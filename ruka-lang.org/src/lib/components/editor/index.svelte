<script lang="ts">
	import { highlight as defaultHighlight } from "./highlighter";
	import { rosePineMoon, themeToCssVars, type Theme } from "./themes";

	type Props = {
		value: string;
		highlight?: (source: string) => string;
		theme?: Theme;
		// Fixed height for the editor box. Content beyond this scrolls inside
		// the container — the underlying <pre> and <textarea> share the same
		// scroll position because they sit in a single grid cell.
		height?: string;
		errorLine?: number | null;
		errorMessage?: string | null;
		readonly?: boolean;
		ariaLabel?: string;
		onChange?: (value: string) => void;
	};

	let {
		value = $bindable(""),
		highlight = defaultHighlight,
		theme = rosePineMoon,
		height = "24rem",
		errorLine = null,
		errorMessage = null,
		readonly = false,
		ariaLabel = "Code editor",
		onChange
	}: Props = $props();

	const rootStyle = $derived(`${themeToCssVars(theme)}; height: ${height}`);

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
		const next = value.slice(0, start) + "\t" + value.slice(end);
		value = next;
		onChange?.(next);
		queueMicrotask(() => {
			if (!textarea) return;
			textarea.selectionStart = textarea.selectionEnd = start + 1;
		});
	}

	export function focus() {
		textarea?.focus();
	}
</script>

<div class="editor" style={rootStyle}>
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
	/* Stack the highlight layer (pre > code) and the input layer (textarea)
	 * in a single CSS grid cell. Grid sizes both children identically, which
	 * is what keeps the caret aligned line-for-line — absolute positioning
	 * lets the textarea round its line-box height differently from the pre,
	 * and the error compounds as the cursor moves down the document. */
	.editor {
		display: grid;
		grid-template-rows: max-content;
		overflow: auto;
		font-family: "Intel One Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	}
	.editor > * {
		grid-area: 1 / 1;
	}
	.editor pre {
		margin: 0;
		border: 0;
		background: transparent;
		pointer-events: none;
		user-select: none;
		overflow: visible;
		min-width: 0;
	}
	.editor pre code {
		display: block;
		margin: 0;
		padding: 12px;
		font-family: "Intel One Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 14px;
		line-height: 1.5;
		font-weight: 550;
		white-space: pre;
		tab-size: 4;
		-moz-tab-size: 4;
		color: var(--ruka-hl-text, inherit);
	}
	.editor :global(.ruka-hl-kw) {
		color: var(--ruka-hl-kw);
	}
	.editor :global(.ruka-hl-str) {
		color: var(--ruka-hl-str);
	}
	.editor :global(.ruka-hl-num) {
		color: var(--ruka-hl-num);
	}
	.editor :global(.ruka-hl-lbl) {
		color: var(--ruka-hl-lbl);
	}
	.editor :global(.ruka-hl-op) {
		color: var(--ruka-hl-op);
	}
	.editor :global(.ruka-hl-surr) {
		color: var(--ruka-hl-surr);
	}
	.editor :global(.ruka-hl-strc) {
		color: var(--ruka-hl-strc);
	}
	.editor :global(.ruka-hl-cmt) {
		color: var(--ruka-hl-cmt);
	}
	.editor :global(.ruka-hl-tp) {
		color: var(--ruka-hl-tp);
	}
	.editor textarea {
		margin: 0;
		padding: 12px;
		border: 0;
		box-sizing: border-box;
		font-family: "Intel One Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 14px;
		line-height: 1.5;
		font-weight: 550;
		white-space: pre;
		tab-size: 4;
		-moz-tab-size: 4;
		color: transparent;
		caret-color: var(--ruka-hl-text, currentColor);
		background: transparent;
		resize: none;
		outline: none;
		overflow: hidden;
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
