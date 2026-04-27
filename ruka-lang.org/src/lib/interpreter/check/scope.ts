import type { Block, Expr, Program, Stmt } from "../ast";
import { RukaError } from "../diagnostics";
import { splitInterp } from "../interp";
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
	const top: Scope = new Map();
	for (const b of BUILTINS) top.set(b, false);

	// Hoist top-level binding names (with mutability) so mutually-recursive
	// functions work and forward references to mutable bindings are tracked.
	for (const s of ast.body) {
		if (s.k === "Bind" && !s.receiver) {
			if (s.pat.k === "IdentPat") top.set(s.pat.name, s.mode === "*");
			else if (s.pat.k === "TuplePat") {
				for (const n of s.pat.names) top.set(n, s.mode === "*");
			}
		}
	}

	try {
		for (const s of ast.body) chkStmt(s, top);
		return null;
	} catch (e) {
		if (e instanceof RukaError) return e;
		throw e;
	}
}

function chkStmt(node: Stmt, scope: Scope): void {
	switch (node.k) {
		case "Bind": {
			chkExpr(node.value, scope);
			// Methods/statics don't add a top-level binding — access is via the
			// receiver type (`obj.method` or `Type.static`), not the bare name.
			if (node.receiver) return;
			if (node.pat.k === "IdentPat") scope.set(node.pat.name, node.mode === "*");
			else if (node.pat.k === "TuplePat") {
				for (const n of node.pat.names) scope.set(n, node.mode === "*");
			}
			return;
		}
		case "Assign": {
			if (!scope.has(node.name)) {
				throw new RukaError(`Undefined: ${node.name}`, node.line);
			}
			if (!scope.get(node.name)) {
				throw new RukaError(
					`Cannot assign to immutable binding '${node.name}' (use 'let *${node.name}' to make it mutable)`,
					node.line
				);
			}
			chkExpr(node.value, scope);
			return;
		}
		case "ExprStmt":
			chkExpr(node.expr, scope);
			return;
		case "For": {
			chkExpr(node.iter, scope);
			const fScope: Scope = new Map(scope);
			if (node.name) fScope.set(node.name, false); // loop variable is immutable
			for (const s of node.body) chkStmt(s, fScope);
			return;
		}
		case "Return":
			chkExpr(node.value, scope);
			return;
		case "Break":
		case "Continue":
			// Structural — nothing to resolve.
			return;
	}
}

function chkInterp(raw: string, scope: Scope, line: number): void {
	// Extract each ${...} (balanced braces, nested strings) and statically
	// check it with the enclosing scope. The inner tokenizer restarts its
	// line counter at 1, so any line it emits is meaningless in the outer
	// source — always report on the line of the enclosing string.
	const parts = splitInterp(raw);
	for (const part of parts) {
		if ("interp" in part) {
			try {
				const innerAst = parse(tokenize(part.interp));
				for (const s of innerAst.body) chkStmt(s, scope);
			} catch (e) {
				if (e instanceof RukaError) throw new RukaError(e.message, line);
				throw e;
			}
		}
	}
}

function chkExpr(node: Expr | Block | null | undefined, scope: Scope): void {
	if (!node) return;
	switch (node.k) {
		case "Lit":
		case "Unit":
		case "Char":
		case "RecordType":
		case "VariantType":
			return;
		case "Str":
			chkInterp(node.raw, scope, node.line);
			return;
		case "Ident":
			if (!scope.has(node.name)) {
				throw new RukaError(`Undefined: ${node.name}`, node.line);
			}
			return;
		case "Fn": {
			const fnScope: Scope = new Map(scope);
			node.params.forEach((p, i) => {
				fnScope.set(p, node.paramModes[i] === "*");
			});
			chkExpr(node.body, fnScope);
			return;
		}
		case "Block": {
			const bScope: Scope = new Map(scope);
			for (const s of node.body) chkStmt(s, bScope);
			return;
		}
		case "While": {
			chkExpr(node.cond, scope);
			const wScope: Scope = new Map(scope);
			for (const s of node.body) chkStmt(s, wScope);
			return;
		}
		case "If":
			chkExpr(node.cond, scope);
			chkExpr(node.then, scope);
			if (node.else_) chkExpr(node.else_, scope);
			return;
		case "Call":
			chkExpr(node.callee, scope);
			for (const a of node.args) chkExpr(a, scope);
			return;
		case "Member":
			chkExpr(node.obj, scope);
			// Don't check the property name — resolved on the value at runtime.
			return;
		case "Index":
			chkExpr(node.obj, scope);
			chkExpr(node.idx, scope);
			return;
		case "Range":
			chkExpr(node.start, scope);
			chkExpr(node.end, scope);
			return;
		case "List":
			for (const e of node.elements) chkExpr(e, scope);
			return;
		case "BinOp":
			chkExpr(node.left, scope);
			chkExpr(node.right, scope);
			return;
		case "Unary":
			chkExpr(node.expr, scope);
			return;
		case "VariantCtor":
			if (node.payload) chkExpr(node.payload, scope);
			return;
		case "RecordLit":
			if (node.typeName) chkExpr(node.typeName, scope);
			for (const f of node.fields) chkExpr(f.value, scope);
			return;
		case "Match": {
			chkExpr(node.subject, scope);
			for (const arm of node.arms) {
				const mScope: Scope = new Map(scope);
				if (arm.pat.k === "VariantPat" && arm.pat.binding) {
					if (arm.pat.binding.k === "BindPat") mScope.set(arm.pat.binding.name, false);
					else if (arm.pat.binding.k === "TuplePat") {
						for (const n of arm.pat.binding.names) mScope.set(n, false);
					}
				}
				if (arm.pat.k === "GuardPat") chkExpr(arm.pat.expr, scope);
				if (arm.pat.k === "LitPat") chkExpr(arm.pat.expr, scope);
				if (arm.pat.k === "RangePat") {
					chkExpr(arm.pat.lo, scope);
					chkExpr(arm.pat.hi, scope);
				}
				chkExpr(arm.body, mScope);
			}
			if (node.elseArm) chkExpr(node.elseArm, scope);
			return;
		}
	}
}
