// Runtime values produced by the evaluator. Each variant carries a `kind`
// discriminator so consumers can branch with exhaustive switches. Null is the
// unit value — it appears as the result of side-effecting builtins, empty
// blocks, and as a placeholder for missing tuple-destructure elements.

import type { Block, RecordTypeField, VariantTag } from "../ast";
import type { RuntimeEnv } from "./env";

export type Value =
	| null
	| boolean
	| number
	| string
	| CharValue
	| RangeValue
	| Value[]
	| RecordValue
	| VariantValue
	| FnValue
	| RecordTypeValue
	| VariantTypeValue
	| ModuleValue;

export type CharValue = { kind: "char"; codepoint: number };

export type RangeValue = {
	kind: "range";
	start: number;
	end: number;
	inclusive: boolean;
	isCharRange: boolean;
};

export type RecordValue = {
	kind: "record";
	typeName: string | null;
	fields: { [name: string]: Value };
};

export type VariantValue = {
	kind: "variant";
	typeName: string | null;
	tag: string;
	payload: Value;
};

// User-defined function (closure) or a host-implemented builtin. The evaluator
// uses the same shape for both; `host` is set on builtins and may be sync or
// async (async is required for input-prompting builtins like ruka.read).
export type FnValue = {
	kind: "fn";
	params?: string[];
	paramModes?: (string | null)[];
	body?: Block;
	closureEnv?: RuntimeEnv;
	host?: HostFn;
};

// The evaluator narrows the result with `isBuiltinEnvelope` before unwrapping,
// so the static return type stays loose to admit both plain `Value`s (sync
// math builtins) and io envelopes that carry RuntimeEvents or input prompts.
export type HostFn = (args: Value[]) => unknown;

export type RecordTypeValue = {
	kind: "recordType";
	fields: RecordTypeField[];
	methods: { [name: string]: FnValue };
	statics: { [name: string]: Value };
};

export type VariantTypeValue = {
	kind: "variantType";
	name: string | null;
	tags: { name: string; hasPayload: boolean }[];
	rawTags: VariantTag[];
	methods: { [name: string]: FnValue };
	statics: { [name: string]: Value };
};

export type ModuleValue = {
	kind: "module";
	members: { [name: string]: Value };
};

export function isFn(value: Value): value is FnValue {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as { kind?: string }).kind === "fn"
	);
}

export function isChar(value: Value): value is CharValue {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as { kind?: string }).kind === "char"
	);
}

export function isRange(value: Value): value is RangeValue {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as { kind?: string }).kind === "range"
	);
}

export function isRecord(value: Value): value is RecordValue {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as { kind?: string }).kind === "record"
	);
}

export function isVariant(value: Value): value is VariantValue {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as { kind?: string }).kind === "variant"
	);
}

export function isRecordType(value: Value): value is RecordTypeValue {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as { kind?: string }).kind === "recordType"
	);
}

export function isVariantType(value: Value): value is VariantTypeValue {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as { kind?: string }).kind === "variantType"
	);
}

export function isModule(value: Value): value is ModuleValue {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as { kind?: string }).kind === "module"
	);
}

// Unwrap a tagged char to its underlying u8 number, leaving other values
// alone. Arithmetic and comparison operators call this on both operands so
// `'a' + 1` works the same as `97 + 1`.
export function numericOf(value: Value): number {
	if (isChar(value)) {
		return value.codepoint;
	}
	return value as number;
}

export function display(value: Value): string {
	if (value === null || value === undefined) {
		return "()";
	}
	if (typeof value === "boolean") {
		return value ? "true" : "false";
	}
	if (typeof value === "number") {
		return String(value);
	}
	if (typeof value === "string") {
		return value;
	}
	if (Array.isArray(value)) {
		return "{" + value.map(display).join(", ") + "}";
	}
	if (isFn(value)) {
		return "<fn>";
	}
	if (isChar(value)) {
		return String.fromCharCode(value.codepoint);
	}
	if (isRange(value)) {
		const sep = value.inclusive ? "..=" : "..";
		if (value.isCharRange) {
			return (
				"'" +
				String.fromCharCode(value.start) +
				"'" +
				sep +
				"'" +
				String.fromCharCode(value.end) +
				"'"
			);
		}
		return value.start + sep + value.end;
	}
	if (isVariantType(value)) {
		return "<variant>";
	}
	if (isVariant(value)) {
		const payload = value.payload !== null ? "(" + display(value.payload) + ")" : "";
		return value.tag + payload;
	}
	if (isRecordType(value)) {
		return "<record>";
	}
	if (isRecord(value)) {
		const parts = Object.keys(value.fields).map(
			(name) => name + " = " + display(value.fields[name])
		);
		const prefix = value.typeName ? value.typeName + " " : "";
		return prefix + "{ " + parts.join(", ") + " }";
	}
	if (isModule(value)) {
		return "<module>";
	}
	return String(value);
}
