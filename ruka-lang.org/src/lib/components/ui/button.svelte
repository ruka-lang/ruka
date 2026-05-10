<script lang="ts">
	import type { Snippet } from "svelte";

	type Props = {
		children: Snippet;
		variant?: "primary" | "ghost";
		// When `href` is set the button renders as an anchor — useful for nav
		// CTAs that should be middle-clickable / right-clickable like links.
		href?: string;
		type?: "button" | "submit" | "reset";
		disabled?: boolean;
		ariaLabel?: string;
		onclick?: (event: MouseEvent) => void;
	};

	let {
		children,
		variant = "ghost",
		href,
		type = "button",
		disabled = false,
		ariaLabel,
		onclick
	}: Props = $props();
</script>

{#if href}
	<a class="btn" data-variant={variant} {href} aria-label={ariaLabel} {onclick}>
		{@render children()}
	</a>
{:else}
	<button
		class="btn"
		data-variant={variant}
		{type}
		{disabled}
		aria-label={ariaLabel}
		{onclick}
	>
		{@render children()}
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font: inherit;
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		font-weight: 500;
		letter-spacing: 0.01em;
		padding: 8px 14px;
		border: 1px solid var(--ui-border);
		background: var(--ui-button-bg);
		color: var(--ui-button-fg);
		border-radius: var(--ui-border-radius);
		cursor: pointer;
		text-decoration: none;
		transition:
			background 120ms ease,
			border-color 120ms ease,
			color 120ms ease;
	}

	.btn:hover {
		border-color: var(--fg-muted);
	}

	.btn[data-variant="primary"] {
		background: var(--ui-button-primary-bg);
		color: var(--ui-button-primary-fg);
		border-color: transparent;
	}

	.btn[data-variant="primary"]:hover {
		filter: brightness(1.08);
		border-color: transparent;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
