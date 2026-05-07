// Bidirectional type checker.
//
// Walks the AST building a CheckedType for every expression. Mostly synthesises
// types bottom-up; uses the `expected` parameter on inferExpr to thread context
// down for literal defaulting (e.g. an int literal in `let x: i32 = 1`).
//
// Mutates AST nodes (RecordLiteral.resolvedTypeName, Receiver.resolvedTypeName)
// and CheckedType nodes (RecordDef.methods/statics/declEnv, VariantDef.same)
// so the evaluator can read resolved type info without re-running inference.

import type {
	Block,
	Call,
	ComplexAssign,
	Expression,
	FunctionExpr,
	Ident,
	Member,
	Program,
	Receiver,
	Statement,
	StringLiteral
} from "../ast";
import { RukaError } from "../diagnostics";
import { splitInterp } from "../interpolator";
import { parse } from "../parser";
import { tokenize } from "../tokenizer";
import {
	loadModuleAst,
	resolveImportPath,
	type ProjectContext
} from "../project";
import { isRukaImportCall } from "./scope";
import {
	astToType,
	envContains,
	extendEnv,
	FLOAT_KINDS,
	INT_KINDS,
	isNumericKind,
	lookupEnv,
	type ArrayType,
	type CheckedType,
	type FunctionType,
	type MemberInfo,
	type NamedType,
	type RangeType,
	type RecordDef,
	type TupleType,
	type TypeEnv,
	type VariantDef,
	typeStr,
	typesEqual
} from "./type";

const UNKNOWN: CheckedType = { kind: "unknown" };

// ── Privacy / member-kind helpers ────────────────────────────────────────
/** Privacy: an identifier is private when its first character is uppercase. */
function isPrivateName(name: string | undefined | null): boolean {
	if (!name) {
		return false;
	}
	const code = name.charCodeAt(0);
	return code >= 65 && code <= 90;
}

// ── Record-pattern helpers ───────────────────────────────────────────────
/** Resolve a value's CheckedType to a RecordDef (direct or via a NamedType). */
function resolveRecord(type: CheckedType | null, env: TypeEnv): RecordDef | null {
	if (!type) return null;
	if (type.kind === "recordDef") return type;
	if (type.kind === "named") {
		const looked = lookupEnv(env, type.name);
		if (looked && looked.kind === "recordDef") return looked;
	}
	return null;
}

/** Bind each `name` to its field type from `def`, enforcing privacy. */
function bindRecordFields(
	names: string[],
	def: RecordDef,
	env: TypeEnv,
	line: number,
	col: number | undefined
): void {
	const fieldByName: Record<string, { name: string; type: CheckedType }> = Object.create(null);
	for (const field of def.fields) {
		fieldByName[field.name] = field;
	}
	for (const name of names) {
		const field = fieldByName[name];
		if (!field) {
			// Also check statics — this covers module destructuring:
			// `let { a, b } = ruka.import(...)` where the module's exports
			// are stored as statics on a no-field RecordDef.
			if (def.statics && name in def.statics) {
				env.bindings[name] = def.statics[name]!.type;
				continue;
			}
			throw new RukaError(
				`no field '${name}' on ${def.name ?? "record"}`,
				line,
				col
			);
		}
		if (field.local && !envContains(env, def.declEnv)) {
			throw new RukaError(
				`field '${name}' is local and cannot be destructured here`,
				line,
				col
			);
		}
		env.bindings[name] = field.type;
	}
}

// ── Type-error helper ────────────────────────────────────────────────────
function typeError(
	line: number,
	col: number | undefined,
	message: string,
	fatal = false
): RukaError {
	return new RukaError(message, line, col, fatal);
}

// ── Member resolution ────────────────────────────────────────────────────
/**
 * Static method/field resolution for built-in and user-defined types.
 * `env` is optional; when provided, named record fields are resolved.
 */
function methodOf(
	object: CheckedType,
	name: string,
	line: number,
	col: number | undefined,
	env: TypeEnv | null
): CheckedType {
	if (!object || object.kind === "unknown") {
		return UNKNOWN;
	}

	if (object.kind === "array") {
		const elementType = object.element;
		if (name === "len") {
			return { kind: "fn", params: [], returnType: { kind: "int" } };
		}
		if (name === "append") {
			return { kind: "fn", params: [elementType], returnType: { kind: "unit" } };
		}
		if (name === "remove") {
			return { kind: "fn", params: [{ kind: "int" }], returnType: elementType };
		}
		if (name === "concat") {
			return {
				kind: "fn",
				params: [{ kind: "array", element: elementType }],
				returnType: { kind: "array", element: elementType }
			};
		}
		throw typeError(line, col, `no method '${name}' on ${typeStr(object)}`);
	}

	if (object.kind === "string") {
		if (name === "len") {
			return { kind: "fn", params: [], returnType: { kind: "int" } };
		}
		if (name === "concat") {
			return {
				kind: "fn",
				params: [{ kind: "string" }],
				returnType: { kind: "string" }
			};
		}
		if (name === "append") {
			return {
				kind: "fn",
				params: [{ kind: "string" }],
				returnType: { kind: "unit" }
			};
		}
		throw typeError(line, col, `no method '${name}' on string`);
	}

	if (object.kind === "variantDef") {
		// First: variant tags (constructors).
		const tag = object.tags.find((t) => t.name === name);
		if (tag) {
			const instance: NamedType = { kind: "named", name: object.name ?? "?" };
			if (!tag.type) {
				return instance;
			}
			return { kind: "fn", params: [tag.type], returnType: instance };
		}
		// Then: statics attached via (TypeName) receiver.
		if (object.statics && name in object.statics) {
			const staticInfo = object.statics[name]!;
			if (isPrivateName(name) && !envContains(env, staticInfo.declEnv)) {
				throw typeError(
					line,
					col,
					`static '${name}' on '${object.name}' is private`,
					true
				);
			}
			return staticInfo.type;
		}
		throw typeError(
			line,
			col,
			`no tag or static '${name}' in ${object.name ?? "variant"}`,
			true
		);
	}

	if (object.kind === "recordDef") {
		// `Type.static` access on a record type (e.g. Color.RED, Vector.new).
		if (object.statics && name in object.statics) {
			const staticInfo = object.statics[name]!;
			if (isPrivateName(name) && !envContains(env, staticInfo.declEnv)) {
				throw typeError(line, col, `static '${name}' on record is private`, true);
			}
			return staticInfo.type;
		}
		throw typeError(line, col, `no static '${name}' on record`, true);
	}

	if (object.kind === "named" && env) {
		const definition = lookupEnv(env, object.name);
		if (definition && definition.kind === "recordDef") {
			const field = definition.fields.find((f) => f.name === name);
			if (field) {
				if (field.local && !envContains(env, definition.declEnv)) {
					throw typeError(
						line,
						col,
						`field '${name}' on '${object.name}' is local`,
						true
					);
				}
				return field.type;
			}
			// Fall through to method lookup.
			if (definition.methods && name in definition.methods) {
				const methodInfo = definition.methods[name]!;
				if (isPrivateName(name) && !envContains(env, methodInfo.declEnv)) {
					throw typeError(
						line,
						col,
						`method '${name}' on '${object.name}' is private`,
						true
					);
				}
				return methodInfo.type;
			}
			throw typeError(line, col, `no field or method '${name}' on ${object.name}`, true);
		}
		// `object` typed as a variant instance — look up methods on the variantDef.
		if (
			definition &&
			definition.kind === "variantDef" &&
			definition.methods &&
			name in definition.methods
		) {
			const methodInfo = definition.methods[name]!;
			if (isPrivateName(name) && !envContains(env, methodInfo.declEnv)) {
				throw typeError(
					line,
					col,
					`method '${name}' on '${object.name}' is private`,
					true
				);
			}
			return methodInfo.type;
		}
	}

	return UNKNOWN;
}

// ── Conformance ──────────────────────────────────────────────────────────
/**
 * Check `actual` conforms to `expected`. Unknown is tolerated in either
 * direction. Returns the resolved type (prefers `expected` when provided,
 * for literal defaulting).
 */
function conform(
	expected: CheckedType | null,
	actual: CheckedType,
	line: number,
	col: number | undefined
): CheckedType {
	if (!expected) {
		return actual;
	}
	if (actual.kind === "unknown") {
		return expected;
	}
	if (expected.kind === "unknown") {
		return actual;
	}
	if (!typesEqual(expected, actual)) {
		// Numeric type mismatch: require an explicit cast rather than implicit narrowing/widening.
		if (isNumericKind(expected.kind) && isNumericKind(actual.kind)) {
			throw typeError(
				line,
				col,
				`assigning ${typeStr(actual)} to ${typeStr(expected)} requires an explicit cast`
			);
		}
		throw typeError(
			line,
			col,
			`type mismatch: expected ${typeStr(expected)}, got ${typeStr(actual)}`
		);
	}
	return actual;
}

// ── Pure AST walkers (used by parameter inference) ───────────────────────
type Visitor = (node: Expression | Block) => void;

function walkExpression(
	node: Expression | Block | null | undefined,
	visit: Visitor
): void {
	if (!node) {
		return;
	}
	visit(node);
	switch (node.kind) {
		case "Block":
			for (const statement of node.body) {
				walkStatement(statement, visit);
			}
			return;
		case "If":
			walkExpression(node.condition, visit);
			walkExpression(node.thenBranch, visit);
			if (node.elseBranch) {
				walkExpression(node.elseBranch, visit);
			}
			return;
		case "While":
			walkExpression(node.condition, visit);
			for (const statement of node.body) {
				walkStatement(statement, visit);
			}
			return;
		case "Call":
			walkExpression(node.callee, visit);
			for (const arg of node.args) {
				walkExpression(arg, visit);
			}
			return;
		case "Member":
			walkExpression(node.object, visit);
			return;
		case "Index":
			walkExpression(node.object, visit);
			walkExpression(node.index, visit);
			return;
		case "BinaryOp":
			walkExpression(node.left, visit);
			walkExpression(node.right, visit);
			return;
		case "UnaryOp":
			walkExpression(node.expression, visit);
			return;
		case "Range":
			walkExpression(node.start, visit);
			if (node.end) {
				walkExpression(node.end, visit);
			}
			return;
		case "ListLiteral":
			for (const element of node.elements) {
				walkExpression(element, visit);
			}
			return;
		case "ArrayComp":
			walkExpression(node.iterable, visit);
			walkExpression(node.body, visit);
			if (node.filter) walkExpression(node.filter, visit);
			return;
		case "MapLiteral":
			for (const entry of node.entries) {
				walkExpression(entry.key, visit);
				walkExpression(entry.value, visit);
			}
			return;
		case "MapComp":
			walkExpression(node.iterable, visit);
			walkExpression(node.keyBody, visit);
			walkExpression(node.valueBody, visit);
			if (node.filter) walkExpression(node.filter, visit);
			return;
		case "BehaviourType":
			return;
		case "Cast":
			walkExpression(node.value, visit);
			return;
		case "RecordLiteral":
			if (node.typeName) {
				walkExpression(node.typeName, visit);
			}
			for (const field of node.fields) {
				walkExpression(field.value, visit);
			}
			return;
		case "FunctionExpr":
			walkExpression(node.body, visit);
			return;
		case "VariantConstructor":
			if (node.payload) {
				walkExpression(node.payload, visit);
			}
			return;
		case "Match":
			walkExpression(node.subject, visit);
			for (const arm of node.arms) {
				if (arm.pattern.kind === "GuardPattern") {
					walkExpression(arm.pattern.expression, visit);
				}
				if (arm.pattern.kind === "LiteralPattern") {
					walkExpression(arm.pattern.expression, visit);
				}
				if (arm.pattern.kind === "RangePattern") {
					walkExpression(arm.pattern.low, visit);
					walkExpression(arm.pattern.high, visit);
				}
				walkExpression(arm.body, visit);
			}
			if (node.elseArm) {
				walkExpression(node.elseArm, visit);
			}
			return;
	}
}

function walkStatement(node: Statement | null | undefined, visit: Visitor): void {
	if (!node) {
		return;
	}
	switch (node.kind) {
		case "Binding":
		case "Assign":
		case "ComplexAssign":
		case "Return":
			walkExpression(node.value, visit);
			return;
		case "ExpressionStmt":
			walkExpression(node.expression, visit);
			return;
		case "For":
			walkExpression(node.iterable, visit);
			for (const statement of node.body) {
				walkStatement(statement, visit);
			}
			return;
		case "Defer":
			walkExpression(node.expression, visit);
			return;
	}
}

// ── Top-level entry point ────────────────────────────────────────────────
const ARITHMETIC_OPS = new Set(["+", "-", "*", "/", "%", "**"]);

/**
 * Walk the AST inferring and checking types.
 * Returns the first violation, or null if the program type-checks.
 *
 * When `ctx` is supplied, `ruka.import("./other.ruka")` calls resolve
 * against the project's source map and contribute a `RecordDef` to
 * `ctx.moduleTypes` for each successfully checked module.
 */
export function checkTypes(
	ast: Program,
	ctx?: ProjectContext,
	path?: string
): RukaError | null {
	const modulePath = path ?? "";
	if (ctx) {
		ctx.visitingTypes.add(modulePath);
	}
	const numericFn1: FunctionType = {
		kind: "fn",
		params: [{ kind: "float" }],
		returnType: { kind: "float" }
	};
	const numericFn2: FunctionType = {
		kind: "fn",
		params: [{ kind: "float" }, { kind: "float" }],
		returnType: { kind: "float" }
	};
	const unknownFn1: FunctionType = {
		kind: "fn",
		params: [UNKNOWN],
		returnType: UNKNOWN
	};
	const unknownFn2: FunctionType = {
		kind: "fn",
		params: [UNKNOWN, UNKNOWN],
		returnType: UNKNOWN
	};

	const topEnv: TypeEnv = { bindings: Object.create(null), parent: null };

	// `ruka` is the prelude — a predefined record always in scope with no
	// instance fields, only statics (the built-in functions). It is treated
	// exactly like any other imported module at the type level.
	function rukaStatic(type: CheckedType): MemberInfo {
		return { type, declEnv: topEnv, line: 0 };
	}
	const rukaModule: RecordDef = {
		kind: "recordDef",
		fields: [],
		statics: {
			println: rukaStatic({ kind: "fn", params: [UNKNOWN], returnType: { kind: "unit" } }),
			print: rukaStatic({ kind: "fn", params: [UNKNOWN], returnType: { kind: "unit" } }),
			read: rukaStatic({ kind: "fn", params: [], returnType: { kind: "string" } }),
			readln: rukaStatic({ kind: "fn", params: [], returnType: { kind: "string" } }),
			expect_eq: rukaStatic(unknownFn2),
			abs: rukaStatic(unknownFn1),
			sin: rukaStatic(numericFn1),
			cos: rukaStatic(numericFn1),
			tan: rukaStatic(numericFn1),
			sqrt: rukaStatic(numericFn1),
			floor: rukaStatic(numericFn1),
			ceil: rukaStatic(numericFn1),
			exp: rukaStatic(numericFn1),
			log: rukaStatic(numericFn1),
			log2: rukaStatic(numericFn1),
			log10: rukaStatic(numericFn1),
			min: rukaStatic(unknownFn2),
			max: rukaStatic(unknownFn2),
			pow: rukaStatic(numericFn2),
			import: rukaStatic(UNKNOWN)
		}
	};
	topEnv.bindings["ruka"] = rukaModule;
	topEnv.bindings["true"] = { kind: "bool" };
	topEnv.bindings["false"] = { kind: "bool" };
	topEnv.bindings["self"] = UNKNOWN;

	// Hoist top-level names — annotated bindings get precise types; record/variant
	// type definitions get their def eagerly so the method pre-pass can find them;
	// everything else is UNKNOWN until the main pass refines it.
	const topLevelNames: string[] = [];
	const localTopLevelNames = new Set<string>();
	for (const statement of ast.body) {
		if (statement.kind === "Binding" && !statement.receiver) {
			let hoisted: CheckedType = astToType(statement.type) ?? UNKNOWN;
			// Eagerly resolve bare `record { ... }` and `variant { ... }` literals so
			// their defs are available when the method pre-registration pass runs.
			if (hoisted.kind === "unknown" && statement.pattern.kind === "IdentifierPattern") {
				if (statement.value.kind === "RecordType") {
					hoisted = {
						kind: "recordDef",
						fields: statement.value.fields.map((f) => ({
							name: f.name,
							type: astToType(f.type) ?? UNKNOWN,
							local: f.local || undefined
						}))
					};
				} else if (statement.value.kind === "VariantType") {
					hoisted = {
						kind: "variantDef",
						tags: statement.value.tags.map((tag) => ({
							name: tag.name,
							type: tag.type ? (astToType(tag.type) ?? UNKNOWN) : null,
							local: tag.local || undefined
						}))
					};
				}
			}
			if (statement.pattern.kind === "IdentifierPattern") {
				topEnv.bindings[statement.pattern.name] = hoisted;
				topLevelNames.push(statement.pattern.name);
				if (statement.local) localTopLevelNames.add(statement.pattern.name);
			} else {
				for (const name of statement.pattern.names) {
					topEnv.bindings[name] = UNKNOWN;
					topLevelNames.push(name);
					if (statement.local) localTopLevelNames.add(name);
				}
			}
		}
	}

	// Stack of expected return types for the enclosing function(s). Top is the
	// innermost fn. Empty = `return` at file scope, which is a hard error.
	const returnTypeStack: CheckedType[] = [];

	// Pre-pass: register all receiver bindings with UNKNOWN type so that
	// forward references to methods (e.g. calling a method before it's defined
	// in source order) succeed during the main pass. For annotated receivers
	// the target is read from the annotation; for unannotated self receivers
	// we run the same field-collection heuristic used by the main pass.
	for (const statement of ast.body) {
		if (statement.kind !== "Binding" || !statement.receiver || !statement.name) continue;
		try {
			let target = resolveReceiverDef(statement.receiver, topEnv, statement.line, statement.col);
			if (!target && statement.receiver.kind === "self") {
				// Unannotated self: collect field accesses and find a unique candidate.
				const fields = collectSelfFields(statement.value);
				const seen = new Set<string>();
				const candidates: { name: string; def: RecordDef }[] = [];
				let walk: TypeEnv | null = topEnv;
				while (walk) {
					for (const [name, binding] of Object.entries(walk.bindings)) {
						if (seen.has(name)) continue;
						seen.add(name);
						if (binding && binding.kind === "recordDef") {
							const fieldNames = new Set(binding.fields.map((f) => f.name));
							if (fields.length > 0 && fields.every((f) => fieldNames.has(f))) {
								candidates.push({ name, def: binding });
							}
						}
					}
					walk = walk.parent;
				}
				if (candidates.length === 1) target = candidates[0]!;
			}
			if (!target) continue;
			if (statement.receiver.kind === "self") {
				target.def.methods = target.def.methods ?? Object.create(null);
				if (!target.def.methods![statement.name]) {
					target.def.methods![statement.name] = { type: UNKNOWN, declEnv: topEnv, line: statement.line };
				}
			} else {
				target.def.statics = target.def.statics ?? Object.create(null);
				if (!target.def.statics![statement.name]) {
					target.def.statics![statement.name] = { type: UNKNOWN, declEnv: topEnv, line: statement.line };
				}
			}
			statement.receiver.resolvedTypeName = target.name;
		} catch {
			// Ignore errors here; the main pass will catches and reports them.
		}
	}

	try {
		for (const statement of ast.body) {
			checkStatement(statement, topEnv);
		}
		if (ctx) {
			// Build the module's public-export type as a no-field RecordDef
			// whose statics hold the exported bindings. This allows both
			// `module.foo` (static access) and `let { foo } = module` (record
			// pattern destructuring that falls through to statics). Privacy is
			// by case: lowercase = public.
			const statics: Record<string, MemberInfo> = Object.create(null);
			for (const name of topLevelNames) {
				if (localTopLevelNames.has(name)) continue;
				const type = topEnv.bindings[name];
				if (type) statics[name] = { type, declEnv: topEnv, line: 0 };
			}
			ctx.moduleTypes.set(modulePath, { kind: "recordDef", fields: [], statics });
		}
		return null;
	} catch (error) {
		if (error instanceof RukaError) {
			if (ctx && !error.path) error.path = modulePath;
			return error;
		}
		throw error;
	} finally {
		if (ctx) ctx.visitingTypes.delete(modulePath);
	}

	// ── Self-field collection (for self-method type inference) ───────────
	function collectSelfFields(node: unknown, accumulator: string[] = []): string[] {
		if (!node || typeof node !== "object") {
			return accumulator;
		}
		// If this is a Call node whose callee is `self.method(...)`, skip
		// collecting the method name — it's not a field. Recurse into args only.
		const asCall = node as Call;
		if (asCall.kind === "Call") {
			const callee = asCall.callee;
			if (
				callee.kind === "Member" &&
				(callee.object as Ident).kind === "Ident" &&
				(callee.object as Ident).name === "self"
			) {
				for (const arg of asCall.args) collectSelfFields(arg, accumulator);
				return accumulator;
			}
		}
		const candidate = node as Member;
		if (
			candidate.kind === "Member" &&
			candidate.object &&
			(candidate.object as Ident).kind === "Ident" &&
			(candidate.object as Ident).name === "self"
		) {
			if (!accumulator.includes(candidate.property)) {
				accumulator.push(candidate.property);
			}
		}
		for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
			void key;
			if (value && typeof value === "object") {
				if (Array.isArray(value)) {
					for (const child of value) {
						collectSelfFields(child, accumulator);
					}
				} else if ((value as { kind?: unknown }).kind) {
					collectSelfFields(value, accumulator);
				}
			}
		}
		return accumulator;
	}

	// ── Receiver resolution ──────────────────────────────────────────────
	function resolveReceiverDef(
		receiver: Receiver,
		env: TypeEnv,
		line: number,
		col: number | undefined
	): { name: string; def: RecordDef | VariantDef } | null {
		if (receiver.kind === "static") {
			const looked = lookupEnv(env, receiver.typeName);
			if (!looked || (looked.kind !== "recordDef" && looked.kind !== "variantDef")) {
				throw typeError(
					line,
					col,
					`static receiver '${receiver.typeName}' is not a record/variant type`
				);
			}
			return { name: receiver.typeName, def: looked };
		}
		// self-method: explicit annotation, pre-pass pin, or inference.
		if (receiver.typeAnnotation) {
			const annotated = astToType(receiver.typeAnnotation);
			if (!annotated || annotated.kind !== "named") {
				throw typeError(
					line,
					col,
					"method receivers on non-record types are not yet supported in the playground"
				);
			}
			const definition = lookupEnv(env, annotated.name);
			if (
				!definition ||
				(definition.kind !== "recordDef" && definition.kind !== "variantDef")
			) {
				throw typeError(
					line,
					col,
					`receiver type '${annotated.name}' is not a record/variant type`
				);
			}
			return { name: annotated.name, def: definition };
		}
		// Use the target resolved by the pre-registration pass, if available.
		// This handles methods that only call other methods (no direct field
		// access) where field-collection inference would be under-constrained.
		if (receiver.resolvedTypeName) {
			const definition = lookupEnv(env, receiver.resolvedTypeName);
			if (definition && (definition.kind === "recordDef" || definition.kind === "variantDef")) {
				return { name: receiver.resolvedTypeName, def: definition };
			}
		}
		return null; // caller handles inference
	}

	// ── ruka.import resolution ──────────────────────────────────────────
	function resolveImport(node: Call): RecordDef {
		if (!ctx) {
			throw typeError(
				node.line,
				node.col,
				"ruka.import(...) is only available when checking a project"
			);
		}

		if (node.args.length !== 1 || node.args[0]!.kind !== "StringLiteral") {
			throw typeError(
				node.line,
				node.col,
				"ruka.import(...) takes a single string literal path"
			);
		}

		const raw = (node.args[0] as StringLiteral).raw;
		if (raw.includes("${")) {
			throw typeError(
				node.line,
				node.col,
				"import path must be a plain string literal (no interpolation)"
			);
		}

		const resolved = resolveImportPath(modulePath, raw);
		if (resolved === null) {
			throw typeError(node.line, node.col, `invalid import path: ${raw}`);
		}
		if (!resolved.endsWith(".ruka")) {
			throw typeError(
				node.line,
				node.col,
				`only .ruka files can be imported (got ${resolved})`
			);
		}
		if (!ctx.sources.has(resolved)) {
			throw typeError(node.line, node.col, `module not found: ${resolved}`);
		}

		const cached = ctx.moduleTypes.get(resolved);
		if (cached) return cached;

		if (ctx.visitingTypes.has(resolved)) {
			throw typeError(
				node.line,
				node.col,
				`cyclic import: ${modulePath} → ${resolved}`
			);
		}

		const importedAst = loadModuleAst(ctx, resolved);
		const error = checkTypes(importedAst, ctx, resolved);
		if (error) {
			// Attach the import call site so the UI can highlight it in the
			// importing file, not just display the error's origin path.
			if (error.importLine === undefined) {
				error.importLine = node.line;
				error.importCol = node.col;
			}
			throw error;
		}

		const built = ctx.moduleTypes.get(resolved);
		if (!built) {
			// Should be unreachable — checkTypes registers the module type
			// on success, and we propagated the error otherwise.
			throw typeError(
				node.line,
				node.col,
				`internal: module type missing for ${resolved}`
			);
		}
		return built;
	}

	// ── Statement checker ───────────────────────────────────────────────
	function checkStatement(node: Statement, env: TypeEnv): void {
		if (node.kind === "Binding" && node.receiver) {
			return checkReceiverBinding(node, env);
		}
		if (node.kind === "Binding") {
			const declared = astToType(node.type);
			const valueType = inferExpression(node.value, declared, env);
			if (node.pattern.kind === "IdentifierPattern") {
				if (valueType && valueType.kind === "variantDef") {
					valueType.name = node.pattern.name;
				}
				if (valueType && valueType.kind === "recordDef") {
					// Tag record types with their declaring scope so private fields
					// can be rejected outside that scope's chain.
					if (!valueType.declEnv) valueType.declEnv = env;
					// If the hoisting pre-pass already created a RecordDef for this
					// name (so methods/statics could be pre-registered on it), update
					// that same object in-place rather than replacing it — otherwise
					// the pre-registered methods would be lost.
					const hoisted = env.bindings[node.pattern.name];
					if (hoisted && hoisted.kind === "recordDef" && hoisted !== valueType) {
						hoisted.fields = valueType.fields;
						if (!hoisted.declEnv) hoisted.declEnv = valueType.declEnv;
						hoisted.name = valueType.name;
						env.bindings[node.pattern.name] = declared || hoisted;
						return;
					}
				}
				env.bindings[node.pattern.name] = declared || valueType;
			} else if (node.pattern.kind === "RecordPattern") {
				const recordDef = resolveRecord(valueType, env);
				if (!recordDef) {
					throw typeError(
						node.line,
						node.col,
						`record destructure expects a record value, got ${typeStr(valueType)}`
					);
				}
				bindRecordFields(node.pattern.names, recordDef, env, node.line, node.col);
			} else if (node.pattern.kind === "TuplePattern") {
				if (!valueType || valueType.kind !== "tuple") {
					throw typeError(
						node.line,
						node.col,
						`tuple destructure expects a tuple value, got ${typeStr(valueType)}`
					);
				}
				if (valueType.elements.length !== node.pattern.names.length) {
					throw typeError(
						node.line,
						node.col,
						`tuple destructure arity mismatch: pattern has ${node.pattern.names.length} name(s), value has ${valueType.elements.length}`
					);
				}
				node.pattern.names.forEach((name, index) => {
					env.bindings[name] = valueType.elements[index]!;
				});
			}
			return;
		}
		if (node.kind === "Assign") {
			const target = lookupEnv(env, node.name);
			inferExpression(node.value, target, env);
			return;
		}
		if (node.kind === "ComplexAssign") {
			// Check the rhs; we can't statically validate the lvalue chain in all cases
			// yet (field assignment checks are tracked in todo.txt), so just infer the
			// target type and use it as the expected type for the value.
			const targetType = inferExpression(node.target, null, env);
			inferExpression(node.value, targetType.kind === "unknown" ? null : targetType, env);
			return;
		}
		if (node.kind === "ExpressionStmt") {
			inferExpression(node.expression, null, env);
			return;
		}
		if (node.kind === "Return") {
			if (returnTypeStack.length === 0) {
				throw typeError(node.line, node.col, "'return' outside function");
			}
			inferExpression(node.value, returnTypeStack[returnTypeStack.length - 1]!, env);
			return;
		}
		if (node.kind === "For") {
			const iterableType = inferExpression(node.iterable, null, env);
			let elementType: CheckedType;
			if (iterableType.kind === "range") {
				elementType = iterableType.element;
			} else if (iterableType.kind === "array") {
				elementType = iterableType.element;
			} else if (iterableType.kind === "string") {
				elementType = { kind: "u8" };
			} else {
				elementType = UNKNOWN;
			}
			const forEnv = extendEnv(env);
			if (node.name) {
				forEnv.bindings[node.name] = elementType;
			} else if (node.tuplePattern) {
				// Destructure tuple elements: each name gets the corresponding element type.
				const elements =
					elementType.kind === "tuple" ? elementType.elements : null;
				node.tuplePattern.forEach((patternName, index) => {
					forEnv.bindings[patternName] = elements?.[index] ?? UNKNOWN;
				});
			}
			for (const inner of node.body) {
				checkStatement(inner, forEnv);
			}
			return;
		}
		if (node.kind === "Defer") {
			inferExpression(node.expression, null, env);
			return;
		}
		// Break / Continue: nothing to check.
	}

	function checkReceiverBinding(
		node: Extract<Statement, { kind: "Binding" }>,
		env: TypeEnv
	): void {
		const receiver = node.receiver!;

		if (receiver.kind === "static") {
			const target = resolveReceiverDef(receiver, env, node.line, node.col)!;
			const staticType = inferExpression(node.value, astToType(node.type), env);
			target.def.statics = target.def.statics ?? Object.create(null);
			const existingStatic = target.def.statics![node.name!];
			if (existingStatic && existingStatic.type.kind !== "unknown") {
				throw typeError(
					node.line,
					node.col,
					`duplicate static '${node.name}' on ${target.name}`
				);
			}
			target.def.statics![node.name!] = {
				type: staticType,
				declEnv: env,
				line: node.line
			};
			receiver.resolvedTypeName = target.name;
			return;
		}

		// self method
		let target = resolveReceiverDef(receiver, env, node.line, node.col);
		if (!target) {
			const fields = collectSelfFields(node.value);
			const seen = new Set<string>();
			const candidates: { name: string; def: RecordDef }[] = [];
			let walk: TypeEnv | null = env;
			while (walk) {
				for (const [name, binding] of Object.entries(walk.bindings)) {
					if (seen.has(name)) {
						continue;
					}
					seen.add(name);
					if (binding && binding.kind === "recordDef") {
						// Skip module-like RecordDefs (no fields, only statics)
						// — they are imported namespaces, not receiver types.
						if (binding.fields.length === 0 && binding.statics && !binding.methods) {
							continue;
						}
						const fieldNames = new Set(binding.fields.map((f) => f.name));
						if (fields.every((f) => fieldNames.has(f))) {
							candidates.push({ name, def: binding });
						}
					}
				}
				walk = walk.parent;
			}
			if (candidates.length === 0) {
				throw typeError(
					node.line,
					node.col,
					`could not infer 'self' type for '${node.name}'; add (self: TypeName)`
				);
			}
			if (candidates.length > 1) {
				throw typeError(
					node.line,
					node.col,
					`ambiguous 'self' type for '${node.name}': ${candidates
						.map((c) => c.name)
						.join(", ")}; add (self: TypeName)`
				);
			}
			target = candidates[0]!;
		}

		const methodEnv = extendEnv(env);
		methodEnv.bindings["self"] = { kind: "named", name: target.name };
		const methodType = inferExpression(node.value, astToType(node.type), methodEnv);
		target.def.methods = target.def.methods ?? Object.create(null);
		const existingMethod = target.def.methods![node.name!];
		// Allow overwriting a pre-pass placeholder (kind: "unknown"), but reject
		// true duplicates (where the existing entry has a resolved type).
		if (existingMethod && existingMethod.type.kind !== "unknown") {
			throw typeError(
				node.line,
				node.col,
				`duplicate method '${node.name}' on ${target.name}`
			);
		}
		target.def.methods![node.name!] = {
			type: methodType,
			declEnv: env,
			line: node.line
		};
		receiver.resolvedTypeName = target.name;
	}

	// ── Interpolation type-check ─────────────────────────────────────────
	function checkInterpolation(
		raw: string,
		env: TypeEnv,
		line: number,
		col: number
	): void {
		const parts = splitInterp(raw);
		for (const part of parts) {
			if ("interp" in part) {
				try {
					const innerAst = parse(tokenize(part.interp));
					for (const statement of innerAst.body) {
						checkStatement(statement, env);
					}
				} catch (error) {
					if (error instanceof RukaError) {
						throw new RukaError(error.message, line, col);
					}
					throw error;
				}
			}
		}
	}

	// ── Function-parameter inference ─────────────────────────────────────
	/**
	 * Pass 1: for each unannotated param, collect field names accessed on it
	 * and find the unique record type in scope that has all of them.
	 */
	function inferParamRecordTypes(
		fn: FunctionExpr,
		fnEnv: TypeEnv
	): Record<string, CheckedType> {
		const fieldUsages: Record<string, string[]> = {};
		fn.params.forEach((paramName, index) => {
			if (!fn.paramTypes[index]) {
				fieldUsages[paramName] = [];
			}
		});
		if (Object.keys(fieldUsages).length === 0) {
			return {};
		}

		// For each unannotated param, track which fields must be numeric (i.e.
		// used as an operand of an arithmetic BinaryOp).
		const numericFields: Record<string, Set<string>> = {};
		for (const paramName of Object.keys(fieldUsages)) {
			numericFields[paramName] = new Set();
		}

		walkExpression(fn.body, (node) => {
			if (
				node.kind === "Member" &&
				(node.object as Ident).kind === "Ident" &&
				fieldUsages[(node.object as Ident).name] !== undefined &&
				!fieldUsages[(node.object as Ident).name]!.includes(node.property)
			) {
				fieldUsages[(node.object as Ident).name]!.push(node.property);
			}
			if (node.kind === "BinaryOp" && ARITHMETIC_OPS.has(node.op)) {
				for (const operand of [node.left, node.right]) {
					if (
						operand.kind === "Member" &&
						(operand.object as Ident).kind === "Ident" &&
						numericFields[(operand.object as Ident).name] !== undefined
					) {
						numericFields[(operand.object as Ident).name]!.add(operand.property);
					}
				}
			}
		});

		// Build the set of all field names declared in any record type in scope.
		// Accesses to non-existent fields aren't allowed to block type inference;
		// the body checker will report them once a type is committed.
		const knownFieldNames = new Set<string>();
		let walk: TypeEnv | null = fnEnv;
		while (walk) {
			for (const binding of Object.values(walk.bindings)) {
				if (binding && binding.kind === "recordDef") {
					for (const field of binding.fields) {
						knownFieldNames.add(field.name);
					}
				}
			}
			walk = walk.parent;
		}

		const inferred: Record<string, CheckedType> = {};
		for (const paramName of Object.keys(fieldUsages)) {
			const fields = fieldUsages[paramName]!;
			if (fields.length === 0) {
				continue;
			}
			const knownAccessed = fields.filter((f) => knownFieldNames.has(f));
			if (knownAccessed.length === 0) {
				throw typeError(
					fn.line,
					fn.col,
					`parameter '${paramName}': no record type in scope has field(s) {${fields.join(", ")}}; add a type annotation`,
					true
				);
			}
			const seen = new Set<string>();
			let candidates: { name: string; def: RecordDef }[] = [];
			let scan: TypeEnv | null = fnEnv;
			while (scan) {
				for (const [name, binding] of Object.entries(scan.bindings)) {
					if (seen.has(name)) {
						continue;
					}
					seen.add(name);
					if (binding && binding.kind === "recordDef") {
						const definedNames = binding.fields.map((f) => f.name);
						if (knownAccessed.every((f) => definedNames.includes(f))) {
							candidates.push({ name, def: binding });
						}
					}
				}
				scan = scan.parent;
			}
			// Narrow by operator constraints: drop candidates whose numeric-required
			// field has a non-numeric type.
			const numericConstraints = numericFields[paramName]!;
			if (numericConstraints.size > 0) {
				candidates = candidates.filter((candidate) =>
					Array.from(numericConstraints).every((fieldName) => {
						const field = candidate.def.fields.find((f) => f.name === fieldName);
						if (!field) {
							return true;
						}
						return isNumericKind(field.type.kind);
					})
				);
			}
			const candidateNames = candidates.map((c) => c.name);
			if (candidates.length === 1) {
				inferred[paramName] = { kind: "named", name: candidateNames[0]! };
			} else if (candidates.length > 1) {
				throw typeError(
					fn.line,
					fn.col,
					`parameter '${paramName}' is ambiguous: could be ${candidateNames.join(
						", "
					)}; add a type annotation`,
					true
				);
			} else {
				throw typeError(
					fn.line,
					fn.col,
					`parameter '${paramName}': no record type in scope has fields {${knownAccessed.join(
						", "
					)}}; add a type annotation`,
					true
				);
			}
		}
		return inferred;
	}

	/**
	 * Pass 2: for each still-unknown param, scan arithmetic BinaryOps where the
	 * other operand's type is now known (using fnEnv populated by pass 1).
	 */
	function inferParamNumericTypes(
		fn: FunctionExpr,
		paramTypes: (CheckedType | null)[],
		fnEnv: TypeEnv
	): Record<string, CheckedType> {
		const inferred: Record<string, CheckedType> = {};
		walkExpression(fn.body, (node) => {
			if (node.kind === "BinaryOp" && ARITHMETIC_OPS.has(node.op)) {
				const pairs: [Expression, Expression][] = [
					[node.left, node.right],
					[node.right, node.left]
				];
				for (const [lhs, rhs] of pairs) {
					if (lhs.kind !== "Ident") {
						continue;
					}
					const paramIndex = fn.params.indexOf(lhs.name);
					if (paramIndex < 0 || paramTypes[paramIndex] || inferred[lhs.name]) {
						continue;
					}
					try {
						const otherType = inferExpression(rhs, null, fnEnv);
						if (isNumericKind(otherType.kind)) {
							inferred[lhs.name] = otherType;
						}
					} catch {
						// Inference is best-effort here; ignore failures.
					}
				}
			}
			// `match <param> with` against numeric range/literal arms tells us
			// the param is numeric — match arms are the only consumers of
			// otherwise-untouched numeric-typed parameters in many programs.
			if (node.kind === "Match" && node.subject.kind === "Ident") {
				const subjectName = node.subject.name;
				const paramIndex = fn.params.indexOf(subjectName);
				if (
					paramIndex < 0 ||
					paramTypes[paramIndex] ||
					inferred[subjectName]
				) {
					return;
				}
				for (const arm of node.arms) {
					const probe =
						arm.pattern.kind === "RangePattern"
							? arm.pattern.low
							: arm.pattern.kind === "LiteralPattern"
								? arm.pattern.expression
								: null;
					if (!probe) {
						continue;
					}
					try {
						const probedType = inferExpression(probe, null, fnEnv);
						if (isNumericKind(probedType.kind)) {
							inferred[subjectName] = probedType;
							break;
						}
					} catch {
						// best-effort
					}
				}
			}
		});
		return inferred;
	}

	/**
	 * Pass 3: for each still-unknown param used as the subject of a `match`
	 * with variant patterns, find the unique variant in scope whose tags
	 * cover every pattern tag used. Mirrors the record-inference shape.
	 */
	function inferParamVariantTypes(
		fn: FunctionExpr,
		paramTypes: (CheckedType | null)[],
		fnEnv: TypeEnv
	): Record<string, CheckedType> {
		const tagUsages: Record<string, Set<string>> = {};
		fn.params.forEach((paramName, index) => {
			if (!paramTypes[index]) {
				tagUsages[paramName] = new Set();
			}
		});
		if (Object.keys(tagUsages).length === 0) {
			return {};
		}

		walkExpression(fn.body, (node) => {
			if (node.kind !== "Match" || node.subject.kind !== "Ident") {
				return;
			}
			const subjectName = node.subject.name;
			const usage = tagUsages[subjectName];
			if (!usage) {
				return;
			}
			for (const arm of node.arms) {
				if (arm.pattern.kind === "VariantPattern") {
					usage.add(arm.pattern.tag);
				}
			}
		});

		const inferred: Record<string, CheckedType> = {};
		for (const paramName of Object.keys(tagUsages)) {
			const tags = tagUsages[paramName]!;
			if (tags.size === 0) {
				continue;
			}
			const seen = new Set<string>();
			const candidates: { name: string; def: VariantDef }[] = [];
			let scan: TypeEnv | null = fnEnv;
			while (scan) {
				for (const [name, binding] of Object.entries(scan.bindings)) {
					if (seen.has(name)) {
						continue;
					}
					seen.add(name);
					if (binding && binding.kind === "variantDef") {
						const definedTags = binding.tags.map((tag) => tag.name);
						if (Array.from(tags).every((tag) => definedTags.includes(tag))) {
							candidates.push({ name, def: binding });
						}
					}
				}
				scan = scan.parent;
			}
			if (candidates.length === 1) {
				inferred[paramName] = { kind: "named", name: candidates[0]!.name };
			} else if (candidates.length > 1) {
				throw typeError(
					fn.line,
					fn.col,
					`parameter '${paramName}' is ambiguous: could be ${candidates
						.map((c) => c.name)
						.join(", ")}; add a type annotation`,
					true
				);
			} else {
				throw typeError(
					fn.line,
					fn.col,
					`parameter '${paramName}': no variant in scope has tags {${Array.from(tags)
						.map((t) => `.${t}`)
						.join(", ")}}; add a type annotation`,
					true
				);
			}
		}
		return inferred;
	}

	// ── Expression inference ─────────────────────────────────────────────
	function inferExpression(
		node: Expression | Block,
		expected: CheckedType | null,
		env: TypeEnv
	): CheckedType {
		switch (node.kind) {
			case "Unit":
				return conform(expected, { kind: "unit" }, node.line, node.col);

			case "Literal": {
				if (typeof node.value === "boolean") {
					return conform(expected, { kind: "bool" }, node.line, node.col);
				}
				// node.isFloat is authoritative — JS numbers don't distinguish
				// integer/float at runtime.
				if (!node.isFloat) {
					if (expected && INT_KINDS.has(expected.kind)) {
						return expected;
					}
					if (expected && expected.kind !== "unknown") {
						throw typeError(
							node.line,
							node.col,
							`expected ${typeStr(expected)}, got integer literal`
						);
					}
					return { kind: "int" };
				}
				if (expected && FLOAT_KINDS.has(expected.kind)) {
					return expected;
				}
				if (expected && expected.kind !== "unknown") {
					throw typeError(
						node.line,
						node.col,
						`expected ${typeStr(expected)}, got float literal`
					);
				}
				return { kind: "float" };
			}

			case "CharLiteral":
				return conform(expected, { kind: "u8" }, node.line, node.col);

			case "StringLiteral":
				checkInterpolation(node.raw, env, node.line, node.col);
				return conform(expected, { kind: "string" }, node.line, node.col);

			case "Ident": {
				const found = lookupEnv(env, node.name);
				if (!found) {
					return UNKNOWN; // scope check already reports undefined
				}
				return conform(expected, found, node.line, node.col);
			}

			case "Block": {
				const blockEnv = extendEnv(env);
				let blockType: CheckedType = { kind: "unit" };
				for (let index = 0; index < node.body.length; index++) {
					const statement = node.body[index]!;
					const isLast = index === node.body.length - 1;
					if (isLast && statement.kind === "ExpressionStmt") {
						blockType = inferExpression(statement.expression, expected, blockEnv);
					} else {
						checkStatement(statement, blockEnv);
					}
				}
				return blockType;
			}

			case "While": {
				inferExpression(node.condition, { kind: "bool" }, env);
				const whileEnv = extendEnv(env);
				let whileType: CheckedType = { kind: "unit" };
				for (let index = 0; index < node.body.length; index++) {
					const statement = node.body[index]!;
					const isLast = index === node.body.length - 1;
					if (isLast && statement.kind === "ExpressionStmt") {
						whileType = inferExpression(statement.expression, null, whileEnv);
					} else {
						checkStatement(statement, whileEnv);
					}
				}
				return whileType;
			}

			case "If": {
				inferExpression(node.condition, { kind: "bool" }, env);
				const thenType = inferExpression(node.thenBranch, expected, env);
				if (node.elseBranch) {
					const elseType = inferExpression(node.elseBranch, expected ?? thenType, env);
					if (
						thenType.kind !== "unknown" &&
						elseType.kind !== "unknown" &&
						!typesEqual(thenType, elseType)
					) {
						throw typeError(
							node.line,
							node.col,
							`if branches differ: ${typeStr(thenType)} vs ${typeStr(elseType)}`
						);
					}
					if (thenType.kind === "unknown") {
						return elseType;
					}
				}
				return thenType;
			}

			case "Range": {
				const startType = inferExpression(node.start, null, env);
				const endType = inferExpression(node.end, startType, env);
				const elementType = startType.kind !== "unknown" ? startType : endType;
				if (
					elementType.kind !== "unknown" &&
					!isNumericKind(elementType.kind) &&
					elementType.kind !== "u8"
				) {
					throw typeError(
						node.line,
						node.col,
						`range bound must be numeric, got ${typeStr(elementType)}`
					);
				}
				return { kind: "range", element: elementType };
			}

			case "ListLiteral": {
				const prefix = node.typePrefix ? astToType(node.typePrefix) : null;

				if (node.shape === "tuple") {
					// Tuple literal `.(a, b, …)`. A type prefix is never produced
					// by the parser for tuples; context only narrows element types.
					const tupleContext =
						expected && expected.kind === "tuple" ? (expected as TupleType) : null;
					if (tupleContext) {
						if (node.elements.length !== tupleContext.elements.length) {
							throw typeError(
								node.line,
								node.col,
								`tuple literal has ${node.elements.length} element(s) but type ${typeStr(
									tupleContext
								)} expects ${tupleContext.elements.length}`
							);
						}
						const inferred = node.elements.map((element, index) =>
							inferExpression(element, tupleContext.elements[index]!, env)
						);
						return conform(
							expected,
							{ kind: "tuple", elements: inferred },
							node.line,
							node.col
						);
					}
					if (node.elements.length === 0) {
						throw typeError(node.line, node.col, "empty .() needs a type context");
					}
					const inferred = node.elements.map((element) =>
						inferExpression(element, null, env)
					);
					return { kind: "tuple", elements: inferred };
				}

				// Array literal `.{a, b, …}`. Element type comes from the prefix,
				// the expected context, or — failing those — the elements themselves
				// (which must be homogeneous).
				const arrayContext =
					(prefix && prefix.kind === "array" ? (prefix as ArrayType) : null) ??
					(expected && expected.kind === "array" ? (expected as ArrayType) : null);
				if (arrayContext) {
					for (const element of node.elements) {
						inferExpression(element, arrayContext.element, env);
					}
					return conform(expected, arrayContext, node.line, node.col);
				}
				if (prefix && prefix.kind !== "array") {
					throw typeError(
						node.line,
						node.col,
						`array literal cannot have non-array prefix ${typeStr(prefix)}`
					);
				}
				if (node.elements.length === 0) {
					throw typeError(
						node.line,
						node.col,
						"empty .{} needs a type context (annotation or [T].{…} prefix)"
					);
				}
				const elementTypes = node.elements.map((element) =>
					inferExpression(element, null, env)
				);
				const first = elementTypes[0]!;
				for (let i = 1; i < elementTypes.length; i++) {
					if (!typesEqual(elementTypes[i]!, first)) {
						throw typeError(
							node.line,
							node.col,
							`array elements must share a type — got ${typeStr(
								first
							)} and ${typeStr(elementTypes[i]!)}`
						);
					}
				}
				return conform(expected, { kind: "array", element: first }, node.line, node.col);
			}

			case "ArrayComp": {
				const iterableType = inferExpression(node.iterable, null, env);
				let elementType: CheckedType;
				if (iterableType.kind === "range") {
					elementType = iterableType.element;
				} else if (iterableType.kind === "array") {
					elementType = iterableType.element;
				} else {
					elementType = UNKNOWN;
				}

				const compEnv = extendEnv(env);
				if (node.name) {
					compEnv.bindings[node.name] = elementType;
				} else if (node.tuplePattern) {
					const elements = elementType.kind === "tuple" ? elementType.elements : null;
					node.tuplePattern.forEach((patternName, index) => {
						compEnv.bindings[patternName] = elements?.[index] ?? UNKNOWN;
					});
				}

				const prefix = node.typePrefix ? astToType(node.typePrefix) : null;
				const bodyExpected =
					prefix && prefix.kind === "array"
						? (prefix as ArrayType).element
						: expected && expected.kind === "array"
							? (expected as ArrayType).element
							: null;

				const bodyType = inferExpression(node.body, bodyExpected, compEnv);
				const resultType: CheckedType = { kind: "array", element: bodyType };
				return conform(expected, resultType, node.line, node.col);
			}

			case "Index": {
				const objectType = inferExpression(node.object, null, env);

				// Map indexing: infer the index against the key type, return value type.
				if (objectType.kind === "map") {
					inferExpression(node.index, objectType.key, env);
					return conform(expected, objectType.value, node.line, node.col);
				}

				const indexType = inferExpression(node.index, null, env);
				if (indexType.kind === "range") {
					if (objectType.kind === "string") {
						return conform(expected, { kind: "string" }, node.line, node.col);
					}
					if (objectType.kind === "array") {
						return conform(expected, objectType, node.line, node.col);
					}
					return UNKNOWN;
				}
				if (
					indexType.kind !== "unknown" &&
					!INT_KINDS.has(indexType.kind) &&
					indexType.kind !== "u8"
				) {
					throw typeError(
						node.line,
						node.col,
						`index must be integer, got ${typeStr(indexType)}`
					);
				}
				if (objectType.kind === "string") {
					return conform(expected, { kind: "u8" }, node.line, node.col);
				}
				if (objectType.kind === "array") {
					return conform(expected, objectType.element, node.line, node.col);
				}
				if (objectType.kind === "tuple") {
					return UNKNOWN; // needs literal-index resolution
				}
				return UNKNOWN;
			}

			case "Member": {
				const objectType = inferExpression(node.object, null, env);
				const memberType = methodOf(objectType, node.property, node.line, node.col, env);
				return conform(expected, memberType, node.line, node.col);
			}

			case "Call": {
				if (isRukaImportCall(node)) {
					const moduleType = resolveImport(node);
					return conform(expected, moduleType, node.line, node.col);
				}
				const calleeType = inferExpression(node.callee, null, env);
				if (calleeType.kind === "fn") {
					const params = calleeType.params;
					if (node.args.length !== params.length) {
						throw typeError(
							node.line,
							node.col,
							`expected ${params.length} arg(s), got ${node.args.length}`
						);
					}
					for (let index = 0; index < node.args.length; index++) {
						inferExpression(node.args[index]!, params[index]!, env);
					}
					return conform(expected, calleeType.returnType, node.line, node.col);
				}
				// Unknown callee — check if it is a user-defined variant constructor.
				if (calleeType.kind === "unknown" && node.callee.kind === "Ident") {
					const tag = node.callee.name;
					// Check expected type for a hint first.
					if (expected && expected.kind === "named") {
						const varDef = lookupEnv(env, expected.name);
						if (varDef && varDef.kind === "variantDef") {
							const tagDef = varDef.tags.find((t) => t.name === tag);
							if (tagDef) {
								if (tagDef.type && node.args.length === 1) {
									inferExpression(node.args[0]!, tagDef.type, env);
								}
								return conform(expected, { kind: "named", name: expected.name }, node.line, node.col);
							}
						}
					}
					// Scan all variant defs in scope.
					const variantCandidates: { name: string; tagDef: { name: string; type: CheckedType | null } }[] = [];
					const seenVarNames = new Set<string>();
					let scanEnv: TypeEnv | null = env;
					while (scanEnv) {
						for (const [name, binding] of Object.entries(scanEnv.bindings)) {
							if (seenVarNames.has(name)) continue;
							seenVarNames.add(name);
							if (binding && binding.kind === "variantDef") {
								const tagDef = binding.tags.find((t) => t.name === tag);
								if (tagDef) variantCandidates.push({ name, tagDef });
							}
						}
						scanEnv = scanEnv.parent;
					}
					if (variantCandidates.length > 1) {
						throw typeError(
							node.line,
							node.col,
							`ambiguous constructor '${tag}': could be ${variantCandidates.map((c) => c.name).join(" or ")}`
						);
					}
					if (variantCandidates.length === 1) {
						const { name: varName, tagDef } = variantCandidates[0]!;
						if (tagDef.type && node.args.length === 1) {
							inferExpression(node.args[0]!, tagDef.type, env);
						}
						return conform(expected, { kind: "named", name: varName }, node.line, node.col);
					}
				}
				// Unknown callee — still walk args so nested expressions get checked.
				for (const arg of node.args) {
					inferExpression(arg, null, env);
				}
				return UNKNOWN;
			}

			case "FunctionExpr": {
				const fnEnv = extendEnv(env);
				const paramTypes: (CheckedType | null)[] = [];
				for (let index = 0; index < node.params.length; index++) {
					const annotated = astToType(node.paramTypes[index]);
					paramTypes.push(annotated);
					fnEnv.bindings[node.params[index]!] = annotated ?? UNKNOWN;
				}

				// Infer unannotated parameter types from the function body.
				if (node.params.some((_, index) => !node.paramTypes[index])) {
					const recordInferred = inferParamRecordTypes(node, fnEnv);
					node.params.forEach((paramName, index) => {
						if (!paramTypes[index] && recordInferred[paramName]) {
							paramTypes[index] = recordInferred[paramName]!;
							fnEnv.bindings[paramName] = recordInferred[paramName]!;
						}
					});
					const numericInferred = inferParamNumericTypes(node, paramTypes, fnEnv);
					node.params.forEach((paramName, index) => {
						if (!paramTypes[index] && numericInferred[paramName]) {
							paramTypes[index] = numericInferred[paramName]!;
							fnEnv.bindings[paramName] = numericInferred[paramName]!;
						}
					});
					const variantInferred = inferParamVariantTypes(node, paramTypes, fnEnv);
					node.params.forEach((paramName, index) => {
						if (!paramTypes[index] && variantInferred[paramName]) {
							paramTypes[index] = variantInferred[paramName]!;
							fnEnv.bindings[paramName] = variantInferred[paramName]!;
						}
					});
				}

				const declaredReturn = astToType(node.returnType);
				returnTypeStack.push(declaredReturn ?? UNKNOWN);
				let bodyType: CheckedType;
				try {
					bodyType = inferExpression(node.body, declaredReturn, fnEnv);
				} finally {
					returnTypeStack.pop();
				}
				return {
					kind: "fn",
					params: paramTypes.map((t) => t ?? UNKNOWN),
					returnType: declaredReturn ?? bodyType
				};
			}

			case "BinaryOp": {
				const op = node.op;
				if (op === "and" || op === "or") {
					inferExpression(node.left, { kind: "bool" }, env);
					inferExpression(node.right, { kind: "bool" }, env);
					return conform(expected, { kind: "bool" }, node.line, node.col);
				}
				if (
					op === "==" ||
					op === "!=" ||
					op === "<" ||
					op === ">" ||
					op === "<=" ||
					op === ">="
				) {
					const leftType = inferExpression(node.left, null, env);
					inferExpression(node.right, leftType, env);
					return conform(expected, { kind: "bool" }, node.line, node.col);
				}
				// Arithmetic. Strings no longer concat with `+`; use s.concat(...).
				const hint = expected && isNumericKind(expected.kind) ? expected : null;
				const leftType = inferExpression(node.left, hint, env);
				const rightType = inferExpression(
					node.right,
					leftType.kind === "unknown" ? hint : leftType,
					env
				);
				const result = leftType.kind !== "unknown" ? leftType : rightType;
				if (op === "+" && (leftType.kind === "string" || rightType.kind === "string")) {
					throw typeError(
						node.line,
						node.col,
						"'+' does not concatenate strings — use s.concat(...) instead"
					);
				}
				if (
					result.kind !== "unknown" &&
					!isNumericKind(result.kind) &&
					result.kind !== "u8"
				) {
					throw typeError(
						node.line,
						node.col,
						`${op} requires numeric operands, got ${typeStr(result)}`
					);
				}
				return conform(expected, result, node.line, node.col);
			}

			case "UnaryOp": {
				if (node.op === "-") {
					// UnaryOp has no `line` of its own; defer the line to the operand.
					const inferredType = inferExpression(node.expression, expected, env);
					if (inferredType.kind !== "unknown" && !isNumericKind(inferredType.kind)) {
						throw typeError(
							lineOf(node.expression),
							colOf(node.expression),
							`unary - requires numeric, got ${typeStr(inferredType)}`
						);
					}
					return inferredType;
				}
				if (node.op === "not") {
					inferExpression(node.expression, { kind: "bool" }, env);
					return conform(
						expected,
						{ kind: "bool" },
						lineOf(node.expression),
						colOf(node.expression)
					);
				}
				return UNKNOWN;
			}

			case "VariantType": {
				const variantTags = node.tags.map((tag) => ({
					name: tag.name,
					type: tag.type ? astToType(tag.type) : null,
					local: tag.local || undefined
				}));
				const definition: VariantDef = { kind: "variantDef", tags: variantTags };
				return definition;
			}

			case "VariantConstructor": {
				// Built-in option constructors: some(T) and none.
				if (node.tag === "some" || node.tag === "none") {
					const innerHint =
						expected && expected.kind === "option" ? expected.inner : null;
					if (node.tag === "some") {
						if (!node.payload) {
							throw typeError(node.line, node.col, "some requires a payload");
						}
						const actualInner = inferExpression(node.payload, innerHint, env);
						node.resolvedTypeName = "option";
						return conform(
							expected,
							{ kind: "option", inner: actualInner },
							node.line,
							node.col
						);
					} else {
						if (node.payload) {
							throw typeError(node.line, node.col, "none takes no payload");
						}
						node.resolvedTypeName = "option";
						return conform(
							expected,
							{ kind: "option", inner: innerHint ?? UNKNOWN },
							node.line,
							node.col
						);
					}
				}
				// Built-in result constructors: ok(T) and err(E).
				if (node.tag === "ok" || node.tag === "err") {
					const okHint =
						expected && expected.kind === "result" ? expected.ok : null;
					const errHint =
						expected && expected.kind === "result" ? expected.err : null;
					if (node.tag === "ok") {
						if (!node.payload) {
							throw typeError(node.line, node.col, "ok requires a payload");
						}
						const actualOk = inferExpression(node.payload, okHint, env);
						node.resolvedTypeName = "result";
						return conform(
							expected,
							{ kind: "result", ok: actualOk, err: errHint ?? UNKNOWN },
							node.line,
							node.col
						);
					} else {
						if (!node.payload) {
							throw typeError(node.line, node.col, "err requires a payload");
						}
						const actualErr = inferExpression(node.payload, errHint, env);
						node.resolvedTypeName = "result";
						return conform(
							expected,
							{ kind: "result", ok: okHint ?? UNKNOWN, err: actualErr },
							node.line,
							node.col
						);
					}
				}

				// Resolve which variant type owns this tag. Use the expected type as
				// a hint; otherwise scan scope for a unique match.
				let definition: VariantDef | null = null;
				let definitionName: string | null = null;
				if (expected && expected.kind === "named") {
					const looked = lookupEnv(env, expected.name);
					if (looked && looked.kind === "variantDef") {
						definition = looked;
						definitionName = expected.name;
					}
				}
				if (!definition) {
					const seen = new Set<string>();
					const candidates: { name: string; def: VariantDef }[] = [];
					let walk: TypeEnv | null = env;
					while (walk) {
						for (const [name, binding] of Object.entries(walk.bindings)) {
							if (seen.has(name)) {
								continue;
							}
							seen.add(name);
							if (!binding || binding.kind !== "variantDef") {
								continue;
							}
							if (binding.tags.some((tag) => tag.name === node.tag)) {
								candidates.push({ name, def: binding });
							}
						}
						walk = walk.parent;
					}
					if (candidates.length === 0) {
						throw typeError(
							node.line,
							node.col,
							`no variant in scope has tag '.${node.tag}'`
						);
					}
					if (candidates.length > 1) {
						throw typeError(
							node.line,
							node.col,
							`ambiguous constructor '.${node.tag}': could be ${candidates
								.map((c) => c.name)
								.join(" or ")}`
						);
					}
					definition = candidates[0]!.def;
					definitionName = candidates[0]!.name;
				}
				const tagDefinition = definition.tags.find((tag) => tag.name === node.tag);
				if (!tagDefinition) {
					throw typeError(
						node.line,
						node.col,
						`no tag '.${node.tag}' in ${definitionName}`,
						true
					);
				}
				if (node.payload && !tagDefinition.type) {
					throw typeError(node.line, node.col, `tag '.${node.tag}' takes no payload`);
				}
				if (!node.payload && tagDefinition.type) {
					throw typeError(node.line, node.col, `tag '.${node.tag}' requires a payload`);
				}
				if (node.payload) {
					inferExpression(node.payload, tagDefinition.type, env);
				}
				node.resolvedTypeName = definitionName!;
				return conform(
					expected,
					{ kind: "named", name: definitionName! },
					node.line,
					node.col
				);
			}

			case "Match": {
				const subjectType = inferExpression(node.subject, null, env);

				// A statically-typed match needs a known subject type to
				// validate patterns and prove exhaustiveness. If we got here
				// with `unknown` it means inference (annotations, record/
				// numeric/variant param passes) failed to pin it down.
				if (subjectType.kind === "unknown") {
					throw typeError(
						node.line,
						node.col,
						"cannot match on a value of unknown type; add a type annotation",
						true
					);
				}

				// Resolve a variant subject to its definition so we can
				// validate tags and check exhaustiveness. Named types are
				// looked up in the env; primitives/records/etc. yield null.
				// Built-in option/result types also produce synthetic defs.
				let variantDef: VariantDef | null = null;
				let variantName: string | null = null;
				if (subjectType.kind === "variantDef") {
					variantDef = subjectType;
					variantName = subjectType.name ?? "<variant>";
				} else if (subjectType.kind === "named") {
					const looked = lookupEnv(env, subjectType.name);
					if (looked && looked.kind === "variantDef") {
						variantDef = looked;
						variantName = subjectType.name;
					}
				} else if (subjectType.kind === "option") {
					variantDef = {
						kind: "variantDef",
						tags: [
							{ name: "some", type: subjectType.inner },
							{ name: "none", type: null }
						]
					};
					variantName = "option";
				} else if (subjectType.kind === "result") {
					variantDef = {
						kind: "variantDef",
						tags: [
							{ name: "ok", type: subjectType.ok },
							{ name: "err", type: subjectType.err }
						]
					};
					variantName = "result";
				}

				// `expected` for literal/range patterns: use the subject type
				// when known so a wrong-type literal (e.g. `"a"` matching an
				// int subject) is rejected by `conform`. Skip for variant
				// subjects — variant constructors are validated explicitly.
				const patternExpected: CheckedType | null = variantDef ? null : subjectType;

				const coveredTags = new Set<string>();
				let matchType: CheckedType = UNKNOWN;
				for (const arm of node.arms) {
					const armEnv = extendEnv(env);
					if (arm.pattern.kind === "VariantPattern") {
						const variantPattern = arm.pattern;
						if (variantDef) {
							const tagDef = variantDef.tags.find(
								(tag) => tag.name === variantPattern.tag
							);
							if (!tagDef) {
								throw typeError(
									node.line,
									node.col,
									`no tag '.${variantPattern.tag}' in ${variantName}`
								);
							}
							if (variantPattern.binding && !tagDef.type) {
								throw typeError(
									node.line,
									node.col,
									`tag '.${variantPattern.tag}' has no payload to bind`
								);
							}
							if (!variantPattern.binding && tagDef.type) {
								throw typeError(
									node.line,
									node.col,
									`tag '.${variantPattern.tag}' has a payload; use '${variantPattern.tag}(_)' to ignore it`
								);
							}
							coveredTags.add(variantPattern.tag);
							if (variantPattern.binding) {
								const payloadType = tagDef.type ?? UNKNOWN;
								const binding = variantPattern.binding;
								if (binding.kind === "BindingPattern") {
									armEnv.bindings[binding.name] = payloadType;
								} else if (binding.kind === "RecordPattern") {
									const recordDef = resolveRecord(payloadType, env);
									if (!recordDef) {
										throw typeError(
											node.line,
											node.col,
											`tag '.${variantPattern.tag}' payload is ${typeStr(payloadType)}, not a record`
										);
									}
									bindRecordFields(
										binding.names,
										recordDef,
										armEnv,
										node.line,
										node.col
									);
								} else {
									// TuplePattern
									if (payloadType.kind !== "tuple") {
										throw typeError(
											node.line,
											node.col,
											`tag '.${variantPattern.tag}' payload is ${typeStr(payloadType)}, not a tuple`
										);
									}
									if (payloadType.elements.length !== binding.names.length) {
										throw typeError(
											node.line,
											node.col,
											`tuple destructure arity mismatch on '.${variantPattern.tag}': pattern has ${binding.names.length} name(s), payload has ${payloadType.elements.length}`
										);
									}
									binding.names.forEach((name, index) => {
										armEnv.bindings[name] = payloadType.elements[index]!;
									});
								}
							}
						} else {
							throw typeError(
								node.line,
								node.col,
								`pattern '.${variantPattern.tag}' cannot match non-variant ${typeStr(subjectType)}`
							);
						}
					}
					if (arm.pattern.kind === "GuardPattern") {
						inferExpression(arm.pattern.expression, { kind: "bool" }, env);
					}
					if (arm.pattern.kind === "LiteralPattern") {
						if (variantDef) {
							throw typeError(
								node.line,
								node.col,
								`literal pattern cannot match variant ${variantName}`
							);
						}
						inferExpression(arm.pattern.expression, patternExpected, env);
					}
					if (arm.pattern.kind === "RangePattern") {
						if (variantDef) {
							throw typeError(
								node.line,
								node.col,
								`range pattern cannot match variant ${variantName}`
							);
						}
						inferExpression(arm.pattern.low, patternExpected, env);
						inferExpression(arm.pattern.high, patternExpected, env);
					}
					const armBodyType = inferExpression(arm.body, expected, armEnv);
					if (matchType.kind === "unknown") {
						matchType = armBodyType;
					}
				}
				if (node.elseArm) {
					inferExpression(node.elseArm, expected ?? matchType, env);
				} else if (variantDef) {
					const missing = variantDef.tags
						.filter((tag) => !coveredTags.has(tag.name))
						.map((tag) => `.${tag.name}`);
					if (missing.length > 0) {
						throw typeError(
							node.line,
							node.col,
							`non-exhaustive match on ${variantName}: missing ${missing.join(", ")}`
						);
					}
				} else {
					// Non-variant subjects (ints, strings, …) can't be
					// enumerated, so an else arm is required.
					throw typeError(
						node.line,
						node.col,
						`non-exhaustive match on ${typeStr(subjectType)}: add an 'else' arm`
					);
				}
				return conform(expected, matchType, node.line, node.col);
			}

			case "RecordType": {
				const recordFields = node.fields.map((field) => ({
					name: field.name,
					type: astToType(field.type) ?? UNKNOWN,
					local: field.local || undefined
				}));
				const definition: RecordDef = { kind: "recordDef", fields: recordFields };
				return definition;
			}

			case "RecordLiteral": {
				// Resolve the target record type — either from the explicit typeName
				// (Thing.{...}) or from the expected type annotation.
				let definition: RecordDef | null = null;
				let namedRecordName: string | null = null;
				if (node.typeName && node.typeName.kind === "Ident") {
					const looked = lookupEnv(env, node.typeName.name);
					if (looked && looked.kind === "recordDef") {
						definition = looked;
						namedRecordName = node.typeName.name;
					} else if (looked && looked.kind !== "unknown") {
						throw typeError(
							node.line,
							node.col,
							`'${node.typeName.name}' is not a record type`
						);
					}
				} else if (node.typeName && node.typeName.kind === "RecordType") {
					// Inline: `record { ... } { field = val }` — anonymous record type.
					definition = {
						kind: "recordDef",
						fields: node.typeName.fields.map((f) => ({
							name: f.name,
							type: astToType(f.type) ?? UNKNOWN
						}))
					};
				} else if (expected && expected.kind === "named") {
					const looked = lookupEnv(env, expected.name);
					if (looked && looked.kind === "recordDef") {
						definition = looked;
						namedRecordName = expected.name;
					}
				}
				if (definition) {
					if (definition.fields.length === 0) {
						throw typeError(
							node.line,
							node.col,
							`cannot instantiate empty record type; use it as a type marker only`
						);
					}
					const fieldByName: Record<string, { name: string; type: CheckedType }> =
						Object.create(null);
					for (const field of definition.fields) {
						fieldByName[field.name] = field;
					}
					for (const field of node.fields) {
						if (!fieldByName[field.name]) {
							throw typeError(
								node.line,
								node.col,
								`unknown field '${field.name}' in record literal`
							);
						}
					}
					const provided = new Set(node.fields.map((field) => field.name));
					for (const definedField of definition.fields) {
						if (!provided.has(definedField.name)) {
							throw typeError(
								node.line,
								node.col,
								`record literal missing field '${definedField.name}'`
							);
						}
					}
					for (const field of node.fields) {
						inferExpression(field.value, fieldByName[field.name]!.type, env);
					}
					// Inline anonymous record types: return the def so downstream
					// checks (e.g. cast validation) can inspect the type.
					if (!namedRecordName) {
						return definition;
					}
					node.resolvedTypeName = namedRecordName;
					return conform(
						expected,
						{ kind: "named", name: namedRecordName },
						node.line,
						node.col
					);
				}

				// No explicit type context — scan record types in scope.
				const literalFieldNames = node.fields
					.map((field) => field.name)
					.slice()
					.sort()
					.join(",");
				const literalFieldByName: Record<string, { name: string; value: Expression }> =
					Object.create(null);
				for (const field of node.fields) {
					literalFieldByName[field.name] = field;
				}

				const seen = new Set<string>();
				const candidates: { name: string; def: RecordDef }[] = [];
				let walk: TypeEnv | null = env;
				while (walk) {
					for (const [name, binding] of Object.entries(walk.bindings)) {
						if (seen.has(name)) {
							continue;
						}
						seen.add(name);
						if (binding && binding.kind === "recordDef") {
							candidates.push({ name, def: binding });
						}
					}
					walk = walk.parent;
				}

				const matches = candidates.filter((candidate) => {
					const definedNames = candidate.def.fields
						.map((field) => field.name)
						.slice()
						.sort()
						.join(",");
					if (definedNames !== literalFieldNames) {
						return false;
					}
					try {
						for (const definedField of candidate.def.fields) {
							inferExpression(
								literalFieldByName[definedField.name]!.value,
								definedField.type,
								env
							);
						}
						return true;
					} catch (error) {
						if (error instanceof RukaError && error.fatal) {
							throw error;
						}
						return false;
					}
				});

				if (matches.length === 0) {
					// A single bare identifier `{ x }` is ambiguous between a one-element
					// array and a record shorthand; give a descriptive error.
					const isSingleShorthand =
						node.fields.length === 1 &&
						node.fields[0]!.value.kind === "Ident" &&
						node.fields[0]!.name === (node.fields[0]!.value as { name: string }).name;
					if (isSingleShorthand) {
						throw typeError(
							node.line,
							node.col,
							`ambiguous: '{${node.fields[0]!.name}}' could be a one-element array or a record shorthand; add a type annotation or use 'Type{...}' to specify`
						);
					}
					throw typeError(
						node.line,
						node.col,
						"no record type in scope matches this literal"
					);
				}
				if (matches.length > 1) {
					throw typeError(
						node.line,
						node.col,
						`ambiguous record literal: matches ${matches
							.map((m) => m.name)
							.join(", ")}; use Type.{...} to specify`
					);
				}

				const inferred = matches[0]!;
				for (const definedField of inferred.def.fields) {
					inferExpression(
						literalFieldByName[definedField.name]!.value,
						definedField.type,
						env
					);
				}
				node.resolvedTypeName = inferred.name;
				return conform(
					expected,
					{ kind: "named", name: inferred.name },
					node.line,
					node.col
				);
			}

			case "BehaviourType":
				// Behaviour type definitions are not yet type-checked in detail.
				return { kind: "unknown" };

			case "MapLiteral": {
				const expectedMap = expected && expected.kind === "map" ? expected : null;
				const prefix = node.typePrefix ? astToType(node.typePrefix) : null;
				const mapType = (prefix && prefix.kind === "map" ? prefix : expectedMap) ?? null;

				let inferredKey: CheckedType = UNKNOWN;
				let inferredValue: CheckedType = UNKNOWN;
				for (const entry of node.entries) {
					const k = inferExpression(entry.key, mapType?.key ?? null, env);
					const v = inferExpression(entry.value, mapType?.value ?? null, env);
					if (inferredKey.kind === "unknown") inferredKey = k;
					if (inferredValue.kind === "unknown") inferredValue = v;
				}
				const resultKey = mapType?.key ?? inferredKey;
				const resultValue = mapType?.value ?? inferredValue;
				return conform(
					expected,
					{ kind: "map", key: resultKey, value: resultValue },
					node.line,
					node.col
				);
			}

			case "MapComp": {
				const compMap = expected && expected.kind === "map" ? expected : null;
				const compPrefix = node.typePrefix ? astToType(node.typePrefix) : null;
				const mapTypeHint = (compPrefix && compPrefix.kind === "map" ? compPrefix : compMap) ?? null;

				const iterableType = inferExpression(node.iterable, null, env);
				const compEnv = extendEnv(env);
				const compElemType: CheckedType =
					iterableType.kind === "array" || iterableType.kind === "range"
						? iterableType.element
						: iterableType.kind === "string"
							? { kind: "u8" }
							: UNKNOWN;
				if (node.name) {
					compEnv.bindings[node.name] = compElemType;
				} else if (node.tuplePattern) {
					for (const name of node.tuplePattern) {
						compEnv.bindings[name] = UNKNOWN;
					}
				}
				const keyType = inferExpression(node.keyBody, mapTypeHint?.key ?? null, compEnv);
				const valueType = inferExpression(node.valueBody, mapTypeHint?.value ?? null, compEnv);
				if (node.filter) inferExpression(node.filter, { kind: "bool" }, compEnv);
				return conform(
					expected,
					{ kind: "map", key: keyType, value: valueType },
					node.line,
					node.col
				);
			}

			case "Cast": {
				inferExpression(node.value, null, env);
				const targetType = astToType(node.type);
				if (!targetType) return UNKNOWN;
				// Validate that common invalid casts are caught.
				const fromType = inferExpression(node.value, null, env);
				const isNumeric = (t: CheckedType | null) =>
					t &&
					(t.kind === "i32" ||
						t.kind === "i64" ||
						t.kind === "f32" ||
						t.kind === "f64" ||
						t.kind === "u8" ||
						t.kind === "int" ||
						t.kind === "float");
				const isString = (t: CheckedType | null) => t && t.kind === "string";
				if (isString(fromType) && isNumeric(targetType)) {
					throw typeError(node.line, node.col, `cannot cast ${typeStr(fromType)} to ${typeStr(targetType)}`);
				}
				if (fromType && fromType.kind === "recordDef") {
					throw typeError(node.line, node.col, `cannot cast ${typeStr(fromType)} to ${typeStr(targetType)}`);
				}
				return targetType ?? UNKNOWN;
			}
		}
		return UNKNOWN;
	}
}

// ── Line lookup for unanchored AST nodes (BinaryOp/UnaryOp/Block) ───────
function lineOf(node: Expression | Block): number {
	if ("line" in node && typeof (node as { line?: number }).line === "number") {
		return (node as { line: number }).line;
	}
	if (node.kind === "BinaryOp") {
		return lineOf(node.left);
	}
	if (node.kind === "UnaryOp") {
		return lineOf(node.expression);
	}
	if (node.kind === "Block") {
		return node.body[0] ? (node.body[0] as { line: number }).line : 0;
	}
	return 0;
}

function colOf(node: Expression | Block): number {
	if ("col" in node && typeof (node as { col?: number }).col === "number") {
		return (node as { col: number }).col;
	}
	if (node.kind === "BinaryOp") {
		return colOf(node.left);
	}
	if (node.kind === "UnaryOp") {
		return colOf(node.expression);
	}
	if (node.kind === "Block") {
		return node.body[0] ? (node.body[0] as { col: number }).col : 0;
	}
	return 0;
}
