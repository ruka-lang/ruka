<script lang="ts" module>
	export type SelectOption = {
		value: string;
		label: string;
	};
</script>

<script lang="ts">
	type Props = {
		value: string;
		options: SelectOption[];
		ariaLabel?: string;
		disabled?: boolean;
		onChange?: (value: string) => void;
	};

	let {
		value = $bindable(""),
		options,
		ariaLabel,
		disabled = false,
		onChange
	}: Props = $props();

	function handleChange(event: Event) {
		const next = (event.target as HTMLSelectElement).value;
		value = next;
		onChange?.(next);
	}
</script>

<select
	class="select"
	aria-label={ariaLabel}
	{value}
	{disabled}
	onchange={handleChange}
>
	{#each options as option (option.value)}
		<option value={option.value}>{option.label}</option>
	{/each}
</select>

<style>
	.select {
		font: inherit;
		font-size: 12px;
		padding: 4px 10px;
		border: 1px solid var(--ui-border);
		background: var(--ui-select-bg);
		color: var(--ui-select-fg);
		border-radius: 4px;
		cursor: pointer;
	}

	.select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* @tailwindcss/forms applies a default focus ring on form controls; replace
	 * it with one tinted to the site accent so it matches the rest of the UI. */
	.select:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--selection);
		border-color: var(--accent);
	}
</style>
