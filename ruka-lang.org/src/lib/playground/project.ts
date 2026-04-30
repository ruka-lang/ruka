// A playground project is a small bundle of files plus a designated entry
// path. Examples are converted into projects on load so the editor and the
// runner share one mutable shape — when user-saved projects (IndexedDB)
// land, they slot in here without changing the rest of the playground.
//
// The language doesn't yet have an `import` builtin, so non-entry files
// aren't reachable from the runtime. They still round-trip through the UI
// so projects can be edited as a unit; the runner reads only the entry.

import type { Example } from "./examples";

export type ProjectFile = {
	path: string;
	source: string;
};

export type Project = {
	files: ProjectFile[];
	entry: string;
};

export function projectFromExample(example: Example): Project {
	return {
		files: example.files.map((file) => ({ path: file.path, source: file.source })),
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
