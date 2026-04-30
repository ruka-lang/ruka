<script lang="ts">
	import type { ProjectFile } from "$lib/playground/project";

	type Props = {
		files: ProjectFile[];
		selected: string;
		entry: string;
		onSelect: (path: string) => void;
	};

	let { files, selected, entry, onSelect }: Props = $props();
</script>

<div class="tabs" role="tablist" aria-label="Project files">
	{#each files as file (file.path)}
		<button
			class="tab"
			role="tab"
			type="button"
			data-active={file.path === selected}
			data-entry={file.path === entry}
			aria-selected={file.path === selected}
			onclick={() => onSelect(file.path)}
		>
			{file.path}
			{#if file.path === entry}<span class="badge" aria-label="Entry file">·</span>{/if}
		</button>
	{/each}
</div>

<style>
	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.tab {
		font: inherit;
		font-size: 12px;
		padding: 4px 10px;
		border: 1px solid var(--ui-border);
		background: transparent;
		color: inherit;
		border-radius: 4px 4px 0 0;
		cursor: pointer;
		opacity: 0.7;
	}

	.tab[data-active="true"] {
		opacity: 1;
		border-bottom-color: transparent;
	}

	.tab .badge {
		margin-left: 4px;
		opacity: 0.7;
	}
</style>
