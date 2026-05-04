<script lang="ts">
	import "./layout.css";
	import favicon from "$lib/assets/branding/favicon/ruka-berry-a32c43.ico";
	import SiteHeader from "$lib/components/SiteHeader.svelte";

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<SiteHeader />

{@render children()}
