<script lang="ts">
	import { highlight as defaultHighlight } from "./highlighter";
	import { rosePineMoon, rosePineDawn, themeToCssVars, type Theme } from "./themes";

	type Props = {
		value: string;
		highlight?: (source: string) => string;
		// When omitted, the editor follows the site theme: moon for dark,
		// dawn for light. Pass a Theme to pin a specific palette.
		theme?: Theme;
		// Fixed height for the editor box. Content beyond this scrolls inside
		// the container — the underlying <pre> and <textarea> share the same
		// scroll position because they sit in a single grid cell.
		height?: string;
		errorLine?: number | null;
		errorColumn?: number | null;
		errorMessage?: string | null;
		readonly?: boolean;
		ariaLabel?: string;
		onChange?: (value: string) => void;
	};

	let {
		value = $bindable(""),
		highlight = defaultHighlight,
		theme,
		height = "24rem",
		errorLine = null,
		errorColumn = null,
		errorMessage = null,
		readonly = false,
		ariaLabel = "Code editor",
		onChange
	}: Props = $props();

	// Track the site theme so the editor follows light/dark when no explicit
	// theme prop is passed. Initial value comes from the html attribute (set
	// before paint by the inline script in app.html); a MutationObserver
	// keeps it in sync when the user toggles.
	let siteTheme = $state<"light" | "dark">("dark");

	$effect(() => {
		const html = document.documentElement;
		const read = () => {
			siteTheme = html.getAttribute("data-theme") === "light" ? "light" : "dark";
		};
		read();

		const observer = new MutationObserver(read);
		observer.observe(html, { attributes: true, attributeFilter: ["data-theme"] });
		return () => observer.disconnect();
	});

	const activeTheme = $derived(theme ?? (siteTheme === "light" ? rosePineDawn : rosePineMoon));
	const rootStyle = $derived(`${themeToCssVars(activeTheme)}; height: ${height}`);

	let textarea: HTMLTextAreaElement | undefined = $state();

	const showDiagnostic = $derived(errorLine != null && !!errorMessage);

	// When a diagnostic is shown we splice a blank phantom line into the
	// editor's display *just below* the offending source line. The phantom
	// is what the textarea and pre both render — the line-for-line alignment
	// the caret depends on stays intact because both layers see the same
	// augmented string. The parent only ever sees the real value via
	// onChange; the phantom is stripped on every input.
	const displayValue = $derived.by(() => {
		if (!showDiagnostic || !errorLine) return value;
		const lines = value.split("\n");
		if (errorLine < 1 || errorLine > lines.length) return value;
		return [...lines.slice(0, errorLine), "", ...lines.slice(errorLine)].join("\n");
	});

	const highlighted = $derived.by(() => {
		const html = highlight(displayValue);
		if (!showDiagnostic || !errorLine) return html;
		const lines = html.split("\n");
		const idx = errorLine - 1;
		if (idx < 0 || idx >= lines.length) return html;
		lines[idx] = `<span class="err-line">${lines[idx]}</span>`;
		return lines.join("\n");
	});

	// Indent prefix for the └─ connector. Without column info, we mirror the
	// offending line's leading whitespace; with column info, we pad to the
	// column-1 character offset on that line. The overlay uses the same
	// monospace + tab-size as the editor, so widths match exactly.
	const errorIndent = $derived.by(() => {
		if (!errorLine) return "";
		const lines = value.split("\n");
		const line = lines[errorLine - 1];
		if (!line) return "";
		if (errorColumn != null && errorColumn > 1) {
			return line.slice(0, Math.min(errorColumn - 1, line.length));
		}
		const match = line.match(/^[\t ]*/);
		return match ? match[0] : "";
	});

	function displayToTrue(display: string): string {
		// Inverse of displayValue: drop the phantom line at index errorLine
		// (0-based), merging anything the user typed onto it into the next
		// line. With no diagnostic shown, display === value, so passthrough.
		if (!showDiagnostic || !errorLine) return display;
		const lines = display.split("\n");
		const idx = errorLine;
		if (idx < 0 || idx >= lines.length) return display;
		const phantomContent = lines[idx];
		if (idx + 1 < lines.length) {
			return [
				...lines.slice(0, idx),
				phantomContent + lines[idx + 1],
				...lines.slice(idx + 2)
			].join("\n");
		}
		return [...lines.slice(0, idx), phantomContent].join("\n");
	}

	function onInput(event: Event) {
		const ta = event.target as HTMLTextAreaElement;
		const next = displayToTrue(ta.value);
		value = next;
		onChange?.(next);
	}

	// Sync the textarea's value to displayValue, but only when they actually
	// differ. Setting textarea.value unconditionally on every render moves
	// the caret to the end of the field — fine on first mount, disastrous
	// while the user is typing. The diff check makes the common path (user
	// typed → displayValue rederived to match → no DOM write) a no-op, so
	// the caret stays put.
	$effect(() => {
		if (!textarea) return;
		if (textarea.value === displayValue) return;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		textarea.value = displayValue;
		textarea.selectionStart = start;
		textarea.selectionEnd = end;
	});

	function onKeyDown(event: KeyboardEvent) {
		if (event.key !== "Tab" || !textarea) return;
		event.preventDefault();
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const display = displayValue;
		const nextDisplay = display.slice(0, start) + "\t" + display.slice(end);
		const next = displayToTrue(nextDisplay);
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
		oninput={onInput}
		onkeydown={onKeyDown}
	></textarea>
	{#if showDiagnostic && errorLine}
		<!--
			Absolutely positioned in the editor's scroll container so the
			diagnostic scrolls with the source. `top` lands the overlay one
			line below the error: padding (12px) + errorLine * 21px (line
			height = font-size 14 × line-height 1.5).
		-->
		<div
			class="err-overlay"
			style="top: calc(12px + {errorLine} * 21px)"
			aria-hidden="true"
		>
			<span class="err-overlay-indent">{errorIndent}</span>
			<span class="err-overlay-msg">└─ {errorMessage}</span>
		</div>
	{/if}
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
		position: relative;
		font-family: "Intel One Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	}
	.editor > pre,
	.editor > textarea {
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
		box-shadow: none;
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
	/* @tailwindcss/forms applies a focus ring (box-shadow + border-color) to
	 * all textareas; null it out so the editor stays chromeless on focus. */
	.editor textarea:focus {
		outline: none;
		box-shadow: none;
		border-color: transparent;
	}
	.editor textarea::selection {
		background: var(--selection, rgba(127, 127, 127, 0.35));
	}
	.editor :global(.err-line) {
		background: color-mix(in srgb, var(--danger) 18%, transparent);
		display: inline-block;
		width: 100%;
	}

	/* Virtual-text diagnostic line, rendered as an absolute overlay so the
	 * underlying pre/textarea stay aligned line-for-line. The hidden indent
	 * span pushes the └─ connector to match the offending line's indentation. */
	.editor .err-overlay {
		position: absolute;
		left: 12px;
		font-family: inherit;
		font-size: 14px;
		line-height: 1.5;
		font-weight: 550;
		font-style: italic;
		color: var(--danger);
		white-space: pre;
		tab-size: 4;
		-moz-tab-size: 4;
		pointer-events: none;
		user-select: none;
	}
	.editor .err-overlay-indent {
		visibility: hidden;
	}
</style>
