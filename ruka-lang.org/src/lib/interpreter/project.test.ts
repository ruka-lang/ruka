import { describe, expect, test } from "vitest";
import { checkProject, resolveImportPath } from "./project";

describe("resolveImportPath", () => {
	test("resolves bare names against the importer's directory", () => {
		expect(resolveImportPath("main.ruka", "util.ruka")).toBe("util.ruka");
		expect(resolveImportPath("src/main.ruka", "util.ruka")).toBe("src/util.ruka");
	});

	test("resolves explicit `./` and nested directories", () => {
		expect(resolveImportPath("src/main.ruka", "./util.ruka")).toBe("src/util.ruka");
		expect(resolveImportPath("src/main.ruka", "lib/math.ruka")).toBe(
			"src/lib/math.ruka"
		);
	});

	test("resolves `../` against the importer's directory", () => {
		expect(resolveImportPath("src/lib/math.ruka", "../util.ruka")).toBe(
			"src/util.ruka"
		);
		expect(resolveImportPath("src/lib/math.ruka", "../../top.ruka")).toBe("top.ruka");
	});

	test("rejects absolute paths and root escapes", () => {
		expect(resolveImportPath("main.ruka", "/abs.ruka")).toBeNull();
		expect(resolveImportPath("main.ruka", "../escape.ruka")).toBeNull();
	});
});

describe("checkProject", () => {
	function sources(entries: Record<string, string>): Map<string, string> {
		return new Map(Object.entries(entries));
	}

	test("type-checks a project that imports across files", () => {
		const project = sources({
			"main.ruka": [
				'let util = ruka.import("util.ruka")',
				"let main = () do",
				"\truka.println(util.greeting)",
				"end"
			].join("\n"),
			"util.ruka": ['let greeting = "hi"'].join("\n")
		});

		expect(checkProject(project, "main.ruka")).toBeNull();
	});

	test("only `let` bindings are exported; `local` bindings are private", () => {
		const project = sources({
			"main.ruka": [
				'let util = ruka.import("util.ruka")',
				"let main = () do",
				"\truka.println(util.hidden)",
				"end"
			].join("\n"),
			"util.ruka": ['local hidden = "secret"'].join("\n")
		});

		const error = checkProject(project, "main.ruka");
		expect(error?.message).toMatch(/no static 'hidden' on record/);
	});

	test("reports a missing module error", () => {
		const project = sources({
			"main.ruka": [
				'let m = ruka.import("missing.ruka")',
				"let main = () do () end"
			].join("\n")
		});

		const error = checkProject(project, "main.ruka");
		expect(error?.message).toMatch(/module not found: missing\.ruka/);
	});

	test("rejects non-literal import paths", () => {
		const project = sources({
			"main.ruka": [
				'let path = "util.ruka"',
				"let m = ruka.import(path)",
				"let main = () do () end"
			].join("\n"),
			"util.ruka": "let x = 1"
		});

		const error = checkProject(project, "main.ruka");
		expect(error?.message).toMatch(/string literal path/);
	});

	test("detects cyclic imports", () => {
		const project = sources({
			"a.ruka": ['let b = ruka.import("b.ruka")', "let main = () do () end"].join(
				"\n"
			),
			"b.ruka": ['let a = ruka.import("a.ruka")'].join("\n")
		});

		const error = checkProject(project, "a.ruka");
		expect(error?.message).toMatch(/cyclic import/);
	});

	test("propagates errors from imported modules with their path attached", () => {
		const project = sources({
			"main.ruka": [
				'let util = ruka.import("util.ruka")',
				"let main = () do () end"
			].join("\n"),
			"util.ruka": ["let bad = unknown_thing"].join("\n")
		});

		const error = checkProject(project, "main.ruka");
		expect(error?.path).toBe("util.ruka");
		expect(error?.message).toMatch(/Undefined: unknown_thing/);
	});

	test("type-checks methods that forward-reference other methods on the same type", () => {
		// train calls self.Fit before Fit is defined in source order
		const project = sources({
			"main.ruka": [
				'let m = ruka.import("model.ruka")',
				"let main = () do () end"
			].join("\n"),
			"model.ruka": [
				"let t = record { value: float }",
				"let train (*self) = () do",
				"\tself.fit()",
				"end",
				"let fit (*self) = () do",
				"\tself.value = self.value + 1.0",
				"end"
			].join("\n")
		});
		expect(checkProject(project, "main.ruka")).toBeNull();
	});

	test("attaches the import call site to cross-module errors", () => {
		const project = sources({
			"main.ruka": [
				"let main = () do () end",
				'let util = ruka.import("util.ruka")'
			].join("\n"),
			"util.ruka": ["let bad = unknown_thing"].join("\n")
		});

		const error = checkProject(project, "main.ruka");
		// The import is on line 2 of main.ruka — the error's importLine should
		// point back there so the UI can highlight the call site.
		expect(error?.importLine).toBe(2);
		expect(error?.path).toBe("util.ruka");
	});
});
