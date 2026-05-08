// Internal type representation used by the type checker (and later the
// evaluator). Distinct from the parser's AST `TypeExpr` — this one carries the
// resolved primitive set, function signatures, record/variant definitions,
// and the "unknown" placeholder used for inference holes.

import type { TypeExpr } from "../ast";

// ── Primitive tag sets ────────────────────────────────────────────────
export const INT_KINDS: ReadonlySet<string> = new Set([
	"int",
	"uint",
	"i8",
	"i16",
	"i32",
	"i64",
	"i128",
	"u8",
	"u16",
	"u32",
	"u64",
	"u128"
]);

export const FLOAT_KINDS: ReadonlySet<string> = new Set(["float", "f32", "f64"]);

export const PRIMITIVE_KINDS: ReadonlySet<string> = new Set([
	...INT_KINDS,
	...FLOAT_KINDS,
	"string",
	"bool"
]);

export function isNumericKind(kind: string): boolean {
	return INT_KINDS.has(kind) || FLOAT_KINDS.has(kind);
}

// ── Internal CheckedType representation ────────────────────────────────
// Primitive types carry their tag directly in `kind` (e.g. { kind: "int" }) —
// this matches the JS playground's representation so the evaluator can compare
// kinds without extra unwrapping.

export type CheckedType =
	| { kind: "unknown" }
	| { kind: "unit" }
	| { kind: "bool" }
	| { kind: "string" }
	| { kind: PrimitiveKind }
	| ArrayType
	| TupleType
	| MapType
	| OptionType
	| ResultType
	| RangeType
	| FunctionType
	| ModuleType
	| NamedType
	| RecordDef
	| VariantDef;

export type PrimitiveKind =
	| "int"
	| "uint"
	| "i8"
	| "i16"
	| "i32"
	| "i64"
	| "i128"
	| "u8"
	| "u16"
	| "u32"
	| "u64"
	| "u128"
	| "float"
	| "f32"
	| "f64";

export type ArrayType = { kind: "array"; element: CheckedType };
export type TupleType = { kind: "tuple"; elements: CheckedType[] };
export type MapType = { kind: "map"; key: CheckedType; value: CheckedType };
export type OptionType = { kind: "option"; inner: CheckedType };
export type ResultType = { kind: "result"; ok: CheckedType; err: CheckedType };
export type RangeType = { kind: "range"; element: CheckedType };
export type FunctionType = { kind: "fn"; params: CheckedType[]; returnType: CheckedType };
export type ModuleType = { kind: "module"; members: Record<string, CheckedType> };
export type NamedType = { kind: "named"; name: string };

export type MemberInfo = {
	type: CheckedType;
	declEnv: TypeEnv;
	line: number;
};

export type RecordDef = {
	kind: "recordDef";
	name?: string;
	fields: { name: string; type: CheckedType; local?: boolean }[];
	methods?: Record<string, MemberInfo>;
	statics?: Record<string, MemberInfo>;
	declEnv?: TypeEnv | null;
};

export type VariantDef = {
	kind: "variantDef";
	name?: string;
	tags: { name: string; type: CheckedType | null; local?: boolean }[];
	methods?: Record<string, MemberInfo>;
	statics?: Record<string, MemberInfo>;
	declEnv?: TypeEnv | null;
};

// ── Environment ───────────────────────────────────────────────────────
export type TypeEnv = {
	bindings: Record<string, CheckedType>;
	parent: TypeEnv | null;
};

export function extendEnv(parent: TypeEnv): TypeEnv {
	return { bindings: Object.create(null), parent };
}

export function lookupEnv(env: TypeEnv | null, name: string): CheckedType | null {
	let current = env;
	while (current) {
		if (name in current.bindings) {
			return current.bindings[name]!;
		}
		current = current.parent;
	}
	return null;
}

/** Resolves dotted type names like `Module.TypeName` through module statics. */
export function lookupTypeEnv(env: TypeEnv | null, name: string): CheckedType | null {
	const dot = name.indexOf(".");
	if (dot === -1) return lookupEnv(env, name);
	const moduleName = name.slice(0, dot);
	const member = name.slice(dot + 1);
	const moduleType = lookupEnv(env, moduleName);
	if (!moduleType || moduleType.kind !== "recordDef") return null;
	return moduleType.statics?.[member]?.type ?? null;
}

/** True when `target` is reachable from `current` via the parent chain. */
export function envContains(
	current: TypeEnv | null,
	target: TypeEnv | null | undefined
): boolean {
	if (!target) {
		return true;
	}
	let walk = current;
	while (walk) {
		if (walk === target) {
			return true;
		}
		walk = walk.parent;
	}
	return false;
}

// ── Conversion + comparison ───────────────────────────────────────────
const UNKNOWN: CheckedType = { kind: "unknown" };

/** Translate a parser-AST type expression to a CheckedType. */
export function astToType(node: TypeExpr | null | undefined): CheckedType | null {
	if (!node) {
		return null;
	}
	switch (node.kind) {
		case "UnitType":
			return { kind: "unit" };
		case "ArrayType":
			return { kind: "array", element: astToType(node.element) ?? UNKNOWN };
		case "TupleType":
			return {
				kind: "tuple",
				elements: node.elements.map((element) => astToType(element) ?? UNKNOWN)
			};
		case "MapType":
			return {
				kind: "map",
				key: astToType(node.key) ?? UNKNOWN,
				value: astToType(node.value) ?? UNKNOWN
			};
		case "OptionType":
			return { kind: "option", inner: astToType(node.inner) ?? UNKNOWN };
		case "ResultType":
			return {
				kind: "result",
				ok: astToType(node.ok) ?? UNKNOWN,
				err: astToType(node.err) ?? UNKNOWN
			};
		case "NamedType":
			if (PRIMITIVE_KINDS.has(node.name)) {
				return { kind: node.name } as CheckedType;
			}
			return { kind: "named", name: node.name };
	}
}

export function typeStr(type: CheckedType | null | undefined): string {
	if (!type) {
		return "?";
	}
	switch (type.kind) {
		case "unit":
			return "()";
		case "array":
			return `[${typeStr(type.element)}]`;
		case "tuple":
			return `[${type.elements.map(typeStr).join(", ")}]`;
		case "map":
			return `[${typeStr(type.key)} => ${typeStr(type.value)}]`;
		case "option":
			return `?(${typeStr(type.inner)})`;
		case "result":
			return `!(${typeStr(type.ok)}, ${typeStr(type.err)})`;
		case "range":
			return `range(${typeStr(type.element)})`;
		case "fn":
			return `(${type.params.map(typeStr).join(", ")}) -> ${typeStr(type.returnType)}`;
		case "module":
			return "<module>";
		case "named":
			return type.name;
		case "variantDef":
			return type.name ?? "<variant>";
		case "unknown":
			return "?";
		default:
			// Primitive — kind is the type name itself.
			return type.kind;
	}
}

export function typesEqual(left: CheckedType | null, right: CheckedType | null): boolean {
	if (!left || !right) {
		return false;
	}
	if (left.kind === "unknown" || right.kind === "unknown") {
		return true;
	}
	if (left.kind !== right.kind) {
		return false;
	}
	switch (left.kind) {
		case "array":
			return typesEqual(left.element, (right as ArrayType).element);
		case "tuple": {
			const rightTuple = right as TupleType;
			if (left.elements.length !== rightTuple.elements.length) {
				return false;
			}
			for (let index = 0; index < left.elements.length; index++) {
				if (!typesEqual(left.elements[index]!, rightTuple.elements[index]!)) {
					return false;
				}
			}
			return true;
		}
		case "option":
			return typesEqual(left.inner, (right as OptionType).inner);
		case "result": {
			const rightResult = right as ResultType;
			return typesEqual(left.ok, rightResult.ok) && typesEqual(left.err, rightResult.err);
		}
		case "range":
			return typesEqual(left.element, (right as RangeType).element);
		case "named":
			return left.name === (right as NamedType).name;
		case "fn": {
			const rightFn = right as FunctionType;
			if (left.params.length !== rightFn.params.length) {
				return false;
			}
			for (let index = 0; index < left.params.length; index++) {
				if (!typesEqual(left.params[index]!, rightFn.params[index]!)) {
					return false;
				}
			}
			return typesEqual(left.returnType, rightFn.returnType);
		}
		default:
			// Primitive — tag equality already verified above.
			return true;
	}
}
