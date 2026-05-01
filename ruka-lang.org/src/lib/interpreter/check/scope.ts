import type { Block, Expression, Program, Statement } from "../ast";
import { RukaError } from "../diagnostics";
import { splitInterp } from "../interpolator";
import { parse } from "../parser";
import { tokenize } from "../tokenizer";

/** Scope value: `true` if the binding is mutable. */
type Scope = Map<string, boolean>;

const BUILTINS = ["ruka", "true", "false", "self"] as const;

/**
 * Walk the AST checking that every identifier reference resolves to a
 * binding in scope, and that assignments only target mutable bindings.
 *
 * Returns the first violation as a RukaError, or null if the program is clean.
 */
export function checkScope(ast: Program): RukaError | null {
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
			} else if (statement.pattern.kind === "TuplePattern") {
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
			checkStatement(statement, topLevel);
		}
		return null;
	} catch (error) {
		if (error instanceof RukaError) {
			return error;
		}
		throw error;
	}
}

function checkStatement(node: Statement, scope: Scope): void {
	switch (node.kind) {
		case "Binding": {
			checkExpression(node.value, scope);
			// Methods/statics don't add a top-level binding — access is via the
			// receiver type (`obj.method` or `Type.static`), not the bare name.
			if (node.receiver) {
				return;
			}
			if (node.pattern.kind === "IdentifierPattern") {
				scope.set(node.pattern.name, node.mode === "*");
			} else if (node.pattern.kind === "TuplePattern") {
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
			checkExpression(node.value, scope);
			return;
		}
		case "ExpressionStmt":
			checkExpression(node.expression, scope);
			return;
		case "For": {
			checkExpression(node.iterable, scope);
			const forScope: Scope = new Map(scope);
			if (node.name) {
				forScope.set(node.name, false); // loop variable is immutable
			}
			for (const inner of node.body) {
				checkStatement(inner, forScope);
			}
			return;
		}
		case "Return":
			checkExpression(node.value, scope);
			return;
		case "Break":
		case "Continue":
			// Structural — nothing to resolve.
			return;
	}
}

function checkInterpolation(raw: string, scope: Scope, line: number, col: number): void {
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
					checkStatement(statement, scope);
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

function checkExpression(
	node: Expression | Block | null | undefined,
	scope: Scope
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
			checkInterpolation(node.raw, scope, node.line, node.col);
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
			checkExpression(node.body, functionScope);
			return;
		}
		case "Block": {
			const blockScope: Scope = new Map(scope);
			for (const statement of node.body) {
				checkStatement(statement, blockScope);
			}
			return;
		}
		case "While": {
			checkExpression(node.condition, scope);
			const whileScope: Scope = new Map(scope);
			for (const statement of node.body) {
				checkStatement(statement, whileScope);
			}
			return;
		}
		case "If":
			checkExpression(node.condition, scope);
			checkExpression(node.thenBranch, scope);
			if (node.elseBranch) {
				checkExpression(node.elseBranch, scope);
			}
			return;
		case "Call":
			checkExpression(node.callee, scope);
			for (const arg of node.args) {
				checkExpression(arg, scope);
			}
			return;
		case "Member":
			checkExpression(node.object, scope);
			// Don't check the property name — resolved on the value at runtime.
			return;
		case "Index":
			checkExpression(node.object, scope);
			checkExpression(node.index, scope);
			return;
		case "Range":
			checkExpression(node.start, scope);
			checkExpression(node.end, scope);
			return;
		case "ListLiteral":
			for (const element of node.elements) {
				checkExpression(element, scope);
			}
			return;
		case "BinaryOp":
			checkExpression(node.left, scope);
			checkExpression(node.right, scope);
			return;
		case "UnaryOp":
			checkExpression(node.expression, scope);
			return;
		case "VariantConstructor":
			if (node.payload) {
				checkExpression(node.payload, scope);
			}
			return;
		case "RecordLiteral":
			if (node.typeName) {
				checkExpression(node.typeName, scope);
			}
			for (const field of node.fields) {
				checkExpression(field.value, scope);
			}
			return;
		case "Match": {
			checkExpression(node.subject, scope);
			for (const arm of node.arms) {
				const armScope: Scope = new Map(scope);
				if (arm.pattern.kind === "VariantPattern" && arm.pattern.binding) {
					if (arm.pattern.binding.kind === "BindingPattern") {
						armScope.set(arm.pattern.binding.name, false);
					} else if (arm.pattern.binding.kind === "TuplePattern") {
						for (const name of arm.pattern.binding.names) {
							armScope.set(name, false);
						}
					}
				}
				if (arm.pattern.kind === "GuardPattern") {
					checkExpression(arm.pattern.expression, scope);
				}
				if (arm.pattern.kind === "LiteralPattern") {
					checkExpression(arm.pattern.expression, scope);
				}
				if (arm.pattern.kind === "RangePattern") {
					checkExpression(arm.pattern.low, scope);
					checkExpression(arm.pattern.high, scope);
				}
				checkExpression(arm.body, armScope);
			}
			if (node.elseArm) {
				checkExpression(node.elseArm, scope);
			}
			return;
		}
	}
}
