import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSource } from "../parser";
import { checkScope } from "./scope";
import { RukaError } from "../diagnostics";

const FIXTURES_DIR = join(__dirname, "..", "fixtures");
const OK_DIR = join(FIXTURES_DIR, "ok");
const ERR_DIR = join(FIXTURES_DIR, "scope-err");

describe("checkScope: ok fixtures should report no errors", () => {
	const files = readdirSync(OK_DIR).filter((f) => f.endsWith(".ruka"));
	for (const file of files) {
		it(file, () => {
			const src = readFileSync(join(OK_DIR, file), "utf8");
			const ast = parseSource(src);
			const err = checkScope(ast);
			expect(err).toBeNull();
		});
	}
});

// Each scope-err fixture's first comment line is `// expect: <substring>`
// — the test asserts that checkScope returns an error containing it.
describe("checkScope: scope-err fixtures should report the expected error", () => {
	const files = readdirSync(ERR_DIR).filter((f) => f.endsWith(".ruka"));
	for (const file of files) {
		it(file, () => {
			const src = readFileSync(join(ERR_DIR, file), "utf8");
			const expected = src.match(/^\/\/\s*expect:\s*(.+)$/m)?.[1];
			expect(expected, "fixture must declare `// expect: ...`").toBeTruthy();

			const ast = parseSource(src);
			const err = checkScope(ast);
			expect(err).toBeInstanceOf(RukaError);
			expect(err!.message).toContain(expected!);
		});
	}
});

describe("checkScope: targeted cases", () => {
	function check(src: string) {
		return checkScope(parseSource(src));
	}

	it("builtins (ruka, true, false, self) are pre-bound", () => {
		expect(check("let main = () do ruka.println(true)")).toBeNull();
	});

	it("top-level bindings hoist for forward reference", () => {
		const src = ["let main = () do other()", "let other = () do 1"].join("\n");
		expect(check(src)).toBeNull();
	});

	it("mutually-recursive top-level functions resolve", () => {
		const src = ["let a = () do b()", "let b = () do a()"].join("\n");
		expect(check(src)).toBeNull();
	});

	it("function parameters are in scope inside the body", () => {
		expect(check("let f = (x) do x + 1")).toBeNull();
	});

	it("for-loop binding is scoped to the loop body", () => {
		const src = [
			"let main = () do",
			'    for i in 1..5 do ruka.println("${i}")',
			'    ruka.println("${i}")',
			"end"
		].join("\n");
		const err = check(src);
		expect(err).toBeInstanceOf(RukaError);
		expect(err!.message).toContain("Undefined: i");
	});

	it("match variant payload binds inside the arm only", () => {
		const src = [
			"let f = (x) do",
			"    match x with",
			"        some(n) do n + 1",
			"        none    do 0",
			"    end",
			"end",
			"let main = () do f(.some(1))"
		].join("\n");
		expect(check(src)).toBeNull();
	});

	it("match payload binding does not leak to siblings", () => {
		const src = [
			"let f = (x) do",
			"    match x with",
			"        some(n) do n",
			"        none    do n", // n not in scope here
			"    end",
			"end"
		].join("\n");
		const err = check(src);
		expect(err).toBeInstanceOf(RukaError);
		expect(err!.message).toContain("Undefined: n");
	});

	it("method/static bindings do not pollute the top-level name space", () => {
		const src = [
			"let counter = record { count: int }",
			"let zero (counter) = .{ count = 0 }",
			"let main = () do counter.zero"
		].join("\n");
		expect(check(src)).toBeNull();
	});

	it("let local shadowing inside a block is fine", () => {
		const src = [
			"let main = () do",
			"    let x = 1",
			"    let x = 2",
			'    ruka.println("${x}")',
			"end"
		].join("\n");
		expect(check(src)).toBeNull();
	});

	it("reports line number on undefined identifier", () => {
		const err = check(["let main = () do", "    missing", "end"].join("\n"));
		expect(err!.line).toBe(2);
	});

	it("mutable binding allows assignment", () => {
		const src = ["let main = () do", "    let *x = 1", "    x = 2", "end"].join("\n");
		expect(check(src)).toBeNull();
	});

	it("error inside ${...} reports the enclosing string line", () => {
		const src = [
			"let main = () do",
			'    let s = "x"',
			'    ruka.println("y ${nope}")',
			"end"
		].join("\n");
		const err = check(src);
		expect(err!.line).toBe(3);
	});
});
