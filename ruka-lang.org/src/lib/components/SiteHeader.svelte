<script lang="ts">
	import { page } from "$app/state";
	import logoBerry from "$lib/assets/branding/svg/ruka-berry-a32c43.svg";
	import logoAmber from "$lib/assets/branding/svg/ruka-amber-e89a3c.svg";
	import logoEmerald from "$lib/assets/branding/svg/ruka-emerald-386248.svg";
	import ThemeToggle from "$lib/components/ThemeToggle.svelte";

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

	// Cycle the accent colour (and matching logo) through berry → amber → emerald
	// every 8 seconds. The data-accent attribute on <html> drives the CSS vars
	// defined in tokens.css so every site-wide use of --accent updates together.
	const accentNames = ["berry"] as const; //["berry", "amber", "emerald"] as const;
	const accentLogos = [logoBerry] as const;//[logoBerry, logoAmber, logoEmerald] as const;
	let accentIndex = $state(0);

	//$effect(() => {
	//	const timer = setInterval(() => {
	//		accentIndex = (accentIndex + 1) % accentNames.length;
	//	}, 8000);
	//	return () => clearInterval(timer);
	//});

	$effect(() => {
		document.documentElement.setAttribute("data-accent", accentNames[accentIndex]);
	});
</script>

<header class="site-header">
	<a class="brand" href="/" aria-label="Ruka home">
		<img class="brand-logo" src={accentLogos[accentIndex]} alt="" width="23" height="23" />
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
		<a
			class="icon-link"
			href="https://github.com/ruka-lang/ruka"
			target="_blank"
			rel="noopener noreferrer"
			aria-label="Ruka on GitHub"
		>
			<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
				<path
					fill="currentColor"
					d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.45 7.45 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
				/>
			</svg>
		</a>
		<ThemeToggle />
	</div>
</header>

<style>
	.site-header {
		display: flex;
		align-items: center;
		gap: 24px;
		padding: 8px 24px;
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

	.brand-logo {
		border-radius: calc(var(--ui-border-radius) / 2);
	}

	.brand-name {
		font-family: var(--font-display);
		font-size: var(--fs-xl);
		line-height: 1;
	}

	nav {
		display: flex;
		gap: 4px;
		flex: 1;
		justify-content: center;
	}

	.nav-link {
		padding: 6px 10px;
		font-size: var(--fs-sm);
		color: var(--fg-muted);
		text-decoration: none;
		border-radius: var(--ui-border-radius);
		transition:
			color 120ms ease,
			background 120ms ease;
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

	.icon-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		color: var(--fg-muted);
		border-radius: var(--ui-border-radius);
		transition:
			color 120ms ease,
			background 120ms ease;
	}

	.icon-link:hover {
		color: var(--fg);
	}
</style>
