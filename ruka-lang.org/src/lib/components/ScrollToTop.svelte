<script lang="ts">
	import { ChevronUp } from "lucide-svelte";

	let visible = $state(false);

	$effect(() => {
		function onScroll() {
			visible = window.scrollY > 400;
		}

		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	});

	function scrollToTop() {
		window.scrollTo({ top: 0, behavior: "smooth" });
	}
</script>

{#if visible}
	<button
		class="scroll-top"
		type="button"
		aria-label="Return to top"
		onclick={scrollToTop}
	>
		<ChevronUp size={18} strokeWidth={2} />
	</button>
{/if}

<style>
	.scroll-top {
		position: fixed;
		bottom: 24px;
		right: 24px;
		z-index: 20;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		border-radius: var(--ui-border-radius);
		color: var(--fg-muted);
		cursor: pointer;
		transition:
			color 120ms ease,
			border-color 120ms ease,
			opacity 120ms ease;
		animation: fade-in 150ms ease;
	}

	.scroll-top:hover {
		color: var(--fg);
		border-color: var(--accent);
	}

	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
