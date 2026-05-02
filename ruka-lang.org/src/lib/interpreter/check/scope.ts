import type { Block, Call, Expression, Program, Statement, StringLiteral } from "../ast";
import { RukaError } from "../diagnostics";
import { splitInterp } from "../interpolator";
import { parse } from "../parser";
import { tokenize } from "../tokenizer";
import { loadModuleAst, resolveImportPath, type ProjectContext } from "../project";

/** Scope value: `true` if the binding is mutable. */
type Scope = Map<string, boolean>;

const BUILTINS = ["ruka", "true", "false", "self"] as const;

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
		topLevel.set(builtin, false);
	}

	// Hoist top-level binding names (with mutability) so mutually-recursive
	// functions work and forward references to mutable bindings are tracked.
	for (const statement of ast.body) {
		if (statement.kind === "Binding" && !statement.receiver) {
			if (statement.pattern.kind === "IdentifierPattern") {
				topLevel.set(statement.pattern.name, statement.mode === "*");
			} else {
				for (const name of statement.pattern.names) {
					topLevel.set(name, statement.mode === "*");
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

function checkStatement(node: Statement, scope: Scope, ctx: ModuleCtx): void {
	switch (node.kind) {
		case "Binding": {
			checkExpression(node.value, scope, ctx);
			// Methods/statics don't add a top-level binding — access is via the
			// receiver type (`obj.method` or `Type.static`), not the bare name.
			if (node.receiver) {
				return;
			}
			if (node.pattern.kind === "IdentifierPattern") {
				scope.set(node.pattern.name, node.mode === "*");
			} else {
				for (const name of node.pattern.names) {
					scope.set(name, node.mode === "*");
				}
			}
			return;
		}
		case "Assign": {
			if (!scope.has(node.name)) {
				throw new RukaError(`Undefined: ${node.name}`, node.line, node.col);
			}
			if (!scope.get(node.name)) {
				throw new RukaError(
					`Cannot assign to immutable binding '${node.name}' (use 'let *${node.name}' to make it mutable)`,
					node.line,
					node.col
				);
			}
			checkExpression(node.value, scope, ctx);
			return;
		}
		case "ExpressionStmt":
			checkExpression(node.expression, scope, ctx);
			return;
		case "For": {
			checkExpression(node.iterable, scope, ctx);
			const forScope: Scope = new Map(scope);
			if (node.name) {
				forScope.set(node.name, false); // loop variable is immutable
			}
			for (const inner of node.body) {
				checkStatement(inner, forScope, ctx);
			}
			return;
		}
		case "Return":
			checkExpression(node.value, scope, ctx);
			return;
		case "Break":
		case "Continue":
			// Structural — nothing to resolve.
			return;
	}
}

function checkInterpolation(
	raw: string,
	scope: Scope,
	line: number,
	col: number,
	ctx: ModuleCtx
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
					checkStatement(statement, scope, ctx);
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
	if (error) throw error;
}

function checkExpression(
	node: Expression | Block | null | undefined,
	scope: Scope,
	ctx: ModuleCtx
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
			checkInterpolation(node.raw, scope, node.line, node.col, ctx);
			return;
		case "Ident":
			if (!scope.has(node.name)) {
				throw new RukaError(`Undefined: ${node.name}`, node.line, node.col);
			}
			return;
		case "FunctionExpr": {
			const functionScope: Scope = new Map(scope);
			node.params.forEach((paramName, index) => {
				functionScope.set(paramName, node.paramModes[index] === "*");
			});
			checkExpression(node.body, functionScope, ctx);
			return;
		}
		case "Block": {
			const blockScope: Scope = new Map(scope);
			for (const statement of node.body) {
				checkStatement(statement, blockScope, ctx);
			}
			return;
		}
		case "While": {
			checkExpression(node.condition, scope, ctx);
			const whileScope: Scope = new Map(scope);
			for (const statement of node.body) {
				checkStatement(statement, whileScope, ctx);
			}
			return;
		}
		case "If":
			checkExpression(node.condition, scope, ctx);
			checkExpression(node.thenBranch, scope, ctx);
			if (node.elseBranch) {
				checkExpression(node.elseBranch, scope, ctx);
			}
			return;
		case "Call":
			if (isRukaImportCall(node)) {
				checkImportCall(node, ctx);
				return;
			}
			checkExpression(node.callee, scope, ctx);
			for (const arg of node.args) {
				checkExpression(arg, scope, ctx);
			}
			return;
		case "Member":
			checkExpression(node.object, scope, ctx);
			// Don't check the property name — resolved on the value at runtime.
			return;
		case "Index":
			checkExpression(node.object, scope, ctx);
			checkExpression(node.index, scope, ctx);
			return;
		case "Range":
			checkExpression(node.start, scope, ctx);
			checkExpression(node.end, scope, ctx);
			return;
		case "ListLiteral":
			for (const element of node.elements) {
				checkExpression(element, scope, ctx);
			}
			return;
		case "BinaryOp":
			checkExpression(node.left, scope, ctx);
			checkExpression(node.right, scope, ctx);
			return;
		case "UnaryOp":
			checkExpression(node.expression, scope, ctx);
			return;
		case "VariantConstructor":
			if (node.payload) {
				checkExpression(node.payload, scope, ctx);
			}
			return;
		case "RecordLiteral":
			if (node.typeName) {
				checkExpression(node.typeName, scope, ctx);
			}
			for (const field of node.fields) {
				checkExpression(field.value, scope, ctx);
			}
			return;
		case "Match": {
			checkExpression(node.subject, scope, ctx);
			for (const arm of node.arms) {
				const armScope: Scope = new Map(scope);
				if (arm.pattern.kind === "VariantPattern" && arm.pattern.binding) {
					if (arm.pattern.binding.kind === "BindingPattern") {
						armScope.set(arm.pattern.binding.name, false);
					} else {
						for (const name of arm.pattern.binding.names) {
							armScope.set(name, false);
						}
					}
				}
				if (arm.pattern.kind === "GuardPattern") {
					checkExpression(arm.pattern.expression, scope, ctx);
				}
				if (arm.pattern.kind === "LiteralPattern") {
					checkExpression(arm.pattern.expression, scope, ctx);
				}
				if (arm.pattern.kind === "RangePattern") {
					checkExpression(arm.pattern.low, scope, ctx);
					checkExpression(arm.pattern.high, scope, ctx);
				}
				checkExpression(arm.body, armScope, ctx);
			}
			if (node.elseArm) {
				checkExpression(node.elseArm, scope, ctx);
			}
			return;
		}
	}
}
