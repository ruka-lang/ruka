<script lang="ts">
	import "./layout.css";
	import favicon from "$lib/assets/branding/favicon/ruka-berry-a32c43.ico";
	import rukaFlower from "$lib/assets/branding/svg/ruka-flower.svg";
	import SiteHeader from "$lib/components/SiteHeader.svelte";
	import ScrollToTop from "$lib/components/ScrollToTop.svelte";

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div
	class="gutter-pattern"
	aria-hidden="true"
	style="--flower-url: url({rukaFlower})"
></div>

<SiteHeader />

{@render children()}

<ScrollToTop />

<footer class="site-footer">
	<p>
		Colour palette by <a href="https://rosepinetheme.com" target="_blank" rel="noopener noreferrer">Rosé Pine</a>
		&mdash;
		<a href="https://www.github.com/ruka-lang/ruka/blob/main/copyright" target="_blank" rel="noopener noreferrer">Copyright</a>
	</p>
</footer>

<style>
	/* Fixed behind all content — z-index: -1 inside body's stacking context sits
	 * above html's solid background but below every page element. Tiles freely and
	 * is clipped naturally at the viewport edge. */
	.gutter-pattern {
		position: fixed;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		background-image: var(--flower-url), var(--flower-url);
		background-size: 160px 160px, 160px 160px;
		background-position: 0 0, 80px 80px;
		background-repeat: repeat;
		opacity: var(--flower-opacity);
		filter: var(--flower-filter);
	}

	.site-footer {
		border-top: 1px solid var(--border);
		padding: 16px 24px;
		font-size: var(--fs-xs);
		color: var(--fg-muted);
		text-align: center;
	}

	.site-footer p {
		margin: 0;
	}

	.site-footer a {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.site-footer a:hover {
		color: var(--fg);
	}
</style>
