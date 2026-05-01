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

export function updateFileSource(
	project: Project,
	path: string,
	source: string
): Project {
	return {
		...project,
		files: project.files.map((file) => (file.path === path ? { ...file, source } : file))
	};
}

export function pathExists(project: Project, path: string): boolean {
	return (
		project.files.some((file) => file.path === path) ||
		project.folders.some((folder) => folder.path === path)
	);
}

// Folders implicitly required by `path`'s parent chain. Used after file
// or folder mutations to keep the explicit folder list in sync with the
// paths that actually contain files.
function ancestorPaths(path: string): string[] {
	const parts = path.split("/");
	const out: string[] = [];

	for (let i = 1; i < parts.length; i++) {
		out.push(parts.slice(0, i).join("/"));
	}

	return out;
}

function addFolderEntries(folders: ProjectFolder[], paths: string[]): ProjectFolder[] {
	const set = new Set(folders.map((f) => f.path));
	for (const path of paths) set.add(path);

	return Array.from(set)
		.sort()
		.map((path) => ({ path }));
}

export function addFile(project: Project, path: string, source = ""): Project {
	if (pathExists(project, path)) return project;

	const file: ProjectFile = { path, source, kind: fileKindFromPath(path) };

	return {
		...project,
		files: [...project.files, file],
		folders: addFolderEntries(project.folders, ancestorPaths(path))
	};
}

export function addFolder(project: Project, path: string): Project {
	if (pathExists(project, path)) return project;

	return {
		...project,
		folders: addFolderEntries(project.folders, [...ancestorPaths(path), path])
	};
}

export function deleteFile(project: Project, path: string): Project {
	return {
		...project,
		files: project.files.filter((file) => file.path !== path)
	};
}

// Recursive: removes the folder itself, all descendant folders, and any
// file whose path lives under it. Caller is responsible for ensuring the
// project's `entry` doesn't sit inside the deleted subtree.
export function deleteFolder(project: Project, path: string): Project {
	const prefix = path + "/";

	return {
		...project,
		files: project.files.filter((file) => !file.path.startsWith(prefix)),
		folders: project.folders.filter(
			(folder) => folder.path !== path && !folder.path.startsWith(prefix)
		)
	};
}

export function renameFile(project: Project, from: string, to: string): Project {
	if (from === to) return project;
	if (pathExists(project, to)) return project;

	const files = project.files.map((file) =>
		file.path === from ? { ...file, path: to, kind: fileKindFromPath(to) } : file
	);

	return {
		...project,
		files,
		folders: addFolderEntries(project.folders, ancestorPaths(to)),
		entry: project.entry === from ? to : project.entry
	};
}

// Folder rename moves the folder and rewrites every descendant file /
// folder path so the tree stays consistent. Updates `entry` too if the
// entry file lived inside the renamed subtree.
export function renameFolder(project: Project, from: string, to: string): Project {
	if (from === to) return project;
	if (pathExists(project, to)) return project;

	const fromPrefix = from + "/";

	function rewrite(path: string): string {
		if (path === from) return to;
		if (path.startsWith(fromPrefix)) return to + path.slice(from.length);
		return path;
	}

	const files = project.files.map((file) => ({
		...file,
		path: rewrite(file.path)
	}));

	const folders = project.folders.map((folder) => ({ path: rewrite(folder.path) }));

	return {
		...project,
		files,
		folders: addFolderEntries(folders, ancestorPaths(to)),
		entry: rewrite(project.entry)
	};
}

export function setEntry(project: Project, path: string): Project {
	if (project.entry === path) return project;

	const file = getFile(project, path);
	if (!file || file.kind !== "ruka") return project;

	return { ...project, entry: path };
}
