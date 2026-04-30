import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseSource } from "../parser";
import { checkScope } from "../check/scope";
import { checkTypes } from "../check/types";
import { RukaError } from "../diagnostics";
import { run } from "./evaluator";
import type { RuntimeEvent } from "./events";

const fixturesDir = join(__dirname, "..", "fixtures");

// Drives a Generator<RuntimeEvent, void, string> to completion. Collects
// stdout/stderr text and answers each input request from the supplied queue
// in order; if there is no answer queued, the empty string is sent (so a
// program that reads more lines than were prepared still terminates).
function drive(source: string, inputs: string[] = []): { stdout: string; stderr: string } {
	const ast = parseSource(source);
	const scopeError = checkScope(ast);
	if (scopeError) throw scopeError;
	const typeError = checkTypes(ast);
	if (typeError) throw typeError;

	let stdout = "";
	let stderr = "";
	const remaining = [...inputs];
	const generator = run(ast);
	let next = generator.next();
	while (!next.done) {
		const event: RuntimeEvent = next.value;
		if (event.kind === "stdout") {
			stdout += event.text;
			next = generator.next();
		} else if (event.kind === "stderr") {
			stderr += event.text;
			next = generator.next();
		} else {
			next = generator.next(remaining.shift() ?? "");
		}
	}
	return { stdout, stderr };
}

describe("evaluator — ok fixtures", () => {
	const okDir = join(fixturesDir, "ok");
	const files = readdirSync(okDir).filter((name) => name.endsWith(".ruka"));
	for (const file of files) {
		it(`runs ${file} without errors`, () => {
			const source = readFileSync(join(okDir, file), "utf8");
			expect(() => drive(source)).not.toThrow();
		});
	}
});

describe("evaluator — basics", () => {
	it("evaluates arithmetic via println", () => {
		const { stdout } = drive("ruka.println(1 + 2 * 3)\n");
		expect(stdout).toBe("7\n");
	});

	it("concatenates strings with .concat", () => {
		const { stdout } = drive('ruka.println("hello, ".concat("world"))\n');
		expect(stdout).toBe("hello, world\n");
	});

	it("auto-calls main if public", () => {
		const source = `let main = () do\n  ruka.println("from main")\nend\n`;
		const { stdout } = drive(source);
		expect(stdout).toBe("from main\n");
	});

	it("does not auto-call private Main (uppercase)", () => {
		const source = `let Main = () do\n  ruka.println("nope")\nend\n`;
		const { stdout } = drive(source);
		expect(stdout).toBe("");
	});

	it("evaluates if/else as a statement", () => {
		const source = `if true do ruka.println(1)\nelse ruka.println(2)\n`;
		const { stdout } = drive(source);
		expect(stdout).toBe("1\n");
	});

	it("threads input from the host into ruka.read", () => {
		const source = `let name = ruka.read()\nruka.println("hi ".concat(name))\n`;
		const { stdout } = drive(source, ["alice"]);
		expect(stdout).toBe("hi alice\n");
	});

	it("emits inputRequest events for ruka.readln", () => {
		const ast = parseSource(`let line = ruka.readln()\nruka.println(line)\n`);
		const generator = run(ast);
		const events: RuntimeEvent[] = [];
		let next = generator.next();
		while (!next.done) {
			events.push(next.value);
			next =
				next.value.kind === "inputRequest"
					? generator.next("typed line")
					: generator.next();
		}
		expect(events.some((event) => event.kind === "inputRequest")).toBe(true);
		expect(events.filter((event) => event.kind === "stdout").map((event) => event.text)).toEqual([
			"typed line\n"
		]);
	});

	it("rejects assignment to immutable bindings at runtime", () => {
		const source = `let x = 1\nx = 2\n`;
		expect(() => drive(source)).toThrow(/immutable/);
	});

	it("allows assignment to mutable bindings", () => {
		const source = `let *x = 1\nx = 2\nruka.println(x)\n`;
		const { stdout } = drive(source);
		expect(stdout).toBe("2\n");
	});

	it("loops with for over a range", () => {
		const source = `for i in 0..3 do\n  ruka.print(i)\nend\n`;
		const { stdout } = drive(source);
		expect(stdout).toBe("012");
	});

	it("supports while + break", () => {
		const source = `let *i = 0\nwhile i < 5 do\n  if i == 3 do break\n  ruka.print(i)\n  i = i + 1\nend\n`;
		const { stdout } = drive(source);
		expect(stdout).toBe("012");
	});

	it("evaluates string interpolation", () => {
		const source = 'let n = 7\nruka.println("n = ${n}")\n';
		const { stdout } = drive(source);
		expect(stdout).toBe("n = 7\n");
	});

	it("annotates RukaError with a line number on runtime errors", () => {
		const source = `ruka.println(1)\nlet x = 1\nx = 2\n`;
		try {
			drive(source);
		} catch (error) {
			expect(error).toBeInstanceOf(RukaError);
			expect((error as RukaError).line).toBe(3);
			return;
		}
		throw new Error("expected RukaError");
	});
});
