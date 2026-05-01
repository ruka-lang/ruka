<script lang="ts">
	import "./layout.css";
	import favicon from "$lib/assets/ruka-berry.ico";
	import SiteHeader from "$lib/components/site-header/index.svelte";

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<SiteHeader />

{@render children()}
