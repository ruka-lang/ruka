<script lang="ts">
	import { Sun, Moon } from "lucide-svelte";
	import { getTheme, toggleTheme, type Theme } from "$lib/theme";

	// Track the current theme reactively so the icon flips the moment the user
	// toggles. Initial value is read from the html attribute (set by the inline
	// script in app.html) so SSR and first client paint agree.
	let theme: Theme = $state("dark");

	$effect(() => {
		theme = getTheme();
	});

	function onClick() {
		theme = toggleTheme();
	}
</script>

<button
	class="theme-toggle"
	type="button"
	aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
	onclick={onClick}
>
	{#if theme === "dark"}
		<Sun size={16} strokeWidth={1.75} />
	{:else}
		<Moon size={16} strokeWidth={1.75} />
	{/if}
</button>

<style>
	.theme-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border: 1px solid var(--ui-border);
		background: transparent;
		color: var(--fg-muted);
		border-radius: var(--ui-border-radius);
		cursor: pointer;
		transition:
			color 120ms ease,
			border-color 120ms ease;
	}

	.theme-toggle:hover {
		color: var(--fg);
		border-color: var(--fg-muted);
	}
</style>
