// String interpolation helpers shared by the scope checker, type checker,
// evaluator, and highlighter.

export type InterpPart = { text: string } | { interp: string };

/**
 * Split a raw string body into literal text / `${...}` expression parts,
 * respecting nested braces AND nested string literals so that
 * `"outer ${"inner"} end"` round-trips correctly.
 */
export function splitInterp(raw: string): InterpPart[] {
	const parts: InterpPart[] = [];
	let buf = "";
	let i = 0;
	const len = raw.length;
	while (i < len) {
		if (raw[i] === "\\" && i + 1 < len) {
			buf += raw[i] + raw[i + 1];
			i += 2;
		} else if (raw[i] === "$" && raw[i + 1] === "{") {
			if (buf.length) {
				parts.push({ text: buf });
				buf = "";
			}
			i += 2;
			let depth = 1;
			let inner = "";
			while (i < len && depth > 0) {
				if (raw[i] === '"') {
					inner += raw[i++];
					while (i < len && raw[i] !== '"') {
						if (raw[i] === "\\" && i + 1 < len) {
							inner += raw[i] + raw[i + 1];
							i += 2;
						} else {
							inner += raw[i++];
						}
					}
					if (i < len) inner += raw[i++];
				} else if (raw[i] === "{") {
					depth++;
					inner += raw[i++];
				} else if (raw[i] === "}") {
					depth--;
					if (depth === 0) {
						i++;
						break;
					}
					inner += raw[i++];
				} else {
					inner += raw[i++];
				}
			}
			parts.push({ interp: inner });
		} else {
			buf += raw[i++];
		}
	}
	if (buf.length) parts.push({ text: buf });
	return parts;
}

/** Decode the four standard escapes the playground recognises in string text. */
export function unescText(raw: string): string {
	return raw
		.replace(/\\n/g, "\n")
		.replace(/\\t/g, "\t")
		.replace(/\\\\/g, "\\")
		.replace(/\\"/g, '"');
}
