import type { Block, Call, Expression, Program, Statement, StringLiteral } from "../ast";
import { RukaError } from "../diagnostics";
import { splitInterp } from "../interpolator";
import { parse } from "../parser";
import { tokenize } from "../tokenizer";
import { loadModuleAst, resolveImportPath, type ProjectContext } from "../project";
import { PRIMITIVE_KINDS } from "./type";

/** Scope entry: mutability flag + whether the naming uses `@` mode (local/non-escaping). */
type ScopeEntry = { mutable: boolean; local: boolean; capturedLocal?: boolean };
type Scope = Map<string, ScopeEntry>;

// Primitive type names can be used as first-class values in comptime contexts.
const BUILTINS: ReadonlyArray<string> = [
	"ruka",
	"true",
	"false",
	"self",
	"type",
	...PRIMITIVE_KINDS,
];

type ModuleCtx = {
	project: ProjectContext;
	path: string;
} | null;

/**
 * Walk the AST checking that every identifier reference resolves to a
 * binding in scope, and that assignments only target mutable bindings.
 * When `ctx` is supplied, `import("./file.ruka")` calls also recursively
 * scope-check the referenced module.
 *
 * Returns the first violation as a RukaError, or null if the program is clean.
 */
export function checkScope(
	ast: Program,
	ctx?: ProjectContext,
	path?: string
): RukaError | null {
	const moduleCtx: ModuleCtx = ctx ? { project: ctx, path: path ?? "" } : null;
	if (moduleCtx) {
		moduleCtx.project.scopeChecked.add(moduleCtx.path);
		moduleCtx.project.visitingScope.add(moduleCtx.path);
	}

	const topLevel: Scope = new Map();
	for (const builtin of BUILTINS) {
		topLevel.set(builtin, { mutable: false, local: false });
	}

	// Hoist top-level binding names (with mutability) so mutually-recursive
	// functions work and forward references to mutable bindings are tracked.
	for (const statement of ast.body) {
		if (statement.kind === "Binding" && !statement.receiver) {
			const mutable = statement.mode === "*";
			if (statement.pattern.kind === "IdentifierPattern") {
				topLevel.set(statement.pattern.name, { mutable, local: false });
			} else {
				for (const name of statement.pattern.names) {
					topLevel.set(name, { mutable, local: false });
				}
			}
			// Hoist variant constructor tag names so bare calls like `tag(val)` resolve.
			if (statement.value.kind === "VariantType") {
				for (const tag of statement.value.tags) {
					topLevel.set(tag.name, { mutable: false, local: false });
				}
			}
		}
	}

	try {
		for (const statement of ast.body) {
			if (statement.kind !== "Binding") {
				return new RukaError(
					`Only declarations are allowed at the top level`,
					statement.line,
					statement.col
				);
			}
			checkStatement(statement, topLevel, moduleCtx);
		}
		return null;
	} catch (error) {
		if (error instanceof RukaError) {
			if (moduleCtx && !error.path) error.path = moduleCtx.path;
			return error;
		}
		throw error;
	} finally {
		if (moduleCtx) {
			moduleCtx.project.visitingScope.delete(moduleCtx.path);
		}
	}
}

function checkStatement(
	node: Statement,
	scope: Scope,
	ctx: ModuleCtx,
	insideFunction = false
): void {
	switch (node.kind) {
		case "Binding": {
			checkExpression(node.value, scope, ctx, insideFunction);
			// Methods/statics don't add a top-level binding — access is via the
			// receiver type (`obj.method` or `Type.static`), not the bare name.
			if (node.receiver) {
				return;
			}
			const mutable = node.mode === "*";
			// `@`-mode namings only restrict capture when declared inside a function body.
			const isLocal = insideFunction && node.mode === "@";
			if (node.pattern.kind === "IdentifierPattern") {
				scope.set(node.pattern.name, { mutable, local: isLocal });
			} else {
				for (const name of node.pattern.names) {
					scope.set(name, { mutable, local: isLocal });
				}
			}
			// Add variant constructor tag names when a variant type is bound locally.
			if (node.value.kind === "VariantType") {
				for (const tag of node.value.tags) {
					scope.set(tag.name, { mutable: false, local: false });
				}
			}
			return;
		}
		case "Assign": {
			if (!scope.has(node.name)) {
				throw new RukaError(`Undefined: ${node.name}`, node.line, node.col);
			}
			if (!scope.get(node.name)!.mutable) {
				throw new RukaError(
					`Cannot assign to immutable binding '${node.name}' (use 'let *${node.name}' to make it mutable)`,
					node.line,
					node.col
				);
			}
			checkExpression(node.value, scope, ctx, insideFunction);
			return;
		}
		case "ComplexAssign":
			checkExpression(node.target, scope, ctx, insideFunction);
			checkExpression(node.value, scope, ctx, insideFunction);
			return;
		case "ExpressionStmt":
			checkExpression(node.expression, scope, ctx, insideFunction);
			return;
		case "For": {
			checkExpression(node.iterable, scope, ctx, insideFunction);
			const forScope: Scope = new Map(scope);
			if (node.name) {
				forScope.set(node.name, { mutable: false, local: false });
			} else if (node.tuplePattern) {
				for (const patternName of node.tuplePattern) {
					forScope.set(patternName, { mutable: false, local: false });
				}
			} else if (node.matchPattern) {
				bindPatternNames(node.matchPattern, forScope);
			}
			for (const inner of node.body) {
				checkStatement(inner, forScope, ctx, insideFunction);
			}
			return;
		}
		case "Return":
			checkExpression(node.value, scope, ctx, insideFunction);
			return;
		case "Break":
		case "Continue":
			// Structural — nothing to resolve.
			return;
		case "Defer":
			checkExpression(node.expression, scope, ctx, insideFunction);
			return;
	}
}

function bindPatternNames(pattern: import("../ast").MatchPattern, scope: Scope): void {
	if (pattern.kind === "VariantPattern" && pattern.binding) {
		if (pattern.binding.kind === "BindingPattern") {
			scope.set(pattern.binding.name, { mutable: false, local: false });
		} else {
			for (const name of pattern.binding.names) {
				scope.set(name, { mutable: false, local: false });
			}
		}
	}
}

function checkInterpolation(
	raw: string,
	scope: Scope,
	line: number,
	col: number,
	ctx: ModuleCtx,
	insideFunction: boolean
): void {
	// Extract each ${...} (balanced braces, nested strings) and statically
	// check it with the enclosing scope. The inner tokenizer restarts its
	// line counter at 1, so any line it emits is meaningless in the outer
	// source — always report on the line of the enclosing string.
	const parts = splitInterp(raw);
	for (const part of parts) {
		if ("interp" in part) {
			try {
				const innerAst = parse(tokenize(part.interp));
				for (const statement of innerAst.body) {
					checkStatement(statement, scope, ctx, insideFunction);
				}
			} catch (error) {
				if (error instanceof RukaError) {
					throw new RukaError(error.message, line, col);
				}
				throw error;
			}
		}
	}
}

/**
 * `ruka.import(...)` is the only call shape the scope/type checkers treat
 * specially: a Member access on the `ruka` builtin module whose property is
 * `import`. Other `ruka.*` calls fall through to normal member-resolution.
 */
export function isRukaImportCall(node: Call): boolean {
	return (
		node.callee.kind === "Member" &&
		node.callee.object.kind === "Ident" &&
		node.callee.object.name === "ruka" &&
		node.callee.property === "import"
	);
}

function checkImportCall(node: Call, ctx: ModuleCtx): void {
	if (!ctx) {
		throw new RukaError(
			"ruka.import(...) is only available when checking a project",
			node.line,
			node.col
		);
	}

	if (node.args.length !== 1 || node.args[0]!.kind !== "StringLiteral") {
		throw new RukaError(
			"ruka.import(...) takes a single string literal path",
			node.line,
			node.col
		);
	}

	const raw = (node.args[0] as StringLiteral).raw;
	// Reject interpolated paths — resolution must be statically decidable.
	if (raw.includes("${")) {
		throw new RukaError(
			"import path must be a plain string literal (no interpolation)",
			node.line,
			node.col
		);
	}

	// `raw` is the string body without the surrounding quotes (the
	// tokenizer strips them).
	const resolved = resolveImportPath(ctx.path, raw);
	if (resolved === null) {
		throw new RukaError(`invalid import path: ${raw}`, node.line, node.col);
	}

	if (!ctx.project.sources.has(resolved)) {
		throw new RukaError(
			`module not found: ${resolved}`,
			node.line,
			node.col
		);
	}

	if (!resolved.endsWith(".ruka")) {
		throw new RukaError(
			`only .ruka files can be imported (got ${resolved})`,
			node.line,
			node.col
		);
	}

	if (ctx.project.scopeChecked.has(resolved)) return;

	if (ctx.project.visitingScope.has(resolved)) {
		// Cyclic import — the in-flight module already has its top-level
		// names hoisted, so further descent isn't needed for scope.
		return;
	}

	const importedAst = loadModuleAst(ctx.project, resolved);
	const error = checkScope(importedAst, ctx.project, resolved);
	if (error) {
		if (error.importLine === undefined) {
			error.importLine = node.line;
			error.importCol = node.col;
		}
		throw error;
	}
}

function checkExpression(
	node: Expression | Block | null | undefined,
	scope: Scope,
	ctx: ModuleCtx,
	insideFunction = false
): void {
	if (!node) {
		return;
	}
	switch (node.kind) {
		case "Literal":
		case "Unit":
		case "CharLiteral":
		case "RecordType":
		case "VariantType":
			return;
		case "StringLiteral":
			checkInterpolation(node.raw, scope, node.line, node.col, ctx, insideFunction);
			return;
		case "Ident":
			if (!scope.has(node.name)) {
				throw new RukaError(`Undefined: ${node.name}`, node.line, node.col);
			}
			if (scope.get(node.name)!.capturedLocal) {
				throw new RukaError(
					`cannot capture @-mode naming '${node.name}'`,
					node.line,
					node.col
				);
			}
			return;
		case "FunctionExpr": {
			const functionScope: Scope = new Map();
			// Copy outer scope, marking function-scope locals as capturedLocal since
			// closures cannot safely reference stack-frame bindings that outlive them.
			for (const [name, entry] of scope) {
				if (entry.local) {
					functionScope.set(name, { mutable: entry.mutable, local: false, capturedLocal: true });
				} else {
					functionScope.set(name, entry);
				}
			}
			node.params.forEach((paramName, index) => {
				functionScope.set(paramName, { mutable: node.paramModes[index] === "*", local: false });
			});
			checkExpression(node.body, functionScope, ctx, true);
			return;
		}
		case "Block": {
			const blockScope: Scope = new Map(scope);
			for (const statement of node.body) {
				checkStatement(statement, blockScope, ctx, insideFunction);
			}
			return;
		}
		case "While": {
			checkExpression(node.condition, scope, ctx, insideFunction);
			const whileScope: Scope = new Map(scope);
			for (const statement of node.body) {
				checkStatement(statement, whileScope, ctx, insideFunction);
			}
			return;
		}
		case "If":
			checkExpression(node.condition, scope, ctx, insideFunction);
			checkExpression(node.thenBranch, scope, ctx, insideFunction);
			if (node.elseBranch) {
				checkExpression(node.elseBranch, scope, ctx, insideFunction);
			}
			return;
		case "Call":
			if (isRukaImportCall(node)) {
				checkImportCall(node, ctx);
				return;
			}
			checkExpression(node.callee, scope, ctx, insideFunction);
			for (const arg of node.args) {
				checkExpression(arg, scope, ctx, insideFunction);
			}
			return;
		case "Member":
			checkExpression(node.object, scope, ctx, insideFunction);
			// Don't check the property name — resolved on the value at runtime.
			return;
		case "Index":
			checkExpression(node.object, scope, ctx, insideFunction);
			checkExpression(node.index, scope, ctx, insideFunction);
			return;
		case "Range":
			checkExpression(node.start, scope, ctx, insideFunction);
			checkExpression(node.end, scope, ctx, insideFunction);
			return;
		case "ListLiteral":
			for (const element of node.elements) {
				checkExpression(element, scope, ctx, insideFunction);
			}
			return;
		case "ArrayComp": {
			checkExpression(node.iterable, scope, ctx, insideFunction);
			const compScope: Scope = new Map(scope);
			if (node.name) {
				compScope.set(node.name, { mutable: false, local: false });
			} else if (node.tuplePattern) {
				for (const patternName of node.tuplePattern) {
					compScope.set(patternName, { mutable: false, local: false });
				}
			}
			checkExpression(node.body, compScope, ctx, insideFunction);
			if (node.filter) checkExpression(node.filter, compScope, ctx, insideFunction);
			return;
		}
		case "MapLiteral":
			for (const entry of node.entries) {
				checkExpression(entry.key, scope, ctx, insideFunction);
				checkExpression(entry.value, scope, ctx, insideFunction);
			}
			return;
		case "MapComp": {
			checkExpression(node.iterable, scope, ctx, insideFunction);
			const mapCompScope: Scope = new Map(scope);
			if (node.name) {
				mapCompScope.set(node.name, { mutable: false, local: false });
			} else if (node.tuplePattern) {
				for (const patternName of node.tuplePattern) {
					mapCompScope.set(patternName, { mutable: false, local: false });
				}
			}
			checkExpression(node.keyBody, mapCompScope, ctx, insideFunction);
			checkExpression(node.valueBody, mapCompScope, ctx, insideFunction);
			if (node.filter) checkExpression(node.filter, mapCompScope, ctx, insideFunction);
			return;
		}
		case "BehaviourType":
			return;
		case "Cast":
			checkExpression(node.value, scope, ctx, insideFunction);
			return;
		case "BinaryOp":
			checkExpression(node.left, scope, ctx, insideFunction);
			checkExpression(node.right, scope, ctx, insideFunction);
			return;
		case "UnaryOp":
			checkExpression(node.expression, scope, ctx, insideFunction);
			return;
		case "VariantConstructor":
			if (node.payload) {
				checkExpression(node.payload, scope, ctx, insideFunction);
			}
			return;
		case "RecordLiteral":
			if (node.typeName) {
				checkExpression(node.typeName, scope, ctx, insideFunction);
			}
			for (const field of node.fields) {
				checkExpression(field.value, scope, ctx, insideFunction);
			}
			return;
		case "Match": {
			checkExpression(node.subject, scope, ctx, insideFunction);
			for (const arm of node.arms) {
				const armScope: Scope = new Map(scope);
				bindPatternNames(arm.pattern, armScope);
				if (arm.pattern.kind === "GuardPattern") {
					checkExpression(arm.pattern.expression, scope, ctx, insideFunction);
				}
				if (arm.pattern.kind === "LiteralPattern") {
					checkExpression(arm.pattern.expression, scope, ctx, insideFunction);
				}
				if (arm.pattern.kind === "RangePattern") {
					checkExpression(arm.pattern.low, scope, ctx, insideFunction);
					checkExpression(arm.pattern.high, scope, ctx, insideFunction);
				}
				checkExpression(arm.body, armScope, ctx, insideFunction);
			}
			if (node.elseArm) {
				checkExpression(node.elseArm, scope, ctx, insideFunction);
			}
			return;
		}
	}
}
