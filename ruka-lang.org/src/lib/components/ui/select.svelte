<script lang="ts" module>
	export type SelectOption = {
		value: string;
		label: string;
	};

	export type SelectGroup = {
		label: string;
		options: SelectOption[];
	};
</script>

<script lang="ts">
	type Props = {
		value: string;
		// Either flat options or grouped options (rendered as <optgroup>s).
		// Pass one or the other; if both are set, `groups` wins.
		options?: SelectOption[];
		groups?: SelectGroup[];
		ariaLabel?: string;
		disabled?: boolean;
		onChange?: (value: string) => void;
	};

	let {
		value = $bindable(""),
		options,
		groups,
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

<select class="select" aria-label={ariaLabel} {value} {disabled} onchange={handleChange}>
	{#if groups}
		{#each groups as group (group.label)}
			<optgroup label={group.label}>
				{#each group.options as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</optgroup>
		{/each}
	{:else if options}
		{#each options as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	{/if}
</select>

<style>
	.select {
		font: inherit;
		font-size: 12px;
		padding: 8px 14px;
		border: 1px solid var(--ui-border);
		background: var(--ui-select-bg);
		color: var(--ui-select-fg);
		border-radius: 3px;
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
