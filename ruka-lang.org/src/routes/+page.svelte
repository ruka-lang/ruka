<script lang="ts">
	import ExampleViewer from "$lib/components/ExampleViewer.svelte";
	import { Button } from "$lib/components/ui";
	import { pickExamples } from "$lib/playground/landingExamples";

	const examples = pickExamples();
</script>

<svelte:head><title>Ruka</title></svelte:head>

<section class="landing">
	<header class="hero">
		<h1 class="hero-title">
			A small language; fun by <em>default</em>.
		</h1>
		<p class="hero-lede">
			Ruka is an opinionated language focused on simplicity and useability, opt in to fine
			control when needed. Write what you mean; let the compiler fill in the rest.
		</p>
		<div class="hero-actions">
			<Button variant="primary" href="/playground">Open the playground</Button>
			<Button variant="ghost" href="/reference">Read the reference</Button>
		</div>
	</header>

	<section class="examples" aria-labelledby="examples-heading">
		<h2 id="examples-heading" class="section-title">Try it</h2>
		<p class="section-lede">
			Pick an example to run it in-browser. The interpreter is a TypeScript port of the
			upcoming compiler — same syntax, same semantics.
		</p>
		<ExampleViewer {examples} />
	</section>
</section>

<style>
	.landing {
		max-width: 1040px;
		margin: 0 auto;
		padding: 96px 32px 128px;
		display: flex;
		flex-direction: column;
		gap: 96px;
	}

	.hero {
		display: flex;
		flex-direction: column;
		gap: 24px;
		max-width: 720px;
	}

	.hero-title {
		font-size: clamp(40px, 6vw, var(--fs-2xl));
	}

	.hero-title em {
		font-style: italic;
		color: var(--accent);
	}

	.hero-lede {
		font-size: var(--fs-md);
		color: var(--fg-muted);
		max-width: 56ch;
		line-height: 1.55;
	}

	.hero-actions {
		display: flex;
		gap: 12px;
		margin-top: 8px;
	}

	.examples {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section-title {
		font-size: var(--fs-xl);
	}

	.section-lede {
		color: var(--fg-muted);
		max-width: 60ch;
		margin-bottom: 16px;
	}
</style>
