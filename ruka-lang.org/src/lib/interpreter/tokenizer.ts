import { KEYWORDS, PUNCT2, PUNCT3, type Token } from "./tokens";

const WHITESPACE_RE = /\s/;
const DIGIT_RE = /\d/;
const IDENT_START_RE = /[a-zA-Z_]/;
const IDENT_BODY_RE = /\w/;

const PUNCT2_SET: ReadonlySet<string> = new Set(PUNCT2);
const PUNCT3_SET: ReadonlySet<string> = new Set(PUNCT3);

/**
 * Lex a Ruka source string into tokens.
 *
 * Newlines emit `NL` tokens at bracket-depth 0 only; inside any `(`/`[`/`{`
 * pair they're whitespace. Strings preserve raw content (escapes intact,
 * `${...}` verbatim) so later passes can re-parse interpolations.
 */
export function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	const length = source.length;
	let pos = 0;
	let line = 1;
	let bracketDepth = 0;

	while (pos < length) {
		// Newline: emit NL only at bracket-depth 0; inside brackets it's whitespace.
		if (source[pos] === "\n") {
			if (bracketDepth === 0) {
				tokens.push({ kind: "NL", value: "\n", line });
			}
			line++;
			pos++;
			continue;
		}
		if (WHITESPACE_RE.test(source[pos])) {
			pos++;
			continue;
		}
		// Line comment.
		if (source[pos] === "/" && source[pos + 1] === "/") {
			while (pos < length && source[pos] !== "\n") {
				pos++;
			}
			continue;
		}

		const tokenLine = line;

		// Multiline string: |"  ...  |"
		// Each content line begins with `|` (stripped). ${...} kept verbatim.
		if (source[pos] === "|" && source[pos + 1] === '"') {
			pos += 2;
			// Skip the rest of the opening line (should be empty / whitespace).
			while (pos < length && source[pos] !== "\n") {
				pos++;
			}
			let body = "";
			let isFirstLine = true;
			while (pos < length) {
				if (source[pos] === "\n") {
					line++;
					pos++;
				}
				while (
					pos < length &&
					source[pos] !== "\n" &&
					(source[pos] === " " || source[pos] === "\t")
				) {
					pos++;
				}
				if (source[pos] === "|" && source[pos + 1] === '"') {
					pos += 2;
					break;
				}
				if (source[pos] !== "|") {
					break; // malformed — bail
				}
				pos++;
				if (source[pos] === " ") {
					pos++; // strip one optional space after `|`
				}
				if (!isFirstLine) {
					body += "\n";
				}
				isFirstLine = false;
				while (pos < length && source[pos] !== "\n") {
					if (source[pos] === "$" && source[pos + 1] === "{") {
						body += "${";
						pos += 2;
						let braceDepth = 1;
						while (pos < length && braceDepth > 0) {
							if (source[pos] === "{") {
								braceDepth++;
								body += source[pos++];
							} else if (source[pos] === "}") {
								braceDepth--;
								if (braceDepth === 0) {
									body += "}";
									pos++;
									break;
								}
								body += source[pos++];
							} else {
								body += source[pos++];
							}
						}
					} else {
						body += source[pos++];
					}
				}
			}
			tokens.push({ kind: "STR", value: body, line: tokenLine });
			continue;
		}

		// Single-line string. Keep ${...} verbatim, including any nested strings,
		// so the parser can recursively tokenize the interpolation later.
		if (source[pos] === '"') {
			pos++;
			let body = "";
			while (pos < length && source[pos] !== '"') {
				if (source[pos] === "\\" && pos + 1 < length) {
					body += source[pos] + source[pos + 1];
					pos += 2;
				} else if (source[pos] === "$" && source[pos + 1] === "{") {
					// Track nested braces AND nested string literals so a `"` inside
					// the expression doesn't terminate the outer string.
					body += "${";
					pos += 2;
					let interpDepth = 1;
					while (pos < length && interpDepth > 0) {
						if (source[pos] === '"') {
							body += source[pos++];
							while (pos < length && source[pos] !== '"') {
								if (source[pos] === "\\" && pos + 1 < length) {
									body += source[pos] + source[pos + 1];
									pos += 2;
								} else {
									body += source[pos++];
								}
							}
							if (pos < length) {
								body += source[pos++];
							}
						} else if (source[pos] === "{") {
							interpDepth++;
							body += source[pos++];
						} else if (source[pos] === "}") {
							interpDepth--;
							if (interpDepth === 0) {
								body += "}";
								pos++;
								break;
							}
							body += source[pos++];
						} else {
							body += source[pos++];
						}
					}
				} else {
					body += source[pos++];
				}
			}
			pos++; // closing "
			tokens.push({ kind: "STR", value: body, line: tokenLine });
			continue;
		}

		// Char literal — emitted as CHAR (u8 byte value) so interpolation can
		// render it as ASCII rather than as a number.
		if (source[pos] === "'") {
			pos++;
			let charValue: number;
			if (source[pos] === "\\" && pos + 1 < length) {
				pos++;
				const escape = source[pos++];
				switch (escape) {
					case "n":
						charValue = 10;
						break;
					case "t":
						charValue = 9;
						break;
					case "r":
						charValue = 13;
						break;
					case "0":
						charValue = 0;
						break;
					case "\\":
						charValue = 92;
						break;
					case "'":
						charValue = 39;
						break;
					case '"':
						charValue = 34;
						break;
					default:
						charValue = escape.charCodeAt(0);
				}
			} else if (pos < length) {
				charValue = source.charCodeAt(pos++);
			} else {
				charValue = 0;
			}
			if (source[pos] === "'") {
				pos++;
			}
			tokens.push({ kind: "CHAR", value: charValue, line: tokenLine });
			continue;
		}

		// Number — string-preserving. The parser interprets it later, deciding
		// int vs. float by whether the text contains a `.`. Stops the fractional
		// part if we hit `..` (range operator).
		if (DIGIT_RE.test(source[pos])) {
			let numberText = "";
			while (pos < length && DIGIT_RE.test(source[pos])) {
				numberText += source[pos++];
			}
			if (
				source[pos] === "." &&
				source[pos + 1] !== "." &&
				DIGIT_RE.test(source[pos + 1] ?? "")
			) {
				numberText += source[pos++];
				while (pos < length && DIGIT_RE.test(source[pos])) {
					numberText += source[pos++];
				}
			}
			tokens.push({ kind: "NUM", value: numberText, line: tokenLine });
			continue;
		}

		// Identifier / keyword.
		if (IDENT_START_RE.test(source[pos])) {
			let word = "";
			while (pos < length && IDENT_BODY_RE.test(source[pos])) {
				word += source[pos++];
			}
			const kind = (KEYWORDS as Set<string>).has(word) ? word : "ID";
			tokens.push({ kind: kind, value: word, line: tokenLine });
			continue;
		}

		// Three-char punctuators (must precede two-char).
		const threeChar = source.slice(pos, pos + 3);
		if (PUNCT3_SET.has(threeChar)) {
			tokens.push({ kind: threeChar, value: threeChar, line: tokenLine });
			pos += 3;
			continue;
		}
		// Two-char punctuators.
		const twoChar = source.slice(pos, pos + 2);
		if (PUNCT2_SET.has(twoChar)) {
			tokens.push({ kind: twoChar, value: twoChar, line: tokenLine });
			pos += 2;
			continue;
		}
		// Single-char fallback. Track bracket depth so NL is suppressed inside.
		const currentChar = source[pos];
		if (currentChar === "(" || currentChar === "[" || currentChar === "{") {
			bracketDepth++;
		} else if (currentChar === ")" || currentChar === "]" || currentChar === "}") {
			bracketDepth--;
		}
		tokens.push({ kind: currentChar, value: currentChar, line: tokenLine });
		pos++;
	}

	tokens.push({ kind: "EOF", value: "", line });
	return tokens;
}
