import { describe, expect, test } from "vitest";
import {
	fileKindFromPath,
	foldersFromFiles,
	getEntrySource,
	getFile,
	projectFromExample,
	updateFileSource,
	type ProjectFile
} from "./project";

describe("fileKindFromPath", () => {
	test("classifies .ruka and .txt", () => {
		expect(fileKindFromPath("main.ruka")).toBe("ruka");
		expect(fileKindFromPath("notes.txt")).toBe("txt");
		expect(fileKindFromPath("src/util.ruka")).toBe("ruka");
	});

	test("defaults unknown extensions to ruka", () => {
		// The UI restricts creation to .ruka / .txt, so this branch only
		// fires on legacy paths — defaulting keeps them editable.
		expect(fileKindFromPath("README")).toBe("ruka");
	});
});

describe("foldersFromFiles", () => {
	test("derives nested folders from file paths", () => {
		const files: ProjectFile[] = [
			{ path: "main.ruka", source: "", kind: "ruka" },
			{ path: "src/util.ruka", source: "", kind: "ruka" },
			{ path: "src/lib/math.ruka", source: "", kind: "ruka" }
		];

		expect(foldersFromFiles(files)).toEqual([
			{ path: "src" },
			{ path: "src/lib" }
		]);
	});

	test("returns empty list when all files are at the root", () => {
		const files: ProjectFile[] = [
			{ path: "main.ruka", source: "", kind: "ruka" },
			{ path: "notes.txt", source: "", kind: "txt" }
		];

		expect(foldersFromFiles(files)).toEqual([]);
	});

	test("deduplicates folders shared across files", () => {
		const files: ProjectFile[] = [
			{ path: "src/a.ruka", source: "", kind: "ruka" },
			{ path: "src/b.ruka", source: "", kind: "ruka" }
		];

		expect(foldersFromFiles(files)).toEqual([{ path: "src" }]);
	});
});

describe("projectFromExample", () => {
	test("classifies file kinds and infers folders", () => {
		const project = projectFromExample({
			id: "demo",
			label: "Demo",
			entry: "main.ruka",
			files: [
				{ path: "main.ruka", source: "let x = 1" },
				{ path: "lib/math.ruka", source: "let y = 2" }
			]
		});

		expect(project.entry).toBe("main.ruka");
		expect(project.files).toEqual([
			{ path: "main.ruka", source: "let x = 1", kind: "ruka" },
			{ path: "lib/math.ruka", source: "let y = 2", kind: "ruka" }
		]);
		expect(project.folders).toEqual([{ path: "lib" }]);
	});
});

describe("updateFileSource", () => {
	test("returns a new project with one file's source replaced", () => {
		const project = projectFromExample({
			id: "demo",
			label: "Demo",
			entry: "main.ruka",
			files: [
				{ path: "main.ruka", source: "old" },
				{ path: "other.ruka", source: "untouched" }
			]
		});

		const next = updateFileSource(project, "main.ruka", "new");

		expect(getEntrySource(next)).toBe("new");
		expect(getFile(next, "other.ruka")?.source).toBe("untouched");
		// Caller-visible immutability — the original project should not
		// have been mutated in place.
		expect(getEntrySource(project)).toBe("old");
	});
});
