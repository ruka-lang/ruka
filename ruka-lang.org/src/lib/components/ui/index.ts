// Reusable UI primitives. Styling is intentionally minimal — these own
// structure, accessibility, and the CSS-variable hooks that the eventual
// brand/light-dark theming pass will populate. Pages should reach for these
// before reintroducing raw <button>/<select>/<div> with one-off styles.

export { default as Button } from "./button.svelte";
export { default as Select } from "./select.svelte";
export { default as Card } from "./card.svelte";
export { default as Popover } from "./popover.svelte";
export type { SelectOption, SelectGroup } from "./select.svelte";
export type { Placement } from "./popover.svelte";
