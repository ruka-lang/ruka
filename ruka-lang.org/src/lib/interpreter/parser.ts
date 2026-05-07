import { tokenize } from "./tokenizer";
import type { Token } from "./tokens";
import { RukaError } from "./diagnostics";
import type {
	ArrayComp,
	BehaviourMethod,
	BehaviourType,
	Binding,
	BindingPattern,
	Block,
	Cast,
	ComplexAssign,
	Defer,
	Expression,
	For,
	FunctionExpr,
	If,
	Index,
	LetPattern,
	ListLiteral,
	MapComp,
	MapLiteral,
	MapLiteralEntry,
	Match,
	MatchArm,
	MatchPattern,
	Member,
	Program,
	Range,
	Receiver,
	RecordLiteral,
	RecordLiteralField,
	RecordType,
	Statement,
	TuplePattern,
	TypeExpr,
	VariantConstructor,
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
 *   `do <expression>`       — single-line; NL (or an enclosing `end`/`else`) terminates.
 *   `do <NL> <statements>`  — multi-line; `end` is required.
 * `else` follows the same rule; `do` after `else` is optional.
 * Ternary: `<expression> if <condition> else <expression>` (right-assoc, lower precedence than `or`).
 */
export function parse(tokens: Token[]): Program {
	let pos = 0;

	const peek = (): Token => tokens[pos]!;
	const check = (kind: string): boolean => tokens[pos]!.kind === kind;

	function eat(kind: string): Token {
		if (!check(kind)) {
			const found = peek();
			throw new RukaError(
				`Expected '${kind}', got '${found.kind}' ('${found.value}')`,
				found.line,
				found.col
			);
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

	// Read a comma-separated list of identifiers up to `close`. Used by
	// both the let-binding destructure (`let (a, b) = …`, `let {a, b}
	// = …`) and the variant-payload destructure (`tag(a, b)`,
	// `tag({a, b})`). Caller is responsible for having already eaten
	// the opening bracket.
	function parseDestructureNames(close: string): string[] {
		skipNewlines();
		const names: string[] = [];
		while (!check(close) && !check("EOF")) {
			names.push(eat("ID").value as string);
			skipNewlines();
			if (tryMatch(",")) skipNewlines();
		}
		eat(close);
		return names;
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

	// ── Type expressions ─────────────────────────────────────────────────
	function parseType(): TypeExpr {
		skipNewlines();
		const token = peek();
		if (token.kind === "(") {
			eat("(");
			skipNewlines();
			if (check(")")) {
				eat(")");
				return { kind: "UnitType", line: token.line, col: token.col };
			}
			// Multi-element: (T, U, ...) → TupleType; single element: (T) → T
			const first = parseType();
			skipNewlines();
			if (!check(",")) {
				eat(")");
				return first;
			}
			const elements: TypeExpr[] = [first];
			while (tryMatch(",")) {
				skipNewlines();
				elements.push(parseType());
				skipNewlines();
			}
			eat(")");
			return { kind: "TupleType", elements, line: token.line, col: token.col };
		}
		if (token.kind === "[") {
			eat("[");
			skipNewlines();
			const first = parseType();
			skipNewlines();
			// Map type: [K => V]
			if (check("=>")) {
				eat("=>");
				skipNewlines();
				const valueType = parseType();
				skipNewlines();
				eat("]");
				return {
					kind: "MapType",
					key: first,
					value: valueType,
					line: token.line,
					col: token.col
				};
			}
			const elements: TypeExpr[] = [first];
			skipNewlines();
			while (tryMatch(",")) {
				skipNewlines();
				elements.push(parseType());
				skipNewlines();
			}
			eat("]");
			if (elements.length === 1) {
				return {
					kind: "ArrayType",
					element: elements[0]!,
					line: token.line,
					col: token.col
				};
			}
			return { kind: "TupleType", elements, line: token.line, col: token.col };
		}
		if (token.kind === "?") {
			eat("?");
			eat("(");
			skipNewlines();
			const inner = parseType();
			skipNewlines();
			eat(")");
			return { kind: "OptionType", inner, line: token.line, col: token.col };
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
			return {
				kind: "ResultType",
				ok: okType,
				err: errType,
				line: token.line,
				col: token.col
			};
		}
		if (token.kind === "ID") {
			const name = eat("ID").value as string;
			if ((name === "option" || name === "result") && check("(")) {
				eat("(");
				skipNewlines();
				const first = parseType();
				skipNewlines();
				if (name === "option") {
					eat(")");
					return { kind: "OptionType", inner: first, line: token.line, col: token.col };
				}
				eat(",");
				skipNewlines();
				const second = parseType();
				skipNewlines();
				eat(")");
				return {
					kind: "ResultType",
					ok: first,
					err: second,
					line: token.line,
					col: token.col
				};
			}
			return { kind: "NamedType", name, line: token.line, col: token.col };
		}
		throw new RukaError(
			`Expected type, got '${token.kind}' ('${token.value}')`,
			token.line,
			token.col
		);
	}

	// Lookahead: is `(` at current pos the start of a function literal?
	// A function literal is `(params) [-> ReturnType] do ...`.
	function isFunctionLiteral(): boolean {
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

	// Lookahead from the current position (after `{` has been consumed and
	// newlines skipped): is this a record literal rather than an array literal?
	//
	// True if the content starts with `ID =` (explicit), contains `ID =` anywhere
	// (mixed shorthand + explicit), or every element is a bare identifier (pure shorthand).
	function isRecordLiteralStart(): boolean {
		if (tokens[pos + 1]?.kind === "=") return true;

		// Scan forward: if any element has `ID =`, it's a record. If all elements
		// are bare IDs (no `=`), it's pure shorthand. If a non-ID appears, it's not.
		let i = pos;
		while (i < tokens.length) {
			const kind = tokens[i]!.kind;
			if (kind === "}" || kind === "EOF") return true;
			if (kind === "NL") { i++; continue; }
			if (kind !== "ID") return false;
			i++;
			const next = tokens[i]?.kind;
			// Explicit field: ID = value
			if (next === "=") return true;
			// Shorthand or separator
			if (next === "," || next === "NL" || next === "}") {
				if (next === ",") i++;
				continue;
			}
			return false;
		}
		return false;
	}

	// Lookahead when pos points AT `{` (not yet consumed):
	// same rules as isRecordLiteralStart() but starts scanning one token ahead.
	// Returns true if the brace content looks like a record literal
	// (explicit `ID =`, pure shorthand `ID ,/}`, or mixed).
	function isRecordLiteralAtBrace(): boolean {
		let i = pos + 1; // first token inside the brace
		while (i < tokens.length) {
			const kind = tokens[i]!.kind;
			if (kind === "}" || kind === "EOF") return true;
			if (kind === "NL") { i++; continue; }
			if (kind !== "ID") return false;
			i++;
			const next = tokens[i]?.kind;
			// Explicit field: ID =
			if (next === "=") return true;
			// Shorthand or more elements: ID , / ID NL / ID }
			if (next === "," || next === "NL" || next === "}") {
				if (next === ",") i++;
				continue;
			}
			return false;
		}
		return false;
	}

	// ── Top-level ────────────────────────────────────────────────────────
	function parseProgram(): Program {
		const body: Statement[] = [];
		skipNewlines();
		while (!check("EOF")) {
			body.push(parseStatement());
			skipNewlines();
		}
		return { kind: "Program", body };
	}

	// ── Statements ───────────────────────────────────────────────────────
	function parseStatement(): Statement {
		const letToken = tryMatch("let");
		if (letToken) {
			return parseLet(letToken, false);
		}

		// `local` and `test` declare bindings with local=true.
		const localToken = tryMatch("local", "test");
		if (localToken) {
			return parseLet(localToken, true);
		}

		if (check("defer")) {
			const line = peek().line;
			const col = peek().col;
			pos++;
			const expression = parseExpression();
			return { kind: "Defer", expression, line, col } satisfies Defer;
		}

		// Assignments: `name = expr`, `name.field = expr`, `name[i] = expr`, etc.
		// Speculatively parse a member/index chain to detect the `=` that follows
		// lvalue targets. If no `=` is found, backtrack and parse as an expression.
		if (check("ID") || check("self")) {
			const savedPos = pos;
			const line = peek().line;
			const col = peek().col;
			const rootTok = tokens[pos]!;
			pos++;
			let lvalue: Expression = {
				kind: "Ident",
				name: rootTok.value as string,
				line: rootTok.line,
				col: rootTok.col
			};

			// Consume member and index accesses that could form the lvalue chain.
			while (true) {
				if (check(".") && tokens[pos + 1] && tokens[pos + 1]!.kind !== "{") {
					const memberLine = peek().line;
					const memberCol = peek().col;
					eat(".");
					skipNewlines();
					lvalue = {
						kind: "Member",
						object: lvalue,
						property: eat("ID").value as string,
						line: memberLine,
						col: memberCol
					};
				} else if (check("[")) {
					const indexLine = peek().line;
					const indexCol = peek().col;
					eat("[");
					skipNewlines();
					const index = parseExpression();
					skipNewlines();
					eat("]");
					lvalue = { kind: "Index", object: lvalue, index, line: indexLine, col: indexCol };
				} else {
					break;
				}
			}

			if (check("=")) {
				eat("=");
				skipNewlines();
				const value = parseExpression();
				if (lvalue.kind === "Ident") {
					return { kind: "Assign", name: lvalue.name, value, line, col };
				}
				return {
					kind: "ComplexAssign",
					target: lvalue as Member | Index,
					value,
					line,
					col
				} satisfies ComplexAssign;
			}

			// Not an assignment — restore position and fall through to expression statement.
			pos = savedPos;
		}

		if (check("break")) {
			const line = peek().line;
			const col = peek().col;
			pos++;
			return { kind: "Break", line, col };
		}
		if (check("continue")) {
			const line = peek().line;
			const col = peek().col;
			pos++;
			return { kind: "Continue", line, col };
		}
		if (check("return")) {
			// Explicit `return` always requires a payload. Functions that return
			// unit write `return ()` — the bare form is no longer accepted.
			const line = peek().line;
			const col = peek().col;
			pos++;
			return { kind: "Return", value: parseExpression(), line, col };
		}

		if (check("for")) {
			return parseFor();
		}

		const line = peek().line;
		const col = peek().col;
		return { kind: "ExpressionStmt", expression: parseExpression(), line, col };
	}

	function parseLet(letToken: Token, forcedLocal: boolean): Binding {
		// Optional mode prefix: *, &, $, @
		let mode: Binding["mode"] = null;
		if (check("*") || check("&") || check("$") || check("@")) {
			mode = peek().value as Binding["mode"];
			pos++;
		}

		// Destructuring patterns:
		//   let (a, b, …) = expression  — tuple, positional
		//   let {x, y, …} = expression  — record, by field name (nominal)
		if (check("(") || check("{")) {
			const isRecord = check("{");
			const close = isRecord ? "}" : ")";
			pos++;
			const destructNames = parseDestructureNames(close);
			eat("=");
			skipNewlines();
			const pattern: LetPattern = isRecord
				? { kind: "RecordPattern", names: destructNames }
				: { kind: "TuplePattern", names: destructNames };
			return {
				kind: "Binding",
				local: false,
				mode,
				pattern,
				type: null,
				value: parseExpression(),
				line: letToken.line,
				col: letToken.col
			};
		}

		const name = eat("ID").value as string;
		const isLocal = forcedLocal;

		// Optional receiver clause:
		//   (self)         — instance method, receiver type inferred
		//   (self: T)      — instance method, receiver type T
		//   (TypeName)     — static method/value attached to TypeName
		let receiver: Receiver | null = null;
		if (check("(")) {
			eat("(");
			skipNewlines();
			const selfMode = tryMatch("*", "&", "$", "@");
			if (check("self")) {
				pos++;
				const selfType = tryMatch(":") ? parseType() : null;
				receiver = { kind: "self", mode: selfMode?.kind as "*" | "&" | "$" | "@" | null ?? null, typeAnnotation: selfType };
			} else if (!selfMode && check("ID")) {
				const receiverTypeName = eat("ID").value as string;
				receiver = { kind: "static", typeName: receiverTypeName };
			} else {
				const found = peek();
				throw new RukaError(
					`Expected 'self' or type name in receiver clause, got '${found.kind}'`,
					found.line,
					found.col
				);
			}
			skipNewlines();
			eat(")");
		}

		const annotation = tryMatch(":") ? parseType() : null;
		eat("=");
		skipNewlines();
		const pattern: LetPattern = { kind: "IdentifierPattern", name };
		return {
			kind: "Binding",
			local: isLocal,
			mode,
			pattern,
			name,
			type: annotation,
			receiver,
			value: parseExpression(),
			line: letToken.line,
			col: letToken.col
		};
	}

	function parseFor(): For {
		const line = peek().line;
		const col = peek().col;
		eat("for");

		let name: string | null = null;
		let tuplePattern: string[] | null = null;
		let matchPattern: MatchPattern | null = null;

		// Tuple destructuring: `for (a, b) in iterable`
		if (check("(")) {
			eat("(");
			skipNewlines();
			tuplePattern = [];
			while (!check(")") && !check("EOF")) {
				tuplePattern.push(eat("ID").value as string);
				skipNewlines();
				if (tryMatch(",")) {
					skipNewlines();
				}
			}
			eat(")");
			eat("in");
		} else if (check("ID") && tokens[pos + 1] && tokens[pos + 1]!.kind === "in") {
			// Single name binding: `for name in iterable`
			name = eat("ID").value as string;
			eat("in");
		} else if (check("ID") && tokens[pos + 1] && tokens[pos + 1]!.kind === "(") {
			// Variant pattern filter: `for some(n) in iterable`
			matchPattern = parsePattern();
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
		return { kind: "For", name, tuplePattern, matchPattern, iterable, body: body.node.body, line, col };
	}

	// Parse the binding clause shared by array/map comprehensions: `for x in iter` or `for (a,b) in iter`.
	// Caller has already consumed `for`.
	function parseCompBinding(): { name: string | null; tuplePattern: string[] | null; iterable: Expression } {
		let name: string | null = null;
		let tuplePattern: string[] | null = null;

		if (check("(")) {
			eat("(");
			skipNewlines();
			tuplePattern = [];
			while (!check(")") && !check("EOF")) {
				tuplePattern.push(eat("ID").value as string);
				skipNewlines();
				if (tryMatch(",")) skipNewlines();
			}
			eat(")");
			eat("in");
		} else if (check("ID") || check("_")) {
			name = peek().value as string;
			pos++;
			eat("in");
		} else {
			// Wildcard pattern: `_`
			name = "_";
			eat("in");
		}

		const iterable = parseOr();
		return { name, tuplePattern, iterable };
	}

	// Parse the body of a body-first comprehension after `{` has been consumed and
	// `for` is the current token. Returns an ArrayComp or MapComp node.
	function parseBodyFirstComp(
		body: Expression,
		typePrefix: TypeExpr | null,
		line: number,
		col: number
	): ArrayComp | MapComp {
		eat("for");
		const { name, tuplePattern, iterable } = parseCompBinding();
		const filter = tryMatch("if") ? parseOr() : null;
		eat("}");

		if (body.kind === "BinaryOp" && body.op === "=>") {
			// Map comprehension: { key => val for ... }
			return {
				kind: "MapComp",
				typePrefix,
				keyBody: body.left,
				valueBody: body.right,
				name,
				tuplePattern,
				iterable,
				filter,
				line,
				col
			} satisfies MapComp;
		}
		return { kind: "ArrayComp", typePrefix, name, tuplePattern, iterable, body, filter, line, col };
	}

	// Parse the body of a typed comprehension after `{` has been consumed and
	// `for` is the current token. Returns an ArrayComp node. (Legacy helper, still used for [T]{ for ...})
	function parseArrayComp(typePrefix: TypeExpr | null, line: number, col: number): ArrayComp | MapComp {
		eat("for");
		const { name, tuplePattern, iterable } = parseCompBinding();
		const filter = tryMatch("if") ? parseOr() : null;
		eat("do");
		skipNewlines();
		const body = parseExpression();
		skipNewlines();
		eat("}");

		return { kind: "ArrayComp", typePrefix, name, tuplePattern, iterable, body, filter, line, col };
	}

	// Parse a collection literal opened by `{` (already consumed), with a known typePrefix.
	// Handles: record literals, array literals, map literals, comprehensions.
	function parseBraceLiteral(typePrefix: TypeExpr | null, line: number, col: number): Expression {
		skipNewlines();

		// Empty brace literal
		if (check("}")) {
			eat("}");
			if (typePrefix && typePrefix.kind === "MapType") {
				return { kind: "MapLiteral", entries: [], typePrefix, line, col } satisfies MapLiteral;
			}
			return { kind: "ListLiteral", shape: "array", typePrefix, elements: [], line, col };
		}

		// Body-first comprehension: `{ for x in iter do body }`
		if (check("for")) {
			return parseArrayComp(typePrefix, line, col);
		}

		// Record literal: starts with `ID =` or all-bare-ID (shorthand)
		if (!typePrefix && check("ID") && isRecordLiteralStart()) {
			const fields: RecordLiteralField[] = [];
			while (!check("}") && !check("EOF")) {
				skipNewlines();
				const fieldLine = peek().line;
				const fieldCol = peek().col;
				const fieldName = eat("ID").value as string;
				if (tryMatch("=")) {
					skipNewlines();
					fields.push({ name: fieldName, value: parseExpression() });
				} else {
					fields.push({
						name: fieldName,
						value: { kind: "Ident", name: fieldName, line: fieldLine, col: fieldCol }
					});
				}
				skipNewlines();
				if (tryMatch(",")) skipNewlines();
			}
			eat("}");
			return { kind: "RecordLiteral", fields, line, col };
		}

		// Parse the first expression, then branch on what follows.
		const first = parseExpression();
		skipNewlines();

		if (check("=>")) {
			// Map literal or map comprehension
			eat("=>");
			skipNewlines();
			const firstValue = parseExpression();
			skipNewlines();

			if (check("for")) {
				// Map comprehension: { key => val for ... }
				eat("for");
				const { name, tuplePattern, iterable } = parseCompBinding();
				const filter = tryMatch("if") ? parseOr() : null;
				eat("}");
				return {
					kind: "MapComp",
					typePrefix,
					keyBody: first,
					valueBody: firstValue,
					name,
					tuplePattern,
					iterable,
					filter,
					line,
					col
				} satisfies MapComp;
			}

			// Map literal: collect remaining entries
			const entries: MapLiteralEntry[] = [{ key: first, value: firstValue }];
			while ((tryMatch(",") || !check("}")) && !check("EOF")) {
				skipNewlines();
				if (check("}")) break;
				const k = parseExpression();
				skipNewlines();
				eat("=>");
				skipNewlines();
				entries.push({ key: k, value: parseExpression() });
				skipNewlines();
			}
			eat("}");
			return { kind: "MapLiteral", entries, typePrefix, line, col } satisfies MapLiteral;
		}

		if (check("for")) {
			// Array comprehension: { body for ... }
			return parseBodyFirstComp(first, typePrefix, line, col);
		}

		// Array literal: collect remaining elements
		const elements: Expression[] = [first];
		while (!check("}") && !check("EOF")) {
			if (tryMatch(",")) skipNewlines();
			if (check("}")) break;
			elements.push(parseExpression());
			skipNewlines();
		}
		eat("}");
		return { kind: "ListLiteral", shape: "array", typePrefix, elements, line, col };
	}

	// ── Expressions ──────────────────────────────────────────────────────
	function parseExpression(): Expression {
		if (check("(") && isFunctionLiteral()) {
			return parseFunction();
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
			return { node: { kind: "Block", body: parseBlockBody() }, multiline: true };
		}
		const single = parseStatement();
		return { node: { kind: "Block", body: [single] }, multiline: false };
	}

	function parseFunction(): FunctionExpr {
		const line = peek().line;
		const col = peek().col;
		eat("(");
		const params: string[] = [];
		const paramTypes: (TypeExpr | null)[] = [];
		const paramModes: (string | null)[] = [];
		skipNewlines();
		while (!check(")") && !check("EOF")) {
			const modeToken = tryMatch("*", "&", "$", "@", "~");
			paramModes.push(modeToken ? modeToken.kind : null);
			if (check("ID")) {
				params.push(eat("ID").value as string);
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
			kind: "FunctionExpr",
			params,
			paramTypes,
			paramModes,
			returnType,
			body: body.node,
			line,
			col
		};
	}

	function parseWhile(): While {
		const line = peek().line;
		const col = peek().col;
		eat("while");

		// Conditional pattern: `while pattern = expr do`
		if (isPatternBind()) {
			const { pattern, subject } = parsePatternBindCondition();
			eat("do");
			const bodyParsed = parseDoBody();
			if (bodyParsed.multiline) eat("end");
			else tryMatch("end");
			// Desugar: wrap body in a match that breaks on non-match
			const matchBody: Block = {
				kind: "Block",
				body: [
					{
						kind: "ExpressionStmt",
						expression: {
							kind: "Match",
							subject,
							arms: [{ pattern, body: bodyParsed.node }],
							elseArm: { kind: "Block", body: [{ kind: "Break", line, col }] },
							line,
							col
						},
						line,
						col
					}
				]
			};
			// Use `true` as condition; the match's else arm breaks
			return {
				kind: "While",
				condition: { kind: "Literal", value: true, line, col },
				body: matchBody.body,
				line,
				col
			};
		}

		const condition = parseOr(); // no trailing ternary; `do` opens the body
		eat("do");
		const body = parseDoBody();
		if (body.multiline) {
			eat("end");
		} else {
			tryMatch("end");
		}
		return { kind: "While", condition, body: body.node.body, line, col };
	}

	function parsePattern(): MatchPattern {
		// Variant pattern. A variant tag carries at most one payload,
		// so destructuring just describes the shape of that one value:
		//   tag                — unit variant
		//   tag(name)          — single binding (whole payload → name)
		//   tag((a, b, …))     — tuple-payload destructure
		//   tag({a, b, …})     — record-payload destructure
		// Disambiguation: a bare ID before `do`/NL is a variant tag;
		// `ID(...)` is a payload pattern; anything else is a guard.
		if (check("ID")) {
			const next = tokens[pos + 1];
			const isBareTag =
				!next || next.kind === "NL" || next.kind === "do" || next.kind === "EOF";
			const isTagCall = next && next.kind === "(";
			if (isBareTag) {
				return { kind: "VariantPattern", tag: eat("ID").value as string, binding: null };
			}
			if (isTagCall) {
				let lookahead = pos + 2;
				while (tokens[lookahead] && tokens[lookahead]!.kind === "NL") {
					lookahead++;
				}
				const insideParen = tokens[lookahead];

				// Record-payload destructure: tag({a, b, ...})
				if (insideParen && insideParen.kind === "{") {
					const tag = eat("ID").value as string;
					eat("(");
					skipNewlines();
					eat("{");
					const names = parseDestructureNames("}");
					skipNewlines();
					eat(")");
					return {
						kind: "VariantPattern",
						tag,
						binding: { kind: "RecordPattern", names }
					};
				}

				// Tuple-payload destructure: tag((a, b, ...))
				if (insideParen && insideParen.kind === "(") {
					const tag = eat("ID").value as string;
					eat("(");
					skipNewlines();
					eat("(");
					const names = parseDestructureNames(")");
					skipNewlines();
					eat(")");
					return {
						kind: "VariantPattern",
						tag,
						binding: { kind: "TuplePattern", names }
					};
				}

				// Single binding: tag(name)
				if (insideParen && insideParen.kind === "ID") {
					let afterIdent = lookahead + 1;
					while (tokens[afterIdent] && tokens[afterIdent]!.kind === "NL") {
						afterIdent++;
					}
					const after = tokens[afterIdent];
					if (after && after.kind === ")") {
						const tag = eat("ID").value as string;
						eat("(");
						skipNewlines();
						const binding: BindingPattern = {
							kind: "BindingPattern",
							name: eat("ID").value as string
						};
						skipNewlines();
						eat(")");
						return { kind: "VariantPattern", tag, binding };
					}
				}
			}
		}

		// Range pattern: NUM..NUM | NUM..=NUM (integers and chars)
		if (
			(check("NUM") || check("CHAR")) &&
			tokens[pos + 1] &&
			(tokens[pos + 1]!.kind === ".." || tokens[pos + 1]!.kind === "..=")
		) {
			const low = parsePrimary();
			const inclusive = peek().kind === "..=";
			eat(inclusive ? "..=" : "..");
			const high = parsePrimary();
			return { kind: "RangePattern", low, high, inclusive };
		}

		// Literal pattern: NUM, STR, CHAR, true, false
		if (
			check("NUM") ||
			check("STR") ||
			check("CHAR") ||
			check("true") ||
			check("false")
		) {
			return { kind: "LiteralPattern", expression: parsePrimary() };
		}

		// Guard pattern: boolean expression stopped before `do`.
		return { kind: "GuardPattern", expression: parseOr() };
	}

	function parseMatch(): Match {
		const matchTok = eat("match");
		const line = matchTok.line;
		const col = matchTok.col;
		skipNewlines();
		const subject = parseExpression();
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
			arms.push({ pattern, body: armBody.node });
			skipNewlines();
		}
		let elseArm: Block | null = null;
		if (tryMatch("else")) {
			tryMatch("do"); // `do` after `else` is optional, matching if/else
			const elseBody = parseDoBody();
			if (elseBody.multiline) {
				eat("end");
			}
			elseArm = elseBody.node;
			skipNewlines();
		}
		eat("end");
		return { kind: "Match", subject, arms, elseArm, line, col };
	}

	// Lookahead: does the current token sequence look like `pattern = expr do`?
	// True when there's a `=` (not `==`) token before `do` at bracket depth 0.
	function isPatternBind(): boolean {
		let i = pos;
		let depth = 0;
		while (i < tokens.length) {
			const kind = tokens[i]!.kind;
			if (kind === "(" || kind === "[" || kind === "{") depth++;
			else if (kind === ")" || kind === "]" || kind === "}") {
				if (depth === 0) return false;
				depth--;
			}
			else if (depth === 0 && kind === "do") return false;
			else if (depth === 0 && kind === "NL") return false;
			else if (depth === 0 && kind === "EOF") return false;
			else if (depth === 0 && kind === "=" && tokens[i + 1]?.kind !== "=") return true;
			else if (depth === 0 && kind === "==" ) return false;
			i++;
		}
		return false;
	}

	// Parse a pattern-bind condition: `pattern = expr`. Returns a Match node
	// with a single arm that captures names and a synthetic subject.
	// Used for `if pattern = expr do`, `while pattern = expr do`.
	function parsePatternBindCondition(): { pattern: MatchPattern; subject: Expression } {
		const pattern = parsePattern();
		eat("=");
		skipNewlines();
		const subject = parseOr();
		return { pattern, subject };
	}

	// `inChain` = this parseIf is the RHS of an enclosing `else if`, so the
	// enclosing call owns the shared trailing `end` (when any branch is multi-line).
	function parseIf(inChain: boolean): Expression {
		const ifToken = tryMatch("if");
		if (!ifToken) {
			return parseTernary();
		}

		// Conditional pattern: `if pattern = expr do`
		if (isPatternBind()) {
			const { pattern, subject } = parsePatternBindCondition();
			eat("do");
			const thenParsed = parseDoBody();
			const thenBranch = thenParsed.node;
			let terminalMultiline = thenParsed.multiline;
			skipNewlines();
			let elseArm: Block | null = null;
			if (tryMatch("else")) {
				tryMatch("do");
				const parsedElse = parseDoBody();
				elseArm = parsedElse.node;
				terminalMultiline = parsedElse.multiline;
			}
			if (!inChain) {
				skipNewlines();
				if (terminalMultiline) eat("end");
			}
			// Desugar to a match expression on the subject
			const arms: MatchArm[] = [{ pattern, body: thenBranch }];
			return {
				kind: "Match",
				subject,
				arms,
				elseArm,
				line: ifToken.line,
				col: ifToken.col
			};
		}

		const condition = parseOr();
		eat("do");
		const thenParsed = parseDoBody();
		const thenBranch = thenParsed.node;
		const thenMultiline = thenParsed.multiline;

		// Allow `else` on a new line regardless of single/multi-line then.
		skipNewlines();
		let elseBranch: Block | Expression | null = null;
		// Tracks whether the *terminating* branch of the chain is multi-line —
		// that's the only thing that decides whether a trailing `end` is required.
		// Middle branches (else-if then-bodies) terminate at the next `else`,
		// so their multilineness doesn't impose an `end`.
		let terminalMultiline = thenMultiline;
		if (tryMatch("else")) {
			if (check("if")) {
				const innerIf = parseIf(true);
				elseBranch = innerIf;
				terminalMultiline = !!(innerIf as If)._multiline;
			} else {
				tryMatch("do"); // `do` after `else` is optional
				const parsedElse = parseDoBody();
				elseBranch = parsedElse.node;
				terminalMultiline = parsedElse.multiline;
			}
		}

		if (!inChain) {
			skipNewlines();
			if (terminalMultiline) {
				eat("end");
			}
			// Single-line if expressions never carry an explicit `end` —
			// one here would belong to the enclosing block.
		}
		return {
			kind: "If",
			condition,
			thenBranch,
			elseBranch,
			line: ifToken.line,
			col: ifToken.col,
			_multiline: terminalMultiline
		};
	}

	// Ternary: `<expression> if <condition> else <expression>` (right-assoc, below `or`).
	function parseTernary(): Expression {
		const lhs = parsePipeline();
		if (tryMatch("if")) {
			const condition = parseOr();
			skipNewlines();
			eat("else");
			skipNewlines();
			const rhs = parseTernary();
			return {
				kind: "If",
				condition,
				thenBranch: lhs,
				elseBranch: rhs,
				line: lineOf(lhs),
				col: colOf(lhs)
			};
		}
		return lhs;
	}

	// Pipeline: `x |> f(a, b)` desugars to `f(x, a, b)`. Left-associative.
	// If the RHS is not a Call (e.g. `x |> f`), synthesize `f(x)`.
	function parsePipeline(): Expression {
		let left: Expression = parseOr();
		while (checkPastNewlines("|>")) {
			skipNewlines();
			pos++;
			skipNewlines();
			const right = parseOr();
			if (right.kind === "Call") {
				left = {
					kind: "Call",
					callee: right.callee,
					args: [left, ...right.args],
					line: right.line,
					col: right.col
				};
			} else {
				left = {
					kind: "Call",
					callee: right,
					args: [left],
					line: lineOf(right) || lineOf(left),
					col: colOf(right) || colOf(left)
				};
			}
		}
		return left;
	}

	// Stops at 'end', 'else', or EOF. NL between statements is filler.
	function parseBlockBody(): Statement[] {
		const statements: Statement[] = [];
		skipNewlines();
		while (!check("end") && !check("else") && !check("EOF")) {
			statements.push(parseStatement());
			skipNewlines();
		}
		return statements;
	}

	function parseOr(): Expression {
		let left = parseAnd();
		while (check("or")) {
			const line = peek().line;
			const col = peek().col;
			pos++;
			skipNewlines();
			left = { kind: "BinaryOp", op: "or", left, right: parseAnd(), line, col };
		}
		return left;
	}

	function parseAnd(): Expression {
		let left = parseCmp();
		while (check("and")) {
			const line = peek().line;
			const col = peek().col;
			pos++;
			skipNewlines();
			left = { kind: "BinaryOp", op: "and", left, right: parseCmp(), line, col };
		}
		return left;
	}

	function parseCmp(): Expression {
		const left = parseRange();
		const op = tryMatch("==", "!=", "<", ">", "<=", ">=");
		if (op) {
			skipNewlines();
			return {
				kind: "BinaryOp",
				op: op.kind as string,
				left,
				right: parseRange(),
				line: op.line,
				col: op.col
			};
		}
		return left;
	}

	function parseRange(): Expression {
		const left = parseAdd();
		if (check("..") || check("..=")) {
			const inclusive = peek().kind === "..=";
			const line = peek().line;
			const col = peek().col;
			pos++;
			skipNewlines();
			const right = parseAdd();
			const node: Range = {
				kind: "Range",
				start: left,
				end: right,
				inclusive,
				line,
				col
			};
			return node;
		}
		return left;
	}

	function parseAdd(): Expression {
		let left = parseMul();
		while (check("+") || check("-")) {
			const opTok = tokens[pos++]!;
			skipNewlines();
			left = {
				kind: "BinaryOp",
				op: opTok.kind as string,
				left,
				right: parseMul(),
				line: opTok.line,
				col: opTok.col
			};
		}
		return left;
	}

	function parseMul(): Expression {
		let left = parsePow();
		while (check("*") || check("/") || check("%")) {
			const opTok = tokens[pos++]!;
			skipNewlines();
			left = {
				kind: "BinaryOp",
				op: opTok.kind as string,
				left,
				right: parsePow(),
				line: opTok.line,
				col: opTok.col
			};
		}
		return left;
	}

	function parsePow(): Expression {
		const left = parseUnary();
		if (check("**")) {
			const line = peek().line;
			const col = peek().col;
			pos++;
			skipNewlines();
			const right = parsePow(); // right-associative
			return { kind: "BinaryOp", op: "**", left, right, line, col };
		}
		return left;
	}

	function parseUnary(): Expression {
		if (tryMatch("-")) {
			skipNewlines();
			return { kind: "UnaryOp", op: "-", expression: parseUnary() };
		}
		if (tryMatch("not")) {
			skipNewlines();
			return { kind: "UnaryOp", op: "not", expression: parseUnary() };
		}
		return parseCall();
	}

	// Bare variant constructor names — any ID immediately followed by `(` in a
	// context where it could be a constructor rather than a regular call.
	// The scope and type checkers resolve ambiguity; here we just emit the node.
	const VARIANT_CONSTRUCTORS = new Set(["some", "none", "ok", "err"]);

	function parseCall(): Expression {
		let expression: Expression = parsePrimary();

		// Convert bare variant constructor Idents into VariantConstructor nodes.
		// `none` has no payload; `some`, `ok`, `err` take one wrapped in `(...)`.
		if (
			expression.kind === "Ident" &&
			VARIANT_CONSTRUCTORS.has(expression.name)
		) {
			if (check("(")) {
				const callLine = peek().line;
				const callCol = peek().col;
				eat("(");
				skipNewlines();
				const payload = check(")") ? null : parseExpression();
				skipNewlines();
				eat(")");
				return {
					kind: "VariantConstructor",
					tag: expression.name,
					payload,
					line: callLine,
					col: callCol
				};
			}
			// Bare `none` (no parens) — unit variant constructor
			return {
				kind: "VariantConstructor",
				tag: expression.name,
				payload: null,
				line: expression.line,
				col: expression.col
			};
		}

		while (true) {
			if (check("(")) {
				const callLine = peek().line;
				const callCol = peek().col;
				eat("(");
				skipNewlines();
				const args: Expression[] = [];
				while (!check(")") && !check("EOF")) {
					// Named argument: `~name = expr` or shorthand `~name`
					if (check("~")) {
						pos++; // eat ~
						const argName = eat("ID").value as string;
						if (tryMatch("=")) {
							skipNewlines();
							args.push(parseExpression());
						} else {
							// Shorthand: ~name refers to a local binding of the same name
							args.push({ kind: "Ident", name: argName, line: peek().line, col: peek().col });
						}
					} else {
						args.push(parseExpression());
					}
					skipNewlines();
					if (tryMatch(",")) {
						skipNewlines();
					}
				}
				eat(")");
				expression = {
					kind: "Call",
					callee: expression,
					args,
					line: callLine,
					col: callCol
				};
			} else if (check(".")) {
				const memberLine = peek().line;
				const memberCol = peek().col;
				eat(".");
				skipNewlines();
				expression = {
					kind: "Member",
					object: expression,
					property: eat("ID").value as string,
					line: memberLine,
					col: memberCol
				};
			} else if (check("[")) {
				const indexLine = peek().line;
				const indexCol = peek().col;
				eat("[");
				skipNewlines();
				const index = parseExpression();
				skipNewlines();
				eat("]");
				expression = {
					kind: "Index",
					object: expression,
					index,
					line: indexLine,
					col: indexCol
				};
			} else if (check("{") && isRecordLiteralAtBrace()) {
				// TypeName { field = val, ... } — record literal with explicit type prefix.
				const recLine = peek().line;
				const recCol = peek().col;
				eat("{");
				skipNewlines();
				const fields: RecordLiteralField[] = [];
				while (!check("}") && !check("EOF")) {
					skipNewlines();
					const fieldLine = peek().line;
					const fieldCol = peek().col;
					const fieldName = eat("ID").value as string;
					if (tryMatch("=")) {
						skipNewlines();
						fields.push({ name: fieldName, value: parseExpression() });
					} else {
						fields.push({
							name: fieldName,
							value: { kind: "Ident", name: fieldName, line: fieldLine, col: fieldCol }
						});
					}
					skipNewlines();
					if (tryMatch(",")) skipNewlines();
				}
				eat("}");
				expression = {
					kind: "RecordLiteral",
					typeName: expression,
					fields,
					line: recLine,
					col: recCol
				} satisfies RecordLiteral;
			} else if (check("as")) {
				const castLine = peek().line;
				const castCol = peek().col;
				eat("as");
				const castType = parseType();
				expression = {
					kind: "Cast",
					value: expression,
					type: castType,
					line: castLine,
					col: castCol
				} satisfies Cast;
			} else if (check("~") && expression.kind === "Call") {
				// Trailing named argument: `f(args) ~name = expr`
				const trailLine = peek().line;
				const trailCol = peek().col;
				pos++; // eat ~
				eat("ID"); // eat param name (ignored semantically for now)
				eat("=");
				skipNewlines();
				const trailArg = parseExpression();
				expression = {
					kind: "Call",
					callee: expression.callee,
					args: [...expression.args, trailArg],
					line: trailLine,
					col: trailCol
				};
			} else {
				break;
			}
		}
		return expression;
	}

	function parsePrimary(): Expression {
		const token = peek();
		if (token.kind === "NUM") {
			pos++;
			const text = token.value as string;
			const isFloat = text.includes(".");
			return {
				kind: "Literal",
				value: parseFloat(text),
				isFloat,
				line: token.line,
				col: token.col
			};
		}
		if (token.kind === "CHAR") {
			pos++;
			return {
				kind: "CharLiteral",
				value: token.value as number,
				line: token.line,
				col: token.col
			};
		}
		if (token.kind === "STR") {
			pos++;
			return {
				kind: "StringLiteral",
				raw: token.value as string,
				line: token.line,
				col: token.col
			};
		}
		if (token.kind === "true") {
			pos++;
			return { kind: "Literal", value: true, line: token.line, col: token.col };
		}
		if (token.kind === "false") {
			pos++;
			return { kind: "Literal", value: false, line: token.line, col: token.col };
		}
		if (token.kind === "ID") {
			const name = token.value as string;
			pos++;
			return {
				kind: "Ident",
				name,
				line: token.line,
				col: token.col
			};
		}
		if (token.kind === "self") {
			pos++;
			return { kind: "Ident", name: "self", line: token.line, col: token.col };
		}
		if (token.kind === "(") {
			eat("(");
			skipNewlines();
			// `()` — unit literal
			if (check(")")) {
				eat(")");
				return { kind: "Unit", line: token.line, col: token.col };
			}
			const first = parseExpression();
			skipNewlines();
			// `(a, b, ...)` — tuple literal
			if (check(",")) {
				const elements: Expression[] = [first];
				while (tryMatch(",")) {
					skipNewlines();
					if (check(")")) break;
					elements.push(parseExpression());
					skipNewlines();
				}
				eat(")");
				return {
					kind: "ListLiteral",
					shape: "tuple",
					typePrefix: null,
					elements,
					line: token.line,
					col: token.col
				};
			}
			eat(")");
			return first;
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
				const fieldLocal = tryMatch("local") !== null;
				const fieldName = eat("ID").value as string;
				eat(":");
				skipNewlines();
				fields.push({ name: fieldName, type: parseType(), local: fieldLocal || undefined });
				skipNewlines();
				if (tryMatch(",")) {
					skipNewlines();
				}
			}
			eat("}");
			return { kind: "RecordType", fields, line: token.line, col: token.col };
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
				const tagLocal = tryMatch("local") !== null;
				const tagName = eat("ID").value as string;
				let tagType: TypeExpr | null = null;
				if (tryMatch(":")) {
					skipNewlines();
					tagType = parseType();
				}
				tags.push({ name: tagName, type: tagType, local: tagLocal || undefined });
				skipNewlines();
				if (tryMatch(",")) {
					skipNewlines();
				}
			}
			eat("}");
			const node: VariantType = {
				kind: "VariantType",
				tags,
				line: token.line,
				col: token.col
			};
			return node;
		}

		// Bare `{` — record literal, array/map literal, or comprehension.
		if (token.kind === "{") {
			pos++;
			return parseBraceLiteral(null, token.line, token.col);
		}

		// Type-prefixed collection literal: [T]{ ... } or [K => V]{ ... }.
		// The type prefix may be separated from `{` by optional whitespace.
		if (token.kind === "[") {
			const prefixLine = token.line;
			const prefixCol = token.col;
			const prefix = parseType(); // consumes through `]`
			skipNewlines();
			eat("{");
			return parseBraceLiteral(prefix, prefixLine, prefixCol);
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

		// Behaviour type: behaviour { methodName(self): () -> ReturnType, ... }
		if (token.kind === "behaviour") {
			pos++;
			skipNewlines();
			eat("{");
			skipNewlines();
			const methods: BehaviourMethod[] = [];
			while (!check("}") && !check("EOF")) {
				skipNewlines();
				const methodName = eat("ID").value as string;
				eat("(");
				skipNewlines();
				// Parse receiver (self or type name) — skip for now, just eat it
				const params: TypeExpr[] = [];
				if (!check(")")) {
					// First param is receiver like `self` — we parse types for any params
					// The spec shows `area(self): () -> float` so first is receiver
					if (check("self") || check("ID")) pos++; // eat receiver name
					if (tryMatch(":")) {
						skipNewlines();
						parseType(); // eat receiver type annotation
					}
					while (tryMatch(",")) {
						skipNewlines();
						if (check("ID")) pos++;
						if (tryMatch(":")) { skipNewlines(); params.push(parseType()); }
					}
				}
				eat(")");
				skipNewlines();
				let returnType: TypeExpr = { kind: "UnitType", line: token.line, col: token.col };
				if (tryMatch(":")) {
					skipNewlines();
					// Method type annotation: `params -> returnType` (e.g. `() -> float`)
					const annotType = parseType();
					if (tryMatch("->")) {
						skipNewlines();
						returnType = parseType();
					} else {
						returnType = annotType;
					}
				}
				methods.push({ name: methodName, params, returnType });
				skipNewlines();
				if (tryMatch(",")) skipNewlines();
			}
			eat("}");
			return {
				kind: "BehaviourType",
				methods,
				line: token.line,
				col: token.col
			} satisfies BehaviourType;
		}

		// Block-like expressions can appear anywhere an expression is expected,
		// including as the rhs of binary operators like `a + if cond do 1 else 2`.
		if (token.kind === "if") {
			return parseIf(false);
		}
		if (token.kind === "match") {
			return parseMatch();
		}
		if (token.kind === "while") {
			return parseWhile();
		}

		throw new RukaError(
			`Unexpected token '${token.kind}' ('${token.value}')`,
			token.line,
			token.col
		);
	}

	return parseProgram();
}

/**
 * Best-effort line lookup. Most expression nodes carry a `line`, but `BinaryOp`,
 * `UnaryOp`, and `Block` don't — recurse into their first child.
 */
function lineOf(node: Expression | Block): number {
	if ("line" in node && typeof (node as { line?: number }).line === "number") {
		return (node as { line: number }).line;
	}
	if (node.kind === "BinaryOp") {
		return lineOf(node.left);
	}
	if (node.kind === "UnaryOp") {
		return lineOf(node.expression);
	}
	if (node.kind === "Block") {
		return node.body[0] ? (node.body[0] as { line: number }).line : 0;
	}
	return 0;
}

/** Column counterpart to lineOf — same recursion shape. */
function colOf(node: Expression | Block): number {
	if ("col" in node && typeof (node as { col?: number }).col === "number") {
		return (node as { col: number }).col;
	}
	if (node.kind === "BinaryOp") {
		return colOf(node.left);
	}
	if (node.kind === "UnaryOp") {
		return colOf(node.expression);
	}
	if (node.kind === "Block") {
		return node.body[0] ? (node.body[0] as { col: number }).col : 0;
	}
	return 0;
}
