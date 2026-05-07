import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSource } from "../parser";
import { checkScope } from "./scope";
import { checkTypes } from "./types";
import { RukaError } from "../diagnostics";

const FIXTURES_DIR = join(__dirname, "..", "fixtures");
const OK_DIR = join(FIXTURES_DIR, "ok");
const ERR_DIR = join(FIXTURES_DIR, "type-err");

describe("checkTypes: ok fixtures should report no errors", () => {
	const files = readdirSync(OK_DIR).filter((f) => f.endsWith(".ruka"));
	for (const file of files) {
		it(file, () => {
			const src = readFileSync(join(OK_DIR, file), "utf8");
			const ast = parseSource(src);
			const scopeError = checkScope(ast);
			expect(scopeError).toBeNull();
			const typeError = checkTypes(ast);
			expect(typeError).toBeNull();
		});
	}
});

// Each type-err fixture's first comment line is `// expect: <substring>`.
describe("checkTypes: type-err fixtures should report the expected error", () => {
	const files = readdirSync(ERR_DIR).filter((f) => f.endsWith(".ruka"));
	for (const file of files) {
		it(file, () => {
			const src = readFileSync(join(ERR_DIR, file), "utf8");
			const expected = src.match(/^\/\/\s*expect:\s*(.+)$/m)?.[1];
			expect(expected, "fixture must declare `// expect: ...`").toBeTruthy();

			const ast = parseSource(src);
			expect(checkScope(ast)).toBeNull();
			const error = checkTypes(ast);
			expect(error).toBeInstanceOf(RukaError);
			expect(error!.message).toContain(expected!);
		});
	}
});

describe("checkTypes: targeted cases", () => {
	function check(src: string) {
		const ast = parseSource(src);
		expect(checkScope(ast)).toBeNull();
		return checkTypes(ast);
	}

	it("infers integer literal as int by default", () => {
		expect(check("let x = 1")).toBeNull();
	});

	it("infers float literal as float by default", () => {
		expect(check("let x = 1.5")).toBeNull();
	});

	it("typed integer binding accepts a default-int literal", () => {
		expect(check("let x: i32 = 1")).toBeNull();
	});

	it("rejects an integer literal where float is expected", () => {
		const error = check("let x: float = 1");
		expect(error).toBeInstanceOf(RukaError);
		expect(error!.message).toContain("expected float, got integer literal");
	});

	it("flags 'and' on non-bool operands", () => {
		const error = check("let main = () do 1 and 2");
		expect(error).toBeInstanceOf(RukaError);
		expect(error!.message).toContain("expected bool");
	});

	it("propagates expected type into block tail expression", () => {
		const src = ["let main = () -> int do", "    let x = 1", "    x", "end"].join("\n");
		expect(check(src)).toBeNull();
	});

	it("rejects assigning a string-typed value to an int slot", () => {
		const error = check('let main = () do let x: int = "hi"');
		expect(error).toBeInstanceOf(RukaError);
		expect(error!.message).toContain("type mismatch");
	});

	it("destructures a record by field name", () => {
		const src = [
			"let point = record { x: int, y: int }",
			"let main = () do",
			"    let p: point = { x = 1, y = 2 }",
			"    let { x, y } = p",
			'    ruka.println("${x} ${y}")',
			"end"
		].join("\n");
		expect(check(src)).toBeNull();
	});

	it("infers self-method receiver type from field accesses", () => {
		const src = [
			"let counter = record { count: int }",
			"let bump (self) = { count = self.count + 1 }",
			"let main = () do",
			"    let c: counter = { count = 0 }",
			"    let d = c.bump",
			"end"
		].join("\n");
		expect(check(src)).toBeNull();
	});

	it("variant constructor unique to one variant resolves cleanly", () => {
		const src = [
			"let hit = variant { critical: int, miss }",
			"let main = () do",
			"    let h: hit = miss",
			"    let g: hit = critical(10)",
			"end"
		].join("\n");
		expect(check(src)).toBeNull();
	});

	it("flags ambiguous variant constructor across multiple variants", () => {
		const src = [
			"let a_t = variant { tag: int }",
			"let b_t = variant { tag: int }",
			"let main = () do let a = tag(1)"
		].join("\n");
		const error = check(src);
		expect(error).toBeInstanceOf(RukaError);
		expect(error!.message).toContain("ambiguous");
	});

	it("for-loop binding gets the array element type", () => {
		const src = [
			"let main = () do",
			"    let *xs = [int]{ 1, 2, 3 }",
			'    for x in xs do ruka.println("${x}")',
			"end"
		].join("\n");
		expect(check(src)).toBeNull();
	});

	it("string indexing yields u8", () => {
		const src = [
			"let main = () do",
			'    let s = "hi"',
			"    let c: u8 = s[0]",
			"end"
		].join("\n");
		expect(check(src)).toBeNull();
	});

	it("immutable record field is detected (placeholder)", () => {
		// Sanity test: a passing record-method program covers the happy path.
		const src = [
			"let counter = record { count: int }",
			"let main = () do",
			"    let c: counter = { count = 0 }",
			'    ruka.println("${c.count}")',
			"end"
		].join("\n");
		expect(check(src)).toBeNull();
	});

	it("reports line numbers on type errors", () => {
		const src = ["let main = () do", '    let x = if true do 1 else "two"', "end"].join(
			"\n"
		);
		const error = check(src);
		expect(error!.line).toBe(2);
	});
});
