<script lang="ts" module>
	export type TocSection = {
		id: string;
		title: string;
		children?: TocSection[];
	};
</script>

<script lang="ts">
	import type { Snippet } from "svelte";

	type Props = {
		title: string;
		sections: TocSection[];
		children: Snippet;
	};

	let { title, sections, children }: Props = $props();

	// Active-section highlight in the sidebar. We watch all section anchors
	// with IntersectionObserver and mark whichever one's heading is closest to
	// the top of the viewport. Pure progressive enhancement — without JS the
	// TOC is still a working list of jump links.
	let activeId = $state<string | null>(null);

	$effect(() => {
		if (typeof IntersectionObserver === "undefined") return;

		const ids = collectIds(sections);
		const targets = ids
			.map((id) => document.getElementById(id))
			.filter((el): el is HTMLElement => el !== null);

		if (targets.length === 0) return;

		// rootMargin biases the "active" zone toward the top third of the
		// viewport so a heading is highlighted just before it scrolls past
		// the header, not after.
		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

				if (visible.length > 0) {
					activeId = visible[0].target.id;
				}
			},
			{
				rootMargin: "-80px 0px -66% 0px",
				threshold: 0
			}
		);

		for (const el of targets) observer.observe(el);
		return () => observer.disconnect();
	});

	function collectIds(items: TocSection[]): string[] {
		const out: string[] = [];
		for (const item of items) {
			out.push(item.id);
			if (item.children) out.push(...collectIds(item.children));
		}
		return out;
	}
</script>

<div class="docs">
	<aside class="sidebar" aria-label="On this page">
		<p class="sidebar-title">{title}</p>
		<nav>
			<ul class="toc">
				{#each sections as section (section.id)}
					<li>
						<a href="#{section.id}" data-active={activeId === section.id}>
							{section.title}
						</a>
						{#if section.children && section.children.length > 0}
							<ul class="toc-sub">
								{#each section.children as child (child.id)}
									<li>
										<a href="#{child.id}" data-active={activeId === child.id}>
											{child.title}
										</a>
									</li>
								{/each}
							</ul>
						{/if}
					</li>
				{/each}
			</ul>
		</nav>
	</aside>

	<article class="content">
		{@render children()}
	</article>
</div>

<style>
	.docs {
		display: grid;
		grid-template-columns: 240px minmax(0, 1fr);
		gap: 48px;
		max-width: 1280px;
		margin: 0 auto;
		padding: 48px 32px 96px;
		align-items: start;
	}

	.sidebar {
		position: sticky;
		/* Site header is sticky at top:0 (~57px tall); offset to clear it. */
		top: 80px;
		font-size: var(--fs-sm);
	}

	.sidebar-title {
		font-family: var(--font-sans);
		font-size: var(--fs-xs);
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-muted);
		margin-bottom: 12px;
	}

	.toc,
	.toc-sub {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.toc > li + li {
		margin-top: 4px;
	}

	.toc-sub {
		margin: 4px 0 8px 12px;
		border-left: 1px solid var(--border);
	}

	.toc-sub li + li {
		margin-top: 2px;
	}

	.toc a {
		display: block;
		padding: 4px 8px;
		color: var(--fg-muted);
		text-decoration: none;
		border-radius: 4px;
		border-left: 2px solid transparent;
		transition: color 120ms ease, border-color 120ms ease;
	}

	.toc-sub a {
		padding-left: 12px;
		font-size: var(--fs-xs);
	}

	.toc a:hover {
		color: var(--fg);
	}

	.toc a[data-active="true"] {
		color: var(--accent);
		border-left-color: var(--accent);
	}

	.content {
		max-width: 960px;
		min-width: 0;
		justify-self: center;
		width: 100%;
	}

	.content :global(h2) {
		font-family: var(--font-display);
		font-size: var(--fs-xl);
		margin-top: 48px;
		margin-bottom: 16px;
		scroll-margin-top: 80px;
	}

	.content :global(h2:first-child) {
		margin-top: 0;
	}

	.content :global(h3) {
		font-size: var(--fs-md);
		font-weight: 600;
		margin-top: 32px;
		margin-bottom: 12px;
		scroll-margin-top: 80px;
	}

	.content :global(p) {
		margin-bottom: 16px;
		color: var(--fg);
		max-width: 70ch;
	}

	.content :global(p + p) {
		margin-top: 0;
	}

	.content :global(a) {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 2px;
		text-decoration-thickness: 1px;
	}

	.content :global(code) {
		font-family: var(--font-mono);
		font-size: 0.9em;
		padding: 1px 5px;
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		border-radius: 4px;
	}

	.content :global(pre) {
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 16px;
		overflow: auto;
		margin: 16px 0;
	}

	.content :global(pre code) {
		background: transparent;
		border: 0;
		padding: 0;
		font-size: var(--fs-sm);
	}

	@media (max-width: 880px) {
		.docs {
			grid-template-columns: 1fr;
			padding: 32px 16px 64px;
			gap: 24px;
		}

		.sidebar {
			position: static;
		}
	}
</style>
