// Lexical alphabet of Ruka.
//
// The tokenizer is the single source of truth for what's a keyword, what's a
// multi-char operator, etc. The highlighter and parser both consume Token[]
// and classify on top — they don't re-scan source.

export const KEYWORDS = new Set([
	"let",
	"do",
	"end",
	"if",
	"else",
	"while",
	"return",
	"true",
	"false",
	"not",
	"and",
	"or",
	"match",
	"with",
	"for",
	"in",
	"break",
	"continue",
	"record",
	"variant",
	"behaviour",
	"self",
	"test",
	"defer"
] as const);

export type Keyword = typeof KEYWORDS extends Set<infer T> ? T : never;

// Multi-character punctuators, longest-first. The tokenizer tries 3-char
// matches before 2-char so `..=` beats `..`.
export const PUNCT3 = ["..="] as const;
export const PUNCT2 = ["==", "!=", "<=", ">=", "->", "..", "**", "|>"] as const;

export type TokenKind =
	| "NL"
	| "EOF"
	| "NUM"
	| "STR"
	| "CHAR"
	| "ID"
	| Keyword
	| (typeof PUNCT3)[number]
	| (typeof PUNCT2)[number]
	// Single-char punctuators are emitted with t === v, so the kind union
	// includes any string. Narrow with the helper predicates instead of relying
	// on a closed literal union here.
	| string;

export interface Token {
	kind: TokenKind;
	/**
	 * - NUM: the raw numeric text (e.g. "2", "2.0", "0.5"). The parser decides
	 *   integer vs. float by scanning for a `.` and converts to a number.
	 * - STR: raw string body with `${...}` and escape sequences preserved.
	 * - CHAR: u8 byte value (already decoded from the source escape).
	 * - everything else: the literal source text of the token.
	 */
	val: string | number;
	line: number;
}

export function isKeyword(s: string): s is Keyword {
	return (KEYWORDS as Set<string>).has(s);
}
