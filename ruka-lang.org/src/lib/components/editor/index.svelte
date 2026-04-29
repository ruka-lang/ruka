<script lang="ts">
	import { highlight as defaultHighlight } from "./highlighter";

	type Props = {
		value: string;
		highlight?: (source: string) => string;
		errorLine?: number | null;
		errorMessage?: string | null;
		readonly?: boolean;
		ariaLabel?: string;
		onChange?: (value: string) => void;
	};

	let {
		value = $bindable(""),
		highlight = defaultHighlight,
		errorLine = null,
		errorMessage = null,
		readonly = false,
		ariaLabel = "Code editor",
		onChange
	}: Props = $props();

	let textarea: HTMLTextAreaElement | undefined = $state();

	const highlighted = $derived.by(() => {
		const html = highlight(value);
		if (!errorLine) return html;
		const lines = html.split("\n");
		const idx = errorLine - 1;
		if (idx < 0 || idx >= lines.length) return html;
		const msg = errorMessage
			? ` <span class="err-msg">← ${escapeText(errorMessage)}</span>`
			: "";
		lines[idx] = `<span class="err-line">${lines[idx]}</span>${msg}`;
		return lines.join("\n");
	});

	function escapeText(s: string): string {
		return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}

	function onInput(event: Event) {
		const next = (event.target as HTMLTextAreaElement).value;
		value = next;
		onChange?.(next);
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key !== "Tab" || !textarea) return;
		event.preventDefault();
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const next = value.slice(0, start) + "  " + value.slice(end);
		value = next;
		onChange?.(next);
		queueMicrotask(() => {
			if (!textarea) return;
			textarea.selectionStart = textarea.selectionEnd = start + 2;
		});
	}

	export function focus() {
		textarea?.focus();
	}
</script>

<div class="editor">
	<pre aria-hidden="true"><code>{@html highlighted}</code></pre>
	<textarea
		bind:this={textarea}
		spellcheck="false"
		autocomplete="off"
		autocapitalize="off"
		aria-label={ariaLabel}
		{readonly}
		{value}
		oninput={onInput}
		onkeydown={onKeyDown}
	></textarea>
</div>

<style>
	.editor {
		position: relative;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 14px;
		line-height: 1.5;
	}
	.editor pre,
	.editor textarea {
		margin: 0;
		padding: 12px;
		border: 0;
		font: inherit;
		line-height: inherit;
		white-space: pre;
		tab-size: 2;
		overflow: auto;
	}
	.editor pre {
		min-height: 12rem;
		color: inherit;
		background: transparent;
		pointer-events: none;
	}
	.editor textarea {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		color: transparent;
		caret-color: currentColor;
		background: transparent;
		resize: none;
		outline: none;
	}
	.editor textarea::selection {
		background: rgba(127, 127, 127, 0.35);
	}
	.editor :global(.err-line) {
		background: rgba(235, 111, 146, 0.18);
		display: inline-block;
		width: 100%;
	}
	.editor :global(.err-msg) {
		color: #eb6f92;
		font-style: italic;
	}
</style>
