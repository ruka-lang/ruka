// Examples for the landing-page viewer. These pull directly from the
// interpreter's `fixtures/ok` set so the landing page is always exercising
// real, currently-passing programs — no separate copies to keep in sync.
//
// To change which examples appear, edit `featuredIds` below. Order is
// preserved; ids that don't resolve are silently dropped, which keeps the
// page resilient when fixtures get renamed or removed.

const RAW_FIXTURES = import.meta.glob("../interpreter/fixtures/ok/*.ruka", {
	query: "?raw",
	import: "default",
	eager: true
}) as Record<string, string>;

export type LandingExample = {
	id: string;
	label: string;
	source: string;
};

function toLabel(id: string): string {
	return id
		.split("-")
		.map((part) => (part.length === 0 ? part : part[0]!.toUpperCase() + part.slice(1)))
		.join(" ");
}

function buildAll(): LandingExample[] {
	const out: LandingExample[] = [];

	for (const fullPath in RAW_FIXTURES) {
		const match = fullPath.match(/\/([^/]+)\.ruka$/);
		if (!match) continue;

		const id = match[1]!;
		out.push({ id, label: toLabel(id), source: RAW_FIXTURES[fullPath]! });
	}

	out.sort((a, b) => a.id.localeCompare(b.id));

	return out;
}

export const allOkExamples: LandingExample[] = buildAll();

// Featured lineup for the landing page. Keep these to non-interactive
// programs — the landing viewer auto-runs on selection and has no input UI.
export const featuredIds: readonly string[] = [
	"hello-world",
	"fibonacci",
	"gradient"
];

export function pickExamples(ids: readonly string[] = featuredIds): LandingExample[] {
	const byId = new Map(allOkExamples.map((ex) => [ex.id, ex]));

	return ids
		.map((id) => byId.get(id))
		.filter((ex): ex is LandingExample => ex !== undefined);
}
