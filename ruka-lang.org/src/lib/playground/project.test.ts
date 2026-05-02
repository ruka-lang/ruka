import { describe, expect, test } from "vitest";
import {
	addFile,
	addFolder,
	defaultOrder,
	deleteFile,
	deleteFolder,
	emptyProject,
	fileKindFromPath,
	foldersFromFiles,
	getEntrySource,
	getFile,
	isProtectedPath,
	move,
	pathExists,
	projectFromExample,
	renameFile,
	renameFolder,
	siblingPaths,
	updateFileSource,
	type Project,
	type ProjectFile
} from "./project";

function sampleProject(): Project {
	return projectFromExample({
		id: "demo",
		label: "Demo",
		entry: "src/main.ruka",
		files: [
			{ path: "src/main.ruka", source: "let x = 1" },
			{ path: "src/lib/math.ruka", source: "let y = 2" },
			{ path: "src/lib/util.ruka", source: "let z = 3" }
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

		expect(foldersFromFiles(files)).toEqual([{ path: "src" }, { path: "src/lib" }]);
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
	test("classifies kinds, infers folders, and pins entry to src/main.ruka", () => {
		const project = projectFromExample({
			id: "demo",
			label: "Demo",
			entry: "src/main.ruka",
			files: [
				{ path: "src/main.ruka", source: "let x = 1" },
				{ path: "src/lib/math.ruka", source: "let y = 2" }
			]
		});

		expect(project.entry).toBe("src/main.ruka");
		expect(project.files).toEqual([
			{ path: "src/main.ruka", source: "let x = 1", kind: "ruka" },
			{ path: "src/lib/math.ruka", source: "let y = 2", kind: "ruka" }
		]);
		expect(project.folders.map((f) => f.path).sort()).toEqual(["src", "src/lib"]);
	});

	test("registers src/ even when the example carries no files under it", () => {
		// Defensive — projectFromExample always guarantees src/ shows up
		// so the file tree has a stable parent for the entry file.
		const project = projectFromExample({
			id: "blank",
			label: "Blank",
			entry: "src/main.ruka",
			files: []
		});

		expect(project.folders.map((f) => f.path)).toEqual(["src"]);
	});
});

describe("emptyProject", () => {
	test("starts with a single src/main.ruka and the src folder", () => {
		const project = emptyProject();

		expect(project.entry).toBe("src/main.ruka");
		expect(project.files.map((f) => f.path)).toEqual(["src/main.ruka"]);
		expect(project.folders.map((f) => f.path)).toEqual(["src"]);
	});
});

describe("addFile", () => {
	test("adds a new file and registers ancestor folders", () => {
		const project = sampleProject();
		const next = addFile(project, "src/lib/nested/deep.ruka", "let q = 4");

		expect(getFile(next, "src/lib/nested/deep.ruka")?.source).toBe("let q = 4");
		expect(next.folders.map((f) => f.path)).toContain("src/lib/nested");
	});

	test("returns the project unchanged when the path is already taken", () => {
		const project = sampleProject();
		const next = addFile(project, "src/main.ruka");

		expect(next).toBe(project);
	});

	test("classifies kind from the path", () => {
		const project = sampleProject();
		const next = addFile(project, "README.txt", "hi");

		expect(getFile(next, "README.txt")?.kind).toBe("txt");
	});

	test("supports root-level files alongside src/", () => {
		// Mirrors how a real Ruka project looks: source under src/ with
		// notes / README at the project root.
		const project = sampleProject();
		const next = addFile(project, "README.txt", "# Demo");

		expect(getFile(next, "README.txt")?.kind).toBe("txt");
		expect(getFile(next, "src/main.ruka")).toBeDefined();
	});
});

describe("addFolder", () => {
	test("adds an empty folder and its ancestors", () => {
		const project = sampleProject();
		const next = addFolder(project, "src/lib/empty/inner");

		const paths = next.folders.map((f) => f.path);
		expect(paths).toContain("src/lib/empty");
		expect(paths).toContain("src/lib/empty/inner");
	});
});

describe("deleteFile", () => {
	test("removes a single file", () => {
		const project = sampleProject();
		const next = deleteFile(project, "src/lib/util.ruka");

		expect(getFile(next, "src/lib/util.ruka")).toBeUndefined();
		expect(getFile(next, "src/lib/math.ruka")).toBeDefined();
	});

	test("refuses to delete the entry file", () => {
		const project = sampleProject();
		const next = deleteFile(project, "src/main.ruka");

		expect(next).toBe(project);
		expect(getFile(next, "src/main.ruka")).toBeDefined();
	});
});

describe("deleteFolder", () => {
	test("cascades over descendant files and folders", () => {
		const project = addFolder(sampleProject(), "src/lib/inner");
		const next = deleteFolder(project, "src/lib");

		expect(next.files.map((f) => f.path)).toEqual(["src/main.ruka"]);
		expect(next.folders.map((f) => f.path)).toEqual(["src"]);
	});

	test("refuses to delete src/", () => {
		const project = sampleProject();
		const next = deleteFolder(project, "src");

		expect(next).toBe(project);
	});
});

describe("renameFile", () => {
	test("renames a non-entry file in place", () => {
		const project = sampleProject();
		const next = renameFile(project, "src/lib/math.ruka", "src/lib/algebra.ruka");

		expect(getFile(next, "src/lib/algebra.ruka")).toBeDefined();
		expect(getFile(next, "src/lib/math.ruka")).toBeUndefined();
		expect(next.entry).toBe("src/main.ruka");
	});

	test("registers ancestor folders when moving into a new directory", () => {
		const project = sampleProject();
		const next = renameFile(project, "src/lib/math.ruka", "src/algebra/math.ruka");

		expect(next.folders.map((f) => f.path)).toContain("src/algebra");
	});

	test("refuses to overwrite an existing path", () => {
		const project = sampleProject();
		const next = renameFile(project, "src/lib/math.ruka", "src/lib/util.ruka");

		expect(next).toBe(project);
	});

	test("refuses to rename the entry file", () => {
		const project = sampleProject();
		const next = renameFile(project, "src/main.ruka", "src/app.ruka");

		expect(next).toBe(project);
		expect(next.entry).toBe("src/main.ruka");
	});
});

describe("renameFolder", () => {
	test("rewrites every descendant file and folder", () => {
		const project = addFolder(sampleProject(), "src/lib/inner");
		const next = renameFolder(project, "src/lib", "src/utils");

		expect(next.files.map((f) => f.path).sort()).toEqual([
			"src/main.ruka",
			"src/utils/math.ruka",
			"src/utils/util.ruka"
		]);
		expect(next.folders.map((f) => f.path).sort()).toEqual([
			"src",
			"src/utils",
			"src/utils/inner"
		]);
	});

	test("refuses to rename src/", () => {
		const project = sampleProject();
		const next = renameFolder(project, "src", "source");

		expect(next).toBe(project);
		expect(next.entry).toBe("src/main.ruka");
	});
});

describe("isProtectedPath", () => {
	test("locks the entry file and src folder", () => {
		expect(isProtectedPath("src")).toBe(true);
		expect(isProtectedPath("src/main.ruka")).toBe(true);
		expect(isProtectedPath("src/lib/math.ruka")).toBe(false);
		expect(isProtectedPath("README.txt")).toBe(false);
	});
});

describe("pathExists", () => {
	test("matches both files and folders", () => {
		const project = sampleProject();

		expect(pathExists(project, "src/main.ruka")).toBe(true);
		expect(pathExists(project, "src/lib")).toBe(true);
		expect(pathExists(project, "missing")).toBe(false);
	});
});

describe("updateFileSource", () => {
	test("returns a new project with one file's source replaced", () => {
		const project = projectFromExample({
			id: "demo",
			label: "Demo",
			entry: "src/main.ruka",
			files: [
				{ path: "src/main.ruka", source: "old" },
				{ path: "src/other.ruka", source: "untouched" }
			]
		});

		const next = updateFileSource(project, "src/main.ruka", "new");

		expect(getEntrySource(next)).toBe("new");
		expect(getFile(next, "src/other.ruka")?.source).toBe("untouched");
		// Caller-visible immutability — the original project should not
		// have been mutated in place.
		expect(getEntrySource(project)).toBe("old");
	});
});

describe("defaultOrder", () => {
	test("groups siblings by parent and lists folders before files", () => {
		const files: ProjectFile[] = [
			{ path: "README.txt", source: "", kind: "txt" },
			{ path: "src/main.ruka", source: "", kind: "ruka" },
			{ path: "src/lib/math.ruka", source: "", kind: "ruka" }
		];
		const folders = foldersFromFiles(files);

		const order = defaultOrder(files, folders);

		// `src` (folder) appears before `README.txt` at the root, and
		// `src/lib` (folder) precedes `src/main.ruka` (file) inside `src`.
		expect(order).toEqual([
			"src",
			"src/lib",
			"src/lib/math.ruka",
			"src/main.ruka",
			"README.txt"
		]);
	});
});

describe("order tracking", () => {
	test("addFile appends the new path to order", () => {
		const project = sampleProject();
		const next = addFile(project, "src/extra.ruka", "");

		expect(next.order).toContain("src/extra.ruka");
		// And the entry's position is preserved relative to the rest.
		expect(next.order.indexOf("src/main.ruka")).toBe(
			project.order.indexOf("src/main.ruka")
		);
	});

	test("addFolder registers ancestors in order", () => {
		const project = sampleProject();
		const next = addFolder(project, "src/lib/inner");

		expect(next.order).toContain("src/lib/inner");
	});

	test("deleteFolder strips the subtree from order", () => {
		const project = sampleProject();
		const next = deleteFolder(project, "src/lib");

		expect(next.order).not.toContain("src/lib");
		expect(next.order).not.toContain("src/lib/math.ruka");
	});

	test("renameFile rewrites the order entry", () => {
		const project = sampleProject();
		const next = renameFile(project, "src/lib/math.ruka", "src/lib/algebra.ruka");

		expect(next.order).toContain("src/lib/algebra.ruka");
		expect(next.order).not.toContain("src/lib/math.ruka");
	});
});

describe("siblingPaths", () => {
	test("returns the children of a parent in order", () => {
		const project = sampleProject();

		expect(siblingPaths(project, "")).toEqual(["src"]);
		expect(siblingPaths(project, "src").sort()).toEqual([
			"src/lib",
			"src/main.ruka"
		]);
	});
});

describe("move", () => {
	test("relocates a file under a different folder", () => {
		const project = addFolder(sampleProject(), "src/utils");
		const next = move(project, "src/lib/math.ruka", "src/utils");

		expect(getFile(next, "src/utils/math.ruka")).toBeDefined();
		expect(getFile(next, "src/lib/math.ruka")).toBeUndefined();
	});

	test("reorders siblings when toParent matches the current parent", () => {
		const project = addFile(sampleProject(), "src/extra.ruka", "");
		// Drop extra above main, both inside `src`.
		const next = move(project, "src/extra.ruka", "src", "src/main.ruka");

		const srcChildren = siblingPaths(next, "src");
		expect(srcChildren.indexOf("src/extra.ruka")).toBeLessThan(
			srcChildren.indexOf("src/main.ruka")
		);
	});

	test("relocates a folder and rewrites every descendant path", () => {
		const project = sampleProject();
		const next = move(project, "src/lib", "");

		expect(next.folders.map((f) => f.path).sort()).toContain("lib");
		expect(getFile(next, "lib/math.ruka")).toBeDefined();
		expect(getFile(next, "src/lib/math.ruka")).toBeUndefined();
	});

	test("refuses to move src/main.ruka", () => {
		const project = sampleProject();
		const next = move(project, "src/main.ruka", "");

		expect(next).toBe(project);
	});

	test("refuses to drop a folder into its own descendant", () => {
		const project = addFolder(sampleProject(), "src/lib/inner");
		const next = move(project, "src/lib", "src/lib/inner");

		expect(next).toBe(project);
	});

	test("refuses to overwrite an existing path at the destination", () => {
		const project = addFile(sampleProject(), "src/util.ruka", "");
		// `src/lib/util.ruka` exists in the sample; moving it to `src`
		// would collide with the file we just added.
		const next = move(project, "src/lib/util.ruka", "src");

		expect(next).toBe(project);
	});

	test("refuses to insert before a path that doesn't share toParent", () => {
		const project = sampleProject();
		// `src/main.ruka` is inside `src`, not at root.
		const next = move(project, "src/lib/math.ruka", "", "src/main.ruka");

		expect(next).toBe(project);
	});
});

