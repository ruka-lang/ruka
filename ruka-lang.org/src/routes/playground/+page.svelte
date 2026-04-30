<script lang="ts">
	import Editor from "$lib/components/editor/index.svelte";
	import Terminal from "$lib/components/terminal/index.svelte";
	import { examples, findExample, entrySource } from "$lib/playground/examples";
	import { checkSource, runSource } from "$lib/playground/driver";

	let selectedId = $state(examples[0].id);
	let source = $state(entrySource(examples[0]));
	let errorLine: number | null = $state(null);
	let errorMessage: string | null = $state(null);
	let canRun = $state(true);
	let running = $state(false);
	let status: "idle" | "running" | "error" | "ok" = $state("idle");
	let terminal: Terminal | undefined = $state();

	let checkTimer: ReturnType<typeof setTimeout> | null = null;

	function scheduleCheck(next: string) {
		if (checkTimer) clearTimeout(checkTimer);
		checkTimer = setTimeout(() => {
			checkTimer = null;
			if (next !== source) return;
			const result = checkSource(next);
			if (result.ok) {
				errorLine = null;
				errorMessage = null;
				canRun = true;
			} else {
				errorLine = result.line ?? null;
				errorMessage = result.message;
				canRun = false;
			}
		}, 300);
	}

	function onSourceChange(next: string) {
		source = next;
		scheduleCheck(next);
	}

	function onSelectExample(event: Event) {
		const id = (event.target as HTMLSelectElement).value;
		const example = findExample(id);
		if (!example) return;
		selectedId = id;
		const next = entrySource(example);
		source = next;
		errorLine = null;
		errorMessage = null;
		canRun = true;
		terminal?.clear();
		scheduleCheck(next);
	}

	async function onRun() {
		if (!terminal || running || !canRun) return;
		running = true;
		status = "running";
		terminal.clear();
		const result = await runSource(source, {
			onStdout: (text) => terminal?.write(text),
			onStderr: (text) => terminal?.writeErr(text),
			requestInput: () => terminal?.requestInput() ?? Promise.resolve("")
		});
		if (result.ok) {
			status = "ok";
		} else {
			status = "error";
			errorLine = result.line ?? null;
			errorMessage = result.message;
			canRun = false;
			terminal?.writeErr(
				"Runtime error" +
					(result.line ? ` (line ${result.line})` : "") +
					": " +
					result.message +
					"\n"
			);
		}
		running = false;
	}
</script>

<svelte:head><title>Ruka — Playground</title></svelte:head>

<section class="playground">
	<header class="playground-header">
		<span class="playground-label">PLAYGROUND</span>
		<div class="playground-controls">
			<select aria-label="Select example" value={selectedId} onchange={onSelectExample}>
				{#each examples as example (example.id)}
					<option value={example.id}>{example.label}</option>
				{/each}
			</select>
			<button type="button" onclick={onRun} disabled={!canRun || running}>
				{running ? "RUNNING" : "RUN"}
			</button>
		</div>
	</header>

	<div class="playground-editor">
		<Editor
			bind:value={source}
			{errorLine}
			{errorMessage}
			onChange={onSourceChange}
			ariaLabel="Ruka code editor"
		/>
	</div>

	<div class="playground-output">
		<Terminal bind:this={terminal} {status} />
	</div>
</section>

<style>
	.playground {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: 960px;
		margin: 24px auto;
		padding: 0 16px;
	}
	.playground-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 10px;
		font-size: 11px;
		letter-spacing: 0.08em;
	}
	.playground-label {
		opacity: 0.7;
	}
	.playground-controls {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.playground-controls select,
	.playground-controls button {
		font: inherit;
		font-size: 12px;
		padding: 4px 10px;
		border: 1px solid currentColor;
		background: transparent;
		color: inherit;
		border-radius: 4px;
		cursor: pointer;
	}
	.playground-controls button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.playground-editor,
	.playground-output {
		border: 1px solid rgba(127, 127, 127, 0.3);
		border-radius: 6px;
		overflow: hidden;
	}
</style>
