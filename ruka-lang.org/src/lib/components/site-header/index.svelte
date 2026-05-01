<script lang="ts">
	import { page } from "$app/state";
	import logo from "$lib/assets/ruka-berry.svg";
	import ThemeToggle from "$lib/components/theme-toggle/index.svelte";

	type NavLink = { href: string; label: string };

	const links: NavLink[] = [
		{ href: "/playground", label: "Playground" },
		{ href: "/reference", label: "Reference" },
		{ href: "/grammar", label: "Grammar" }
	];

	function isActive(href: string): boolean {
		// `/` is exact-match only — every page would otherwise match it as a
		// prefix. The doc routes get prefix matching so nested children (when
		// they exist) keep their nav highlight.
		const path = page.url.pathname;
		return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
	}
</script>

<header class="site-header">
	<a class="brand" href="/" aria-label="Ruka home">
		<img src={logo} alt="" width="24" height="24" />
		<span class="brand-name">Ruka</span>
	</a>

	<nav aria-label="Primary">
		{#each links as link (link.href)}
			<a class="nav-link" href={link.href} data-active={isActive(link.href)}>
				{link.label}
			</a>
		{/each}
	</nav>

	<div class="actions">
		<ThemeToggle />
	</div>
</header>

<style>
	.site-header {
		display: flex;
		align-items: center;
		gap: 24px;
		padding: 14px 24px;
		border-bottom: 1px solid var(--border);
		background: var(--bg);
		/* Sticky so the toggle and nav stay reachable while scrolling docs. */
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: var(--fg);
		text-decoration: none;
	}

	.brand-name {
		font-family: var(--font-display);
		font-size: var(--fs-lg);
		line-height: 1;
		letter-spacing: -0.01em;
	}

	nav {
		display: flex;
		gap: 4px;
		flex: 1;
	}

	.nav-link {
		padding: 6px 10px;
		font-size: var(--fs-sm);
		color: var(--fg-muted);
		text-decoration: none;
		border-radius: 6px;
		transition: color 120ms ease, background 120ms ease;
	}

	.nav-link:hover {
		color: var(--fg);
	}

	.nav-link[data-active="true"] {
		color: var(--accent);
	}

	.actions {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
</style>
