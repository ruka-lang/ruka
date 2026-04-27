import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { tokenize } from "./tokenizer";
import type { Token } from "./tokens";

const FIXTURES_DIR = join(__dirname, "fixtures", "ok");

// Trim line numbers + raw chars off snapshot output to make it readable.
// Line numbers are tested separately in the line-tracking suite.
function pretty(toks: Token[]): string {
	return toks
		.map((t) => {
			if (t.kind === "NL") return "NL";
			if (t.kind === "EOF") return "EOF";
			if (t.kind === "NUM") return `NUM(${t.val})`;
			if (t.kind === "STR") return `STR(${JSON.stringify(t.val)})`;
			if (t.kind === "CHAR") return `CHAR(${t.val})`;
			if (t.kind === "ID") return `ID(${t.val})`;
			return `${t.kind}`;
		})
		.join(" ");
}

describe("tokenize: fixture snapshots", () => {
	const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".ruka"));
	for (const file of files) {
		it(file, () => {
			const src = readFileSync(join(FIXTURES_DIR, file), "utf8");
			const toks = tokenize(src);
			expect(toks[toks.length - 1]?.kind).toBe("EOF");
			expect(pretty(toks)).toMatchSnapshot();
		});
	}
});

describe("tokenize: edge cases", () => {
	it("emits NL at depth 0 only", () => {
		const toks = tokenize("a\nb\n(c\nd)\ne");
		const kinds = toks.map((t) => t.kind);
		// NL between a/b, b/(, ) and e — but not between c and d (inside parens)
		expect(kinds).toEqual(["ID", "NL", "ID", "NL", "(", "ID", "ID", ")", "NL", "ID", "EOF"]);
	});

	it("distinguishes `..` from a numeric fractional part", () => {
		const toks = tokenize("1..5");
		expect(toks.slice(0, 4)).toEqual([
			{ t: "NUM", v: "1", line: 1 },
			{ t: "..", v: "..", line: 1 },
			{ t: "NUM", v: "5", line: 1 },
			{ t: "EOF", v: "", line: 1 }
		]);
	});

	it("parses `..=` as a single 3-char token", () => {
		const toks = tokenize("1..=5");
		expect(toks.map((t) => t.kind)).toEqual(["NUM", "..=", "NUM", "EOF"]);
	});

	it("preserves numeric literal text verbatim", () => {
		const toks = tokenize("2.0 2 0.5 100");
		expect(toks.filter((t) => t.kind === "NUM").map((t) => t.val)).toEqual(["2.0", "2", "0.5", "100"]);
	});

	it("keeps ${...} verbatim inside strings, including nested strings", () => {
		const toks = tokenize('"a${ "b" + c }d"');
		expect(toks[0]).toMatchObject({ t: "STR", v: 'a${ "b" + c }d' });
	});

	it("handles nested braces inside ${...}", () => {
		const toks = tokenize('"x${ {y} }z"');
		expect(toks[0]).toMatchObject({ t: "STR", v: "x${ {y} }z" });
	});

	it("decodes char escapes to u8 codepoints", () => {
		const cases: Array<[string, number]> = [
			["'a'", 97],
			["'\\n'", 10],
			["'\\t'", 9],
			["'\\\\'", 92],
			["'\\''", 39]
		];
		for (const [src, code] of cases) {
			const toks = tokenize(src);
			expect(toks[0]).toMatchObject({ t: "CHAR", v: code });
		}
	});

	it("classifies keywords vs identifiers", () => {
		const toks = tokenize("let foo = if x do 1 else 2 end");
		const ts = toks.map((t) => t.kind);
		expect(ts).toContain("let");
		expect(ts).toContain("if");
		expect(ts).toContain("do");
		expect(ts).toContain("else");
		expect(ts).toContain("end");
		// `foo` and `x` are identifiers, not keywords
		expect(toks.find((t) => t.val === "foo")?.kind).toBe("ID");
		expect(toks.find((t) => t.val === "x")?.kind).toBe("ID");
	});

	it("emits ~ as its own token (named-parameter sigil)", () => {
		const toks = tokenize("~name");
		expect(toks.map((t) => t.kind)).toEqual(["~", "ID", "EOF"]);
	});

	it("multiline string strips leading | and one optional space", () => {
		const src = ['|"', "| line 1", "|  line 2", '|"'].join("\n");
		const toks = tokenize(src);
		expect(toks[0]).toMatchObject({ t: "STR", v: "line 1\n line 2" });
	});

	it("multiline string preserves ${...} verbatim", () => {
		const src = ['|"', "| hello ${name}!", '|"'].join("\n");
		const toks = tokenize(src);
		expect(toks[0]).toMatchObject({ t: "STR", v: "hello ${name}!" });
	});

	it("skips line comments", () => {
		const toks = tokenize("a // comment\nb");
		expect(toks.map((t) => t.kind)).toEqual(["ID", "NL", "ID", "EOF"]);
	});

	it("tracks line numbers across newlines and comments", () => {
		const toks = tokenize("a\n// c\nb");
		expect(toks.find((t) => t.val === "a")?.line).toBe(1);
		expect(toks.find((t) => t.val === "b")?.line).toBe(3);
	});

	it("hits all multi-char punctuators", () => {
		const toks = tokenize("== != <= >= -> .. ** |> ..=");
		const ts = toks.filter((t) => t.kind !== "EOF").map((t) => t.kind);
		expect(ts).toEqual(["==", "!=", "<=", ">=", "->", "..", "**", "|>", "..="]);
	});
});

describe("tokenize: trailing EOF invariant", () => {
	it("always ends with EOF", () => {
		for (const src of ["", " ", "\n", "x", "let"]) {
			const toks = tokenize(src);
			expect(toks[toks.length - 1]?.kind).toBe("EOF");
		}
	});
});
