<script lang="ts">
	import DocsShell, { type TocSection } from "$lib/components/docs-shell/index.svelte";

	// Placeholder structure — content port from docs/reference.html happens
	// in a later phase. Sections are listed here so the layout has something
	// to anchor against.
	const sections: TocSection[] = [
		{ id: "overview", title: "Overview" },
		{ id: "syntax", title: "Syntax" },
		{ id: "types", title: "Types" },
		{ id: "modes", title: "Modes" },
		{ id: "patterns", title: "Patterns" }
	];
</script>

<svelte:head><title>Ruka — Reference</title></svelte:head>

<DocsShell title="Reference" {sections}>
	<h1>Reference</h1>

	<section id="overview">
		<h2>Overview</h2>
		<p>
			Reference content is being ported from the legacy
			<code>docs/reference.html</code>. This page is a placeholder that
			exercises the docs shell.
		</p>
	</section>

	<section id="syntax">
		<h2>Syntax</h2>
		<p>Tokens, expressions, blocks, and the surface syntax of Ruka.</p>
	</section>

	<section id="types">
		<h2>Types</h2>
		<p>The type system, inference rules, and built-in types.</p>
	</section>

	<section id="modes">
		<h2>Modes</h2>
		<p>Parameter and binding modes, ownership, and mutability.</p>
	</section>

	<section id="patterns">
		<h2>Patterns</h2>
		<p>Destructuring, matching, and exhaustiveness.</p>
	</section>
</DocsShell>
