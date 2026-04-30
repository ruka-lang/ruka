// Playground examples are auto-discovered from `examples/<id>/*.ruka`. Each
// subdirectory of `examples/` is a single example; the directory name is the
// id. This shape is intentionally multi-file from day one — the `/playground`
// page is meant to evolve into a multi-file project workspace, and modeling
// every example as a list of files (with one designated `entry`) keeps the
// driver agnostic to whether a project happens to be one file or many.
//
// To add an example, drop a directory under `examples/` containing a
// `main.ruka` (and any additional files). Vite's `import.meta.glob` picks
// it up at build time — no manual registration needed.

const FILE_MODULES = import.meta.glob("./examples/**/*.ruka", {
	query: "?raw",
	import: "default",
	eager: true
}) as Record<string, string>;

export type ExampleFile = {
	path: string;
	source: string;
};

export type Example = {
	id: string;
	label: string;
	entry: string;
	files: ExampleFile[];
};

// Convert a kebab-case id like "hello-world" into a display label.
function toLabel(id: string): string {
	return id
		.split("-")
		.map((part) => (part.length === 0 ? part : part[0]!.toUpperCase() + part.slice(1)))
		.join(" ");
}

function buildExamples(): Example[] {
	const grouped = new Map<string, ExampleFile[]>();

	for (const fullPath in FILE_MODULES) {
		// `./examples/<id>/<rest...>.ruka`
		const match = fullPath.match(/^\.\/examples\/([^/]+)\/(.+\.ruka)$/);
		if (!match) continue;
		const id = match[1]!;
		const path = match[2]!;
		const source = FILE_MODULES[fullPath]!;
		const files = grouped.get(id) ?? [];
		files.push({ path, source });
		grouped.set(id, files);
	}

	const result: Example[] = [];
	for (const [id, files] of grouped) {
		files.sort((a, b) => a.path.localeCompare(b.path));
		// Prefer `main.ruka` as the entry, fall back to the first file so a
		// project that uses a different convention still resolves.
		const entry = files.find((f) => f.path === "main.ruka")?.path ?? files[0]!.path;
		result.push({ id, label: toLabel(id), entry, files });
	}

	result.sort((a, b) => a.label.localeCompare(b.label));
	return result;
}

export const examples: Example[] = buildExamples();

export function findExample(id: string): Example | undefined {
	return examples.find((ex) => ex.id === id);
}

// Convenience for callers that only render the entry file (the current
// single-file `/playground` editor). Multi-file UI will read `files` directly.
export function entrySource(example: Example): string {
	const file = example.files.find((f) => f.path === example.entry);
	return file?.source ?? "";
}
