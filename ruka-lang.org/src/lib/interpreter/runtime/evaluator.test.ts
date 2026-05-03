import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseSource } from "../parser";
import { checkScope } from "../check/scope";
import { checkTypes } from "../check/types";
import { RukaError } from "../diagnostics";
import { checkProjectFull } from "../project";
import { run } from "./evaluator";
import type { RuntimeEvent } from "./events";
import type { RuntimeProject } from "./env";

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

describe("evaluator — variant payload destructure", () => {
	it("binds the whole payload with tag(name)", () => {
		const source = `let Hit = variant {
\tcritical: int,
\tmiss
}
let main = () do
\tlet hit = .critical(42)
\tmatch hit with
\t\tcritical(dmg) do ruka.println(dmg)
\t\tmiss          do ruka.println("miss")
\tend
end
`;
		const { stdout } = drive(source);
		expect(stdout).toBe("42\n");
	});

	it("destructures a tuple payload positionally with tag((a, b))", () => {
		const source = `let Hit = variant {
\tspread: [int, int],
\tmiss
}
let main = () do
\tlet hit = .spread(.(7, 9))
\tmatch hit with
\t\tspread((lo, hi)) do ruka.println("\${lo}-\${hi}")
\t\tmiss             do ruka.println("miss")
\tend
end
`;
		const { stdout } = drive(source);
		expect(stdout).toBe("7-9\n");
	});

	it("destructures a record payload by field name with tag({a, b})", () => {
		const source = `let Damage = record { dmg: int, kind: int }
let Hit = variant {
\tcritical: Damage,
\tmiss
}
let main = () do
\tlet hit = .critical(Damage.{ dmg = 12, kind = 1 })
\tmatch hit with
\t\tcritical({dmg, kind}) do ruka.println("\${dmg}/\${kind}")
\t\tmiss                  do ruka.println("miss")
\tend
end
`;
		const { stdout } = drive(source);
		expect(stdout).toBe("12/1\n");
	});
});

function driveProject(
	files: Record<string, string>,
	entry: string
): { stdout: string; stderr: string } {
	const sources = new Map(Object.entries(files));
	const { error: checkError, asts } = checkProjectFull(sources, entry);
	if (checkError) throw checkError;

	const ast = parseSource(files[entry]!);
	const project: RuntimeProject = {
		sources,
		moduleValues: new Map(),
		visiting: new Set(),
		asts
	};

	let stdout = "";
	let stderr = "";
	const generator = run(ast, project, entry);
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
			next = generator.next("");
		}
	}
	return { stdout, stderr };
}

describe("evaluator — ruka.import", () => {
	it("calls a function exported from another module", () => {
		const { stdout } = driveProject(
			{
				"main.ruka": [
					'let util = ruka.import("util.ruka")',
					"let main = () do",
					"\truka.println(util.greet())",
					"end"
				].join("\n"),
				"util.ruka": ['let greet = () do "hello" end'].join("\n")
			},
			"main.ruka"
		);
		expect(stdout).toBe("hello\n");
	});

	it("caches imported modules across repeated imports", () => {
		const { stdout } = driveProject(
			{
				"main.ruka": [
					'let a = ruka.import("util.ruka")',
					'let b = ruka.import("util.ruka")',
					"let main = () do",
					"\truka.println(a.value)",
					"\truka.println(b.value)",
					"end"
				].join("\n"),
				// Top-level side effect runs exactly once if the module is
				// cached on first import.
				"util.ruka": [
					'let _greet = ruka.println("loaded")',
					"let value = 42"
				].join("\n")
			},
			"main.ruka"
		);
		expect(stdout).toBe("loaded\n42\n42\n");
	});

	it("resolves nested directory imports", () => {
		const { stdout } = driveProject(
			{
				"main.ruka": [
					'let m = ruka.import("lib/math.ruka")',
					"let main = () do",
					"\truka.println(m.answer)",
					"end"
				].join("\n"),
				"lib/math.ruka": ["let answer = 7"].join("\n")
			},
			"main.ruka"
		);
		expect(stdout).toBe("7\n");
	});

	it("dispatches methods on a record type re-exported through an intermediate module", () => {
		// Mirrors the networks example: type `t` defined in single.ruka, re-exported
		// via root.ruka as `single`, then used in main.ruka where the binding name
		// doesn't match the original typeName "t".
		const { stdout } = driveProject(
			{
				"main.ruka": [
					'let { single } = ruka.import("root.ruka")',
					"let main = () do",
					"\tlet *obj = single.new()",
					"\tobj.inc()",
					"\truka.println(obj.n)",
					"end"
				].join("\n"),
				"root.ruka": [
					'let Single = ruka.import("single.ruka")',
					"let single = Single.t"
				].join("\n"),
				"single.ruka": [
					"let t = record { n: int }",
					"let new (t) = () do .{ n = 0 } end",
					"let inc (*self) = () do",
					"\tself.n = self.n + 1",
					"end"
				].join("\n")
			},
			"main.ruka"
		);
		expect(stdout).toBe("1\n");
	});
});

describe("evaluator — receiver modes", () => {
	it("parses and calls a method with a (*self) mutable receiver", () => {
		const source = [
			"let counter = record { n: int }",
			"let inc (*self) = () do",
			"\tself.n = self.n + 1",
			"end",
			"let main = () do",
			"\tlet *c = counter.{ n = 0 }",
			"\tc.inc()",
			"\tc.inc()",
			"\truka.println(c.n)",
			"end"
		].join("\n");
		const { stdout } = drive(source);
		expect(stdout).toBe("2\n");
	});
});

describe("evaluator — record literal shorthand", () => {
	it("expands a pure-shorthand record literal", () => {
		const source = [
			"let point = record { x: int, y: int }",
			"let main = () do",
			"\tlet x = 3",
			"\tlet y = 7",
			"\tlet p = point.{ x, y }",
			"\truka.println(p.x)",
			"\truka.println(p.y)",
			"end"
		].join("\n");
		const { stdout } = drive(source);
		expect(stdout).toBe("3\n7\n");
	});

	it("expands shorthand fields mixed with explicit fields", () => {
		const source = [
			"let vec = record { x: float, y: float, label: int }",
			"let main = () do",
			"\tlet x = 1.0",
			"\tlet y = 2.0",
			"\tlet v = vec.{ x, y, label = 42 }",
			"\truka.println(v.label)",
			"end"
		].join("\n");
		const { stdout } = drive(source);
		expect(stdout).toBe("42\n");
	});
});

describe("evaluator — complex assignment", () => {
	it("assigns to a record field", () => {
		const source = [
			"let point = record { x: int, y: int }",
			"let main = () do",
			"\tlet *p = point.{ x = 1, y = 2 }",
			"\tp.x = 99",
			"\truka.println(p.x)",
			"end"
		].join("\n");
		const { stdout } = drive(source);
		expect(stdout).toBe("99\n");
	});

	it("assigns to an array index", () => {
		const source = inMain(
			["let *arr = [int].{10, 20, 30}", "arr[1] = 99", "ruka.println(arr)"].join("\n")
		);
		const { stdout } = drive(source);
		expect(stdout).toBe(".{10, 99, 30}\n");
	});

	it("assigns to a record field that holds an array", () => {
		const source = [
			"let bag = record { items: [int] }",
			"let main = () do",
			"\tlet *b = bag.{ items = [int].{1, 2, 3} }",
			"\tb.items[0] = 42",
			"\truka.println(b.items)",
			"end"
		].join("\n");
		const { stdout } = drive(source);
		expect(stdout).toBe(".{42, 2, 3}\n");
	});

	it("reflects field mutation through the same binding", () => {
		const source = [
			"let counter = record { n: int }",
			"let main = () do",
			"\tlet *c = counter.{ n = 0 }",
			"\tc.n = c.n + 1",
			"\tc.n = c.n + 1",
			"\truka.println(c.n)",
			"end"
		].join("\n");
		const { stdout } = drive(source);
		expect(stdout).toBe("2\n");
	});
});

describe("evaluator — for loop tuple destructuring", () => {
	it("destructures tuple elements in a for loop", () => {
		const source = inMain(
			[
				"let pairs = [[int, int]].{ .(1, 10), .(2, 20), .(3, 30) }",
				"let *sum = 0",
				"for (a, b) in pairs do",
				"\tsum = sum + a + b",
				"end",
				"ruka.println(sum)"
			].join("\n")
		);
		const { stdout } = drive(source);
		expect(stdout).toBe("66\n");
	});

	it("makes only the first element available when pattern is shorter than tuple", () => {
		const source = inMain(
			[
				"let triples = [[int, int, int]].{ .(1, 2, 3), .(4, 5, 6) }",
				"let *total = 0",
				"for (x, y) in triples do",
				"\ttotal = total + x + y",
				"end",
				"ruka.println(total)"
			].join("\n")
		);
		const { stdout } = drive(source);
		expect(stdout).toBe("12\n");
	});
});

describe("evaluator — array comprehensions", () => {
	it("repeats a value across a range (pattern-less)", () => {
		const source = inMain(
			["let zeros = [float].{ for 0..4 do 0.0 }", "ruka.println(zeros)"].join("\n")
		);
		const { stdout } = drive(source);
		expect(stdout).toBe(".{0, 0, 0, 0}\n");
	});

	it("maps a named binding over a range", () => {
		const source = inMain(
			["let doubled = .{ for i in 0..4 do i * 2 }", "ruka.println(doubled)"].join("\n")
		);
		const { stdout } = drive(source);
		expect(stdout).toBe(".{0, 2, 4, 6}\n");
	});

	it("works with a type prefix", () => {
		const source = inMain(
			["let ones = [int].{ for 0..3 do 1 }", "ruka.println(ones)"].join("\n")
		);
		const { stdout } = drive(source);
		expect(stdout).toBe(".{1, 1, 1}\n");
	});

	it("destructures tuples from the iterable", () => {
		const source = inMain(
			[
				"let pairs = [[int, int]].{ .(1, 10), .(2, 20) }",
				"let sums = .{ for (a, b) in pairs do a + b }",
				"ruka.println(sums)"
			].join("\n")
		);
		const { stdout } = drive(source);
		expect(stdout).toBe(".{11, 22}\n");
	});

	it("produces an empty array for an empty range", () => {
		const source = inMain(
			["let empty = [int].{ for 0..0 do 1 }", "ruka.println(empty.len())"].join("\n")
		);
		const { stdout } = drive(source);
		expect(stdout).toBe("0\n");
	});
});
