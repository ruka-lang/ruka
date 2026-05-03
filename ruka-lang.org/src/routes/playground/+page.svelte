<script lang="ts">
	import { onMount, untrack } from "svelte";
	import {
		FilePlus2,
		PanelRightOpen,
		Pencil,
		Play,
		Save,
		Trash2
	} from "lucide-svelte";
	import Editor from "$lib/components/editor/index.svelte";
	import Terminal from "$lib/components/terminal/index.svelte";
	import FileTree, { type TreeAction } from "$lib/components/file-tree/index.svelte";
	import { Button, Popover, Select, type SelectGroup } from "$lib/components/ui";
	import { examples, findExample } from "$lib/playground/examples";
	import {
		projectFromExample,
		emptyProject,
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
		move,
		pathExists,
		isProtectedPath,
		type Project
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

	// Pane layout state. The tree column is drag-resizable via the
	// vertical gutter between tree and editor; the output column
	// collapses to a thin vertical rail with a chevron toggle.
	let treeWidth = $state(220);
	let outputCollapsed = $state(false);
	let resizing = false;

	function onResizeStart(event: PointerEvent) {
		event.preventDefault();
		resizing = true;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		const startX = event.clientX;
		const startWidth = treeWidth;

		function onMove(e: PointerEvent) {
			if (!resizing) return;
			const delta = e.clientX - startX;
			treeWidth = Math.max(160, Math.min(480, startWidth + delta));
		}

		function onEnd() {
			resizing = false;
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onEnd);
		}

		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onEnd);
	}

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
		scheduleCheck(selectedPath, getEntrySource(project));
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
			if (!errorPath || errorPath === selectedPath) {
				// Error is in the currently-visible file — highlight it directly.
				errorLine = result.line ?? null;
				errorColumn = result.col ?? null;
				errorMessage = result.message;
			} else {
				// Error originated in a different file. If the import call that
				// triggered it is visible here, highlight that line.
				const importLine = "importLine" in result ? result.importLine : undefined;
				const importCol = "importCol" in result ? result.importCol : undefined;
				errorLine = importLine ?? null;
				errorColumn = importCol ?? null;
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
			stored.order = project.order;
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

		if (action.kind === "delete-file") {
			if (isProtectedPath(action.path)) return;
			commitProjectMutation(deleteFile(project, action.path));
			return;
		}

		if (action.kind === "move") {
			const before = project;
			const next = move(project, action.from, action.toParent, action.before);
			if (next === before) return;
			commitProjectMutation(next);

			// `move` rewrites descendant paths when crossing folders;
			// keep the editor pointed at the same file the user was
			// editing, even if its path just changed.
			if (selectedPath === action.from || selectedPath.startsWith(action.from + "/")) {
				const newName =
					action.toParent === ""
						? action.from.split("/").pop()!
						: `${action.toParent}/${action.from.split("/").pop()!}`;
				const suffix = selectedPath.slice(action.from.length);
				selectedPath = newName + suffix;
			}
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

		if (isProtectedPath(target)) {
			popoverError = "The src folder can't be deleted";
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
			canRun = false;
			// Runtime errors go to the terminal only — no inline editor annotation.
			const runtimePath = "path" in result ? result.path : undefined;
			const locationPrefix = runtimePath ? `in ${runtimePath}: ` : "";
			terminal?.writeErr(
				"Runtime error" +
					(result.line ? ` (line ${result.line})` : "") +
					": " +
					locationPrefix +
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
			<Button variant="ghost" onclick={(e) => openProjectPopover("new", e)}>
				<FilePlus2 size={14} strokeWidth={1.75} />
				NEW
			</Button>
			{#if active.kind === "example"}
				<Button variant="ghost" onclick={(e) => openProjectPopover("save-as", e)}>
					<Save size={14} strokeWidth={1.75} />
					SAVE AS
				</Button>
			{:else}
				<Button variant="ghost" onclick={(e) => openProjectPopover("rename", e)}>
					<Pencil size={14} strokeWidth={1.75} />
					RENAME
				</Button>
				<Button variant="ghost" onclick={(e) => openProjectPopover("delete", e)}>
					<Trash2 size={14} strokeWidth={1.75} />
					DELETE
				</Button>
			{/if}
			<Button variant="primary" disabled={!canRun || running} onclick={onRun}>
				<Play size={14} strokeWidth={2} />
				{running ? "RUNNING" : "RUN"}
			</Button>
		</div>
	</header>

	<div class="workspace" class:output-collapsed={outputCollapsed}>
		<div class="pane tree-pane" style="width: {treeWidth}px">
			<FileTree
				files={project.files}
				folders={project.folders}
				order={project.order}
				selected={selectedPath}
				onAction={onTreeAction}
			/>
		</div>

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="resize-gutter"
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize file tree"
			onpointerdown={onResizeStart}
		></div>

		<div class="pane editor-pane">
			<Editor
				value={currentSource}
				height="100%"
				{errorLine}
				{errorColumn}
				{errorMessage}
				onChange={onSourceChange}
				ariaLabel="Ruka code editor"
			/>
		</div>

		{#if outputCollapsed}
			<button
				class="output-rail"
				type="button"
				onclick={() => (outputCollapsed = false)}
				aria-label="Expand output panel"
				title="Expand output"
			>
				<PanelRightOpen size={14} strokeWidth={1.75} />
				<span class="output-rail-label">OUTPUT</span>
				<span class="output-rail-status" data-status={status} aria-hidden="true"></span>
			</button>
		{:else}
			<div class="pane output-pane">
				<Terminal
					bind:this={terminal}
					{status}
					maxHeight="none"
					onCollapse={() => (outputCollapsed = true)}
				/>
			</div>
		{/if}
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
	/* Single bordered shell that fills most of the viewport. The
	 * playground reads as one connected surface — header on top, three
	 * panes below — with 1px dividers between sections instead of
	 * floating cards. */
	.playground {
		display: flex;
		flex-direction: column;
		max-width: min(1600px, calc(100vw - 32px));
		height: calc(100vh - 88px);
		margin: 16px auto;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		overflow: hidden;
	}

	.playground-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
		font-size: 11px;
		letter-spacing: 0.08em;
		flex-wrap: wrap;
	}
	.playground-label {
		opacity: 0.7;
	}
	.playground-controls {
		display: flex;
		gap: 6px;
		align-items: center;
		flex-wrap: wrap;
	}
	/* Header buttons — denser than the default Button variant so the
	 * full action row fits comfortably with icons + labels. */
	.playground-controls :global(.btn) {
		gap: 6px;
		padding: 6px 10px;
		font-size: var(--fs-xs);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.workspace {
		display: flex;
		flex: 1;
		min-height: 0;
	}

	.pane {
		display: flex;
		flex-direction: column;
		min-height: 0;
		min-width: 0;
	}

	.tree-pane {
		flex: 0 0 auto;
		border-right: 1px solid var(--border);
	}

	.editor-pane {
		flex: 1 1 auto;
	}

	/* Editor fills its pane — the height: 100% prop on <Editor> sits in
	 * the prop chain, this rule forces the wrapper to provide the box
	 * height the editor measures against. */
	.editor-pane :global(.editor) {
		flex: 1;
		min-height: 0;
		height: 100% !important;
	}

	.output-pane {
		flex: 0 0 320px;
		border-left: 1px solid var(--border);
	}

	.workspace.output-collapsed .editor-pane {
		border-right: 1px solid var(--border);
	}

	/* The resize gutter is a 4px-wide drag handle between tree and
	 * editor. The visible 1px divider runs through its center; the
	 * extra 3px of pointer area gives the user something to grab. */
	.resize-gutter {
		flex: 0 0 4px;
		margin-left: -2px;
		margin-right: -2px;
		cursor: col-resize;
		background: transparent;
		position: relative;
		z-index: 1;
	}
	.resize-gutter:hover {
		background: var(--accent);
		opacity: 0.4;
	}

	/* Vertical "OUTPUT" rail shown when the output pane is collapsed.
	 * Click anywhere on the rail to expand the pane back. */
	.output-rail {
		display: flex;
		flex: 0 0 28px;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 8px;
		padding: 10px 0;
		color: var(--fg-muted);
		background: transparent;
		border: none;
		border-left: 1px solid var(--border);
		font: inherit;
		font-size: 10px;
		letter-spacing: 0.12em;
		cursor: pointer;
	}
	.output-rail:hover {
		color: var(--fg);
		background: var(--bg-elevated);
	}
	.output-rail-label {
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		text-transform: uppercase;
	}
	.output-rail-status {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: transparent;
	}
	.output-rail-status[data-status="running"] {
		background: var(--accent);
	}
	.output-rail-status[data-status="ok"] {
		background: #4ade80;
	}
	.output-rail-status[data-status="error"] {
		background: var(--danger);
	}

	/* Mobile: stack the panes vertically. The output rail is hidden
	 * since horizontal collapsing doesn't apply when columns become
	 * rows; the user can scroll past the editor to see output. */
	@media (max-width: 720px) {
		.playground {
			height: auto;
			min-height: calc(100vh - 88px);
		}
		.workspace {
			flex-direction: column;
		}
		.tree-pane {
			width: auto !important;
			max-height: 200px;
			border-right: none;
			border-bottom: 1px solid var(--border);
		}
		.resize-gutter {
			display: none;
		}
		.editor-pane {
			min-height: 50vh;
		}
		.output-pane {
			flex: 0 0 auto;
			max-height: 240px;
			border-left: none;
			border-top: 1px solid var(--border);
		}
		.output-rail {
			flex-direction: row;
			width: 100%;
			height: 28px;
			border-left: none;
			border-top: 1px solid var(--border);
		}
		.output-rail-label {
			writing-mode: horizontal-tb;
			transform: none;
		}
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
