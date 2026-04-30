<script lang="ts">
	import DocsShell, { type TocSection } from "$lib/components/docs-shell/index.svelte";

	// Placeholder structure — EBNF port from docs/grammar.html happens in a
	// later phase. Sections mirror the canonical grammar grouping.
	const sections: TocSection[] = [
		{ id: "lexical", title: "Lexical" },
		{ id: "expressions", title: "Expressions" },
		{ id: "statements", title: "Statements" },
		{ id: "declarations", title: "Declarations" },
		{ id: "types", title: "Types" }
	];
</script>

<svelte:head><title>Ruka — Grammar</title></svelte:head>

<DocsShell title="Grammar" {sections}>
	<h1>Grammar</h1>

	<section id="lexical">
		<h2>Lexical</h2>
		<p>
			Token definitions, identifiers, literals, and whitespace handling.
			Content is being ported from <code>docs/grammar.html</code>.
		</p>
	</section>

	<section id="expressions">
		<h2>Expressions</h2>
		<p>Operator precedence, primary expressions, and call forms.</p>
	</section>

	<section id="statements">
		<h2>Statements</h2>
		<p>Bindings, control flow, and block structure.</p>
	</section>

	<section id="declarations">
		<h2>Declarations</h2>
		<p>Records, variants, methods, and modules.</p>
	</section>

	<section id="types">
		<h2>Types</h2>
		<p>Type expressions and the surface syntax of the type system.</p>
	</section>
</DocsShell>
