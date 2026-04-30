<script lang="ts">
	import type { Snippet } from "svelte";

	type Props = {
		children: Snippet;
		variant?: "primary" | "ghost";
		type?: "button" | "submit" | "reset";
		disabled?: boolean;
		ariaLabel?: string;
		onclick?: (event: MouseEvent) => void;
	};

	let {
		children,
		variant = "ghost",
		type = "button",
		disabled = false,
		ariaLabel,
		onclick
	}: Props = $props();
</script>

<button class="btn" data-variant={variant} {type} {disabled} aria-label={ariaLabel} {onclick}>
	{@render children()}
</button>

<style>
	.btn {
		font: inherit;
		font-size: 12px;
		letter-spacing: 0.04em;
		padding: 4px 10px;
		border: 1px solid var(--ui-border, currentColor);
		background: var(--ui-button-bg, transparent);
		color: var(--ui-button-fg, inherit);
		border-radius: 4px;
		cursor: pointer;
	}

	.btn[data-variant="primary"] {
		background: var(--ui-button-primary-bg, currentColor);
		color: var(--ui-button-primary-fg, #1a1a1a);
		border-color: transparent;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
