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
		| { kind: "set-entry"; path: string };

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

	// Build a hierarchical tree from the flat (files, folders) lists.
	// Files are grouped by their immediate parent folder; explicit folder
	// entries become folder nodes even when empty so newly-created
	// directories don't disappear until the user puts a file in them.
	export function buildTree(files: ProjectFile[], folders: ProjectFolder[]): TreeNode[] {
		// Map of folder-path → FolderNode. The empty-string key is the
		// virtual root; every node ends up referenced from there.
		const folderNodes = new Map<string, FolderNode>();
		folderNodes.set("", { kind: "folder", path: "", name: "", children: [] });

		function ensureFolder(path: string): FolderNode {
			const existing = folderNodes.get(path);
			if (existing) return existing;

			const slash = path.lastIndexOf("/");
			const name = slash === -1 ? path : path.slice(slash + 1);
			const node: FolderNode = { kind: "folder", path, name, children: [] };
			folderNodes.set(path, node);

			const parent = slash === -1 ? "" : path.slice(0, slash);
			ensureFolder(parent).children.push(node);

			return node;
		}

		for (const folder of folders) ensureFolder(folder.path);

		for (const file of files) {
			const slash = file.path.lastIndexOf("/");
			const parentPath = slash === -1 ? "" : file.path.slice(0, slash);
			const name = slash === -1 ? file.path : file.path.slice(slash + 1);

			ensureFolder(parentPath).children.push({
				kind: "file",
				path: file.path,
				name,
				fileKind: file.kind
			});
		}

		// Folders first, then files — both alphabetical within their group.
		// Stable ordering keeps the tree readable as files are added.
		function sort(node: FolderNode) {
			node.children.sort((a, b) => {
				if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
				return a.name.localeCompare(b.name);
			});
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
	type Props = {
		files: ProjectFile[];
		folders: ProjectFolder[];
		selected: string;
		entry: string;
		onAction: (action: TreeAction) => void;
	};

	let { files, folders, selected, entry, onAction }: Props = $props();

	const tree = $derived(buildTree(files, folders));

	// Folders default to open. Closed paths are tracked explicitly so the
	// tree's visual state is preserved across re-renders even though the
	// nodes themselves are rebuilt each time.
	let collapsed: Set<string> = $state(new Set());

	function toggleFolder(path: string) {
		const next = new Set(collapsed);
		if (next.has(path)) next.delete(path);
		else next.add(path);
		collapsed = next;
	}

	function fire(action: TreeAction) {
		onAction(action);
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
				>＋ƒ</button
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
					})}>＋▸</button
			>
		</div>
	</div>

	<ul class="tree" role="tree">
		{#each tree as node (node.path)}
			{@render renderNode(node, 0)}
		{/each}
	</ul>
</aside>

{#snippet renderNode(node: TreeNode, depth: number)}
	{#if node.kind === "folder"}
		{@const isCollapsed = collapsed.has(node.path)}
		<li role="treeitem" aria-expanded={!isCollapsed} aria-selected="false">
			<div class="row folder-row" style="padding-left: {depth * 12 + 8}px">
				<button
					class="row-main"
					type="button"
					onclick={() => toggleFolder(node.path)}
					aria-label={isCollapsed ? `Expand ${node.path}` : `Collapse ${node.path}`}
				>
					<span class="caret" data-collapsed={isCollapsed}>▸</span>
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
							})}>＋ƒ</button
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
							})}>＋▸</button
					>
					<button
						class="icon-btn"
						type="button"
						aria-label="Rename {node.path}"
						title="Rename"
						onclick={(e) =>
							fire({
								kind: "rename-folder",
								path: node.path,
								anchor: e.currentTarget as HTMLElement
							})}>✎</button
					>
					<button
						class="icon-btn danger"
						type="button"
						aria-label="Delete {node.path}"
						title="Delete folder"
						onclick={(e) =>
							fire({
								kind: "delete-folder",
								path: node.path,
								anchor: e.currentTarget as HTMLElement
							})}>×</button
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
		{@const isEntry = node.path === entry}
		{@const isSelected = node.path === selected}
		{@const canSetEntry = !isEntry && node.fileKind === "ruka"}
		<li role="treeitem" aria-selected={isSelected}>
			<div
				class="row file-row"
				data-active={isSelected}
				data-entry={isEntry}
				style="padding-left: {depth * 12 + 8}px"
			>
				<button
					class="row-main"
					type="button"
					onclick={() => fire({ kind: "open", path: node.path })}
				>
					<span class="kind-tag" data-kind={node.fileKind}>{node.fileKind}</span>
					<span class="name">{node.name}</span>
					{#if isEntry}
						<span class="entry-badge" title="Entry file">entry</span>
					{/if}
				</button>
				<div class="row-actions">
					{#if canSetEntry}
						<button
							class="icon-btn"
							type="button"
							aria-label="Set {node.path} as entry"
							title="Set as entry"
							onclick={() => fire({ kind: "set-entry", path: node.path })}>★</button
						>
					{/if}
					<button
						class="icon-btn"
						type="button"
						aria-label="Rename {node.path}"
						title="Rename"
						onclick={(e) =>
							fire({
								kind: "rename-file",
								path: node.path,
								anchor: e.currentTarget as HTMLElement
							})}>✎</button
					>
					<button
						class="icon-btn danger"
						type="button"
						disabled={isEntry}
						aria-label="Delete {node.path}"
						title={isEntry ? "Cannot delete the entry file" : "Delete file"}
						onclick={() => fire({ kind: "delete-file", path: node.path })}>×</button
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
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 6px;
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
		letter-spacing: 0.08em;
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
		display: inline-block;
		width: 12px;
		font-size: 10px;
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
		letter-spacing: 0.04em;
		color: var(--fg-muted);
		border: 1px solid var(--border);
		border-radius: 3px;
	}

	.kind-tag[data-kind="ruka"] {
		color: var(--accent);
		border-color: var(--accent);
	}

	.entry-badge {
		font-size: 9px;
		padding: 1px 5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--bg);
		background: var(--accent);
		border-radius: 3px;
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
		border-radius: 4px;
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
</style>
