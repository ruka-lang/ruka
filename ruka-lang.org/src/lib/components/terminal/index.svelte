<script lang="ts">
	import { PanelRightClose } from "lucide-svelte";

	type Stream = "stdout" | "stderr";
	type Segment = { stream: Stream; text: string };

	type Status = "idle" | "running" | "error" | "ok";

	type Props = {
		status?: Status;
		emptyMessage?: string;
		ariaLabel?: string;
		// Cap on the terminal's height. The body scrolls on overflow so long
		// program output doesn't push the page layout around. Pass `none` to
		// let the terminal fill its container instead.
		maxHeight?: string;
		// When set, a collapse chevron is rendered in the header — clicking
		// it calls this callback. Used by the playground to toggle the
		// output pane closed.
		onCollapse?: () => void;
	};

	let {
		status = $bindable("idle"),
		emptyMessage = "(no output)",
		ariaLabel = "Program output",
		maxHeight = "24rem",
		onCollapse
	}: Props = $props();

	let segments: Segment[] = $state([]);
	let prompting = $state(false);
	let inputValue = $state("");
	let scroller: HTMLDivElement | undefined = $state();
	let inputEl: HTMLInputElement | undefined = $state();

	let pendingResolve: ((line: string) => void) | null = null;

	function append(stream: Stream, text: string) {
		if (!text) return;
		const last = segments[segments.length - 1];
		if (last && last.stream === stream) {
			segments[segments.length - 1] = { stream, text: last.text + text };
		} else {
			segments.push({ stream, text });
		}
		queueMicrotask(scrollToBottom);
	}

	function scrollToBottom() {
		if (scroller) scroller.scrollTop = scroller.scrollHeight;
	}

	export function write(text: string) {
		append("stdout", text);
	}

	export function writeErr(text: string) {
		append("stderr", text);
	}

	export function clear() {
		segments = [];
		prompting = false;
		inputValue = "";
		pendingResolve = null;
	}

	export function requestInput(): Promise<string> {
		prompting = true;
		queueMicrotask(() => inputEl?.focus());
		return new Promise<string>((resolve) => {
			pendingResolve = resolve;
		});
	}

	export function cancelInput() {
		prompting = false;
		const resolve = pendingResolve;
		pendingResolve = null;
		if (resolve) resolve("");
	}

	function onInputKey(event: KeyboardEvent) {
		if (event.key !== "Enter") return;
		event.preventDefault();
		const line = inputValue;
		inputValue = "";
		prompting = false;
		append("stdout", line + "\n");
		const resolve = pendingResolve;
		pendingResolve = null;
		resolve?.(line);
	}

	const isEmpty = $derived(segments.length === 0 && !prompting);
</script>

<div
	class="terminal"
	data-status={status}
	style={maxHeight === "none" ? "" : `max-height: ${maxHeight}`}
>
	<div class="terminal-header">
		<span class="terminal-header-label">OUTPUT</span>
		<span class="terminal-status" data-status={status} aria-hidden="true"></span>
		{#if onCollapse}
			<button
				class="terminal-collapse"
				type="button"
				onclick={onCollapse}
				aria-label="Collapse output panel"
				title="Collapse output"
			>
				<PanelRightClose size={14} strokeWidth={1.75} />
			</button>
		{/if}
	</div>
	<div class="terminal-body" bind:this={scroller} aria-label={ariaLabel} role="log">
		{#if isEmpty}
			<span class="terminal-empty">{emptyMessage}</span>
		{:else}
			{#each segments as seg, i (i)}
				<span class="terminal-seg" data-stream={seg.stream}>{seg.text}</span>
			{/each}
		{/if}
		{#if prompting}
			<span class="terminal-prompt">
				<span class="terminal-prompt-marker">›</span>
				<input
					bind:this={inputEl}
					bind:value={inputValue}
					onkeydown={onInputKey}
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					aria-label="Program input"
				/>
			</span>
		{/if}
	</div>
</div>

<style>
	.terminal {
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 13px;
		line-height: 1.5;
		/* max-height is set inline from the prop so the body's overflow:auto
		 * has something to clip against. */
	}
	.terminal-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		font-size: 11px;
		border-bottom: 1px solid var(--border);
	}
	.terminal-header-label {
		opacity: 0.7;
	}
	.terminal-status {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: transparent;
	}
	.terminal-status[data-status="running"] {
		background: var(--accent);
		animation: terminal-pulse 1s ease-in-out infinite;
	}
	.terminal-status[data-status="ok"] {
		background: #4ade80;
	}
	.terminal-status[data-status="error"] {
		background: var(--danger);
	}
	@keyframes terminal-pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}
	.terminal-collapse {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 22px;
		padding: 0 4px;
		font: inherit;
		color: var(--fg-muted);
		background: transparent;
		border: 1px solid transparent;
		border-radius: 4px;
		cursor: pointer;
	}
	.terminal-collapse:hover {
		color: var(--fg);
		border-color: var(--border);
	}
	.terminal-body {
		flex: 1;
		padding: 10px;
		overflow: auto;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.terminal-empty {
		opacity: 0.5;
		font-style: italic;
	}
	.terminal-seg[data-stream="stderr"] {
		color: var(--danger);
	}
	.terminal[data-status="error"] .terminal-body {
		color: var(--danger);
	}
	.terminal-prompt {
		display: inline-flex;
		gap: 6px;
		align-items: center;
	}
	.terminal-prompt-marker {
		opacity: 0.6;
	}
	.terminal-prompt input {
		flex: 1;
		min-width: 8rem;
		font: inherit;
		color: inherit;
		background: transparent;
		border: 0;
		outline: none;
		padding: 0;
	}
</style>
