import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSource, parse } from "./parser";
import { tokenize } from "./tokenizer";
import { RukaError } from "./diagnostics";

const FIXTURES_DIR = join(__dirname, "fixtures", "ok");

describe("parse: fixture snapshots", () => {
	const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".ruka"));
	for (const file of files) {
		it(file, () => {
			const src = readFileSync(join(FIXTURES_DIR, file), "utf8");
			const ast = parseSource(src);
			expect(ast.k).toBe("Program");
			expect(ast).toMatchSnapshot();
		});
	}
});

// Helpers for terse assertions.
function firstStmt(src: string) {
	return parseSource(src).body[0]!;
}
function exprOf(src: string) {
	const s = firstStmt(src);
	if (s.k !== "ExprStmt") throw new Error(`expected ExprStmt, got ${s.k}`);
	return s.expr;
}

describe("parse: literals", () => {
	it("integer literal carries isFloat=false", () => {
		const e = exprOf("42");
		expect(e).toMatchObject({ k: "Lit", v: 42, isFloat: false });
	});
	it("float literal carries isFloat=true", () => {
		const e = exprOf("2.5");
		expect(e).toMatchObject({ k: "Lit", v: 2.5, isFloat: true });
	});
	it("true / false produce boolean Lit", () => {
		expect(exprOf("true")).toMatchObject({ k: "Lit", v: true });
		expect(exprOf("false")).toMatchObject({ k: "Lit", v: false });
	});
	it("string literal preserves raw body", () => {
		expect(exprOf('"hi ${name}"')).toMatchObject({ k: "Str", raw: "hi ${name}" });
	});
	it("char literal stores u8 codepoint", () => {
		expect(exprOf("'A'")).toMatchObject({ k: "Char", v: 65 });
	});
	it("unit literal `()`", () => {
		expect(exprOf("()")).toMatchObject({ k: "Unit" });
	});
});

describe("parse: bindings", () => {
	it("plain let binds an identifier", () => {
		const s = firstStmt("let x = 1");
		expect(s).toMatchObject({
			k: "Bind",
			mode: null,
			local: false,
			pat: { k: "IdentPat", name: "x" },
			value: { k: "Lit", v: 1 }
		});
	});

	it("mode prefix `*` marks mutability", () => {
		expect(firstStmt("let *x = 1")).toMatchObject({ k: "Bind", mode: "*" });
	});

	it("uppercase first letter sets local=true", () => {
		expect(firstStmt("let Foo = 1")).toMatchObject({ k: "Bind", local: true });
	});

	it("destructuring let { a, b } = expr", () => {
		const s = firstStmt("let {a, b} = pair");
		expect(s).toMatchObject({
			k: "Bind",
			pat: { k: "TuplePat", names: ["a", "b"] }
		});
	});

	it("self receiver clause", () => {
		const s = firstStmt("let bump (self) = 1");
		expect(s).toMatchObject({
			k: "Bind",
			receiver: { kind: "self", tyAnno: null }
		});
	});

	it("static receiver clause", () => {
		const s = firstStmt("let zero (counter) = 0");
		expect(s).toMatchObject({
			k: "Bind",
			receiver: { kind: "static", tyName: "counter" }
		});
	});

	it("typed binding parses the annotation", () => {
		const s = firstStmt("let x: int = 1");
		expect(s).toMatchObject({
			k: "Bind",
			type: { k: "TyName", name: "int" }
		});
	});
});

describe("parse: control flow", () => {
	it("single-line if without else", () => {
		const e = exprOf("if x do 1");
		expect(e).toMatchObject({ k: "If", else_: null });
	});

	it("if/else if/else chain shares one trailing end", () => {
		const src = ["if a do", "    1", "else if b do", "    2", "else", "    3", "end"].join("\n");
		const e = exprOf(src);
		expect(e.k).toBe("If");
		// outer.else_ is another If (the chain)
		expect((e as { else_: { k: string } }).else_.k).toBe("If");
	});

	it("ternary `a if cond else b` desugars to If", () => {
		const e = exprOf("1 if x else 2");
		expect(e).toMatchObject({
			k: "If",
			then: { k: "Lit", v: 1 },
			else_: { k: "Lit", v: 2 }
		});
	});

	it("while loop with single-statement body", () => {
		const e = exprOf("while x do 1");
		expect(e).toMatchObject({ k: "While" });
	});

	it("for loop with binding", () => {
		const s = firstStmt("for i in xs do 1");
		expect(s).toMatchObject({ k: "For", name: "i" });
	});

	it("for loop without binding", () => {
		const s = firstStmt("for xs do 1");
		expect(s).toMatchObject({ k: "For", name: null });
	});

	it("break / continue / return", () => {
		expect(firstStmt("break")).toMatchObject({ k: "Break" });
		expect(firstStmt("continue")).toMatchObject({ k: "Continue" });
		expect(firstStmt("return ()")).toMatchObject({ k: "Return" });
	});
});

describe("parse: match", () => {
	it("match arms with bare-tag, payload-binding, and guard patterns", () => {
		const src = [
			"match x with",
			"    a do 1",
			"    b(n) do n",
			"    n > 0 do 2",
			"else 0",
			"end"
		].join("\n");
		const m = exprOf(src) as { k: "Match"; arms: { pat: { k: string } }[]; elseArm: unknown };
		expect(m.k).toBe("Match");
		expect(m.arms.map((a) => a.pat.k)).toEqual(["VariantPat", "VariantPat", "GuardPat"]);
		expect(m.elseArm).not.toBeNull();
	});

	it("range pattern in match", () => {
		const src = ["match x with", '    1..=5 do "a"', 'else "b"', "end"].join("\n");
		const m = exprOf(src) as { arms: { pat: { k: string; inclusive?: boolean } }[] };
		expect(m.arms[0]!.pat).toMatchObject({ k: "RangePat", inclusive: true });
	});
});

describe("parse: operators", () => {
	it("precedence: + below *", () => {
		// 1 + 2 * 3  →  BinOp(+, 1, BinOp(*, 2, 3))
		const e = exprOf("1 + 2 * 3") as { op: string; right: { op: string } };
		expect(e.op).toBe("+");
		expect(e.right.op).toBe("*");
	});

	it("** is right-associative", () => {
		// 2 ** 3 ** 2  →  BinOp(**, 2, BinOp(**, 3, 2))
		const e = exprOf("2 ** 3 ** 2") as { op: string; right: { op: string } };
		expect(e.op).toBe("**");
		expect(e.right.op).toBe("**");
	});

	it("range operator", () => {
		const e = exprOf("1..5");
		expect(e).toMatchObject({ k: "Range", inclusive: false });
	});

	it("inclusive range", () => {
		const e = exprOf("1..=5");
		expect(e).toMatchObject({ k: "Range", inclusive: true });
	});

	it("unary minus and not", () => {
		expect(exprOf("-x")).toMatchObject({ k: "Unary", op: "-" });
		expect(exprOf("not x")).toMatchObject({ k: "Unary", op: "not" });
	});

	it("pipeline `x |> f(y)` desugars to `f(x, y)`", () => {
		const e = exprOf("x |> f(y)") as {
			k: string;
			callee: { name: string };
			args: { name: string }[];
		};
		expect(e.k).toBe("Call");
		expect(e.callee.name).toBe("f");
		expect(e.args.map((a) => a.name)).toEqual(["x", "y"]);
	});

	it("pipeline with bare function `x |> f` desugars to `f(x)`", () => {
		const e = exprOf("x |> f") as { k: string; args: { name: string }[] };
		expect(e.k).toBe("Call");
		expect(e.args.map((a) => a.name)).toEqual(["x"]);
	});
});

describe("parse: postfix chains", () => {
	it("member, call, and index chain", () => {
		const e = exprOf("a.b(c)[0]") as { k: "Index"; obj: { k: "Call"; callee: { k: "Member" } } };
		expect(e.k).toBe("Index");
		expect(e.obj.k).toBe("Call");
		expect(e.obj.callee.k).toBe("Member");
	});

	it("record literal .{ a = 1 }", () => {
		const e = exprOf(".{a = 1}");
		expect(e).toMatchObject({
			k: "RecordLit",
			fields: [{ name: "a", value: { k: "Lit", v: 1 } }]
		});
	});

	it("list literal .{1, 2, 3}", () => {
		const e = exprOf(".{1, 2, 3}") as { k: "List"; elements: unknown[] };
		expect(e.k).toBe("List");
		expect(e.elements.length).toBe(3);
	});

	it("typed list literal [int].{1, 2}", () => {
		const e = exprOf("[int].{1, 2}");
		expect(e).toMatchObject({
			k: "List",
			typePrefix: { k: "TyArray", elem: { k: "TyName", name: "int" } }
		});
	});

	it("variant constructor .tag(payload)", () => {
		const e = exprOf(".some(1)");
		expect(e).toMatchObject({ k: "VariantCtor", tag: "some" });
	});
});

describe("parse: types", () => {
	it("option(T)", () => {
		const s = firstStmt("let x: option(int) = 1");
		expect(s).toMatchObject({ type: { k: "TyOption", inner: { k: "TyName", name: "int" } } });
	});

	it("result(T, E)", () => {
		const s = firstStmt("let x: result(int, string) = 1");
		expect(s).toMatchObject({
			type: {
				k: "TyResult",
				ok: { k: "TyName", name: "int" },
				err: { k: "TyName", name: "string" }
			}
		});
	});

	it("tuple [a, b]", () => {
		const s = firstStmt("let x: [int, string] = 1");
		expect(s).toMatchObject({ type: { k: "TyTuple" } });
	});

	it("array [a]", () => {
		const s = firstStmt("let x: [int] = 1");
		expect(s).toMatchObject({ type: { k: "TyArray" } });
	});
});

describe("parse: errors", () => {
	it("reports an unexpected token with a line number", () => {
		try {
			parseSource(") foo");
			expect.fail("expected throw");
		} catch (e) {
			expect(e).toBeInstanceOf(RukaError);
			expect((e as RukaError).line).toBe(1);
		}
	});

	it("missing `=` in let binding", () => {
		try {
			parseSource("let x 1");
			expect.fail("expected throw");
		} catch (e) {
			expect(e).toBeInstanceOf(RukaError);
		}
	});

	it("parse() consumes pre-tokenized input", () => {
		const ast = parse(tokenize("let x = 1"));
		expect(ast.body[0]).toMatchObject({ k: "Bind" });
	});
});
