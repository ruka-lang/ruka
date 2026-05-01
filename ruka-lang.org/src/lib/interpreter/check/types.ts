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
	Expression,
	FunctionExpr,
	Ident,
	Member,
	Program,
	Receiver,
	Statement
} from "../ast";
import { RukaError } from "../diagnostics";
import { splitInterp } from "../interpolator";
import { parse } from "../parser";
import { tokenize } from "../tokenizer";
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
	type ModuleType,
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
		if (name === "length") {
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
		if (name === "length") {
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

	if (object.kind === "module") {
		const member = object.members[name];
		if (member) {
			return member;
		}
		throw typeError(line, col, `no member '${name}' on module`);
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
				if (isPrivateName(name) && !envContains(env, definition.declEnv)) {
					throw typeError(
						line,
						col,
						`field '${name}' on '${object.name}' is private`,
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
			throw typeError(
				line,
				col,
				`no field or method '${name}' on ${object.name}`,
				true
			);
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

function walkExpression(node: Expression | Block | null | undefined, visit: Visitor): void {
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
	}
}

// ── Top-level entry point ────────────────────────────────────────────────
const ARITHMETIC_OPS = new Set(["+", "-", "*", "/", "%", "**"]);

/**
 * Walk the AST inferring and checking types.
 * Returns the first violation, or null if the program type-checks.
 */
export function checkTypes(ast: Program): RukaError | null {
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

	const rukaModule: ModuleType = {
		kind: "module",
		members: {
			println: { kind: "fn", params: [UNKNOWN], returnType: { kind: "unit" } },
			print: { kind: "fn", params: [UNKNOWN], returnType: { kind: "unit" } },
			read: { kind: "fn", params: [], returnType: { kind: "string" } },
			readln: { kind: "fn", params: [], returnType: { kind: "string" } },
			expect_eq: unknownFn2,
			abs: unknownFn1,
			sin: numericFn1,
			cos: numericFn1,
			tan: numericFn1,
			sqrt: numericFn1,
			floor: numericFn1,
			ceil: numericFn1,
			min: unknownFn2,
			max: unknownFn2,
			pow: numericFn2
		}
	};

	const topEnv: TypeEnv = { bindings: Object.create(null), parent: null };
	topEnv.bindings["ruka"] = rukaModule;
	topEnv.bindings["true"] = { kind: "bool" };
	topEnv.bindings["false"] = { kind: "bool" };
	topEnv.bindings["self"] = UNKNOWN;

	// Hoist top-level names — annotated bindings get precise types; others are
	// unknown until the second pass refines them. Receiver bindings are attached
	// to their target type later, not bound by their bare name.
	for (const statement of ast.body) {
		if (statement.kind === "Binding" && !statement.receiver) {
			const hoisted = astToType(statement.type) ?? UNKNOWN;
			if (statement.pattern.kind === "IdentifierPattern") {
				topEnv.bindings[statement.pattern.name] = hoisted;
			} else if (statement.pattern.kind === "TuplePattern") {
				for (const name of statement.pattern.names) {
					topEnv.bindings[name] = UNKNOWN;
				}
			}
		}
	}

	// Stack of expected return types for the enclosing function(s). Top is the
	// innermost fn. Empty = `return` at file scope, which is a hard error.
	const returnTypeStack: CheckedType[] = [];

	try {
		for (const statement of ast.body) {
			checkStatement(statement, topEnv);
		}
		return null;
	} catch (error) {
		if (error instanceof RukaError) {
			return error;
		}
		throw error;
	}

	// ── Self-field collection (for self-method type inference) ───────────
	function collectSelfFields(node: unknown, accumulator: string[] = []): string[] {
		if (!node || typeof node !== "object") {
			return accumulator;
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
			if (
				!looked ||
				(looked.kind !== "recordDef" && looked.kind !== "variantDef")
			) {
				throw typeError(
					line,
					col,
					`static receiver '${receiver.typeName}' is not a record/variant type`
				);
			}
			return { name: receiver.typeName, def: looked };
		}
		// self-method: explicit annotation or inference.
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
		return null; // caller handles inference
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
				// Tag record types with their declaring scope so private fields
				// can be rejected outside that scope's chain.
				if (
					valueType &&
					valueType.kind === "recordDef" &&
					!valueType.declEnv
				) {
					valueType.declEnv = env;
				}
				env.bindings[node.pattern.name] = declared || valueType;
			} else if (node.pattern.kind === "TuplePattern") {
				// Same `{a, b}` syntax destructures both tuples (positional) and
				// records (by field name). Distinguish by the value's type.
				let recordDef: RecordDef | null = null;
				if (valueType && valueType.kind === "recordDef") {
					recordDef = valueType;
				} else if (valueType && valueType.kind === "named") {
					const looked = lookupEnv(env, valueType.name);
					if (looked && looked.kind === "recordDef") {
						recordDef = looked;
					}
				}
				if (recordDef) {
					const fieldByName: Record<string, { name: string; type: CheckedType }> =
						Object.create(null);
					for (const field of recordDef.fields) {
						fieldByName[field.name] = field;
					}
					for (const name of node.pattern.names) {
						const field = fieldByName[name];
						if (!field) {
							throw typeError(node.line, node.col, `no field '${name}' on record`);
						}
						if (isPrivateName(name) && !envContains(env, recordDef.declEnv)) {
							throw typeError(
								node.line,
								node.col,
								`field '${name}' is private and cannot be destructured here`
							);
						}
						env.bindings[name] = field.type;
					}
				} else {
					const elementTypes =
						valueType && valueType.kind === "tuple" ? valueType.elements : [];
					node.pattern.names.forEach((name, index) => {
						env.bindings[name] = elementTypes[index] ?? UNKNOWN;
					});
				}
			}
			return;
		}
		if (node.kind === "Assign") {
			const target = lookupEnv(env, node.name);
			inferExpression(node.value, target, env);
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
			inferExpression(
				node.value,
				returnTypeStack[returnTypeStack.length - 1]!,
				env
			);
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
			}
			for (const inner of node.body) {
				checkStatement(inner, forEnv);
			}
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
			if (target.def.statics![node.name!]) {
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
		if (target.def.methods![node.name!]) {
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
	function checkInterpolation(raw: string, env: TypeEnv, line: number, col: number): void {
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
			if (node.kind !== "BinaryOp" || !ARITHMETIC_OPS.has(node.op)) {
				return;
			}
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
		});
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
					const elseType = inferExpression(
						node.elseBranch,
						expected ?? thenType,
						env
					);
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
						throw typeError(
							node.line,
							node.col,
							"empty .() needs a type context"
						);
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
				return conform(
					expected,
					{ kind: "array", element: first },
					node.line,
					node.col
				);
			}

			case "Index": {
				const objectType = inferExpression(node.object, null, env);
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
					const numericInferred = inferParamNumericTypes(
						node,
						paramTypes,
						fnEnv
					);
					node.params.forEach((paramName, index) => {
						if (!paramTypes[index] && numericInferred[paramName]) {
							paramTypes[index] = numericInferred[paramName]!;
							fnEnv.bindings[paramName] = numericInferred[paramName]!;
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
				const hint =
					expected && isNumericKind(expected.kind) ? expected : null;
				const leftType = inferExpression(node.left, hint, env);
				const rightType = inferExpression(
					node.right,
					leftType.kind === "unknown" ? hint : leftType,
					env
				);
				const result = leftType.kind !== "unknown" ? leftType : rightType;
				if (
					op === "+" &&
					(leftType.kind === "string" || rightType.kind === "string")
				) {
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
					return conform(expected, { kind: "bool" }, lineOf(node.expression), colOf(node.expression));
				}
				return UNKNOWN;
			}

			case "VariantType": {
				const variantTags = node.tags.map((tag) => ({
					name: tag.name,
					type: tag.type ? astToType(tag.type) : null
				}));
				const definition: VariantDef = { kind: "variantDef", tags: variantTags };
				return definition;
			}

			case "VariantConstructor": {
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
				return conform(
					expected,
					{ kind: "named", name: definitionName! },
					node.line,
					node.col
				);
			}

			case "Match": {
				inferExpression(node.subject, null, env);
				let matchType: CheckedType = UNKNOWN;
				for (const arm of node.arms) {
					const armEnv = extendEnv(env);
					if (arm.pattern.kind === "VariantPattern" && arm.pattern.binding) {
						if (arm.pattern.binding.kind === "BindingPattern") {
							armEnv.bindings[arm.pattern.binding.name] = UNKNOWN;
						}
						if (arm.pattern.binding.kind === "TuplePattern") {
							for (const name of arm.pattern.binding.names) {
								armEnv.bindings[name] = UNKNOWN;
							}
						}
					}
					if (arm.pattern.kind === "GuardPattern") {
						inferExpression(arm.pattern.expression, { kind: "bool" }, env);
					}
					if (arm.pattern.kind === "LiteralPattern") {
						inferExpression(arm.pattern.expression, null, env);
					}
					if (arm.pattern.kind === "RangePattern") {
						inferExpression(arm.pattern.low, null, env);
						inferExpression(arm.pattern.high, null, env);
					}
					const armBodyType = inferExpression(arm.body, expected, armEnv);
					if (matchType.kind === "unknown") {
						matchType = armBodyType;
					}
				}
				if (node.elseArm) {
					inferExpression(node.elseArm, expected ?? matchType, env);
				}
				return conform(expected, matchType, node.line, node.col);
			}

			case "RecordType": {
				const recordFields = node.fields.map((field) => ({
					name: field.name,
					type: astToType(field.type) ?? UNKNOWN
				}));
				const definition: RecordDef = { kind: "recordDef", fields: recordFields };
				return definition;
			}

			case "RecordLiteral": {
				// Resolve the target record type — either from the explicit typeName
				// (Thing.{...}) or from the expected type annotation.
				let definition: RecordDef | null = null;
				if (node.typeName && node.typeName.kind === "Ident") {
					const looked = lookupEnv(env, node.typeName.name);
					if (looked && looked.kind === "recordDef") {
						definition = looked;
					} else if (looked && looked.kind !== "unknown") {
						throw typeError(
							node.line,
							node.col,
							`'${node.typeName.name}' is not a record type`
						);
					}
				} else if (expected && expected.kind === "named") {
					const looked = lookupEnv(env, expected.name);
					if (looked && looked.kind === "recordDef") {
						definition = looked;
					}
				}
				if (definition) {
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
					const recordName =
						node.typeName && node.typeName.kind === "Ident"
							? node.typeName.name
							: (expected as NamedType).name;
					node.resolvedTypeName = recordName;
					return conform(
						expected,
						{ kind: "named", name: recordName },
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
					throw typeError(node.line, node.col, "no record type in scope matches this literal");
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
