<script lang="ts">
	import ExampleViewer from "$lib/components/example-viewer/index.svelte";
	import { pickExamples } from "$lib/playground/landing-examples";

	const examples = pickExamples();
</script>

<svelte:head><title>Ruka</title></svelte:head>

<section class="landing">
	<header class="hero">
		<h1>Ruka</h1>
		<p>A small, strongly-typed language with aggressive bidirectional inference.</p>
	</header>

	<section class="examples">
		<h2>Try it</h2>
		<ExampleViewer {examples} />
	</section>
</section>

<style>
	.landing {
		display: flex;
		flex-direction: column;
		gap: 32px;
		max-width: 960px;
		margin: 24px auto;
		padding: 0 16px;
	}

	.hero h1 {
		margin: 0 0 8px;
	}

	.hero p {
		margin: 0;
		opacity: 0.8;
	}

	.examples h2 {
		font-size: 14px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.7;
		margin: 0 0 8px;
	}
</style>
