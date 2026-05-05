<script lang="ts">
	import type { Snippet } from "svelte";

	type Props = {
		children: Snippet;
		// Disable the inner padding when the card holds an element that owns its
		// own padding (e.g. the editor or terminal panes on /playground).
		padded?: boolean;
	};

	let { children, padded = true }: Props = $props();
</script>

<div class="card" data-padded={padded}>
	{@render children()}
</div>

<style>
	.card {
		border: 1px solid var(--ui-border);
		border-radius: 3px;
		background: var(--ui-card-bg);
		overflow: hidden;
	}

	.card[data-padded="true"] {
		padding: 12px;
	}
</style>
