// A playground project is a small bundle of files. Source code lives under
// `src/` and the entry is always `src/main.ruka` — mirroring how a real
// Ruka project will look once the compiler ships. Other folders, including
// the project root, are free for whatever the user wants (a `README.txt`,
// notes, fixture data, etc.).
//
// Only `.ruka` and `.txt` files are supported. `.txt` is opaque content
// (no highlighting, no parsing) — useful for notes sitting alongside
// source.
//
// Sibling order in the file tree is stored explicitly in `order` (a flat
// list of every file and folder path in display order). Filtering `order`
// by parent yields the visible sibling sequence — the user reorders by
// dragging, and `addFile` / `addFolder` append new entries so they show
// up at the bottom of their parent.

import type { Example } from "./examples";

export const ENTRY_PATH = "src/main.ruka";
export const SRC_FOLDER = "src";

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
	order: string[];
};

export function fileKindFromPath(path: string): FileKind {
	if (path.endsWith(".txt")) return "txt";
	return "ruka";
}

function parentOf(path: string): string {
	const i = path.lastIndexOf("/");
	return i === -1 ? "" : path.slice(0, i);
}

function nameOf(path: string): string {
	const i = path.lastIndexOf("/");
	return i === -1 ? path : path.slice(i + 1);
}

function joinPath(parent: string, name: string): string {
	return parent === "" ? name : `${parent}/${name}`;
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

// Build a fresh `order` list from the project's files and folders,
// folder-then-file alphabetical. Used as the seed when projects are
// created and as the migration fallback for stored records that
// predate the field.
export function defaultOrder(
	files: ProjectFile[],
	folders: ProjectFolder[]
): string[] {
	const folderPaths = folders.map((f) => f.path).sort();
	const filePaths = files.map((f) => f.path).sort();

	// Group by parent so siblings stay together; within each group,
	// folders precede files (matches the previous tree-sort behavior).
	const byParent = new Map<string, { folders: string[]; files: string[] }>();

	function bucket(parent: string) {
		const existing = byParent.get(parent);
		if (existing) return existing;
		const fresh = { folders: [] as string[], files: [] as string[] };
		byParent.set(parent, fresh);
		return fresh;
	}

	for (const path of folderPaths) bucket(parentOf(path)).folders.push(path);
	for (const path of filePaths) bucket(parentOf(path)).files.push(path);

	const out: string[] = [];

	function emit(parent: string) {
		const group = byParent.get(parent);
		if (!group) return;
		for (const folder of group.folders) {
			out.push(folder);
			emit(folder);
		}
		for (const file of group.files) out.push(file);
	}

	emit("");
	return out;
}

export function projectFromExample(example: Example): Project {
	const files: ProjectFile[] = example.files.map((file) => ({
		path: file.path,
		source: file.source,
		kind: fileKindFromPath(file.path)
	}));

	// `src/` is registered explicitly so it survives a state where the
	// example's only file gets removed (defensive — examples should
	// always carry a `src/main.ruka`).
	const folders = addFolderEntries(foldersFromFiles(files), [SRC_FOLDER]);

	return {
		files,
		folders,
		entry: ENTRY_PATH,
		order: defaultOrder(files, folders)
	};
}

// Empty starter shape for a brand-new user project: a single
// `src/main.ruka` with the standard scaffold.
export function emptyProject(): Project {
	const files: ProjectFile[] = [
		{
			path: ENTRY_PATH,
			source: 'let main = () do\n\truka.println("Hello!")\nend\n',
			kind: "ruka"
		}
	];
	const folders: ProjectFolder[] = [{ path: SRC_FOLDER }];

	return {
		files,
		folders,
		entry: ENTRY_PATH,
		order: defaultOrder(files, folders)
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

// Paths in `order` whose parent equals `parent`, preserving order.
// The file tree uses this to render siblings in the user-controlled
// sequence rather than sorting them alphabetically.
export function siblingPaths(project: Project, parent: string): string[] {
	return project.order.filter((path) => parentOf(path) === parent);
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

// Append `path` to `order` if it isn't already there. New entries
// land at the end of the list; the file tree groups them under their
// parent automatically.
function appendOrder(order: string[], path: string): string[] {
	if (order.includes(path)) return order;
	return [...order, path];
}

// Rewrite `order` so that any entry equal to `from`, or a descendant
// of `from`, gets its prefix swapped to `to`. Mirrors the rename
// behavior on files / folders.
function rewriteOrder(order: string[], from: string, to: string): string[] {
	const fromPrefix = from + "/";
	return order.map((p) => {
		if (p === from) return to;
		if (p.startsWith(fromPrefix)) return to + p.slice(from.length);
		return p;
	});
}

// Drop `path` and any descendant from `order`. Used when files /
// folders are deleted or moved away.
function removeOrder(order: string[], path: string): string[] {
	const prefix = path + "/";
	return order.filter((p) => p !== path && !p.startsWith(prefix));
}

// Move `path` so it sits right before `before` (or at the end of
// `parent`'s sibling run when `before` is null). Other entries keep
// their relative order. `path` must already be in `order`.
function repositionInOrder(
	order: string[],
	path: string,
	parent: string,
	before: string | null
): string[] {
	const without = order.filter((p) => p !== path);

	if (before !== null) {
		const idx = without.indexOf(before);
		if (idx !== -1) {
			return [...without.slice(0, idx), path, ...without.slice(idx)];
		}
	}

	// Append after the last existing sibling of `parent` so the moved
	// entry lands at the bottom of its new folder rather than at the
	// very end of the whole project.
	let insertAt = without.length;
	for (let i = without.length - 1; i >= 0; i--) {
		const sibling = without[i]!;
		if (parentOf(sibling) === parent) {
			insertAt = i + 1;
			break;
		}
		// If we walk past a path that lives under `parent` (a deeper
		// descendant of a sibling folder), insert after it too — that
		// keeps the new entry below the folder it's nested next to.
		if (sibling.startsWith(parent === "" ? "" : parent + "/")) {
			insertAt = i + 1;
			break;
		}
	}

	return [...without.slice(0, insertAt), path, ...without.slice(insertAt)];
}

export function addFile(project: Project, path: string, source = ""): Project {
	if (pathExists(project, path)) return project;

	const file: ProjectFile = { path, source, kind: fileKindFromPath(path) };
	const ancestors = ancestorPaths(path);
	const folders = addFolderEntries(project.folders, ancestors);

	// Register any newly-created ancestor folders in `order` too so
	// the tree can render them. New paths land at the end of their
	// parent's sibling run.
	let order = project.order;
	for (const ancestor of ancestors) {
		if (!order.includes(ancestor)) order = appendOrder(order, ancestor);
	}
	order = appendOrder(order, path);

	return {
		...project,
		files: [...project.files, file],
		folders,
		order
	};
}

export function addFolder(project: Project, path: string): Project {
	if (pathExists(project, path)) return project;

	const ancestors = ancestorPaths(path);
	const folders = addFolderEntries(project.folders, [...ancestors, path]);

	let order = project.order;
	for (const ancestor of ancestors) {
		if (!order.includes(ancestor)) order = appendOrder(order, ancestor);
	}
	order = appendOrder(order, path);

	return {
		...project,
		folders,
		order
	};
}

// `src/main.ruka` is the fixed entry; `src/` is its required parent.
// Mutations that would remove or rename either are rejected here so
// callers don't have to special-case them.
export function isProtectedPath(path: string): boolean {
	return path === ENTRY_PATH || path === SRC_FOLDER;
}

export function deleteFile(project: Project, path: string): Project {
	if (isProtectedPath(path)) return project;

	return {
		...project,
		files: project.files.filter((file) => file.path !== path),
		order: removeOrder(project.order, path)
	};
}

// Recursive: removes the folder itself, all descendant folders, and any
// file whose path lives under it. Refuses to delete `src/` (which would
// take the entry with it).
export function deleteFolder(project: Project, path: string): Project {
	if (isProtectedPath(path)) return project;

	const prefix = path + "/";

	return {
		...project,
		files: project.files.filter((file) => !file.path.startsWith(prefix)),
		folders: project.folders.filter(
			(folder) => folder.path !== path && !folder.path.startsWith(prefix)
		),
		order: removeOrder(project.order, path)
	};
}

export function renameFile(project: Project, from: string, to: string): Project {
	if (from === to) return project;
	if (isProtectedPath(from)) return project;
	if (pathExists(project, to)) return project;

	const files = project.files.map((file) =>
		file.path === from ? { ...file, path: to, kind: fileKindFromPath(to) } : file
	);
	const ancestors = ancestorPaths(to);
	const folders = addFolderEntries(project.folders, ancestors);

	let order = rewriteOrder(project.order, from, to);
	for (const ancestor of ancestors) {
		if (!order.includes(ancestor)) order = appendOrder(order, ancestor);
	}

	return { ...project, files, folders, order };
}

// Folder rename moves the folder and rewrites every descendant file /
// folder path so the tree stays consistent. Refuses to rename `src/`
// (which would move the entry out from under the runner).
export function renameFolder(project: Project, from: string, to: string): Project {
	if (from === to) return project;
	if (isProtectedPath(from)) return project;
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
	const ancestors = ancestorPaths(to);
	const foldersWithAncestors = addFolderEntries(folders, ancestors);

	let order = rewriteOrder(project.order, from, to);
	for (const ancestor of ancestors) {
		if (!order.includes(ancestor)) order = appendOrder(order, ancestor);
	}

	return { ...project, files, folders: foldersWithAncestors, order };
}

// Move a file or folder to a new parent and / or position. `before`
// is the path of the sibling the moved entry should sit just above —
// pass null to append at the end of `toParent`. Returns the project
// unchanged if the move is invalid (protected path, collision, or a
// folder being dropped into its own descendant).
export function move(
	project: Project,
	from: string,
	toParent: string,
	before: string | null = null
): Project {
	if (isProtectedPath(from)) return project;

	const isFile = project.files.some((f) => f.path === from);
	const isFolder = !isFile && project.folders.some((f) => f.path === from);
	if (!isFile && !isFolder) return project;

	// Reject dropping a folder into itself or into its own descendants —
	// that would create an unreachable subtree.
	if (isFolder && (toParent === from || toParent.startsWith(from + "/"))) {
		return project;
	}

	// Reject dropping into `before` itself, or pretending a non-sibling
	// is a sibling — the tree disambiguates parents from positions.
	if (before !== null && parentOf(before) !== toParent) return project;

	const newPath = joinPath(toParent, nameOf(from));
	const samePath = newPath === from;

	if (!samePath && pathExists(project, newPath)) return project;

	let next = project;

	if (!samePath) {
		// Reuse the rename helpers' descendant-aware path rewrite. We
		// bypass the protection check (already passed above) by inlining
		// the work — the helpers refuse on protected `from`, but `from`
		// here is guaranteed non-protected.
		const fromPrefix = from + "/";
		function rewrite(path: string): string {
			if (path === from) return newPath;
			if (path.startsWith(fromPrefix)) return newPath + path.slice(from.length);
			return path;
		}

		const files = project.files.map((file) => ({
			...file,
			path: rewrite(file.path),
			kind: file.path === from ? fileKindFromPath(newPath) : file.kind
		}));

		const folders = project.folders.map((folder) => ({ path: rewrite(folder.path) }));
		const ancestors = ancestorPaths(newPath);
		const foldersWithAncestors = addFolderEntries(folders, ancestors);

		let order = rewriteOrder(project.order, from, newPath);
		for (const ancestor of ancestors) {
			if (!order.includes(ancestor)) order = appendOrder(order, ancestor);
		}

		next = { ...project, files, folders: foldersWithAncestors, order };
	}

	// Now `newPath` is the entry to reposition. If `before` was on the
	// move's source side, it doesn't apply post-rename — fall back to
	// "append at the end of toParent".
	const beforeAfterMove =
		before !== null && before !== from && !before.startsWith(from + "/")
			? before
			: null;

	const order = repositionInOrder(next.order, newPath, toParent, beforeAfterMove);

	return { ...next, order };
}
