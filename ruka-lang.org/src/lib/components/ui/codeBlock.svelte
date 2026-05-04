<script lang="ts">
	import { highlight } from "$lib/components/editor/highlighter";
	import {
		rosePineMoon,
		rosePineDawn,
		themeToCssVars,
		type Theme
	} from "$lib/components/editor/themes";

	type Props = {
		code: string;
		// Pin a specific palette; otherwise follow the site theme.
		theme?: Theme;
	};

	let { code, theme }: Props = $props();

	// Mirror the editor: follow the html[data-theme] attribute. Server render
	// uses dark; the inline script in app.html sets data-theme before paint, so
	// the first observation in $effect catches the real value.
	let siteTheme = $state<"light" | "dark">("dark");

	$effect(() => {
		const html = document.documentElement;
		const read = () => {
			siteTheme = html.getAttribute("data-theme") === "light" ? "light" : "dark";
		};
		read();

		const observer = new MutationObserver(read);
		observer.observe(html, { attributes: true, attributeFilter: ["data-theme"] });
		return () => observer.disconnect();
	});

	const activeTheme = $derived(
		theme ?? (siteTheme === "light" ? rosePineDawn : rosePineMoon)
	);
	const rootStyle = $derived(themeToCssVars(activeTheme));
</script>

<pre class="ruka-code" style={rootStyle}><code>{@html highlight(code)}</code></pre>

<style>
	.ruka-code {
		/* Match DocsShell's <pre> shell so the block sits naturally next to
		 * unhighlighted prose snippets. */
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		border-radius: 3px;
		padding: 16px;
		overflow: auto;
		margin: 16px 0;
	}
	.ruka-code code {
		display: block;
		font-family: var(--font-mono);
		font-size: var(--fs-base);
		font-weight: 550;
		line-height: 1.4;
		white-space: pre;
		tab-size: 4;
		-moz-tab-size: 4;
		color: var(--ruka-hl-text, inherit);
		background: transparent;
		border: 0;
		padding: 0;
	}
	.ruka-code :global(.ruka-hl-kw) {
		color: var(--ruka-hl-kw);
	}
	.ruka-code :global(.ruka-hl-str) {
		color: var(--ruka-hl-str);
	}
	.ruka-code :global(.ruka-hl-num) {
		color: var(--ruka-hl-num);
	}
	.ruka-code :global(.ruka-hl-lbl) {
		color: var(--ruka-hl-lbl);
	}
	.ruka-code :global(.ruka-hl-op) {
		color: var(--ruka-hl-op);
	}
	.ruka-code :global(.ruka-hl-surr) {
		color: var(--ruka-hl-surr);
	}
	.ruka-code :global(.ruka-hl-strc) {
		color: var(--ruka-hl-strc);
	}
	.ruka-code :global(.ruka-hl-cmt) {
		color: var(--ruka-hl-cmt);
	}
	.ruka-code :global(.ruka-hl-tp) {
		color: var(--ruka-hl-tp);
	}
</style>
