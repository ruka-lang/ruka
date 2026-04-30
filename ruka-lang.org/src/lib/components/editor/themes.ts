// Highlighter themes. Each theme maps the highlighter's token classes to a
// color (any valid CSS color). The editor applies a theme by setting one CSS
// custom property per token class on its root element, so swapping themes is
// a pure prop change with no DOM rewrites and no recomputation of highlight
// HTML. Add a new theme by exporting another `Theme` object below.

export type TokenClass = "kw" | "str" | "num" | "lbl" | "op" | "surr" | "strc" | "cmt" | "tp";

export type Theme = {
	name: string;
	// Foreground used for plain identifiers and unclassified text. Inherited
	// from the surrounding element if omitted.
	text?: string;
	tokens: Record<TokenClass, string>;
};

// Default — Rosé Pine Moon, matching the existing docs site palette.
export const rosePineMoon: Theme = {
	name: "rose-pine-moon",
	text: "#e0def4",
	tokens: {
		kw: "#eb6f92",
		str: "#9ccfd8",
		num: "#f6c177",
		lbl: "#ea9a97",
		op: "#908caa",
		surr: "#c4a7e7",
		strc: "#908caa",
		cmt: "#6e6a86",
		tp: "#c4a7e7"
	}
};

// A lighter alternative for future light-mode support.
export const rosePineDawn: Theme = {
	name: "rose-pine-dawn",
	text: "#575279",
	tokens: {
		kw: "#b4637a",
		str: "#56949f",
		num: "#ea9d34",
		lbl: "#d7827e",
		op: "#797593",
		surr: "#907aa9",
		strc: "#797593",
		cmt: "#9893a5",
		tp: "#907aa9"
	}
};

// Convert a theme into the inline `style` string the editor sets on its root
// element. Each token class becomes `--ruka-hl-<class>: <color>`.
export function themeToCssVars(theme: Theme): string {
	const parts: string[] = [];
	if (theme.text) parts.push(`--ruka-hl-text: ${theme.text}`);
	for (const cls in theme.tokens) {
		parts.push(`--ruka-hl-${cls}: ${theme.tokens[cls as TokenClass]}`);
	}
	return parts.join("; ");
}
