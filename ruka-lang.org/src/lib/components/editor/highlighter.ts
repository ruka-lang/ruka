// Surface-level syntax highlighter for the playground editor. This is a
// lenient single-pass scanner — it must produce sensible output for partial
// or malformed input as the user types, so it does NOT reuse the interpreter
// tokenizer (which raises on invalid sources).
//
// Output is HTML: each recognised lexeme becomes a `<span class="ruka-hl-X">`
// where X is one of the TokenClass values. Plain text and unrecognised bytes
// are HTML-escaped and emitted bare. Color is resolved by CSS custom
// properties (see themes.ts) so the scheme is fully data-driven.

import type { TokenClass } from "./themes";

const KEYWORDS = new Set([
	"let",
	"local",
	"if",
	"match",
	"while",
	"for",
	"return",
	"record",
	"variant",
	"behaviour",
	"true",
	"false",
	"self",
	"test",
	"break",
	"continue",
	"defer"
]);

// `ruka` is the reserved built-in module identifier; styled as a keyword.
const BUILTIN_IDENTS = new Set(["ruka"]);

const OPERATORS = new Set([
	"+",
	"-",
	"*",
	"**",
	"/",
	"%",
	"==",
	"!=",
	"<",
	">",
	"<=",
	">=",
	",",
	"=",
	"->",
	":",
	".",
	"..",
	"..=",
	"@",
	"&",
	"$",
	"|",
	"^",
	"!",
	"?",
	"and",
	"or",
	"not",
	"in"
]);

const STRUCTURES = new Set(["(", ")", "[", "]", "{", "}"]);

// Word-form structural delimiters that pair like brackets — `do … end` opens
// and closes a block the same way `{` and `}` do. Highlighted as `strc` so
// they read as scaffolding rather than syntax words.
const WORD_STRUCTURES = new Set(["do", "end", "with", "else"]);

export function escapeHtml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function span(cls: TokenClass, s: string): string {
	return `<span class="ruka-hl-${cls}">${escapeHtml(s)}</span>`;
}

// Render the body of a string literal (quotes already stripped). `${ … }`
// holes are emitted as marker spans surrounding the recursively-highlighted
// inner expression so the user sees the boundary clearly.
function highlightStrContent(raw: string): string {
	let out = "";
	let i = 0;
	while (i < raw.length) {
		if (raw[i] === "$" && raw[i + 1] === "{") {
			out += span("strc", "${");
			i += 2;
			let depth = 1;
			let inner = "";
			while (i < raw.length && depth > 0) {
				if (raw[i] === "{") {
					depth++;
				} else if (raw[i] === "}") {
					depth--;
					if (depth === 0) break;
				}
				inner += raw[i++];
			}
			out += highlight(inner);
			out += span("strc", "}");
			i++;
		} else {
			const start = i;
			while (i < raw.length && !(raw[i] === "$" && raw[i + 1] === "{")) {
				if (raw[i] === "\\" && i + 1 < raw.length) {
					i += 2;
					continue;
				}
				i++;
			}
			if (i > start) out += span("str", raw.slice(start, i));
		}
	}
	return out;
}

// Walk back from `i - 1` over whitespace, then return the two characters
// immediately preceding the first non-space byte. Used to detect when an
// identifier is a type position (`: Foo`, `-> Foo`).
function previousNonSpacePair(
	raw: string,
	i: number
): { first: string; second: string } | null {
	for (let k = i - 1; k > 0; k--) {
		if (!/\s/.test(raw[k]!)) {
			return { first: raw[k - 1] ?? "", second: raw[k]! };
		}
	}
	return null;
}

export function highlight(raw: string): string {
	let out = "";
	let i = 0;

	while (i < raw.length) {
		// Line comment.
		if (raw[i] === "/" && raw[i + 1] === "/") {
			const end = raw.indexOf("\n", i);
			const stop = end === -1 ? raw.length : end;
			out += span("cmt", raw.slice(i, stop));
			i = stop;
			continue;
		}

		// Multiline string `|" … |"`.
		if (raw[i] === "|" && raw[i + 1] === '"') {
			let j = i + 2;
			let content = "";
			while (j < raw.length) {
				if (raw[j] === "|" && raw[j + 1] === '"') {
					j += 2;
					break;
				}
				content += raw[j++];
			}
			// Body excludes the closing `|"` even if it was found, so wrap
			// only the content between the delimiters in interpolation
			// highlighting and emit the delimiters separately.
			const bodyEnd = raw.endsWith('|"', j) ? j - 2 : j;
			out += span("str", '|"');
			out += highlightStrContent(raw.slice(i + 2, bodyEnd));
			if (bodyEnd < j) out += span("str", '|"');
			i = j;
			continue;
		}

		// Standard string literal.
		if (raw[i] === '"') {
			let j = i + 1;
			let strContent = "";
			while (j < raw.length && raw[j] !== '"') {
				if (raw[j] === "\\" && j + 1 < raw.length) {
					strContent += raw[j]! + raw[j + 1]!;
					j += 2;
					continue;
				}
				strContent += raw[j++];
			}
			out += span("str", '"');
			out += highlightStrContent(strContent);
			if (j < raw.length) out += span("str", '"');
			i = j < raw.length ? j + 1 : j;
			continue;
		}

		// Char literal `'x'`, `'\n'`, `'\\'`.
		if (raw[i] === "'") {
			let j = i + 1;
			if (j < raw.length && raw[j] === "\\") j++;
			j++;
			if (j < raw.length && raw[j] === "'") j++;
			out += span("str", raw.slice(i, j));
			i = j;
			continue;
		}

		// Named-parameter label `~name`.
		if (raw[i] === "~") {
			let j = i + 1;
			while (j < raw.length && /\w/.test(raw[j]!)) j++;
			out += span("lbl", raw.slice(i, j));
			i = j;
			continue;
		}

		// Number literal. The fractional dot is consumed only when it isn't
		// the start of a `..` / `..=` range operator.
		if (/\d/.test(raw[i]!)) {
			let j = i;
			if (raw[i] === "0" && (raw[i + 1] === "b" || raw[i + 1] === "x")) {
				j += 2;
				while (j < raw.length && /[\da-fA-F]/.test(raw[j]!)) j++;
			} else {
				while (j < raw.length && /\d/.test(raw[j]!)) j++;
				if (raw[j] === "." && raw[j + 1] !== "." && /\d/.test(raw[j + 1] ?? "")) {
					j++;
					while (j < raw.length && /\d/.test(raw[j]!)) j++;
				}
			}
			out += span("num", raw.slice(i, j));
			i = j;
			continue;
		}

		// Word-form structural delimiters (do / end). Same word-boundary rule
		// as SURROUNDS — reject when the next char extends the identifier.
		const wstr =
			(WORD_STRUCTURES.has(raw.slice(i, i + 4)) && raw.slice(i, i + 4)) ||
			(WORD_STRUCTURES.has(raw.slice(i, i + 3)) && raw.slice(i, i + 3)) ||
			(WORD_STRUCTURES.has(raw.slice(i, i + 2)) && raw.slice(i, i + 2)) ||
			null;
		if (wstr && (i + wstr.length >= raw.length || !/\w/.test(raw[i + wstr.length]!))) {
			out += span("kw", wstr);
			i += wstr.length;
			continue;
		}

		// Operators (longest match first).
		const op =
			(OPERATORS.has(raw.slice(i, i + 3)) && raw.slice(i, i + 3)) ||
			(OPERATORS.has(raw.slice(i, i + 2)) && raw.slice(i, i + 2)) ||
			(OPERATORS.has(raw[i]!) && raw[i]!) ||
			null;
		if (op) {
			// Word-form ops (and / or / not) must not be a prefix of an
			// identifier; symbol ops have no such risk.
			const isWordOp = /[a-zA-Z]/.test(op[0]!);
			const safe =
				!isWordOp || i + op.length >= raw.length || !/\w/.test(raw[i + op.length]!);
			if (safe) {
				out += span("op", op);
				i += op.length;
				continue;
			}
		}

		// Brackets / braces / parens.
		const strc =
			(STRUCTURES.has(raw.slice(i, i + 2)) && raw.slice(i, i + 2)) ||
			(STRUCTURES.has(raw[i]!) && raw[i]!) ||
			null;
		if (strc) {
			out += span("strc", strc);
			i += strc.length;
			continue;
		}

		// Identifier / keyword / type.
		if (/[a-zA-Z_]/.test(raw[i]!)) {
			let j = i;
			while (j < raw.length && /\w/.test(raw[j]!)) j++;
			const word = raw.slice(i, j);
			if (KEYWORDS.has(word) || BUILTIN_IDENTS.has(word)) {
				out += span("kw", word);
			} else {
				// Types aren't required to be capitalized; they're identified
				// by being preceded by `:` or `->` (with optional spaces).
				const prev = previousNonSpacePair(raw, i);
				const isType =
					prev !== null &&
					(prev.second === ":" || (prev.first === "-" && prev.second === ">"));
				if (isType) out += span("tp", word);
				else out += escapeHtml(word);
			}
			i = j;
			continue;
		}

		out += escapeHtml(raw[i++]!);
	}

	return out;
}
