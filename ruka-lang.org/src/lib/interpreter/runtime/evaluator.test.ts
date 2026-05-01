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
function drive(
	source: string,
	inputs: string[] = []
): { stdout: string; stderr: string } {
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

// Wrap a body of statements in a `let main = () do … end` declaration so
// the basics tests can stay focused on what the evaluator does, not on the
// surrounding declaration boilerplate.
function inMain(body: string): string {
	return `let main = () do\n${body}\nend\n`;
}

describe("evaluator — basics", () => {
	it("evaluates arithmetic via println", () => {
		const { stdout } = drive(inMain("ruka.println(1 + 2 * 3)"));
		expect(stdout).toBe("7\n");
	});

	it("concatenates strings with .concat", () => {
		const { stdout } = drive(inMain('ruka.println("hello, ".concat("world"))'));
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
		const source = inMain(`if true do ruka.println(1)\nelse ruka.println(2)`);
		const { stdout } = drive(source);
		expect(stdout).toBe("1\n");
	});

	it("threads input from the host into ruka.read", () => {
		const source = inMain(`let name = ruka.read()\nruka.println("hi ".concat(name))`);
		const { stdout } = drive(source, ["alice"]);
		expect(stdout).toBe("hi alice\n");
	});

	it("emits inputRequest events for ruka.readln", () => {
		const ast = parseSource(inMain(`let line = ruka.readln()\nruka.println(line)`));
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
		expect(
			events.filter((event) => event.kind === "stdout").map((event) => event.text)
		).toEqual(["typed line\n"]);
	});

	it("rejects assignment to immutable bindings at runtime", () => {
		const source = inMain(`let x = 1\nx = 2`);
		expect(() => drive(source)).toThrow(/immutable/);
	});

	it("allows assignment to mutable bindings", () => {
		const source = inMain(`let *x = 1\nx = 2\nruka.println(x)`);
		const { stdout } = drive(source);
		expect(stdout).toBe("2\n");
	});

	it("loops with for over a range", () => {
		const source = inMain(`for i in 0..3 do\n  ruka.print(i)\nend`);
		const { stdout } = drive(source);
		expect(stdout).toBe("012");
	});

	it("supports while + break", () => {
		const source = inMain(
			`let *i = 0\nwhile i < 5 do\n  if i == 3 do break\n  ruka.print(i)\n  i = i + 1\nend`
		);
		const { stdout } = drive(source);
		expect(stdout).toBe("012");
	});

	it("evaluates string interpolation", () => {
		const source = inMain('let n = 7\nruka.println("n = ${n}")');
		const { stdout } = drive(source);
		expect(stdout).toBe("n = 7\n");
	});

	it("annotates RukaError with a line number on runtime errors", () => {
		const source = `let main = () do\n\tlet x = 1\n\tx = 2\nend\n`;
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
