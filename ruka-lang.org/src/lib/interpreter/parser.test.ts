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
			expect(ast.kind).toBe("Program");
			expect(ast).toMatchSnapshot();
		});
	}
});

// Helpers for terse assertions.
function firstStatement(src: string) {
	return parseSource(src).body[0]!;
}
function expressionOf(src: string) {
	const stmt = firstStatement(src);
	if (stmt.kind !== "ExpressionStmt") {
		throw new Error(`expected ExpressionStmt, got ${stmt.kind}`);
	}
	return stmt.expression;
}

describe("parse: literals", () => {
	it("integer literal carries isFloat=false", () => {
		expect(expressionOf("42")).toMatchObject({
			kind: "Literal",
			value: 42,
			isFloat: false
		});
	});
	it("float literal carries isFloat=true", () => {
		expect(expressionOf("2.5")).toMatchObject({
			kind: "Literal",
			value: 2.5,
			isFloat: true
		});
	});
	it("true / false produce boolean Literal", () => {
		expect(expressionOf("true")).toMatchObject({ kind: "Literal", value: true });
		expect(expressionOf("false")).toMatchObject({ kind: "Literal", value: false });
	});
	it("string literal preserves raw body", () => {
		expect(expressionOf('"hi ${name}"')).toMatchObject({
			kind: "StringLiteral",
			raw: "hi ${name}"
		});
	});
	it("char literal stores u8 codepoint", () => {
		expect(expressionOf("'A'")).toMatchObject({ kind: "CharLiteral", value: 65 });
	});
	it("unit literal `()`", () => {
		expect(expressionOf("()")).toMatchObject({ kind: "Unit" });
	});
});

describe("parse: bindings", () => {
	it("plain let binds an identifier", () => {
		const stmt = firstStatement("let x = 1");
		expect(stmt).toMatchObject({
			kind: "Binding",
			mode: null,
			local: false,
			pattern: { kind: "IdentifierPattern", name: "x" },
			value: { kind: "Literal", value: 1 }
		});
	});

	it("mode prefix `*` marks mutability", () => {
		expect(firstStatement("let *x = 1")).toMatchObject({ kind: "Binding", mode: "*" });
	});

	it("uppercase first letter sets local=true", () => {
		expect(firstStatement("let Foo = 1")).toMatchObject({ kind: "Binding", local: true });
	});

	it("destructuring let { a, b } = expression", () => {
		expect(firstStatement("let {a, b} = pair")).toMatchObject({
			kind: "Binding",
			pattern: { kind: "RecordPattern", names: ["a", "b"] }
		});
	});

	it("self receiver clause", () => {
		expect(firstStatement("let bump (self) = 1")).toMatchObject({
			kind: "Binding",
			receiver: { kind: "self", typeAnnotation: null }
		});
	});

	it("static receiver clause", () => {
		expect(firstStatement("let zero (counter) = 0")).toMatchObject({
			kind: "Binding",
			receiver: { kind: "static", typeName: "counter" }
		});
	});

	it("typed binding parses the annotation", () => {
		expect(firstStatement("let x: int = 1")).toMatchObject({
			kind: "Binding",
			type: { kind: "NamedType", name: "int" }
		});
	});
});

describe("parse: control flow", () => {
	it("single-line if without else", () => {
		expect(expressionOf("if x do 1")).toMatchObject({ kind: "If", elseBranch: null });
	});

	it("if/else if/else chain shares one trailing end", () => {
		const src = [
			"if a do",
			"    1",
			"else if b do",
			"    2",
			"else",
			"    3",
			"end"
		].join("\n");
		const node = expressionOf(src);
		expect(node.kind).toBe("If");
		// outer.elseBranch is another If (the chain)
		expect((node as { elseBranch: { kind: string } }).elseBranch.kind).toBe("If");
	});

	it("if chain mixes multi-line middle branches with a single-line terminator", () => {
		// The terminating else is single-line, so no trailing `end` is required
		// even though an earlier else-if's then-body spans multiple lines.
		const src = [
			"if a do 1",
			"else if b do",
			"    2",
			"    3",
			"else .none"
		].join("\n");
		const node = expressionOf(src);
		expect(node.kind).toBe("If");
	});

	it("ternary `a if cond else b` desugars to If", () => {
		expect(expressionOf("1 if x else 2")).toMatchObject({
			kind: "If",
			thenBranch: { kind: "Literal", value: 1 },
			elseBranch: { kind: "Literal", value: 2 }
		});
	});

	it("while loop with single-statement body", () => {
		expect(expressionOf("while x do 1")).toMatchObject({ kind: "While" });
	});

	it("for loop with binding", () => {
		expect(firstStatement("for i in xs do 1")).toMatchObject({ kind: "For", name: "i" });
	});

	it("for loop without binding", () => {
		expect(firstStatement("for xs do 1")).toMatchObject({ kind: "For", name: null });
	});

	it("break / continue / return", () => {
		expect(firstStatement("break")).toMatchObject({ kind: "Break" });
		expect(firstStatement("continue")).toMatchObject({ kind: "Continue" });
		expect(firstStatement("return ()")).toMatchObject({ kind: "Return" });
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
		const matchNode = expressionOf(src) as {
			kind: "Match";
			arms: { pattern: { kind: string } }[];
			elseArm: unknown;
		};
		expect(matchNode.kind).toBe("Match");
		expect(matchNode.arms.map((arm) => arm.pattern.kind)).toEqual([
			"VariantPattern",
			"VariantPattern",
			"GuardPattern"
		]);
		expect(matchNode.elseArm).not.toBeNull();
	});

	it("match else accepts a multi-line block without `do`", () => {
		const src = [
			"match x with",
			"    a do 1",
			"else",
			"    let y = 2",
			"    y",
			"end",
			"end"
		].join("\n");
		const matchNode = expressionOf(src) as {
			kind: "Match";
			elseArm: { kind: "Block"; body: unknown[] } | null;
		};
		expect(matchNode.kind).toBe("Match");
		expect(matchNode.elseArm).not.toBeNull();
		expect(matchNode.elseArm!.body.length).toBe(2);
	});

	it("range pattern in match", () => {
		const src = ["match x with", '    1..=5 do "a"', 'else "b"', "end"].join("\n");
		const matchNode = expressionOf(src) as {
			arms: { pattern: { kind: string; inclusive?: boolean } }[];
		};
		expect(matchNode.arms[0]!.pattern).toMatchObject({
			kind: "RangePattern",
			inclusive: true
		});
	});
});

describe("parse: operators", () => {
	it("precedence: + below *", () => {
		// 1 + 2 * 3  →  BinaryOp(+, 1, BinaryOp(*, 2, 3))
		const node = expressionOf("1 + 2 * 3") as { op: string; right: { op: string } };
		expect(node.op).toBe("+");
		expect(node.right.op).toBe("*");
	});

	it("** is right-associative", () => {
		// 2 ** 3 ** 2  →  BinaryOp(**, 2, BinaryOp(**, 3, 2))
		const node = expressionOf("2 ** 3 ** 2") as { op: string; right: { op: string } };
		expect(node.op).toBe("**");
		expect(node.right.op).toBe("**");
	});

	it("range operator", () => {
		expect(expressionOf("1..5")).toMatchObject({ kind: "Range", inclusive: false });
	});

	it("inclusive range", () => {
		expect(expressionOf("1..=5")).toMatchObject({ kind: "Range", inclusive: true });
	});

	it("unary minus and not", () => {
		expect(expressionOf("-x")).toMatchObject({ kind: "UnaryOp", op: "-" });
		expect(expressionOf("not x")).toMatchObject({ kind: "UnaryOp", op: "not" });
	});

	it("pipeline `x |> f(y)` desugars to `f(x, y)`", () => {
		const node = expressionOf("x |> f(y)") as {
			kind: string;
			callee: { name: string };
			args: { name: string }[];
		};
		expect(node.kind).toBe("Call");
		expect(node.callee.name).toBe("f");
		expect(node.args.map((arg) => arg.name)).toEqual(["x", "y"]);
	});

	it("pipeline with bare function `x |> f` desugars to `f(x)`", () => {
		const node = expressionOf("x |> f") as { kind: string; args: { name: string }[] };
		expect(node.kind).toBe("Call");
		expect(node.args.map((arg) => arg.name)).toEqual(["x"]);
	});
});

describe("parse: postfix chains", () => {
	it("member, call, and index chain", () => {
		const node = expressionOf("a.b(c)[0]") as {
			kind: "Index";
			object: { kind: "Call"; callee: { kind: "Member" } };
		};
		expect(node.kind).toBe("Index");
		expect(node.object.kind).toBe("Call");
		expect(node.object.callee.kind).toBe("Member");
	});

	it("record literal .{ a = 1 }", () => {
		expect(expressionOf(".{a = 1}")).toMatchObject({
			kind: "RecordLiteral",
			fields: [{ name: "a", value: { kind: "Literal", value: 1 } }]
		});
	});

	it("list literal .{1, 2, 3}", () => {
		const node = expressionOf(".{1, 2, 3}") as {
			kind: "ListLiteral";
			elements: unknown[];
		};
		expect(node.kind).toBe("ListLiteral");
		expect(node.elements.length).toBe(3);
	});

	it("typed list literal [int].{1, 2}", () => {
		expect(expressionOf("[int].{1, 2}")).toMatchObject({
			kind: "ListLiteral",
			typePrefix: { kind: "ArrayType", element: { kind: "NamedType", name: "int" } }
		});
	});

	it("variant constructor .tag(payload)", () => {
		expect(expressionOf(".some(1)")).toMatchObject({
			kind: "VariantConstructor",
			tag: "some"
		});
	});
});

describe("parse: types", () => {
	it("option(T)", () => {
		expect(firstStatement("let x: option(int) = 1")).toMatchObject({
			type: { kind: "OptionType", inner: { kind: "NamedType", name: "int" } }
		});
	});

	it("result(T, E)", () => {
		expect(firstStatement("let x: result(int, string) = 1")).toMatchObject({
			type: {
				kind: "ResultType",
				ok: { kind: "NamedType", name: "int" },
				err: { kind: "NamedType", name: "string" }
			}
		});
	});

	it("tuple [a, b]", () => {
		expect(firstStatement("let x: [int, string] = 1")).toMatchObject({
			type: { kind: "TupleType" }
		});
	});

	it("array [a]", () => {
		expect(firstStatement("let x: [int] = 1")).toMatchObject({
			type: { kind: "ArrayType" }
		});
	});
});

describe("parse: errors", () => {
	it("reports an unexpected token with a line number", () => {
		try {
			parseSource(") foo");
			expect.fail("expected throw");
		} catch (error) {
			expect(error).toBeInstanceOf(RukaError);
			expect((error as RukaError).line).toBe(1);
		}
	});

	it("missing `=` in let binding", () => {
		try {
			parseSource("let x 1");
			expect.fail("expected throw");
		} catch (error) {
			expect(error).toBeInstanceOf(RukaError);
		}
	});

	it("parse() consumes pre-tokenized input", () => {
		const ast = parse(tokenize("let x = 1"));
		expect(ast.body[0]).toMatchObject({ kind: "Binding" });
	});
});
