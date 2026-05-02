<script lang="ts">
	import { onMount, untrack } from "svelte";
	import Editor from "$lib/components/editor/index.svelte";
	import Terminal from "$lib/components/terminal/index.svelte";
	import FileTree, { type TreeAction } from "$lib/components/file-tree/index.svelte";
	import { Button, Card, Popover, Select, type SelectGroup } from "$lib/components/ui";
	import { examples, findExample } from "$lib/playground/examples";
	import {
		projectFromExample,
		updateFileSource,
		getFile,
		getEntrySource,
		fileKindFromPath,
		addFile,
		addFolder,
		renameFile,
		renameFolder,
		deleteFile,
		deleteFolder,
		setEntry,
		pathExists,
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
	import {
		checkSource,
		checkProjectSource,
		runSource,
		runProject
	} from "$lib/playground/driver";

	// Active source of the working project. `example` reads from the
	// bundled examples list and is never persisted; `project` is loaded
	// from IndexedDB and autosaves on every edit.
	type Active = { kind: "example"; id: string } | { kind: "project"; id: string };

	const EMPTY_TEMPLATE: ProjectFile[] = [
		{
			path: "main.ruka",
			source: 'let main = () do\n\truka.println("Hello!")\nend\n',
			kind: "ruka"
		}
	];

	function emptyProject(): Project {
		return {
			files: EMPTY_TEMPLATE.map((f) => ({ ...f })),
			folders: [],
			entry: "main.ruka"
		};
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

			// Check the whole project from the entry so `ruka.import(...)`
			// resolves across files. `checkSource` is kept as a fallback for
			// the (rare) case where the project has no entry registered.
			const result = project.entry
				? checkProjectSource(project)
				: checkSource(next);

			if (result.ok) {
				errorLine = null;
				errorColumn = null;
				errorMessage = null;
				canRun = true;
				return;
			}

			canRun = false;
			const errorPath = "path" in result ? result.path : undefined;
			// Inline line/col decoration only when the error lives in the
			// file the user is editing. Cross-module errors get a
			// path-prefixed message without highlighting a wrong line.
			if (!errorPath || errorPath === selectedPath) {
				errorLine = result.line ?? null;
				errorColumn = result.col ?? null;
				errorMessage = result.message;
			} else {
				errorLine = null;
				errorColumn = null;
				errorMessage = `in ${errorPath}: ${result.message}`;
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

	// Popover state. Only one is open at a time; the trigger element
	// passes itself as the anchor so the bubble's arrow points back at it.
	// Per-kind context (target path for rename/delete, parent path for
	// new file/folder) is captured on open and read by the submit handler.
	type PopoverKind =
		| "new"
		| "save-as"
		| "rename"
		| "delete"
		| "new-file"
		| "new-folder"
		| "rename-file"
		| "rename-folder"
		| "delete-folder";
	let popoverKind: PopoverKind | null = $state(null);
	let popoverAnchor: HTMLElement | null = $state(null);
	let popoverInput = $state("");
	let popoverInputEl: HTMLInputElement | null = $state(null);
	let popoverError: string | null = $state(null);
	let popoverTargetPath: string | null = $state(null);
	let popoverParentPath: string | null = $state(null);

	function openProjectPopover(
		kind: "new" | "save-as" | "rename" | "delete",
		event: MouseEvent
	) {
		popoverAnchor = event.currentTarget as HTMLElement;
		popoverKind = kind;
		popoverInput = kind === "rename" ? (activeProject?.name ?? "") : "";
		popoverError = null;
		popoverTargetPath = null;
		popoverParentPath = null;
		queueMicrotask(() => popoverInputEl?.focus());
	}

	function openTreePopover(
		kind: "new-file" | "new-folder" | "rename-file" | "rename-folder" | "delete-folder",
		anchor: HTMLElement,
		opts: { target?: string; parent?: string } = {}
	) {
		popoverAnchor = anchor;
		popoverKind = kind;
		popoverError = null;
		popoverTargetPath = opts.target ?? null;
		popoverParentPath = opts.parent ?? null;

		if (kind === "rename-file" || kind === "rename-folder") {
			const path = opts.target ?? "";
			const slash = path.lastIndexOf("/");
			popoverInput = slash === -1 ? path : path.slice(slash + 1);
		} else {
			popoverInput = "";
		}

		queueMicrotask(() => popoverInputEl?.focus());
	}

	function closePopover() {
		popoverKind = null;
		popoverAnchor = null;
		popoverInput = "";
		popoverInputEl = null;
		popoverError = null;
		popoverTargetPath = null;
		popoverParentPath = null;
	}

	function joinPath(parent: string, name: string): string {
		return parent === "" ? name : `${parent}/${name}`;
	}

	function isValidName(name: string): boolean {
		// Disallow path separators in a single segment and reject names
		// that would round-trip to the empty string after trimming.
		return name.length > 0 && !name.includes("/");
	}

	function isValidFileName(name: string): boolean {
		if (!isValidName(name)) return false;
		return name.endsWith(".ruka") || name.endsWith(".txt");
	}

	function commitProjectMutation(next: Project) {
		project = next;
		const file = getFile(next, selectedPath);
		if (!file) {
			selectedPath = next.entry;
			resetDiagnostics();
			const entryFile = getFile(next, next.entry);
			if (entryFile) scheduleCheck(next.entry, entryFile.source);
		}
		scheduleSave();
	}

	function onTreeAction(action: TreeAction) {
		if (action.kind === "open") {
			onSelectFile(action.path);
			return;
		}

		if (action.kind === "set-entry") {
			commitProjectMutation(setEntry(project, action.path));
			return;
		}

		if (action.kind === "delete-file") {
			if (action.path === project.entry) return;
			commitProjectMutation(deleteFile(project, action.path));
			return;
		}

		if (action.kind === "new-file") {
			openTreePopover("new-file", action.anchor, { parent: action.parent });
		} else if (action.kind === "new-folder") {
			openTreePopover("new-folder", action.anchor, { parent: action.parent });
		} else if (action.kind === "rename-file") {
			openTreePopover("rename-file", action.anchor, { target: action.path });
		} else if (action.kind === "rename-folder") {
			openTreePopover("rename-folder", action.anchor, { target: action.path });
		} else if (action.kind === "delete-folder") {
			openTreePopover("delete-folder", action.anchor, { target: action.path });
		}
	}

	function submitNewFile() {
		const name = popoverInput.trim();
		if (!isValidFileName(name)) {
			popoverError = "Name must end in .ruka or .txt";
			return;
		}

		const path = joinPath(popoverParentPath ?? "", name);
		if (pathExists(project, path)) {
			popoverError = "A file or folder with that name already exists";
			return;
		}

		commitProjectMutation(addFile(project, path));
		selectedPath = path;
		closePopover();
	}

	function submitNewFolder() {
		const name = popoverInput.trim();
		if (!isValidName(name)) {
			popoverError = "Folder name can't contain '/'";
			return;
		}

		const path = joinPath(popoverParentPath ?? "", name);
		if (pathExists(project, path)) {
			popoverError = "A file or folder with that name already exists";
			return;
		}

		commitProjectMutation(addFolder(project, path));
		closePopover();
	}

	function submitRenameFile() {
		const target = popoverTargetPath;
		if (!target) return;

		const name = popoverInput.trim();
		if (!isValidFileName(name)) {
			popoverError = "Name must end in .ruka or .txt";
			return;
		}

		const slash = target.lastIndexOf("/");
		const parent = slash === -1 ? "" : target.slice(0, slash);
		const nextPath = joinPath(parent, name);
		if (nextPath === target) {
			closePopover();
			return;
		}

		if (pathExists(project, nextPath)) {
			popoverError = "A file or folder with that name already exists";
			return;
		}

		commitProjectMutation(renameFile(project, target, nextPath));
		if (selectedPath === target) selectedPath = nextPath;
		closePopover();
	}

	function submitRenameFolder() {
		const target = popoverTargetPath;
		if (!target) return;

		const name = popoverInput.trim();
		if (!isValidName(name)) {
			popoverError = "Folder name can't contain '/'";
			return;
		}

		const slash = target.lastIndexOf("/");
		const parent = slash === -1 ? "" : target.slice(0, slash);
		const nextPath = joinPath(parent, name);
		if (nextPath === target) {
			closePopover();
			return;
		}

		if (pathExists(project, nextPath)) {
			popoverError = "A file or folder with that name already exists";
			return;
		}

		const before = selectedPath;
		commitProjectMutation(renameFolder(project, target, nextPath));
		// renameFolder rewrites descendant paths — the selected file may
		// have moved, so recompute it from the same suffix.
		if (before === target || before.startsWith(target + "/")) {
			selectedPath = nextPath + before.slice(target.length);
		}
		closePopover();
	}

	function submitDeleteFolder() {
		const target = popoverTargetPath;
		if (!target) {
			closePopover();
			return;
		}

		// Refuse if the entry file lives under the folder — the user has
		// to either move/rename the entry or pick a new entry first.
		const entry = project.entry;
		if (entry === target || entry.startsWith(target + "/")) {
			popoverError = "Cannot delete a folder that contains the entry file";
			return;
		}

		commitProjectMutation(deleteFolder(project, target));
		closePopover();
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
		else if (popoverKind === "new-file") submitNewFile();
		else if (popoverKind === "new-folder") submitNewFolder();
		else if (popoverKind === "rename-file") submitRenameFile();
		else if (popoverKind === "rename-folder") submitRenameFolder();
	}

	async function onRun() {
		if (!terminal || running || !canRun) return;

		running = true;
		status = "running";
		terminal.clear();

		const hooks = {
			onStdout: (text: string) => terminal?.write(text),
			onStderr: (text: string) => terminal?.writeErr(text),
			requestInput: () => terminal?.requestInput() ?? Promise.resolve("")
		};
		// Use the project-aware runner whenever we have a real entry so
		// `ruka.import(...)` can resolve across files. `runSource` stays as
		// the fallback for the (unreachable) no-entry case.
		const result = project.entry
			? await runProject(project, hooks)
			: await runSource(getEntrySource(project), hooks);

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
			<Button variant="ghost" onclick={(e) => openProjectPopover("new", e)}>NEW</Button>
			{#if active.kind === "example"}
				<Button variant="ghost" onclick={(e) => openProjectPopover("save-as", e)}
					>SAVE AS</Button
				>
			{:else}
				<Button variant="ghost" onclick={(e) => openProjectPopover("rename", e)}
					>RENAME</Button
				>
				<Button variant="ghost" onclick={(e) => openProjectPopover("delete", e)}
					>DELETE</Button
				>
			{/if}
			<Button variant="ghost" disabled={!canRun || running} onclick={onRun}>
				{running ? "RUNNING" : "RUN"}
			</Button>
		</div>
	</header>

	<div class="workspace">
		<FileTree
			files={project.files}
			folders={project.folders}
			selected={selectedPath}
			entry={project.entry}
			onAction={onTreeAction}
		/>

		<div class="workspace-main">
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
		</div>
	</div>
</section>

<Popover
	anchor={popoverAnchor}
	open={popoverKind !== null}
	placement="bottom"
	onClose={closePopover}
	ariaLabel={popoverKind === "delete" || popoverKind === "delete-folder"
		? "Confirm delete"
		: "Name"}
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
	{:else if popoverKind === "delete-folder"}
		<p class="popover-msg">
			Delete folder <strong>{popoverTargetPath}</strong> and everything inside it?
		</p>
		{#if popoverError}
			<p class="popover-error">{popoverError}</p>
		{/if}
		<div class="popover-actions">
			<Button variant="ghost" onclick={closePopover}>Cancel</Button>
			<Button variant="primary" onclick={submitDeleteFolder}>Delete</Button>
		</div>
	{:else}
		<form onsubmit={onPopoverSubmit}>
			<label class="popover-label">
				{#if popoverKind === "new"}New project name
				{:else if popoverKind === "save-as"}Save copy as
				{:else if popoverKind === "rename"}Rename project
				{:else if popoverKind === "new-file"}New file{popoverParentPath
						? ` in ${popoverParentPath}`
						: ""}
				{:else if popoverKind === "new-folder"}New folder{popoverParentPath
						? ` in ${popoverParentPath}`
						: ""}
				{:else if popoverKind === "rename-file"}Rename file
				{:else if popoverKind === "rename-folder"}Rename folder
				{/if}
				<input
					bind:this={popoverInputEl}
					bind:value={popoverInput}
					class="popover-input"
					type="text"
					placeholder={popoverKind === "new-file"
						? "name.ruka"
						: popoverKind === "new-folder" || popoverKind === "rename-folder"
							? "folder-name"
							: popoverKind === "rename-file"
								? "name.ruka"
								: "my-project"}
					autocomplete="off"
					spellcheck="false"
				/>
			</label>
			{#if popoverError}
				<p class="popover-error">{popoverError}</p>
			{/if}
			<div class="popover-actions">
				<Button variant="ghost" onclick={closePopover}>Cancel</Button>
				<Button variant="primary" type="submit">
					{#if popoverKind === "new" || popoverKind === "new-file" || popoverKind === "new-folder"}
						Create
					{:else if popoverKind === "save-as"}Save
					{:else}Rename{/if}
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
		max-width: 1200px;
		margin: 24px auto;
		padding: 0 16px;
	}

	.workspace {
		display: grid;
		grid-template-columns: 220px minmax(0, 1fr);
		gap: 12px;
		align-items: start;
	}

	.workspace-main {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}

	/* Below ~720px the sidebar shifts to a stacked panel above the editor.
	 * Tree nodes still render the same — just the column collapses so the
	 * editor doesn't get squeezed off-screen. */
	@media (max-width: 720px) {
		.workspace {
			grid-template-columns: minmax(0, 1fr);
		}
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

	.popover-error {
		font-size: var(--fs-xs);
		color: #ff6b6b;
		margin: 0;
	}

	.popover-actions {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
		margin-top: 4px;
	}
</style>
