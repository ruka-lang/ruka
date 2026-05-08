<script lang="ts">
	import { highlight as defaultHighlight } from "./highlighter";
	import { rosePine, rosePineDawn, themeToCssVars, type Theme } from "./themes";
	import { Popover } from "$lib/components/ui";

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

	const activeTheme = $derived(
		theme ?? (siteTheme === "light" ? rosePineDawn : rosePine)
	);
	const rootStyle = $derived(`${themeToCssVars(activeTheme)}; height: ${height}`);

	let textarea: HTMLTextAreaElement | undefined = $state();
	let preEl: HTMLPreElement | undefined = $state();

	// Invisible anchor element positioned at the error line. The Popover
	// measures its screen rect to place the bubble — it needs a real DOM node
	// even though it has no visual presence of its own.
	let errAnchorEl: HTMLDivElement | null = $state(null);
	let errorHovered = $state(false);

	// Horizontal position of the err-anchor, measured from the rendered .err-line
	// span so the Popover centres on the actual text rather than the full editor width.
	let errAnchorLeft = $state("12px");
	let errAnchorWidth = $state("0px");

	$effect(() => {
		// Re-run when highlighted changes (i.e. whenever the error line updates).
		void highlighted;
		if (!preEl || !showDiagnostic) return;
		queueMicrotask(() => {
			const span = preEl?.querySelector(".err-line");
			if (!span || !preEl) return;
			const preRect = preEl.getBoundingClientRect();
			const spanRect = span.getBoundingClientRect();
			errAnchorLeft = `${spanRect.left - preRect.left}px`;
			errAnchorWidth = `${spanRect.width}px`;
		});
	});

	const showDiagnostic = $derived(errorLine != null && !!errorMessage);

	// Wrap the error line in a span so CSS can apply a wavy underline without
	// touching the layout (no phantom lines, no cursor-offset bugs).
	const highlighted = $derived.by(() => {
		const html = highlight(value);
		// Browsers don't give height to a trailing newline in a <pre> element,
		// so the caret appears between lines when the cursor is on the last empty
		// line. Appending a space forces the pre to the same height as the textarea.
		const padded = value.endsWith("\n") ? html + " " : html;
		if (!showDiagnostic || !errorLine) return padded;
		const lines = padded.split("\n");
		const idx = errorLine - 1;
		if (idx < 0 || idx >= lines.length) return padded;
		lines[idx] = `<span class="err-line">${lines[idx]}</span>`;
		return lines.join("\n");
	});

	// Sync the textarea's value to the source, but only when they actually
	// differ. Setting textarea.value unconditionally on every render moves
	// the caret to the end of the field — fine on first mount, disastrous
	// while the user is typing.
	$effect(() => {
		if (!textarea) return;
		if (textarea.value === value) return;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		textarea.value = value;
		textarea.selectionStart = start;
		textarea.selectionEnd = end;
	});

	function onInput(event: Event) {
		const ta = event.target as HTMLTextAreaElement;
		value = ta.value;
		onChange?.(ta.value);
	}

	// Hover detection: compute which line the mouse is over from offsetY.
	// The textarea has overflow:hidden so its scrollTop is always 0; offsetY
	// is relative to the textarea's own top-left and is not affected by the
	// parent .editor scroll position.
	const LINE_HEIGHT_PX = 21; // matches font-size:15px * line-height:1.4
	const PADDING_TOP_PX = 12;

	function onMouseMove(event: MouseEvent) {
		if (!showDiagnostic || !errorLine) {
			errorHovered = false;
			return;
		}
		const line = Math.floor((event.offsetY - PADDING_TOP_PX) / LINE_HEIGHT_PX) + 1;
		errorHovered = line === errorLine;
	}

	function onMouseLeave() {
		errorHovered = false;
	}

	// Pairs where typing the opener auto-inserts the closer.
	const autoClosePairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
	// Closing chars that the cursor should skip over when already present.
	const skipOverChars = new Set([")", "}", "]"]);
	// All auto-closed pairs (for Backspace deletion of both chars).
	const matchedPairs: Record<string, string> = { "(": ")", "{": "}", "[": "]", '"': '"', "'": "'" };

	function insertAround(start: number, end: number, open: string, close: string) {
		const hasSelection = start !== end;
		const selected = value.slice(start, end);
		const next = value.slice(0, start) + open + selected + close + value.slice(end);
		value = next;
		onChange?.(next);
		queueMicrotask(() => {
			if (!textarea) return;
			if (hasSelection) {
				textarea.selectionStart = start + 1;
				textarea.selectionEnd = start + 1 + selected.length;
			} else {
				textarea.selectionStart = textarea.selectionEnd = start + 1;
			}
		});
	}

	function onKeyDown(event: KeyboardEvent) {
		if (!textarea) return;

		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const hasSelection = start !== end;

		// Tab: insert literal tab at cursor / selection.
		if (event.key === "Tab") {
			event.preventDefault();
			const next = value.slice(0, start) + "\t" + value.slice(end);
			value = next;
			onChange?.(next);
			queueMicrotask(() => {
				if (!textarea) return;
				textarea.selectionStart = textarea.selectionEnd = start + 1;
			});
			return;
		}

		// Auto-close bracket pairs: ( { [
		if (event.key in autoClosePairs) {
			event.preventDefault();
			insertAround(start, end, event.key, autoClosePairs[event.key]);
			return;
		}

		// Skip over a closing bracket when it already sits at the cursor.
		if (!hasSelection && skipOverChars.has(event.key) && value[start] === event.key) {
			event.preventDefault();
			queueMicrotask(() => {
				if (!textarea) return;
				textarea.selectionStart = textarea.selectionEnd = start + 1;
			});
			return;
		}

		// Auto-close quotes " and '. Skip over if the same quote is already next;
		// otherwise insert the pair with cursor between them.
		if (event.key === '"' || event.key === "'") {
			event.preventDefault();
			if (!hasSelection && value[start] === event.key) {
				queueMicrotask(() => {
					if (!textarea) return;
					textarea.selectionStart = textarea.selectionEnd = start + 1;
				});
			} else {
				insertAround(start, end, event.key, event.key);
			}
			return;
		}

		// Backspace: delete both chars when cursor sits between a matched pair.
		if (!hasSelection && event.key === "Backspace" && start > 0) {
			const prev = value[start - 1];
			const next = value[start];
			if (prev in matchedPairs && matchedPairs[prev] === next) {
				event.preventDefault();
				const updated = value.slice(0, start - 1) + value.slice(start + 1);
				value = updated;
				onChange?.(updated);
				queueMicrotask(() => {
					if (!textarea) return;
					textarea.selectionStart = textarea.selectionEnd = start - 1;
				});
				return;
			}
		}

		// Enter: auto-indent to match the current line, and auto-close `do end`
		// blocks when the cursor is placed directly after the `do` keyword.
		if (event.key === "Enter") {
			event.preventDefault();

			const beforeCursor = value.slice(0, start);
			const lineStart = beforeCursor.lastIndexOf("\n") + 1;
			const currentLine = beforeCursor.slice(lineStart);

			const indentMatch = currentLine.match(/^[\t ]*/);
			const indent = indentMatch ? indentMatch[0] : "";

			// Auto-close: pressing Enter immediately after `do` inserts an indented
			// blank line then `end` at the same indentation level.
			const lineTrimmed = currentLine.trimEnd();
			if (/(?:^|\s)do$/.test(lineTrimmed)) {
				const innerIndent = indent + "\t";
				const insert = "\n" + innerIndent + "\n" + indent + "end";
				const next = value.slice(0, start) + insert + value.slice(end);
				value = next;
				onChange?.(next);
				const cursorPos = start + 1 + innerIndent.length;
				queueMicrotask(() => {
					if (!textarea) return;
					textarea.selectionStart = textarea.selectionEnd = cursorPos;
				});
				return;
			}

			// Expand `{\n}` into a properly indented block when Enter is pressed
			// between a `{` and its auto-closed `}`.
			if (!hasSelection && value[start - 1] === "{" && value[start] === "}") {
				const innerIndent = indent + "\t";
				const insert = "\n" + innerIndent + "\n" + indent;
				const next = value.slice(0, start) + insert + value.slice(end);
				value = next;
				onChange?.(next);
				const cursorPos = start + 1 + innerIndent.length;
				queueMicrotask(() => {
					if (!textarea) return;
					textarea.selectionStart = textarea.selectionEnd = cursorPos;
				});
				return;
			}

			// Default: replicate the current line's indentation on the new line.
			const insert = "\n" + indent;
			const next = value.slice(0, start) + insert + value.slice(end);
			value = next;
			onChange?.(next);
			queueMicrotask(() => {
				if (!textarea) return;
				textarea.selectionStart = textarea.selectionEnd = start + insert.length;
			});
			return;
		}
	}

	const lineCount = $derived(value.split("\n").length);

	export function focus() {
		textarea?.focus();
	}
</script>

<div class="editor" style={rootStyle}>
	<div class="gutter" aria-hidden="true">
		{#each { length: lineCount } as _, i}
			<div class="gutter-line">{i + 1}</div>
		{/each}
	</div>
	<div class="editor-content">
		<pre bind:this={preEl} aria-hidden="true"><code>{@html highlighted}</code></pre>
		<textarea
			bind:this={textarea}
			spellcheck="false"
			autocomplete="off"
			autocapitalize="off"
			aria-label={ariaLabel}
			{readonly}
			oninput={onInput}
			onkeydown={onKeyDown}
			onmousemove={onMouseMove}
			onmouseleave={onMouseLeave}
		></textarea>

		<!-- Invisible anchor at the error line's row. Its left/width are measured
		     from the rendered .err-line span so the Popover bubble centres on
		     the midpoint of the actual text content, not the full editor width. -->
		{#if showDiagnostic && errorLine}
			<div
				bind:this={errAnchorEl}
				class="err-anchor"
				style="top: calc(12px + {errorLine - 1} * 1.4em); left: {errAnchorLeft}; width: {errAnchorWidth}"
				aria-hidden="true"
			></div>
		{/if}
	</div>
</div>

<Popover
	anchor={errAnchorEl}
	open={showDiagnostic && errorHovered}
	placement="bottom"
	role="hint"
	ariaLabel="Diagnostic"
>
	<span class="err-popover-msg">{errorMessage}</span>
</Popover>

<style>
	/* Flex row: gutter column on the left, editor-content on the right.
	 * Both scroll together as one unit; position:sticky on the gutter
	 * keeps line numbers visible when scrolling horizontally on long lines. */
	.editor {
		display: flex;
		overflow: auto;
		font-family: var(--font-mono);
		background: var(--ruka-hl-bg, var(--bg-elevated));
	}
	.gutter {
		flex: 0 0 auto;
		position: sticky;
		left: 0;
		z-index: 1;
		padding: 12px 10px 12px 12px;
		background: var(--ruka-hl-bg, var(--bg-elevated));
		border-right: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
		text-align: right;
		font-size: var(--fs-base);
		line-height: 1.4;
		font-weight: 550;
		color: var(--fg-muted);
		user-select: none;
		pointer-events: none;
	}
	.gutter-line {
		font-family: var(--font-mono);
		line-height: 1.4;
		opacity: 0.5;
	}
	/* Stack the highlight layer (pre > code) and the input layer (textarea)
	 * in a single CSS grid cell. Grid sizes both identically, which is what
	 * keeps the caret aligned line-for-line. */
	.editor-content {
		flex: 1 0 0;
		display: grid;
		grid-template-rows: max-content;
		position: relative;
		min-width: 0;
	}
	.editor-content > pre,
	.editor-content > textarea {
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
		font-family: var(--font-mono);
		font-size: var(--fs-base);
		line-height: 1.4;
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
		font-family: var(--font-mono);
		font-size: var(--fs-base);
		line-height: 1.4;
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

	/* Wavy underline on the error line — no background shift, no layout change. */
	.editor :global(.err-line) {
		text-decoration: underline wavy var(--danger);
		text-decoration-skip-ink: none;
		text-underline-offset: 3px;
	}

	/* Invisible positioned element used only as a Popover anchor. */
	.err-anchor {
		position: absolute;
		left: 0;
		right: 0;
		height: 1.4em;
		pointer-events: none;
	}

	/* Styling applied inside the hint popover for the error message. */
	.err-popover-msg {
		color: var(--danger);
		font-style: italic;
	}
</style>
