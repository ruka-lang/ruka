// Theme resolution + persistence. The initial value is decided by the inline
// script in app.html (which runs before first paint to avoid a flash); this
// module just reads/updates it at runtime.
//
// Storage key is shared with the inline script — keep them in sync.

import { browser } from "$app/environment";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ruka-theme";

export function getTheme(): Theme {
	if (!browser) return "dark";

	const attr = document.documentElement.getAttribute("data-theme");
	return attr === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme): void {
	if (!browser) return;

	document.documentElement.setAttribute("data-theme", theme);

	try {
		localStorage.setItem(STORAGE_KEY, theme);
	} catch (_) {
		// Storage unavailable (private mode, quota) — the attribute change is
		// the source of truth for the current page; we just don't persist.
	}
}

export function toggleTheme(): Theme {
	const next: Theme = getTheme() === "dark" ? "light" : "dark";
	setTheme(next);
	return next;
}
