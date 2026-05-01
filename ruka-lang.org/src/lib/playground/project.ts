// A playground project is a small bundle of files plus a designated entry
// path. Examples are converted into projects on load so the editor and the
// runner share one mutable shape — when user-saved projects (IndexedDB)
// land, they slot in here without changing the rest of the playground.
//
// The language doesn't yet have an `import` builtin, so non-entry files
// aren't reachable from the runtime. They still round-trip through the UI
// so projects can be edited as a unit; the runner reads only the entry.
//
// Only `.ruka` and `.txt` files are supported. `.txt` is opaque content
// (no highlighting, no parsing) — useful for notes / fixture data sitting
// alongside source. The entry must always be `.ruka`.

import type { Example } from "./examples";

export type FileKind = "ruka" | "txt";

export type ProjectFile = {
	path: string;
	source: string;
	kind: FileKind;
};

// Folders are tracked explicitly rather than inferred from `/` in file
// paths so the UI can represent empty folders the user just created.
export type ProjectFolder = {
	path: string;
};

export type Project = {
	files: ProjectFile[];
	folders: ProjectFolder[];
	entry: string;
};

export function fileKindFromPath(path: string): FileKind {
	if (path.endsWith(".txt")) return "txt";
	return "ruka";
}

// Derive the folder set from a list of file paths. Used when converting
// examples (which only carry files) into projects, and as a starting
// point before any user-created empty folders are added.
export function foldersFromFiles(files: ProjectFile[]): ProjectFolder[] {
	const set = new Set<string>();

	for (const file of files) {
		const parts = file.path.split("/");
		for (let i = 1; i < parts.length; i++) {
			set.add(parts.slice(0, i).join("/"));
		}
	}

	return Array.from(set)
		.sort()
		.map((path) => ({ path }));
}

export function projectFromExample(example: Example): Project {
	const files: ProjectFile[] = example.files.map((file) => ({
		path: file.path,
		source: file.source,
		kind: fileKindFromPath(file.path)
	}));

	return {
		files,
		folders: foldersFromFiles(files),
		entry: example.entry
	};
}

export function getFile(project: Project, path: string): ProjectFile | undefined {
	return project.files.find((file) => file.path === path);
}

export function getEntrySource(project: Project): string {
	return getFile(project, project.entry)?.source ?? "";
}

export function updateFileSource(project: Project, path: string, source: string): Project {
	return {
		...project,
		files: project.files.map((file) =>
			file.path === path ? { ...file, source } : file
		)
	};
}
