<script lang="ts" module>
	import type { ProjectFile, ProjectFolder } from "$lib/playground/project";

	export type TreeAction =
		| { kind: "open"; path: string }
		| { kind: "rename-file"; path: string; anchor: HTMLElement }
		| { kind: "rename-folder"; path: string; anchor: HTMLElement }
		| { kind: "delete-file"; path: string }
		| { kind: "delete-folder"; path: string; anchor: HTMLElement }
		| { kind: "new-file"; parent: string; anchor: HTMLElement }
		| { kind: "new-folder"; parent: string; anchor: HTMLElement }
		| { kind: "move"; from: string; toParent: string; before: string | null };

	type FileNode = {
		kind: "file";
		path: string;
		name: string;
		fileKind: ProjectFile["kind"];
	};

	type FolderNode = {
		kind: "folder";
		path: string;
		name: string;
		children: TreeNode[];
	};

	export type TreeNode = FileNode | FolderNode;

	function parentOf(path: string): string {
		const i = path.lastIndexOf("/");
		return i === -1 ? "" : path.slice(0, i);
	}

	// Build a hierarchical tree from the flat (files, folders) lists,
	// using `order` to drive sibling sequence. Paths missing from
	// `order` (defensive — should not happen in practice) sort to the
	// end alphabetically so nothing disappears from the tree.
	export function buildTree(
		files: ProjectFile[],
		folders: ProjectFolder[],
		order: string[]
	): TreeNode[] {
		const orderIndex = new Map<string, number>();
		order.forEach((p, i) => orderIndex.set(p, i));

		function indexOf(path: string): number {
			const idx = orderIndex.get(path);
			return idx === undefined ? Number.MAX_SAFE_INTEGER : idx;
		}

		const folderNodes = new Map<string, FolderNode>();
		folderNodes.set("", { kind: "folder", path: "", name: "", children: [] });

		function ensureFolder(path: string): FolderNode {
			const existing = folderNodes.get(path);
			if (existing) return existing;

			const slash = path.lastIndexOf("/");
			const name = slash === -1 ? path : path.slice(slash + 1);
			const node: FolderNode = { kind: "folder", path, name, children: [] };
			folderNodes.set(path, node);

			ensureFolder(parentOf(path)).children.push(node);

			return node;
		}

		for (const folder of folders) ensureFolder(folder.path);

		for (const file of files) {
			const slash = file.path.lastIndexOf("/");
			const name = slash === -1 ? file.path : file.path.slice(slash + 1);

			ensureFolder(parentOf(file.path)).children.push({
				kind: "file",
				path: file.path,
				name,
				fileKind: file.kind
			});
		}

		function sort(node: FolderNode) {
			node.children.sort((a, b) => indexOf(a.path) - indexOf(b.path));
			for (const child of node.children) {
				if (child.kind === "folder") sort(child);
			}
		}

		const root = folderNodes.get("")!;
		sort(root);
		return root.children;
	}
</script>

<script lang="ts">
	import {
		ChevronRight,
		FilePlus,
		FolderPlus,
		Pencil,
		Trash2
	} from "lucide-svelte";
	import { isProtectedPath } from "$lib/playground/project";

	type Props = {
		files: ProjectFile[];
		folders: ProjectFolder[];
		order: string[];
		selected: string;
		onAction: (action: TreeAction) => void;
	};

	let { files, folders, order, selected, onAction }: Props = $props();

	const tree = $derived(buildTree(files, folders, order));

	let collapsed: Set<string> = $state(new Set());

	// Drag-and-drop state. `dragSource` is the path being dragged;
	// `dragOver` records which row is currently a candidate target,
	// and which "zone" of that row (before / into) the drop would
	// resolve to. The CSS uses these to draw an indicator line or
	// folder ring.
	let dragSource: string | null = $state(null);
	let dragOver: { path: string; zone: "before" | "into" } | null = $state(null);
	let dragOverRoot = $state(false);

	function toggleFolder(path: string) {
		const next = new Set(collapsed);
		if (next.has(path)) next.delete(path);
		else next.add(path);
		collapsed = next;
	}

	function fire(action: TreeAction) {
		onAction(action);
	}

	function onDragStart(event: DragEvent, path: string) {
		if (isProtectedPath(path)) {
			event.preventDefault();
			return;
		}
		dragSource = path;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = "move";
			event.dataTransfer.setData("text/plain", path);
		}
	}

	function onDragEnd() {
		dragSource = null;
		dragOver = null;
		dragOverRoot = false;
	}

	// A drop is invalid when the source equals the target, when the
	// target is a descendant of the source (would orphan the subtree),
	// or when "before X" tries to put the source directly above itself
	// in the same position it already occupies.
	function isLegalDrop(
		from: string | null,
		target: string,
		zone: "before" | "into"
	): boolean {
		if (from === null) return false;
		if (from === target) return false;
		if (target === from || target.startsWith(from + "/")) return false;

		if (zone === "into") {
			// Don't allow dropping into your own current parent if the
			// effect would be a no-op (still legal, but visually noisy).
			// We let it through anyway — the project helper just appends.
			return true;
		}
		// `before`: target's parent becomes the new parent of `from`.
		return true;
	}

	function computeZone(event: DragEvent, isFolder: boolean): "before" | "into" {
		// Files have no "into" zone — the whole row counts as "before".
		// Folders use the top quarter as "before this folder", the rest
		// as "drop into this folder" (append at end).
		if (!isFolder) return "before";

		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const y = event.clientY - rect.top;
		return y < rect.height * 0.25 ? "before" : "into";
	}

	function onRowDragOver(event: DragEvent, path: string, isFolder: boolean) {
		if (dragSource === null) return;
		const zone = computeZone(event, isFolder);
		if (!isLegalDrop(dragSource, path, zone)) {
			dragOver = null;
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
		dragOver = { path, zone };
		dragOverRoot = false;
	}

	function onRowDrop(event: DragEvent, path: string, isFolder: boolean) {
		if (dragSource === null) return;
		event.preventDefault();
		event.stopPropagation();

		const zone = computeZone(event, isFolder);
		if (!isLegalDrop(dragSource, path, zone)) {
			onDragEnd();
			return;
		}

		const from = dragSource;
		const toParent = zone === "into" ? path : parentOf(path);
		const before = zone === "into" ? null : path;

		fire({ kind: "move", from, toParent, before });
		onDragEnd();
	}

	// The trailing strip below the last visible row catches "drop at
	// the end of root" — needed because every other zone resolves to
	// "before X" or "into folder", neither of which can land a path
	// at the bottom of the root level.
	function onRootDragOver(event: DragEvent) {
		if (dragSource === null) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
		dragOverRoot = true;
		dragOver = null;
	}

	function onRootDrop(event: DragEvent) {
		if (dragSource === null) return;
		event.preventDefault();

		const from = dragSource;
		fire({ kind: "move", from, toParent: "", before: null });
		onDragEnd();
	}
</script>

<aside class="file-tree" aria-label="Project files">
	<div class="tree-header">
		<span class="tree-title">Files</span>
		<div class="tree-header-actions">
			<button
				class="icon-btn"
				type="button"
				aria-label="New file at root"
				title="New file"
				onclick={(e) =>
					fire({ kind: "new-file", parent: "", anchor: e.currentTarget as HTMLElement })}
				><FilePlus size={14} strokeWidth={1.75} /></button
			>
			<button
				class="icon-btn"
				type="button"
				aria-label="New folder at root"
				title="New folder"
				onclick={(e) =>
					fire({
						kind: "new-folder",
						parent: "",
						anchor: e.currentTarget as HTMLElement
					})}><FolderPlus size={14} strokeWidth={1.75} /></button
			>
		</div>
	</div>

	<ul class="tree" role="tree">
		{#each tree as node (node.path)}
			{@render renderNode(node, 0)}
		{/each}
		<li
			class="root-drop"
			class:active={dragOverRoot}
			role="presentation"
			ondragover={onRootDragOver}
			ondragleave={() => (dragOverRoot = false)}
			ondrop={onRootDrop}
		></li>
	</ul>
</aside>

{#snippet renderNode(node: TreeNode, depth: number)}
	{#if node.kind === "folder"}
		{@const isCollapsed = collapsed.has(node.path)}
		{@const isLocked = isProtectedPath(node.path)}
		{@const isHere = dragOver?.path === node.path}
		{@const showBefore = isHere && dragOver?.zone === "before"}
		{@const showInto = isHere && dragOver?.zone === "into"}
		<li role="treeitem" aria-expanded={!isCollapsed} aria-selected="false">
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="row folder-row"
				class:drop-before={showBefore}
				class:drop-into={showInto}
				draggable={!isLocked}
				style="padding-left: {depth * 12 + 8}px"
				ondragstart={(e) => onDragStart(e, node.path)}
				ondragend={onDragEnd}
				ondragover={(e) => onRowDragOver(e, node.path, true)}
				ondragleave={() => {
					if (dragOver?.path === node.path) dragOver = null;
				}}
				ondrop={(e) => onRowDrop(e, node.path, true)}
			>
				<button
					class="row-main"
					type="button"
					onclick={() => toggleFolder(node.path)}
					aria-label={isCollapsed ? `Expand ${node.path}` : `Collapse ${node.path}`}
				>
					<span class="caret" data-collapsed={isCollapsed}>
						<ChevronRight size={12} strokeWidth={2} />
					</span>
					<span class="name folder-name">{node.name}</span>
				</button>
				<div class="row-actions">
					<button
						class="icon-btn"
						type="button"
						aria-label="New file in {node.path}"
						title="New file"
						onclick={(e) =>
							fire({
								kind: "new-file",
								parent: node.path,
								anchor: e.currentTarget as HTMLElement
							})}><FilePlus size={14} strokeWidth={1.75} /></button
					>
					<button
						class="icon-btn"
						type="button"
						aria-label="New folder in {node.path}"
						title="New folder"
						onclick={(e) =>
							fire({
								kind: "new-folder",
								parent: node.path,
								anchor: e.currentTarget as HTMLElement
							})}><FolderPlus size={14} strokeWidth={1.75} /></button
					>
					<button
						class="icon-btn"
						type="button"
						disabled={isLocked}
						aria-label="Rename {node.path}"
						title={isLocked ? "src folder can't be renamed" : "Rename"}
						onclick={(e) =>
							fire({
								kind: "rename-folder",
								path: node.path,
								anchor: e.currentTarget as HTMLElement
							})}><Pencil size={13} strokeWidth={1.75} /></button
					>
					<button
						class="icon-btn danger"
						type="button"
						disabled={isLocked}
						aria-label="Delete {node.path}"
						title={isLocked ? "src folder can't be deleted" : "Delete folder"}
						onclick={(e) =>
							fire({
								kind: "delete-folder",
								path: node.path,
								anchor: e.currentTarget as HTMLElement
							})}><Trash2 size={13} strokeWidth={1.75} /></button
				>
				</div>
			</div>
			{#if !isCollapsed}
				<ul role="group">
					{#each node.children as child (child.path)}
						{@render renderNode(child, depth + 1)}
					{/each}
				</ul>
			{/if}
		</li>
	{:else}
		{@const isSelected = node.path === selected}
		{@const isLocked = isProtectedPath(node.path)}
		{@const isHere = dragOver?.path === node.path}
		<li role="treeitem" aria-selected={isSelected}>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="row file-row"
				class:drop-before={isHere && dragOver?.zone === "before"}
				data-active={isSelected}
				draggable={!isLocked}
				style="padding-left: {depth * 12 + 8}px"
				ondragstart={(e) => onDragStart(e, node.path)}
				ondragend={onDragEnd}
				ondragover={(e) => onRowDragOver(e, node.path, false)}
				ondragleave={() => {
					if (dragOver?.path === node.path) dragOver = null;
				}}
				ondrop={(e) => onRowDrop(e, node.path, false)}
			>
				<button
					class="row-main"
					type="button"
					onclick={() => fire({ kind: "open", path: node.path })}
				>
					<span class="kind-tag" data-kind={node.fileKind}>{node.fileKind}</span>
					<span class="name">{node.name}</span>
				</button>
				<div class="row-actions">
					<button
						class="icon-btn"
						type="button"
						disabled={isLocked}
						aria-label="Rename {node.path}"
						title={isLocked ? "Entry file can't be renamed" : "Rename"}
						onclick={(e) =>
							fire({
								kind: "rename-file",
								path: node.path,
								anchor: e.currentTarget as HTMLElement
							})}><Pencil size={13} strokeWidth={1.75} /></button
					>
					<button
						class="icon-btn danger"
						type="button"
						disabled={isLocked}
						aria-label="Delete {node.path}"
						title={isLocked ? "Entry file can't be deleted" : "Delete file"}
						onclick={() => fire({ kind: "delete-file", path: node.path })}
						><Trash2 size={13} strokeWidth={1.75} /></button
					>
				</div>
			</div>
		</li>
	{/if}
{/snippet}

<style>
	.file-tree {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		height: 100%;
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		background: var(--bg);
		overflow: hidden;
	}

	.tree-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 10px;
		border-bottom: 1px solid var(--border);
	}

	.tree-title {
		font-size: var(--fs-xs);
		text-transform: uppercase;
		color: var(--fg-muted);
	}

	.tree-header-actions {
		display: flex;
		gap: 4px;
	}

	.tree {
		list-style: none;
		margin: 0;
		padding: 4px 0;
		overflow-y: auto;
		flex: 1;
	}

	:global(.file-tree ul[role="group"]) {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.row {
		position: relative;
		display: flex;
		align-items: center;
		gap: 4px;
		padding-right: 6px;
		min-height: 26px;
	}

	.row:hover {
		background: var(--bg-elevated);
	}

	.row-main {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
		padding: 2px 0;
		font: inherit;
		color: inherit;
		background: transparent;
		border: none;
		text-align: left;
		cursor: pointer;
	}

	.caret {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		color: var(--fg-muted);
		transition: transform 120ms ease;
	}

	.caret[data-collapsed="false"] {
		transform: rotate(90deg);
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.folder-name {
		font-weight: 500;
	}

	.kind-tag {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		padding: 0 4px;
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--fg-muted);
		border: 1px solid var(--border);
		border-radius: 2px;
	}

	.kind-tag[data-kind="ruka"] {
		color: var(--accent);
	}

	.file-row[data-active="true"] {
		background: var(--selection);
	}

	.row-actions {
		display: none;
		gap: 2px;
	}

	.row:hover .row-actions,
	.row:focus-within .row-actions {
		display: inline-flex;
	}

	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 22px;
		padding: 0 4px;
		font: inherit;
		font-size: 12px;
		color: var(--fg-muted);
		background: transparent;
		border: 1px solid transparent;
		border-radius: 3px;
		cursor: pointer;
	}

	.icon-btn:hover:not(:disabled) {
		color: var(--fg);
		border-color: var(--border);
	}

	.icon-btn.danger:hover:not(:disabled) {
		color: #ff6b6b;
		border-color: #ff6b6b;
	}

	.icon-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	/* Drag-and-drop indicators. `drop-before` paints a 2px line at the
	 * top of the row to show "insert above"; `drop-into` outlines the
	 * folder body to show "drop inside". */
	.row.drop-before::before {
		content: "";
		position: absolute;
		top: -1px;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--accent);
		pointer-events: none;
	}

	.row.drop-into {
		outline: 1px solid var(--accent);
		outline-offset: -1px;
		background: var(--selection);
	}

	.root-drop {
		min-height: 16px;
		flex: 1;
	}

	.root-drop.active {
		border-top: 2px solid var(--accent);
	}
</style>
