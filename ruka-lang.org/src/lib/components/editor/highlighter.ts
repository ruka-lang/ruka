// Phase 6 placeholder. Phase 7 will replace this with a tokenizer-driven
// highlighter that emits classed <span> spans. For now, escape HTML so the
// editor renders source faithfully under the textarea overlay.
export function highlight(source: string): string {
	return escapeHtml(source);
}

export function escapeHtml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
