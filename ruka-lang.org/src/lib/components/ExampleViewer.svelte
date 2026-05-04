<script lang="ts">
	import { untrack } from "svelte";
	import Editor from "$lib/components/editor/index.svelte";
	import Terminal from "$lib/components/terminal/index.svelte";
	import { Card, Select } from "$lib/components/ui";
	import { runSource } from "$lib/playground/driver";
	import type { LandingExample } from "$lib/playground/landingExamples";

	type Props = {
		examples: LandingExample[];
		// Editor height is fixed but configurable per consumer — landing wants a
		// taller window than an inline doc snippet would.
		height?: string;
	};

	let { examples, height = "20rem" }: Props = $props();

	// Initial selection is the first example; subsequent changes are driven
	// by `loadAndRun`. `untrack` tells Svelte we deliberately want only the
	// initial prop value, not a reactive subscription.
	let selectedId = $state(untrack(() => examples[0]?.id ?? ""));
	let source = $state(untrack(() => examples[0]?.source ?? ""));
	let status: "idle" | "running" | "error" | "ok" = $state("idle");
	let terminal: Terminal | undefined = $state();

	const options = $derived(examples.map((ex) => ({ value: ex.id, label: ex.label })));

	function loadAndRun(id: string) {
		const example = examples.find((ex) => ex.id === id);
		if (!example) return;

		selectedId = id;
		source = example.source;

		runExample();
	}

	async function runExample() {
		if (!terminal) return;

		status = "running";
		terminal.clear();

		// Featured examples are curated to be non-interactive; if one happens to
		// request input we resolve with an empty string and let any subsequent
		// runtime error surface in the terminal rather than hanging the UI.
		const result = await runSource(source, {
			onStdout: (text) => terminal?.write(text),
			onStderr: (text) => terminal?.writeErr(text),
			requestInput: () => Promise.resolve("")
		});

		if (result.ok) {
			status = "ok";
		} else {
			status = "error";
			terminal.writeErr(
				"Error" +
					(result.line ? ` (line ${result.line})` : "") +
					": " +
					result.message +
					"\n"
			);
		}
	}

	$effect(() => {
		// Auto-run once the terminal mounts, using whatever example is currently
		// selected. Subsequent selections route through `loadAndRun` directly.
		if (terminal && status === "idle" && source) {
			runExample();
		}
	});
</script>

<div class="example-viewer">
	<header class="header">
		<Select
			ariaLabel="Select example"
			value={selectedId}
			{options}
			onChange={loadAndRun}
		/>
	</header>

	<div class="split">
		<Card padded={false}>
			<Editor value={source} readonly {height} ariaLabel="Example source" />
		</Card>

		<Card padded={false}>
			<Terminal bind:this={terminal} {status} maxHeight={height} />
		</Card>
	</div>
</div>

<style>
	.example-viewer {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.header {
		display: flex;
		justify-content: flex-end;
	}

	.split {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		align-items: stretch;
	}

	/* Stack the panes on narrow screens — side-by-side becomes unreadable
	 * once each column drops below ~360px. */
	@media (max-width: 800px) {
		.split {
			grid-template-columns: 1fr;
		}
	}
</style>
