import { describe, expect, test } from "vitest";
import {
	addFile,
	addFolder,
	deleteFile,
	deleteFolder,
	fileKindFromPath,
	foldersFromFiles,
	getEntrySource,
	getFile,
	pathExists,
	projectFromExample,
	renameFile,
	renameFolder,
	setEntry,
	updateFileSource,
	type Project,
	type ProjectFile
} from "./project";

function sampleProject(): Project {
	return projectFromExample({
		id: "demo",
		label: "Demo",
		entry: "main.ruka",
		files: [
			{ path: "main.ruka", source: "let x = 1" },
			{ path: "lib/math.ruka", source: "let y = 2" },
			{ path: "lib/util.ruka", source: "let z = 3" }
		]
	});
}

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

describe("addFile", () => {
	test("adds a new file and registers ancestor folders", () => {
		const project = sampleProject();
		const next = addFile(project, "lib/nested/deep.ruka", "let q = 4");

		expect(getFile(next, "lib/nested/deep.ruka")?.source).toBe("let q = 4");
		expect(next.folders.map((f) => f.path)).toContain("lib/nested");
	});

	test("returns the project unchanged when the path is already taken", () => {
		const project = sampleProject();
		const next = addFile(project, "main.ruka");

		expect(next).toBe(project);
	});

	test("classifies kind from the path", () => {
		const project = sampleProject();
		const next = addFile(project, "notes.txt", "hi");

		expect(getFile(next, "notes.txt")?.kind).toBe("txt");
	});
});

describe("addFolder", () => {
	test("adds an empty folder and its ancestors", () => {
		const project = sampleProject();
		const next = addFolder(project, "lib/empty/inner");

		const paths = next.folders.map((f) => f.path);
		expect(paths).toContain("lib/empty");
		expect(paths).toContain("lib/empty/inner");
	});
});

describe("deleteFile", () => {
	test("removes a single file", () => {
		const project = sampleProject();
		const next = deleteFile(project, "lib/util.ruka");

		expect(getFile(next, "lib/util.ruka")).toBeUndefined();
		expect(getFile(next, "lib/math.ruka")).toBeDefined();
	});
});

describe("deleteFolder", () => {
	test("cascades over descendant files and folders", () => {
		const project = addFolder(sampleProject(), "lib/inner");
		const next = deleteFolder(project, "lib");

		expect(next.files.map((f) => f.path)).toEqual(["main.ruka"]);
		expect(next.folders.map((f) => f.path)).toEqual([]);
	});
});

describe("renameFile", () => {
	test("rewrites the entry pointer when the entry is renamed", () => {
		const project = sampleProject();
		const next = renameFile(project, "main.ruka", "app.ruka");

		expect(next.entry).toBe("app.ruka");
		expect(getFile(next, "app.ruka")).toBeDefined();
	});

	test("registers ancestor folders when moving into a new directory", () => {
		const project = sampleProject();
		const next = renameFile(project, "main.ruka", "apps/main.ruka");

		expect(next.folders.map((f) => f.path)).toContain("apps");
	});

	test("refuses to overwrite an existing path", () => {
		const project = sampleProject();
		const next = renameFile(project, "lib/math.ruka", "lib/util.ruka");

		expect(next).toBe(project);
	});
});

describe("renameFolder", () => {
	test("rewrites every descendant file and folder", () => {
		const project = addFolder(sampleProject(), "lib/inner");
		const next = renameFolder(project, "lib", "src");

		expect(next.files.map((f) => f.path).sort()).toEqual([
			"main.ruka",
			"src/math.ruka",
			"src/util.ruka"
		]);
		expect(next.folders.map((f) => f.path).sort()).toEqual(["src", "src/inner"]);
	});

	test("rewrites the entry when the entry lives inside the renamed folder", () => {
		const project = sampleProject();
		const moved = renameFile(project, "main.ruka", "lib/main.ruka");
		const next = renameFolder(moved, "lib", "src");

		expect(next.entry).toBe("src/main.ruka");
	});
});

describe("setEntry", () => {
	test("only accepts paths to existing .ruka files", () => {
		const project = addFile(sampleProject(), "notes.txt", "hello");

		expect(setEntry(project, "lib/math.ruka").entry).toBe("lib/math.ruka");
		expect(setEntry(project, "notes.txt")).toBe(project);
		expect(setEntry(project, "missing.ruka")).toBe(project);
	});
});

describe("pathExists", () => {
	test("matches both files and folders", () => {
		const project = sampleProject();

		expect(pathExists(project, "main.ruka")).toBe(true);
		expect(pathExists(project, "lib")).toBe(true);
		expect(pathExists(project, "missing")).toBe(false);
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
