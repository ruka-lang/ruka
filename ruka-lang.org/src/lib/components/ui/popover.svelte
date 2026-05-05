<script lang="ts" module>
	export type Placement = "top" | "bottom" | "left" | "right";
</script>

<script lang="ts">
	import type { Snippet } from "svelte";

	type Props = {
		// Element the bubble points at. Position is recomputed whenever this
		// or `open` changes — pass the same node you want the arrow aimed at.
		anchor: HTMLElement | null;
		open: boolean;
		placement?: Placement;
		// Soft role hint. "hint" disables pointer events and the close button
		// so the bubble behaves like a tooltip; "dialog" gives it focus + a
		// backdrop click-to-dismiss.
		role?: "hint" | "dialog";
		ariaLabel?: string;
		onClose?: () => void;
		children: Snippet;
	};

	let {
		anchor,
		open,
		placement = "bottom",
		role = "dialog",
		ariaLabel,
		onClose,
		children
	}: Props = $props();

	let bubble: HTMLDivElement | null = $state(null);
	// `top`/`left` apply to the bubble; arrow{Top,Left} are the offset of the
	// arrow tip *within* the bubble so it lines up with the anchor's center.
	let top = $state(0);
	let left = $state(0);
	let arrowTop = $state(0);
	let arrowLeft = $state(0);

	const GAP = 10; // distance from anchor to bubble (leaves room for the arrow)
	const EDGE = 8; // viewport edge padding before clamping

	function reposition() {
		if (!open || !anchor || !bubble) return;

		const anchorRect = anchor.getBoundingClientRect();
		const bubbleRect = bubble.getBoundingClientRect();
		const viewportW = window.innerWidth;
		const viewportH = window.innerHeight;

		let nextTop = 0;
		let nextLeft = 0;

		if (placement === "bottom") {
			nextTop = anchorRect.bottom + GAP;
			nextLeft = anchorRect.left + anchorRect.width / 2 - bubbleRect.width / 2;
		} else if (placement === "top") {
			nextTop = anchorRect.top - bubbleRect.height - GAP;
			nextLeft = anchorRect.left + anchorRect.width / 2 - bubbleRect.width / 2;
		} else if (placement === "right") {
			nextTop = anchorRect.top + anchorRect.height / 2 - bubbleRect.height / 2;
			nextLeft = anchorRect.right + GAP;
		} else {
			nextTop = anchorRect.top + anchorRect.height / 2 - bubbleRect.height / 2;
			nextLeft = anchorRect.left - bubbleRect.width - GAP;
		}

		// Clamp inside the viewport but remember where the anchor's center
		// actually is — that's where the arrow needs to point even when the
		// bubble itself shifts to stay on screen.
		const clampedLeft = Math.max(
			EDGE,
			Math.min(nextLeft, viewportW - bubbleRect.width - EDGE)
		);
		const clampedTop = Math.max(
			EDGE,
			Math.min(nextTop, viewportH - bubbleRect.height - EDGE)
		);

		top = clampedTop;
		left = clampedLeft;

		if (placement === "top" || placement === "bottom") {
			arrowLeft = anchorRect.left + anchorRect.width / 2 - clampedLeft;
			arrowTop = placement === "top" ? bubbleRect.height : 0;
		} else {
			arrowTop = anchorRect.top + anchorRect.height / 2 - clampedTop;
			arrowLeft = placement === "left" ? bubbleRect.width : 0;
		}
	}

	$effect(() => {
		// Re-run whenever any of these change. The bubble's own size depends
		// on its content, so we measure after it mounts.
		void open;
		void anchor;
		void placement;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		bubble;
		queueMicrotask(reposition);
	});

	$effect(() => {
		if (!open) return;

		function onResize() {
			reposition();
		}
		function onScroll() {
			reposition();
		}
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape" && role === "dialog") {
				onClose?.();
			}
		}

		window.addEventListener("resize", onResize);
		window.addEventListener("scroll", onScroll, true);
		window.addEventListener("keydown", onKey);

		return () => {
			window.removeEventListener("resize", onResize);
			window.removeEventListener("scroll", onScroll, true);
			window.removeEventListener("keydown", onKey);
		};
	});

	function onBackdropClick() {
		if (role === "dialog") onClose?.();
	}
</script>

{#if open}
	{#if role === "dialog"}
		<!-- A transparent backdrop catches outside clicks; pointer-events
		     stay enabled only for it, not the bubble's surroundings. -->
		<div class="popover-backdrop" role="presentation" onmousedown={onBackdropClick}></div>
	{/if}
	<div
		bind:this={bubble}
		class="popover"
		data-placement={placement}
		data-role={role}
		role={role === "dialog" ? "dialog" : "tooltip"}
		aria-label={ariaLabel}
		style="top: {top}px; left: {left}px"
	>
		<span
			class="popover-arrow"
			style="top: {arrowTop}px; left: {arrowLeft}px"
			aria-hidden="true"
		></span>
		<div class="popover-body">
			{@render children()}
		</div>
	</div>
{/if}

<style>
	.popover-backdrop {
		position: fixed;
		inset: 0;
		z-index: 49;
		background: transparent;
	}

	.popover {
		position: fixed;
		z-index: 50;
		min-width: 200px;
		max-width: min(360px, calc(100vw - 24px));
		padding: 12px 14px;
		background: var(--bg-elevated);
		color: var(--fg);
		border: 1px solid var(--border);
		border-radius: 3px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		line-height: 1.45;
	}

	.popover[data-role="hint"] {
		pointer-events: none;
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		padding: 8px 10px;
	}

	.popover-body {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	/* The arrow is a 10px square rotated 45° and clipped behind the bubble.
	 * Two stacked elements would let us paint a clean border edge, but a
	 * single rotated square reads correctly against the elevated bg and
	 * keeps the markup tiny. */
	.popover-arrow {
		position: absolute;
		width: 10px;
		height: 10px;
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		transform: rotate(45deg);
	}

	.popover[data-placement="bottom"] .popover-arrow {
		transform: translate(-50%, -50%) rotate(45deg);
		border-right: none;
		border-bottom: none;
	}
	.popover[data-placement="top"] .popover-arrow {
		transform: translate(-50%, -50%) rotate(45deg);
		border-left: none;
		border-top: none;
	}
	.popover[data-placement="right"] .popover-arrow {
		transform: translate(-50%, -50%) rotate(45deg);
		border-top: none;
		border-right: none;
	}
	.popover[data-placement="left"] .popover-arrow {
		transform: translate(-50%, -50%) rotate(45deg);
		border-bottom: none;
		border-left: none;
	}
</style>
