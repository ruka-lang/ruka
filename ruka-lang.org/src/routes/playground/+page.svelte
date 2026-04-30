<script lang="ts">
	import { untrack } from "svelte";
	import Editor from "$lib/components/editor/index.svelte";
	import Terminal from "$lib/components/terminal/index.svelte";
	import FileTabs from "$lib/components/file-tabs/index.svelte";
	import { Button, Card, Select } from "$lib/components/ui";
	import { examples, findExample } from "$lib/playground/examples";
	import {
		projectFromExample,
		updateFileSource,
		getFile,
		getEntrySource,
		type Project
	} from "$lib/playground/project";
	import { checkSource, runSource } from "$lib/playground/driver";

	const exampleOptions = examples.map((example) => ({
		value: example.id,
		label: example.label
	}));

	let selectedExampleId = $state(examples[0].id);
	let project = $state<Project>(projectFromExample(examples[0]));
	let selectedPath = $state(untrack(() => project.entry));

	let errorLine: number | null = $state(null);
	let errorMessage: string | null = $state(null);
	let canRun = $state(true);
	let running = $state(false);
	let status: "idle" | "running" | "error" | "ok" = $state("idle");
	let terminal: Terminal | undefined = $state();

	// Source of the currently-edited file. The Editor binds to this; on every
	// keystroke we mirror the change back into the project so the file tabs
	// preserve edits when the user switches files.
	const currentSource = $derived(getFile(project, selectedPath)?.source ?? "");

	let checkTimer: ReturnType<typeof setTimeout> | null = null;

	function scheduleCheck(path: string, next: string) {
		if (checkTimer) clearTimeout(checkTimer);

		checkTimer = setTimeout(() => {
			checkTimer = null;

			// The user may have switched files or kept typing during the debounce
			// — only honor the result if the file/source we checked is still the
			// active one. Otherwise we'd flash diagnostics for stale state.
			if (path !== selectedPath) return;
			if (next !== getFile(project, path)?.source) return;

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
		project = updateFileSource(project, selectedPath, next);
		scheduleCheck(selectedPath, next);
	}

	function onSelectFile(path: string) {
		if (path === selectedPath) return;

		selectedPath = path;
		errorLine = null;
		errorMessage = null;
		canRun = true;

		const file = getFile(project, path);
		if (file) scheduleCheck(path, file.source);
	}

	function onSelectExample(id: string) {
		const example = findExample(id);
		if (!example) return;

		selectedExampleId = id;
		project = projectFromExample(example);
		selectedPath = project.entry;
		errorLine = null;
		errorMessage = null;
		canRun = true;
		terminal?.clear();
		scheduleCheck(selectedPath, getEntrySource(project));
	}

	async function onRun() {
		if (!terminal || running || !canRun) return;

		running = true;
		status = "running";
		terminal.clear();

		// Ruka has no `import` builtin yet, so the runtime sees only the entry.
		// Non-entry files are editable here so the project shape is ready for
		// when imports land — they're just inert today.
		const result = await runSource(getEntrySource(project), {
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
			<Select
				ariaLabel="Select example"
				value={selectedExampleId}
				options={exampleOptions}
				onChange={onSelectExample}
			/>
			<Button variant="ghost" disabled={!canRun || running} onclick={onRun}>
				{running ? "RUNNING" : "RUN"}
			</Button>
		</div>
	</header>

	<FileTabs
		files={project.files}
		selected={selectedPath}
		entry={project.entry}
		onSelect={onSelectFile}
	/>

	<Card padded={false}>
		<Editor
			value={currentSource}
			{errorLine}
			{errorMessage}
			onChange={onSourceChange}
			ariaLabel="Ruka code editor"
		/>
	</Card>

	<Card padded={false}>
		<Terminal bind:this={terminal} {status} />
	</Card>
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
</style>
