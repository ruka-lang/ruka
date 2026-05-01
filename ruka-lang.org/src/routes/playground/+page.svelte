<script lang="ts">
	import { onMount, untrack } from "svelte";
	import Editor from "$lib/components/editor/index.svelte";
	import Terminal from "$lib/components/terminal/index.svelte";
	import FileTabs from "$lib/components/file-tabs/index.svelte";
	import { Button, Card, Popover, Select, type SelectGroup } from "$lib/components/ui";
	import { examples, findExample } from "$lib/playground/examples";
	import {
		projectFromExample,
		updateFileSource,
		getFile,
		getEntrySource,
		fileKindFromPath,
		type Project,
		type ProjectFile
	} from "$lib/playground/project";
	import {
		listProjects,
		loadProject,
		saveProject,
		deleteProject,
		renameProject,
		newStoredProject,
		toProject,
		type StoredProject
	} from "$lib/playground/storage";
	import { checkSource, runSource } from "$lib/playground/driver";

	// Active source of the working project. `example` reads from the
	// bundled examples list and is never persisted; `project` is loaded
	// from IndexedDB and autosaves on every edit.
	type Active =
		| { kind: "example"; id: string }
		| { kind: "project"; id: string };

	const EMPTY_TEMPLATE: ProjectFile[] = [
		{
			path: "main.ruka",
			source: 'let main = () do\n\truka.println("Hello!")\nend\n',
			kind: "ruka"
		}
	];

	function emptyProject(): Project {
		return { files: EMPTY_TEMPLATE.map((f) => ({ ...f })), folders: [], entry: "main.ruka" };
	}

	let active: Active = $state({ kind: "example", id: examples[0].id });
	let userProjects: StoredProject[] = $state([]);
	let project: Project = $state(projectFromExample(examples[0]));
	let selectedPath = $state(untrack(() => project.entry));

	let errorLine: number | null = $state(null);
	let errorColumn: number | null = $state(null);
	let errorMessage: string | null = $state(null);
	let canRun = $state(true);
	let running = $state(false);
	let status: "idle" | "running" | "error" | "ok" = $state("idle");
	let terminal: Terminal | undefined = $state();

	const currentSource = $derived(getFile(project, selectedPath)?.source ?? "");

	// Encode active state as a select value so Examples and My Projects
	// can share one dropdown via <optgroup>s.
	const selectValue = $derived.by(() => {
		const a = active;
		return a.kind === "example" ? `example:${a.id}` : `project:${a.id}`;
	});

	const selectGroups = $derived.by<SelectGroup[]>(() => {
		const groups: SelectGroup[] = [
			{
				label: "Examples",
				options: examples.map((ex) => ({
					value: `example:${ex.id}`,
					label: ex.label
				}))
			}
		];

		if (userProjects.length > 0) {
			groups.push({
				label: "My Projects",
				options: userProjects.map((p) => ({
					value: `project:${p.id}`,
					label: p.name
				}))
			});
		}

		return groups;
	});

	const activeProject = $derived.by(() => {
		const a = active;
		if (a.kind !== "project") return undefined;
		return userProjects.find((p) => p.id === a.id);
	});

	onMount(async () => {
		userProjects = await listProjects();
	});

	let checkTimer: ReturnType<typeof setTimeout> | null = null;
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	function scheduleCheck(path: string, next: string) {
		if (checkTimer) clearTimeout(checkTimer);

		checkTimer = setTimeout(() => {
			checkTimer = null;

			if (path !== selectedPath) return;
			if (next !== getFile(project, path)?.source) return;
			// .txt files don't get type-checked.
			if (fileKindFromPath(path) !== "ruka") {
				errorLine = null;
				errorColumn = null;
				errorMessage = null;
				canRun = true;
				return;
			}

			const result = checkSource(next);
			if (result.ok) {
				errorLine = null;
				errorColumn = null;
				errorMessage = null;
				canRun = true;
			} else {
				errorLine = result.line ?? null;
				errorColumn = result.col ?? null;
				errorMessage = result.message;
				canRun = false;
			}
		}, 300);
	}

	// Autosave runs only when the active source is a user project.
	// Examples are read-only — edits to them stay in-memory and are
	// discarded when the user picks something else.
	function scheduleSave() {
		if (active.kind !== "project") return;
		const id = active.id;

		if (saveTimer) clearTimeout(saveTimer);

		saveTimer = setTimeout(async () => {
			saveTimer = null;

			const stored = await loadProject(id);
			if (!stored) return;

			stored.files = project.files;
			stored.folders = project.folders;
			stored.entry = project.entry;
			await saveProject(stored);

			// Refresh the in-memory list so updatedAt-based ordering
			// stays accurate without another DB roundtrip on every save.
			userProjects = await listProjects();
		}, 500);
	}

	function onSourceChange(next: string) {
		project = updateFileSource(project, selectedPath, next);
		scheduleCheck(selectedPath, next);
		scheduleSave();
	}

	function onSelectFile(path: string) {
		if (path === selectedPath) return;

		selectedPath = path;
		errorLine = null;
		errorColumn = null;
		errorMessage = null;
		canRun = true;

		const file = getFile(project, path);
		if (file) scheduleCheck(path, file.source);
	}

	function resetDiagnostics() {
		errorLine = null;
		errorColumn = null;
		errorMessage = null;
		canRun = true;
	}

	async function loadExample(id: string) {
		const example = findExample(id);
		if (!example) return;

		active = { kind: "example", id };
		project = projectFromExample(example);
		selectedPath = project.entry;
		resetDiagnostics();
		terminal?.clear();
		scheduleCheck(selectedPath, getEntrySource(project));
	}

	async function loadUserProject(id: string) {
		const stored = await loadProject(id);
		if (!stored) {
			// Fell out of the list (deleted in another tab, say); refresh
			// and bail back to the first example.
			userProjects = await listProjects();
			await loadExample(examples[0].id);
			return;
		}

		active = { kind: "project", id };
		project = toProject(stored);
		selectedPath = project.entry;
		resetDiagnostics();
		terminal?.clear();
		scheduleCheck(selectedPath, getEntrySource(project));
	}

	function onSelectFromDropdown(value: string) {
		const [kind, id] = value.split(":", 2);
		if (kind === "example" && id) {
			loadExample(id);
		} else if (kind === "project" && id) {
			loadUserProject(id);
		}
	}

	// Popover state. Only one is open at a time; the trigger button passes
	// itself as the anchor so the bubble's arrow points back at it.
	type PopoverKind = "new" | "save-as" | "rename" | "delete";
	let popoverKind: PopoverKind | null = $state(null);
	let popoverAnchor: HTMLElement | null = $state(null);
	let popoverInput = $state("");
	let popoverInputEl: HTMLInputElement | null = $state(null);

	function openPopover(kind: PopoverKind, event: MouseEvent) {
		popoverAnchor = event.currentTarget as HTMLElement;
		popoverKind = kind;
		popoverInput = kind === "rename" ? activeProject?.name ?? "" : "";
		// Wait for the bubble to mount, then focus its input (or the
		// confirm button for the delete prompt).
		queueMicrotask(() => popoverInputEl?.focus());
	}

	function closePopover() {
		popoverKind = null;
		popoverAnchor = null;
		popoverInput = "";
		popoverInputEl = null;
	}

	async function onNewProject() {
		const name = popoverInput.trim();
		if (!name) return;

		const stored = newStoredProject(name, emptyProject());
		await saveProject(stored);
		userProjects = await listProjects();
		closePopover();
		await loadUserProject(stored.id);
	}

	async function onSaveAsProject() {
		const name = popoverInput.trim();
		if (!name) return;

		const stored = newStoredProject(name, project);
		await saveProject(stored);
		userProjects = await listProjects();
		closePopover();
		await loadUserProject(stored.id);
	}

	async function onRenameProject() {
		if (active.kind !== "project") return;

		const current = activeProject?.name ?? "";
		const next = popoverInput.trim();
		if (!next || next === current) {
			closePopover();
			return;
		}

		await renameProject(active.id, next);
		userProjects = await listProjects();
		closePopover();
	}

	async function onDeleteProject() {
		if (active.kind !== "project") {
			closePopover();
			return;
		}

		const id = active.id;
		closePopover();
		await deleteProject(id);
		userProjects = await listProjects();
		await loadExample(examples[0].id);
	}

	function onPopoverSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (popoverKind === "new") onNewProject();
		else if (popoverKind === "save-as") onSaveAsProject();
		else if (popoverKind === "rename") onRenameProject();
	}

	async function onRun() {
		if (!terminal || running || !canRun) return;

		running = true;
		status = "running";
		terminal.clear();

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
			errorColumn = result.col ?? null;
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
				ariaLabel="Select example or project"
				value={selectValue}
				groups={selectGroups}
				onChange={onSelectFromDropdown}
			/>
			<Button variant="ghost" onclick={(e) => openPopover("new", e)}>NEW</Button>
			{#if active.kind === "example"}
				<Button variant="ghost" onclick={(e) => openPopover("save-as", e)}>SAVE AS</Button>
			{:else}
				<Button variant="ghost" onclick={(e) => openPopover("rename", e)}>RENAME</Button>
				<Button variant="ghost" onclick={(e) => openPopover("delete", e)}>DELETE</Button>
			{/if}
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
			{errorColumn}
			{errorMessage}
			onChange={onSourceChange}
			ariaLabel="Ruka code editor"
		/>
	</Card>

	<Card padded={false}>
		<Terminal bind:this={terminal} {status} maxHeight="20rem" />
	</Card>
</section>

<Popover
	anchor={popoverAnchor}
	open={popoverKind !== null}
	placement="bottom"
	onClose={closePopover}
	ariaLabel={popoverKind === "delete" ? "Confirm delete" : "Project name"}
>
	{#if popoverKind === "delete"}
		<p class="popover-msg">
			Delete <strong>{activeProject?.name ?? "this project"}</strong>?
			<br />This can't be undone.
		</p>
		<div class="popover-actions">
			<Button variant="ghost" onclick={closePopover}>Cancel</Button>
			<Button variant="primary" onclick={onDeleteProject}>Delete</Button>
		</div>
	{:else}
		<form onsubmit={onPopoverSubmit}>
			<label class="popover-label">
				{#if popoverKind === "new"}New project name{:else if popoverKind === "save-as"}Save copy as{:else}Rename project{/if}
				<input
					bind:this={popoverInputEl}
					bind:value={popoverInput}
					class="popover-input"
					type="text"
					placeholder="my-project"
					autocomplete="off"
					spellcheck="false"
				/>
			</label>
			<div class="popover-actions">
				<Button variant="ghost" onclick={closePopover}>Cancel</Button>
				<Button variant="primary" type="submit">
					{#if popoverKind === "new"}Create{:else if popoverKind === "save-as"}Save{:else}Rename{/if}
				</Button>
			</div>
		</form>
	{/if}
</Popover>

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
		flex-wrap: wrap;
	}

	.popover-label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: var(--fs-xs);
		letter-spacing: 0.04em;
		color: var(--fg-muted);
		text-transform: uppercase;
	}

	.popover-input {
		font: inherit;
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		padding: 6px 8px;
		background: var(--bg);
		color: var(--fg);
		border: 1px solid var(--border);
		border-radius: 4px;
		outline: none;
	}

	.popover-input:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px var(--selection);
	}

	.popover-msg {
		font-size: var(--fs-sm);
		color: var(--fg);
	}

	.popover-actions {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
		margin-top: 4px;
	}
</style>
