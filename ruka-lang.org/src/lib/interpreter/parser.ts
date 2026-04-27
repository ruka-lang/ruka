import { tokenize } from "./tokenizer";
import type { Token } from "./tokens";
import { RukaError } from "./diagnostics";
import type {
	Bind,
	BindPat,
	BindTarget,
	Block,
	Expr,
	Fn,
	For,
	If,
	ListLit,
	Match,
	MatchArm,
	MatchPat,
	Program,
	Range as RangeExpr,
	Receiver,
	RecordLit,
	RecordLitField,
	RecordType,
	Stmt,
	Ty,
	TuplePat,
	VariantCtor,
	VariantTag,
	VariantType,
	While
} from "./ast";

/** Convenience entry point for callers that have raw source. */
export function parseSource(source: string): Program {
	return parse(tokenize(source));
}

/**
 * Parse a token stream into a Program.
 *
 * Block rules:
 *   `do <expr>`        — single-line; NL (or an enclosing `end`/`else`) terminates.
 *   `do <NL> <stmts>`  — multi-line; `end` is required.
 * `else` follows the same rule; `do` after `else` is optional.
 * Ternary: `<expr> if <cond> else <expr>` (right-assoc, lower precedence than `or`).
 */
export function parse(tokens: Token[]): Program {
	let pos = 0;

	const peek = (): Token => tokens[pos]!;
	const check = (kind: string): boolean => tokens[pos]!.kind === kind;

	function eat(kind: string): Token {
		if (!check(kind)) {
			const found = peek();
			throw new RukaError(`Expected '${kind}', got '${found.kind}' ('${found.val}')`, found.line);
		}
		return tokens[pos++]!;
	}

	function tryMatch(...kinds: string[]): Token | null {
		for (const kind of kinds) {
			if (check(kind)) {
				return tokens[pos++]!;
			}
		}
		return null;
	}

	function skipNewlines(): void {
		while (check("NL")) {
			pos++;
		}
	}

	// True when the next non-NL token has the given kind. Used for operators
	// that should chain across line breaks (e.g. `|>` placed on the next line).
	function checkPastNewlines(kind: string): boolean {
		let lookahead = pos;
		while (lookahead < tokens.length && tokens[lookahead]!.kind === "NL") {
			lookahead++;
		}
		return lookahead < tokens.length && tokens[lookahead]!.kind === kind;
	}

	// ── Types ────────────────────────────────────────────────────────────
	function parseType(): Ty {
		skipNewlines();
		const token = peek();
		if (token.kind === "(") {
			eat("(");
			skipNewlines();
			eat(")");
			return { k: "TyUnit", line: token.line };
		}
		if (token.kind === "[") {
			eat("[");
			skipNewlines();
			const elements: Ty[] = [parseType()];
			skipNewlines();
			while (tryMatch(",")) {
				skipNewlines();
				elements.push(parseType());
				skipNewlines();
			}
			eat("]");
			if (elements.length === 1) {
				return { k: "TyArray", elem: elements[0]!, line: token.line };
			}
			return { k: "TyTuple", elems: elements, line: token.line };
		}
		if (token.kind === "?") {
			eat("?");
			eat("(");
			skipNewlines();
			const inner = parseType();
			skipNewlines();
			eat(")");
			return { k: "TyOption", inner, line: token.line };
		}
		if (token.kind === "!") {
			eat("!");
			eat("(");
			skipNewlines();
			const okType = parseType();
			skipNewlines();
			eat(",");
			skipNewlines();
			const errType = parseType();
			skipNewlines();
			eat(")");
			return { k: "TyResult", ok: okType, err: errType, line: token.line };
		}
		if (token.kind === "ID") {
			const name = eat("ID").val as string;
			if ((name === "option" || name === "result") && check("(")) {
				eat("(");
				skipNewlines();
				const first = parseType();
				skipNewlines();
				if (name === "option") {
					eat(")");
					return { k: "TyOption", inner: first, line: token.line };
				}
				eat(",");
				skipNewlines();
				const second = parseType();
				skipNewlines();
				eat(")");
				return { k: "TyResult", ok: first, err: second, line: token.line };
			}
			return { k: "TyName", name, line: token.line };
		}
		throw new RukaError(`Expected type, got '${token.kind}' ('${token.val}')`, token.line);
	}

	// Lookahead: is `(` at current pos the start of a function literal?
	// A function literal is `(params) [-> ReturnType] do ...`.
	function isFnLiteral(): boolean {
		let lookahead = pos + 1;
		let parenDepth = 1;
		while (lookahead < tokens.length && parenDepth > 0) {
			if (tokens[lookahead]!.kind === "(") {
				parenDepth++;
			} else if (tokens[lookahead]!.kind === ")") {
				parenDepth--;
			}
			lookahead++;
		}
		if (tokens[lookahead] && tokens[lookahead]!.kind === "->") {
			lookahead++;
			while (
				lookahead < tokens.length &&
				tokens[lookahead]!.kind !== "do" &&
				tokens[lookahead]!.kind !== "NL" &&
				tokens[lookahead]!.kind !== "EOF"
			) {
				lookahead++;
			}
		}
		return !!tokens[lookahead] && tokens[lookahead]!.kind === "do";
	}

	// ── Top-level ────────────────────────────────────────────────────────
	function parseProgram(): Program {
		const body: Stmt[] = [];
		skipNewlines();
		while (!check("EOF")) {
			body.push(parseStmt());
			skipNewlines();
		}
		return { k: "Program", body };
	}

	// ── Statements ───────────────────────────────────────────────────────
	function parseStmt(): Stmt {
		const letToken = tryMatch("let");
		if (letToken) {
			return parseLet(letToken);
		}

		// Plain assignment: ident = expr
		if (check("ID") && tokens[pos + 1] && tokens[pos + 1]!.kind === "=") {
			const line = peek().line;
			const name = eat("ID").val as string;
			eat("=");
			skipNewlines();
			return { k: "Assign", name, value: parseExpr(), line };
		}

		if (check("break")) {
			const line = peek().line;
			pos++;
			return { k: "Break", line };
		}
		if (check("continue")) {
			const line = peek().line;
			pos++;
			return { k: "Continue", line };
		}
		if (check("return")) {
			// Explicit `return` always requires a payload. Functions that return
			// unit write `return ()` — the bare form is no longer accepted.
			const line = peek().line;
			pos++;
			return { k: "Return", value: parseExpr(), line };
		}

		if (check("for")) {
			return parseFor();
		}

		const line = peek().line;
		return { k: "ExprStmt", expr: parseExpr(), line };
	}

	function parseLet(letToken: Token): Bind {
		// Optional mode prefix: *, &, $, @
		let mode: Bind["mode"] = null;
		if (check("*") || check("&") || check("$") || check("@")) {
			mode = peek().val as Bind["mode"];
			pos++;
		}

		// Tuple/record destructuring: let {a, b, ...} = expr
		if (check("{")) {
			eat("{");
			skipNewlines();
			const destructNames: string[] = [];
			while (!check("}") && !check("EOF")) {
				destructNames.push(eat("ID").val as string);
				skipNewlines();
				if (tryMatch(",")) {
					skipNewlines();
				}
			}
			eat("}");
			eat("=");
			skipNewlines();
			const pattern: TuplePat = { k: "TuplePat", names: destructNames };
			return {
				k: "Bind",
				local: false,
				mode,
				pat: pattern,
				type: null,
				value: parseExpr(),
				line: letToken.line
			};
		}

		const name = eat("ID").val as string;
		const isLocal = /^[A-Z]/.test(name);

		// Optional receiver clause:
		//   (self)         — instance method, receiver type inferred
		//   (self: T)      — instance method, receiver type T
		//   (TypeName)     — static method/value attached to TypeName
		let receiver: Receiver | null = null;
		if (check("(")) {
			eat("(");
			skipNewlines();
			if (check("self")) {
				pos++;
				const selfType = tryMatch(":") ? parseType() : null;
				receiver = { kind: "self", tyAnno: selfType };
			} else if (check("ID")) {
				const receiverTypeName = eat("ID").val as string;
				receiver = { kind: "static", tyName: receiverTypeName };
			} else {
				const found = peek();
				throw new RukaError(
					`Expected 'self' or type name in receiver clause, got '${found.kind}'`,
					found.line
				);
			}
			skipNewlines();
			eat(")");
		}

		const annotation = tryMatch(":") ? parseType() : null;
		eat("=");
		skipNewlines();
		const pattern: BindTarget = { k: "IdentPat", name };
		return {
			k: "Bind",
			local: isLocal,
			mode,
			pat: pattern,
			name,
			type: annotation,
			receiver,
			value: parseExpr(),
			line: letToken.line
		};
	}

	function parseFor(): For {
		const line = peek().line;
		eat("for");
		// Optional binding: `for name in iter` or pattern-less `for iter`.
		let name: string | null = null;
		if (check("ID") && tokens[pos + 1] && tokens[pos + 1]!.kind === "in") {
			name = eat("ID").val as string;
			eat("in");
		}
		const iterable = parseOr(); // no trailing ternary; `do` opens the body
		eat("do");
		const body = parseDoBody();
		if (body.multiline) {
			eat("end");
		} else {
			tryMatch("end");
		}
		return { k: "For", name, iter: iterable, body: body.node.body, line };
	}

	// ── Expressions ──────────────────────────────────────────────────────
	function parseExpr(): Expr {
		if (check("(") && isFnLiteral()) {
			return parseFn();
		}
		if (check("while")) {
			return parseWhile();
		}
		if (check("match")) {
			return parseMatch();
		}
		return parseIf(false);
	}

	// Parse a block body opened by a `do` token already consumed by the caller.
	// Single-line: one statement, terminated by NL/else/end.
	// Multi-line:  `do` followed by NL, then statements until a closing `end`.
	function parseDoBody(): { node: Block; multiline: boolean } {
		if (check("NL")) {
			skipNewlines();
			return { node: { k: "Block", body: parseBlockBody() }, multiline: true };
		}
		const single = parseStmt();
		return { node: { k: "Block", body: [single] }, multiline: false };
	}

	function parseFn(): Fn {
		const line = peek().line;
		eat("(");
		const params: string[] = [];
		const paramTypes: (Ty | null)[] = [];
		const paramModes: (string | null)[] = [];
		skipNewlines();
		while (!check(")") && !check("EOF")) {
			const modeToken = tryMatch("*", "&", "$", "@");
			paramModes.push(modeToken ? modeToken.kind : null);
			if (check("ID")) {
				params.push(eat("ID").val as string);
			}
			paramTypes.push(tryMatch(":") ? parseType() : null);
			skipNewlines();
			if (tryMatch(",")) {
				skipNewlines();
			}
		}
		eat(")");
		const returnType = tryMatch("->") ? parseType() : null;
		eat("do");
		const body = parseDoBody();
		if (body.multiline) {
			eat("end");
		} else {
			tryMatch("end");
		}
		return {
			k: "Fn",
			params,
			paramTypes,
			paramModes,
			returnType,
			body: body.node,
			line
		};
	}

	function parseWhile(): While {
		const line = peek().line;
		eat("while");
		const cond = parseOr(); // no trailing ternary; `do` opens the body
		eat("do");
		const body = parseDoBody();
		if (body.multiline) {
			eat("end");
		} else {
			tryMatch("end");
		}
		return { k: "While", cond, body: body.node.body, line };
	}

	function parsePattern(): MatchPat {
		// Variant pattern: tagName | tagName(binding) | tagName({a, b})
		// Disambiguation: a bare ID before `do`/NL is a variant tag; ID(ID) or
		// ID({...}) are variant patterns with payload; anything else is a guard.
		if (check("ID")) {
			const next = tokens[pos + 1];
			const isBareTag = !next || next.kind === "NL" || next.kind === "do" || next.kind === "EOF";
			const isTagCall = next && next.kind === "(";
			if (isBareTag) {
				return { k: "VariantPat", tag: eat("ID").val as string, binding: null };
			}
			if (isTagCall) {
				let lookahead = pos + 2;
				while (tokens[lookahead] && tokens[lookahead]!.kind === "NL") {
					lookahead++;
				}
				const insideParen = tokens[lookahead];
				if (insideParen && insideParen.kind === "ID") {
					let afterIdent = lookahead + 1;
					while (tokens[afterIdent] && tokens[afterIdent]!.kind === "NL") {
						afterIdent++;
					}
					if (tokens[afterIdent] && tokens[afterIdent]!.kind === ")") {
						// tagName(name) — simple binding
						const tag = eat("ID").val as string;
						eat("(");
						skipNewlines();
						const binding: BindPat = { k: "BindPat", name: eat("ID").val as string };
						skipNewlines();
						eat(")");
						return { k: "VariantPat", tag, binding };
					}
				}
				if (insideParen && insideParen.kind === "{") {
					// tagName({a, b, ...}) — tuple destructuring of payload
					const tag = eat("ID").val as string;
					eat("(");
					skipNewlines();
					eat("{");
					skipNewlines();
					const payloadNames: string[] = [];
					while (!check("}") && !check("EOF")) {
						payloadNames.push(eat("ID").val as string);
						skipNewlines();
						if (tryMatch(",")) {
							skipNewlines();
						}
					}
					eat("}");
					skipNewlines();
					eat(")");
					return {
						k: "VariantPat",
						tag,
						binding: { k: "TuplePat", names: payloadNames }
					};
				}
			}
		}

		// Range pattern: NUM..NUM | NUM..=NUM (integers and chars)
		if (
			(check("NUM") || check("CHAR")) &&
			tokens[pos + 1] &&
			(tokens[pos + 1]!.kind === ".." || tokens[pos + 1]!.kind === "..=")
		) {
			const lo = parsePrimary();
			const inclusive = peek().kind === "..=";
			eat(inclusive ? "..=" : "..");
			const hi = parsePrimary();
			return { k: "RangePat", lo, hi, inclusive };
		}

		// Literal pattern: NUM, STR, CHAR, true, false
		if (
			check("NUM") ||
			check("STR") ||
			check("CHAR") ||
			check("true") ||
			check("false")
		) {
			return { k: "LitPat", expr: parsePrimary() };
		}

		// Guard pattern: boolean expression stopped before `do`.
		return { k: "GuardPat", expr: parseOr() };
	}

	function parseMatch(): Match {
		const line = eat("match").line;
		skipNewlines();
		const subject = parseExpr();
		skipNewlines();
		eat("with");
		skipNewlines();
		const arms: MatchArm[] = [];
		while (!check("else") && !check("end") && !check("EOF")) {
			const pattern = parsePattern();
			skipNewlines();
			eat("do");
			const armBody = parseDoBody();
			if (armBody.multiline) {
				eat("end");
			}
			arms.push({ pat: pattern, body: armBody.node });
			skipNewlines();
		}
		let elseArm: Block | null = null;
		if (tryMatch("else")) {
			skipNewlines();
			const elseBody = parseDoBody();
			if (elseBody.multiline) {
				eat("end");
			}
			elseArm = elseBody.node;
			skipNewlines();
		}
		eat("end");
		return { k: "Match", subject, arms, elseArm, line };
	}

	// `inChain` = this parseIf is the RHS of an enclosing `else if`, so the
	// enclosing call owns the shared trailing `end` (when any branch is multi-line).
	function parseIf(inChain: boolean): Expr {
		const ifToken = tryMatch("if");
		if (!ifToken) {
			return parseTernary();
		}
		const cond = parseOr();
		eat("do");
		const thenParsed = parseDoBody();
		const thenBody = thenParsed.node;
		const thenMultiline = thenParsed.multiline;

		// Allow `else` on a new line regardless of single/multi-line then.
		skipNewlines();
		let elseBody: Block | Expr | null = null;
		let elseMultiline = false;
		if (tryMatch("else")) {
			if (check("if")) {
				const innerIf = parseIf(true);
				elseBody = innerIf;
				elseMultiline = !!(innerIf as If)._multiline;
			} else {
				tryMatch("do"); // `do` after `else` is optional
				const parsedElse = parseDoBody();
				elseBody = parsedElse.node;
				elseMultiline = parsedElse.multiline;
			}
		}

		const multiline = thenMultiline || elseMultiline;
		if (!inChain) {
			skipNewlines();
			if (multiline) {
				eat("end");
			}
			// Single-line if expressions never carry an explicit `end` —
			// one here would belong to the enclosing block.
		}
		return {
			k: "If",
			cond,
			then: thenBody,
			else_: elseBody,
			line: ifToken.line,
			_multiline: multiline
		};
	}

	// Ternary: `<expr> if <cond> else <expr>` (right-assoc, below `or`).
	function parseTernary(): Expr {
		const lhs = parsePipeline();
		if (tryMatch("if")) {
			const cond = parseOr();
			skipNewlines();
			eat("else");
			skipNewlines();
			const rhs = parseTernary();
			return { k: "If", cond, then: lhs, else_: rhs, line: lineOf(lhs) };
		}
		return lhs;
	}

	// Pipeline: `x |> f(a, b)` desugars to `f(x, a, b)`. Left-associative.
	// If the RHS is not a Call (e.g. `x |> f`), synthesize `f(x)`.
	function parsePipeline(): Expr {
		let left: Expr = parseOr();
		while (checkPastNewlines("|>")) {
			skipNewlines();
			pos++;
			skipNewlines();
			const right = parseOr();
			if (right.k === "Call") {
				left = {
					k: "Call",
					callee: right.callee,
					args: [left, ...right.args],
					line: right.line
				};
			} else {
				left = {
					k: "Call",
					callee: right,
					args: [left],
					line: lineOf(right) || lineOf(left)
				};
			}
		}
		return left;
	}

	// Stops at 'end', 'else', or EOF. NL between statements is filler.
	function parseBlockBody(): Stmt[] {
		const stmts: Stmt[] = [];
		skipNewlines();
		while (!check("end") && !check("else") && !check("EOF")) {
			stmts.push(parseStmt());
			skipNewlines();
		}
		return stmts;
	}

	function parseOr(): Expr {
		let left = parseAnd();
		while (check("or")) {
			pos++;
			skipNewlines();
			left = { k: "BinOp", op: "or", left, right: parseAnd() };
		}
		return left;
	}

	function parseAnd(): Expr {
		let left = parseCmp();
		while (check("and")) {
			pos++;
			skipNewlines();
			left = { k: "BinOp", op: "and", left, right: parseCmp() };
		}
		return left;
	}

	function parseCmp(): Expr {
		const left = parseRange();
		const op = tryMatch("==", "!=", "<", ">", "<=", ">=");
		if (op) {
			skipNewlines();
			return { k: "BinOp", op: op.kind as string, left, right: parseRange() };
		}
		return left;
	}

	function parseRange(): Expr {
		const left = parseAdd();
		if (check("..") || check("..=")) {
			const inclusive = peek().kind === "..=";
			const line = peek().line;
			pos++;
			skipNewlines();
			const right = parseAdd();
			const node: RangeExpr = {
				k: "Range",
				start: left,
				end: right,
				inclusive,
				line
			};
			return node;
		}
		return left;
	}

	function parseAdd(): Expr {
		let left = parseMul();
		while (check("+") || check("-")) {
			const op = tokens[pos++]!.kind as string;
			skipNewlines();
			left = { k: "BinOp", op, left, right: parseMul() };
		}
		return left;
	}

	function parseMul(): Expr {
		let left = parsePow();
		while (check("*") || check("/") || check("%")) {
			const op = tokens[pos++]!.kind as string;
			skipNewlines();
			left = { k: "BinOp", op, left, right: parsePow() };
		}
		return left;
	}

	function parsePow(): Expr {
		const left = parseUnary();
		if (check("**")) {
			pos++;
			skipNewlines();
			const right = parsePow(); // right-associative
			return { k: "BinOp", op: "**", left, right };
		}
		return left;
	}

	function parseUnary(): Expr {
		if (tryMatch("-")) {
			skipNewlines();
			return { k: "Unary", op: "-", expr: parseUnary() };
		}
		if (tryMatch("not")) {
			skipNewlines();
			return { k: "Unary", op: "not", expr: parseUnary() };
		}
		return parseCall();
	}

	function parseCall(): Expr {
		let expr: Expr = parsePrimary();
		while (true) {
			if (check("(")) {
				const callLine = peek().line;
				eat("(");
				skipNewlines();
				const args: Expr[] = [];
				while (!check(")") && !check("EOF")) {
					args.push(parseExpr());
					skipNewlines();
					if (tryMatch(",")) {
						skipNewlines();
					}
				}
				eat(")");
				expr = { k: "Call", callee: expr, args, line: callLine };
			} else if (check(".")) {
				const memberLine = peek().line;
				eat(".");
				skipNewlines();
				if (check("{")) {
					// Type-prefixed record literal: Expr.{ field = val, ... }
					eat("{");
					skipNewlines();
					const fields: RecordLitField[] = [];
					while (!check("}") && !check("EOF")) {
						const fieldName = eat("ID").val as string;
						eat("=");
						skipNewlines();
						fields.push({ name: fieldName, value: parseExpr() });
						skipNewlines();
						if (tryMatch(",")) {
							skipNewlines();
						}
					}
					eat("}");
					const node: RecordLit = {
						k: "RecordLit",
						typeName: expr,
						fields,
						line: memberLine
					};
					expr = node;
				} else {
					expr = {
						k: "Member",
						obj: expr,
						prop: eat("ID").val as string,
						line: memberLine
					};
				}
			} else if (check("[")) {
				const indexLine = peek().line;
				eat("[");
				skipNewlines();
				const index = parseExpr();
				skipNewlines();
				eat("]");
				expr = { k: "Index", obj: expr, idx: index, line: indexLine };
			} else {
				break;
			}
		}
		return expr;
	}

	function parsePrimary(): Expr {
		const token = peek();
		if (token.kind === "NUM") {
			pos++;
			const text = token.val as string;
			const isFloat = text.includes(".");
			return { k: "Lit", v: parseFloat(text), isFloat, line: token.line };
		}
		if (token.kind === "CHAR") {
			pos++;
			return { k: "Char", v: token.val as number, line: token.line };
		}
		if (token.kind === "STR") {
			pos++;
			return { k: "Str", raw: token.val as string, line: token.line };
		}
		if (token.kind === "true") {
			pos++;
			return { k: "Lit", v: true, line: token.line };
		}
		if (token.kind === "false") {
			pos++;
			return { k: "Lit", v: false, line: token.line };
		}
		if (token.kind === "ID") {
			pos++;
			return { k: "Ident", name: token.val as string, line: token.line };
		}
		if (token.kind === "self") {
			pos++;
			return { k: "Ident", name: "self", line: token.line };
		}
		if (token.kind === "(") {
			eat("(");
			skipNewlines();
			// `()` — unit literal
			if (check(")")) {
				eat(")");
				return { k: "Unit", line: token.line };
			}
			const inner = parseExpr();
			skipNewlines();
			eat(")");
			return inner;
		}

		// Record type: record { name: Type, ... }
		if (token.kind === "record") {
			pos++;
			skipNewlines();
			eat("{");
			skipNewlines();
			const fields: RecordType["fields"] = [];
			while (!check("}") && !check("EOF")) {
				skipNewlines();
				const fieldName = eat("ID").val as string;
				eat(":");
				skipNewlines();
				fields.push({ name: fieldName, type: parseType() });
				skipNewlines();
				if (tryMatch(",")) {
					skipNewlines();
				}
			}
			eat("}");
			return { k: "RecordType", fields, line: token.line };
		}

		// Variant type: variant { tag, tag: Type, ... }
		if (token.kind === "variant") {
			pos++;
			skipNewlines();
			eat("{");
			skipNewlines();
			const tags: VariantTag[] = [];
			while (!check("}") && !check("EOF")) {
				skipNewlines();
				const tagName = eat("ID").val as string;
				let tagType: Ty | null = null;
				if (tryMatch(":")) {
					skipNewlines();
					tagType = parseType();
				}
				tags.push({ name: tagName, type: tagType });
				skipNewlines();
				if (tryMatch(",")) {
					skipNewlines();
				}
			}
			eat("}");
			const node: VariantType = { k: "VariantType", tags, line: token.line };
			return node;
		}

		// Unqualified variant constructor: .tagName or .tagName(payload)
		if (token.kind === "." && tokens[pos + 1] && tokens[pos + 1]!.kind === "ID") {
			pos++;
			const tag = eat("ID").val as string;
			let payload: Expr | null = null;
			if (check("(")) {
				eat("(");
				payload = parseExpr();
				eat(")");
			}
			const node: VariantCtor = {
				k: "VariantCtor",
				tag,
				payload,
				line: token.line
			};
			return node;
		}

		// Record or array/tuple literal: .{ ... }
		if (token.kind === "." && tokens[pos + 1] && tokens[pos + 1]!.kind === "{") {
			const literalLine = token.line;
			eat(".");
			eat("{");
			skipNewlines();
			// Record literal: .{ name = expr, ... } — distinguished by ID followed by '='
			if (
				!check("}") &&
				check("ID") &&
				tokens[pos + 1] &&
				tokens[pos + 1]!.kind === "="
			) {
				const fields: RecordLitField[] = [];
				while (!check("}") && !check("EOF")) {
					skipNewlines();
					const fieldName = eat("ID").val as string;
					eat("=");
					skipNewlines();
					fields.push({ name: fieldName, value: parseExpr() });
					skipNewlines();
					if (tryMatch(",")) {
						skipNewlines();
					}
				}
				eat("}");
				return { k: "RecordLit", fields, line: literalLine };
			}
			// Array/tuple literal: .{a, b, c}
			const elements: Expr[] = [];
			while (!check("}") && !check("EOF")) {
				elements.push(parseExpr());
				skipNewlines();
				if (tryMatch(",")) {
					skipNewlines();
				}
			}
			eat("}");
			const node: ListLit = {
				k: "List",
				typePrefix: null,
				elements,
				line: literalLine
			};
			return node;
		}

		// Type-prefixed collection literal: [int].{2, 3} or [int, string].{1, "hi"}
		if (token.kind === "[") {
			const prefixLine = token.line;
			const prefix = parseType(); // consumes through `]`
			eat(".");
			eat("{");
			skipNewlines();
			const elements: Expr[] = [];
			while (!check("}") && !check("EOF")) {
				elements.push(parseExpr());
				skipNewlines();
				if (tryMatch(",")) {
					skipNewlines();
				}
			}
			eat("}");
			return { k: "List", typePrefix: prefix, elements, line: prefixLine };
		}

		if (token.kind === "do") {
			eat("do");
			const body = parseDoBody();
			if (body.multiline) {
				eat("end");
			} else {
				tryMatch("end");
			}
			return body.node;
		}

		throw new RukaError(`Unexpected token '${token.kind}' ('${token.val}')`, token.line);
	}

	return parseProgram();
}

/**
 * Best-effort line lookup. Most expression nodes carry a `line`, but `BinOp`,
 * `Unary`, and `Block` don't — recurse into their first child.
 */
function lineOf(node: Expr | Block): number {
	if ("line" in node && typeof (node as { line?: number }).line === "number") {
		return (node as { line: number }).line;
	}
	if (node.k === "BinOp") {
		return lineOf(node.left);
	}
	if (node.k === "Unary") {
		return lineOf(node.expr);
	}
	if (node.k === "Block") {
		return node.body[0] ? (node.body[0] as { line: number }).line : 0;
	}
	return 0;
}
