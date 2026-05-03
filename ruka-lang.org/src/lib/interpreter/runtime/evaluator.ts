// Tree-walking evaluator. Implemented as a synchronous Generator so it can
// emit RuntimeEvents as it goes (stdout text, input requests). The host
// drives it with `for (const event of run(ast))` and uses `gen.next(text)`
// to deliver user input back to the program after an `inputRequest`.
//
// Errors are RukaErrors thrown out of the generator with `.line` annotated
// at the deepest site; the host catches them and renders a diagnostic.

import type {
	Binding,
	Block,
	ComplexAssign,
	Expression,
	For,
	If,
	MatchPattern,
	Program,
	Statement
} from "../ast";
import { RukaError } from "../diagnostics";
import { splitInterp, unescText } from "../interpolator";
import { parse } from "../parser";
import { tokenize } from "../tokenizer";
import { isBuiltinEnvelope, makeRukaModule } from "./builtins";
import {
	envGet,
	envHas,
	envModulePath,
	envProject,
	envSet,
	envUpdate,
	makeEnv,
	type RuntimeEnv,
	type RuntimeProject
} from "./env";
import { ControlSignal, type RuntimeEvent } from "./events";
import { isRukaImportCall } from "../check/scope";
import { resolveImportPath } from "../project";
import type { ModuleValue } from "./value";
import {
	display,
	isChar,
	isFn,
	isModule,
	isRange,
	isRecord,
	isRecordType,
	isVariant,
	isVariantType,
	numericOf,
	type FnValue,
	type RangeValue,
	type Value
} from "./value.js";

export type Run = Generator<RuntimeEvent, void, string>;

export function run(ast: Program, project?: RuntimeProject, entry?: string): Run {
	return runImpl(ast, project, entry);
}

function* runImpl(ast: Program, project?: RuntimeProject, entry?: string): Run {
	const globalEnv = makeEnv(null);
	envSet(globalEnv, "ruka", makeRukaModule());
	if (project) {
		globalEnv.project = project;
		globalEnv.modulePath = entry ?? "";
	}

	for (const stmt of ast.body) {
		yield* evalStatement(stmt, globalEnv);
	}

	const mainBinding = findMain(ast);
	const mainValue = envHas(globalEnv, "main") ? envGet(globalEnv, "main") : null;
	if (mainBinding && !mainBinding.local && isFn(mainValue)) {
		yield* callFn(mainValue, [], mainBinding.line, mainBinding.col, globalEnv);
	}
}

// Privacy by case: lowercase first character = public. Used to filter the
// imported module's top-level bindings into its exported member set.
function isPublicName(name: string): boolean {
	const code = name.charCodeAt(0);
	return !(code >= 65 && code <= 90);
}

function* loadModuleValue(
	project: RuntimeProject,
	path: string,
	line: number,
	col: number | undefined
): Generator<RuntimeEvent, ModuleValue, string> {
	const cached = project.moduleValues.get(path);
	if (cached) return cached;

	if (project.visiting.has(path)) {
		throw new RukaError("cyclic import: " + path, line, col);
	}

	const source = project.sources.get(path);
	if (source === undefined) {
		throw new RukaError("module not found: " + path, line, col);
	}

	project.visiting.add(path);
	try {
		const ast = parse(tokenize(source));
		const moduleEnv = makeEnv(null);
		envSet(moduleEnv, "ruka", makeRukaModule());
		moduleEnv.project = project;
		moduleEnv.modulePath = path;

		for (const stmt of ast.body) {
			yield* evalStatement(stmt, moduleEnv);
		}

		const members: { [name: string]: import("./value").Value } = Object.create(null);
		for (const name of Object.keys(moduleEnv.vars)) {
			if (name === "ruka") continue;
			if (!isPublicName(name)) continue;
			members[name] = moduleEnv.vars[name];
		}

		const moduleValue: ModuleValue = { kind: "module", members };
		project.moduleValues.set(path, moduleValue);
		return moduleValue;
	} finally {
		project.visiting.delete(path);
	}
}

function findMain(ast: Program): Binding | null {
	for (const stmt of ast.body) {
		if (
			stmt.kind === "Binding" &&
			stmt.pattern.kind === "IdentifierPattern" &&
			stmt.pattern.name === "main"
		) {
			return stmt;
		}
	}
	return null;
}

// ── Statements ──────────────────────────────────────────────────────────

function* evalStatement(
	node: Statement,
	env: RuntimeEnv
): Generator<RuntimeEvent, Value, string> {
	try {
		switch (node.kind) {
			case "Binding":
				return yield* evalBinding(node, env);
			case "Assign": {
				const value = yield* evalExpression(node.value, env);
				envUpdate(env, node.name, value);
				return value;
			}
			case "ComplexAssign":
				return yield* evalComplexAssign(node, env);
			case "ExpressionStmt":
				return yield* evalExpression(node.expression, env);
			case "For":
				return yield* evalFor(node, env);
			case "Break":
				throw new ControlSignal("break");
			case "Continue":
				throw new ControlSignal("continue");
			case "Return": {
				const value = yield* evalExpression(node.value, env);
				throw new ControlSignal("return", value);
			}
		}
	} catch (error) {
		annotate(error, node.line, node.col);
		throw error;
	}
}

function* evalBinding(
	node: Binding,
	env: RuntimeEnv
): Generator<RuntimeEvent, Value, string> {
	if (node.receiver) {
		// Methods and statics attach to the receiver type's runtime value;
		// they don't bind a name in the surrounding scope.
		const receiver = node.receiver;
		const typeName =
			receiver.resolvedTypeName ??
			(receiver.kind === "static" ? receiver.typeName : undefined);
		if (!typeName) {
			return null;
		}
		if (!envHas(env, typeName)) {
			return null;
		}
		const typeValue = envGet(env, typeName);
		const value = yield* evalExpression(node.value, env);
		if (isRecordType(typeValue) || isVariantType(typeValue)) {
			if (receiver.kind === "self") {
				if (isFn(value)) {
					typeValue.methods[node.name!] = value;
				}
			} else {
				typeValue.statics[node.name!] = value;
			}
		}
		return null;
	}

	const value = yield* evalExpression(node.value, env);

	if (node.pattern.kind === "IdentifierPattern") {
		if (isVariantType(value)) {
			value.name = node.pattern.name;
		}
		envSet(env, node.pattern.name, value);
		env.mut[node.pattern.name] = node.mode === "*";
	} else if (node.pattern.kind === "RecordPattern") {
		// Type checker has guaranteed `value` is a record with these fields.
		const fields = (value as { fields: Record<string, Value> }).fields;
		for (const name of node.pattern.names) {
			envSet(env, name, fields[name] ?? null);
			env.mut[name] = node.mode === "*";
		}
	} else {
		// TuplePattern — type checker has guaranteed array shape and arity.
		const tuple = value as Value[];
		node.pattern.names.forEach((name, index) => {
			envSet(env, name, tuple[index] ?? null);
			env.mut[name] = node.mode === "*";
		});
	}
	return value;
}

function* evalFor(node: For, env: RuntimeEnv): Generator<RuntimeEvent, Value, string> {
	const iterable = yield* evalExpression(node.iterable, env);
	const values = iterableValues(iterable, node.line, node.col);
	let result: Value = null;
	let iterations = 0;
	for (const item of values) {
		iterations++;
		if (iterations > 10000) {
			throw new RukaError("Exceeded 10,000 iterations", node.line, node.col);
		}
		const iterEnv = makeEnv(env);
		if (node.name) {
			envSet(iterEnv, node.name, item);
		} else if (node.tuplePattern) {
			const elements = Array.isArray(item) ? item : [];
			node.tuplePattern.forEach((patternName, index) => {
				envSet(iterEnv, patternName, elements[index] ?? null);
			});
		}
		try {
			for (const stmt of node.body) {
				result = yield* evalStatement(stmt, iterEnv);
			}
		} catch (error) {
			if (error instanceof ControlSignal) {
				if (error.signal === "continue") {
					continue;
				}
				if (error.signal === "break") {
					return result;
				}
			}
			throw error;
		}
	}
	return result;
}

function iterableValues(value: Value, line: number, col: number | undefined): Value[] {
	if (Array.isArray(value)) {
		return value;
	}
	if (isRange(value)) {
		const out: Value[] = [];
		const step = value.start <= value.end ? 1 : -1;
		const stop = value.inclusive ? value.end + step : value.end;
		for (let n = value.start; n !== stop; n += step) {
			out.push(value.isCharRange ? { kind: "char", codepoint: n } : n);
		}
		return out;
	}
	throw new RukaError("Not iterable: " + display(value), line, col);
}

function* evalComplexAssign(
	node: ComplexAssign,
	env: RuntimeEnv
): Generator<RuntimeEvent, Value, string> {
	const value = yield* evalExpression(node.value, env);

	if (node.target.kind === "Index") {
		const object = yield* evalExpression(node.target.object, env);
		const index = yield* evalExpression(node.target.index, env);
		if (!Array.isArray(object)) {
			throw new RukaError("Index assignment requires an array", node.line, node.col);
		}
		const i = numericOf(index);
		if (i < 0 || i >= object.length) {
			throw new RukaError(
				`Index ${i} out of bounds (length ${object.length})`,
				node.line,
				node.col
			);
		}
		object[i] = value;
		return value;
	}

	// Member assignment: `object.field = value`
	const object = yield* evalExpression(node.target.object, env);
	if (!isRecord(object)) {
		throw new RukaError(
			"Member assignment requires a record value",
			node.line,
			node.col
		);
	}
	object.fields[node.target.property] = value;
	return value;
}

// ── Expressions ─────────────────────────────────────────────────────────

function* evalExpression(
	node: Expression,
	env: RuntimeEnv
): Generator<RuntimeEvent, Value, string> {
	switch (node.kind) {
		case "Literal":
			return node.value;
		case "Unit":
			return null;
		case "CharLiteral":
			return { kind: "char", codepoint: node.value };
		case "StringLiteral":
			return yield* interpolateString(node.raw, env);

		case "RecordType":
			return { kind: "recordType", fields: node.fields, methods: {}, statics: {} };

		case "VariantType":
			return {
				kind: "variantType",
				name: null,
				rawTags: node.tags,
				tags: node.tags.map((tag) => ({ name: tag.name, hasPayload: tag.type !== null })),
				methods: {},
				statics: {}
			};

		case "VariantConstructor": {
			const payload = node.payload ? yield* evalExpression(node.payload, env) : null;
			return {
				kind: "variant",
				typeName: node.resolvedTypeName ?? null,
				tag: node.tag,
				payload
			};
		}

		case "RecordLiteral": {
			const fields: { [name: string]: Value } = Object.create(null);
			for (const field of node.fields) {
				fields[field.name] = yield* evalExpression(field.value, env);
			}
			let typeName: string | null = null;
			if (node.resolvedTypeName) {
				typeName = node.resolvedTypeName;
			} else if (node.typeName && node.typeName.kind === "Ident") {
				typeName = node.typeName.name;
			}
			return { kind: "record", typeName, fields };
		}

		case "Ident": {
			try {
				return envGet(env, node.name);
			} catch (error) {
				annotate(error, node.line, node.col);
				throw error;
			}
		}

		case "Block":
			return yield* evalBlock(node, env);

		case "While": {
			let result: Value = null;
			let iterations = 0;
			whileLoop: while (true) {
				const condition = yield* evalExpression(node.condition, env);
				if (!condition) {
					break;
				}
				iterations++;
				if (iterations > 10000) {
					throw new RukaError("Exceeded 10,000 iterations", node.line, node.col);
				}
				const iterEnv = makeEnv(env);
				try {
					for (const stmt of node.body) {
						result = yield* evalStatement(stmt, iterEnv);
					}
				} catch (error) {
					if (error instanceof ControlSignal) {
						if (error.signal === "continue") {
							continue whileLoop;
						}
						if (error.signal === "break") {
							break whileLoop;
						}
					}
					throw error;
				}
			}
			return result;
		}

		case "Range": {
			const start = yield* evalExpression(node.start, env);
			const end = yield* evalExpression(node.end, env);
			const isCharRange = isChar(start) || isChar(end);
			const range: RangeValue = {
				kind: "range",
				start: numericOf(start),
				end: numericOf(end),
				inclusive: node.inclusive,
				isCharRange
			};
			return range;
		}

		case "ListLiteral": {
			const elements: Value[] = [];
			for (const element of node.elements) {
				elements.push(yield* evalExpression(element, env));
			}
			return elements;
		}

		case "ArrayComp": {
			const iterable = yield* evalExpression(node.iterable, env);
			const values = iterableValues(iterable, node.line, node.col);
			const result: Value[] = [];
			let iterations = 0;
			for (const item of values) {
				iterations++;
				if (iterations > 10000) {
					throw new RukaError("Exceeded 10,000 iterations", node.line, node.col);
				}
				const compEnv = makeEnv(env);
				if (node.name) {
					envSet(compEnv, node.name, item);
				} else if (node.tuplePattern) {
					const elements = Array.isArray(item) ? item : [];
					node.tuplePattern.forEach((patternName, index) => {
						envSet(compEnv, patternName, elements[index] ?? null);
					});
				}
				result.push(yield* evalExpression(node.body, compEnv));
			}
			return result;
		}

		case "Index":
			return yield* evalIndex(node, env);

		case "If":
			return yield* evalIf(node, env);

		case "FunctionExpr":
			return {
				kind: "fn",
				params: node.params,
				paramModes: node.paramModes,
				body: node.body,
				closureEnv: env
			};

		case "Call":
			return yield* evalCall(node, env);

		case "Member":
			return yield* evalMember(node, env);

		case "BinaryOp":
			return yield* evalBinaryOp(node, env);

		case "UnaryOp": {
			const value = yield* evalExpression(node.expression, env);
			if (node.op === "-") {
				return -numericOf(value);
			}
			return !value;
		}

		case "Match":
			return yield* evalMatch(node, env);
	}
}

function* evalBlock(
	node: Block,
	env: RuntimeEnv
): Generator<RuntimeEvent, Value, string> {
	const blockEnv = makeEnv(env);
	let result: Value = null;
	for (const stmt of node.body) {
		result = yield* evalStatement(stmt, blockEnv);
	}
	return result;
}

function* evalIf(node: If, env: RuntimeEnv): Generator<RuntimeEvent, Value, string> {
	const condition = yield* evalExpression(node.condition, env);
	if (condition) {
		return yield* evalBranch(node.thenBranch, env);
	}
	if (node.elseBranch) {
		return yield* evalBranch(node.elseBranch, env);
	}
	return null;
}

function* evalBranch(
	branch: Block | Expression,
	env: RuntimeEnv
): Generator<RuntimeEvent, Value, string> {
	if ((branch as Block).kind === "Block") {
		return yield* evalBlock(branch as Block, env);
	}
	return yield* evalExpression(branch as Expression, env);
}

function* evalIndex(
	node: Extract<Expression, { kind: "Index" }>,
	env: RuntimeEnv
): Generator<RuntimeEvent, Value, string> {
	try {
		const object = yield* evalExpression(node.object, env);
		const index = yield* evalExpression(node.index, env);
		if (isRange(index)) {
			const low = index.start;
			const high = index.inclusive ? index.end + 1 : index.end;
			if (typeof object === "string") {
				return object.slice(low, high);
			}
			if (Array.isArray(object)) {
				return object.slice(low, high);
			}
			throw new RukaError("Cannot slice " + display(object));
		}
		if (Array.isArray(object)) {
			return object[numericOf(index)];
		}
		if (typeof object === "string") {
			return { kind: "char", codepoint: object.charCodeAt(numericOf(index)) };
		}
		throw new RukaError("Cannot index " + display(object));
	} catch (error) {
		annotate(error, node.line, node.col);
		throw error;
	}
}

function* evalCall(
	node: Extract<Expression, { kind: "Call" }>,
	env: RuntimeEnv
): Generator<RuntimeEvent, Value, string> {
	try {
		if (isRukaImportCall(node)) {
			const project = envProject(env);
			if (!project) {
				throw new RukaError(
					"ruka.import(...) requires a project context",
					node.line,
					node.col
				);
			}
			// Type-check has already validated that the argument is a string
			// literal; assert here for runtime safety.
			const arg = node.args[0];
			if (!arg || arg.kind !== "StringLiteral") {
				throw new RukaError(
					"ruka.import(...) takes a single string literal path",
					node.line,
					node.col
				);
			}
			const resolved = resolveImportPath(envModulePath(env), arg.raw);
			if (resolved === null) {
				throw new RukaError(
					"invalid import path: " + arg.raw,
					node.line,
					node.col
				);
			}
			return yield* loadModuleValue(project, resolved, node.line, node.col);
		}

		const callee = yield* evalExpression(node.callee, env);
		const args: Value[] = [];
		for (const arg of node.args) {
			args.push(yield* evalExpression(arg, env));
		}
		if (!isFn(callee)) {
			throw new RukaError("Not a function: " + display(callee));
		}
		return yield* callFn(callee, args, node.line, node.col, env);
	} catch (error) {
		annotate(error, node.line, node.col);
		throw error;
	}
}

function* callFn(
	fn: FnValue,
	args: Value[],
	_line: number,
	_col: number | undefined,
	_callerEnv: RuntimeEnv
): Generator<RuntimeEvent, Value, string> {
	if (fn.host) {
		const result = fn.host(args);
		if (isBuiltinEnvelope(result)) {
			if (result.kind === "events") {
				for (const event of result.events) {
					yield event;
				}
				return result.value;
			}
			const text: string = yield { kind: "inputRequest", prompt: result.prompt };
			return text;
		}
		return result as Value;
	}

	const fnEnv = makeEnv(fn.closureEnv ?? null);
	const params = fn.params ?? [];
	for (let i = 0; i < params.length; i++) {
		envSet(fnEnv, params[i], i < args.length ? args[i] : null);
		if (fn.paramModes && fn.paramModes[i] === "*") {
			fnEnv.mut[params[i]] = true;
		}
	}
	try {
		return yield* evalBlock(fn.body!, fnEnv);
	} catch (error) {
		if (error instanceof ControlSignal && error.signal === "return") {
			return error.value;
		}
		throw error;
	}
}

function* evalMember(
	node: Extract<Expression, { kind: "Member" }>,
	env: RuntimeEnv
): Generator<RuntimeEvent, Value, string> {
	try {
		const object = yield* evalExpression(node.object, env);

		if (isModule(object)) {
			if (node.property in object.members) {
				return object.members[node.property];
			}
			throw new RukaError("No member '" + node.property + "' on module");
		}

		if (isVariantType(object)) {
			const tag = object.tags.find((candidate) => candidate.name === node.property);
			if (tag) {
				const typeName = object.name;
				if (!tag.hasPayload) {
					return { kind: "variant", typeName, tag: node.property, payload: null };
				}
				const tagName = node.property;
				return {
					kind: "fn",
					host: (args) => ({
						kind: "variant",
						typeName,
						tag: tagName,
						payload: args[0]
					})
				};
			}
			if (node.property in object.statics) {
				return object.statics[node.property];
			}
			throw new RukaError("No tag or static '" + node.property + "' on variant");
		}

		if (isRecordType(object)) {
			if (node.property in object.statics) {
				return object.statics[node.property];
			}
			throw new RukaError("No static '" + node.property + "' on record type");
		}

		if (Array.isArray(object)) {
			const list = object;
			if (node.property === "len") {
				return { kind: "fn", host: () => list.length };
			}
			if (node.property === "append") {
				return {
					kind: "fn",
					host: (args) => {
						list.push(args[0]);
						return null;
					}
				};
			}
			if (node.property === "remove") {
				return {
					kind: "fn",
					host: (args) => {
						const index = args[0] as number;
						if (index < 0 || index >= list.length) {
							throw new RukaError(
								"remove: index " + index + " out of bounds (length " + list.length + ")"
							);
						}
						return list.splice(index, 1)[0];
					}
				};
			}
			if (node.property === "concat") {
				return {
					kind: "fn",
					host: (args) => list.concat(args[0] as Value[])
				};
			}
			throw new RukaError("No method '" + node.property + "' on array");
		}

		if (typeof object === "string") {
			const text = object;
			if (node.property === "len") {
				return { kind: "fn", host: () => text.length };
			}
			if (node.property === "concat") {
				return { kind: "fn", host: (args) => text + (args[0] as string) };
			}
			if (node.property === "append") {
				const target = node.object;
				return {
					kind: "fn",
					host: (args) => {
						if (target.kind !== "Ident") {
							throw new RukaError("append: receiver must be a direct binding");
						}
						envUpdate(env, target.name, text + (args[0] as string));
						return null;
					}
				};
			}
			throw new RukaError("No method '" + node.property + "' on string");
		}

		if (isRecord(object)) {
			if (node.property in object.fields) {
				return object.fields[node.property];
			}
			if (object.typeName && envHas(env, object.typeName)) {
				const typeValue = envGet(env, object.typeName);
				if (
					(isRecordType(typeValue) || isVariantType(typeValue)) &&
					node.property in typeValue.methods
				) {
					return bindMethod(typeValue.methods[node.property], object);
				}
			}
			throw new RukaError(
				"No field or method '" + node.property + "' on " + display(object)
			);
		}

		if (isVariant(object)) {
			// Method dispatch on a variant instance: methods live on the variant
			// type value the binding was named after; here we have no name on the
			// instance itself, so this path only triggers via static lookup
			// elsewhere. Fall through to the default error.
		}

		throw new RukaError(
			"No field or method '" + node.property + "' on " + display(object)
		);
	} catch (error) {
		annotate(error, node.line, node.col);
		throw error;
	}
}

function bindMethod(method: FnValue, receiver: Value): FnValue {
	return {
		kind: "fn",
		host: undefined,
		params: method.params,
		paramModes: method.paramModes,
		body: method.body,
		closureEnv: makeBoundEnv(method.closureEnv ?? null, receiver)
	};
}

function makeBoundEnv(parent: RuntimeEnv | null, receiver: Value): RuntimeEnv {
	const env = makeEnv(parent);
	envSet(env, "self", receiver);
	return env;
}

function* evalBinaryOp(
	node: Extract<Expression, { kind: "BinaryOp" }>,
	env: RuntimeEnv
): Generator<RuntimeEvent, Value, string> {
	if (node.op === "and") {
		const left = yield* evalExpression(node.left, env);
		if (!left) {
			return left;
		}
		return yield* evalExpression(node.right, env);
	}
	if (node.op === "or") {
		const left = yield* evalExpression(node.left, env);
		if (left) {
			return left;
		}
		return yield* evalExpression(node.right, env);
	}

	const left = yield* evalExpression(node.left, env);
	const right = yield* evalExpression(node.right, env);
	const leftNum = numericOf(left);
	const rightNum = numericOf(right);
	switch (node.op) {
		case "+":
			return leftNum + rightNum;
		case "-":
			return leftNum - rightNum;
		case "*":
			return leftNum * rightNum;
		case "/":
			return leftNum / rightNum;
		case "%":
			return leftNum % rightNum;
		case "**":
			return Math.pow(leftNum, rightNum);
		case "==":
			return leftNum === rightNum;
		case "!=":
			return leftNum !== rightNum;
		case "<":
			return leftNum < rightNum;
		case ">":
			return leftNum > rightNum;
		case "<=":
			return leftNum <= rightNum;
		case ">=":
			return leftNum >= rightNum;
		default:
			throw new RukaError("Unknown operator: " + node.op);
	}
}

function* evalMatch(
	node: Extract<Expression, { kind: "Match" }>,
	env: RuntimeEnv
): Generator<RuntimeEvent, Value, string> {
	try {
		const subject = yield* evalExpression(node.subject, env);
		for (const arm of node.arms) {
			const bindings = yield* matchPattern(arm.pattern, subject, env);
			if (bindings !== null) {
				const armEnv = makeEnv(env);
				for (const name of Object.keys(bindings)) {
					envSet(armEnv, name, bindings[name]);
				}
				return yield* evalBlock(arm.body, armEnv);
			}
		}
		if (node.elseArm !== null) {
			return yield* evalBlock(node.elseArm, env);
		}
		// Exhaustiveness is enforced by the type checker, so reaching here
		// would indicate a compiler bug.
		throw new RukaError("internal: match fell through (compiler bug)");
	} catch (error) {
		annotate(error, node.line, node.col);
		throw error;
	}
}

function* matchPattern(
	pattern: MatchPattern,
	subject: Value,
	env: RuntimeEnv
): Generator<RuntimeEvent, { [name: string]: Value } | null, string> {
	if (pattern.kind === "VariantPattern") {
		if (!isVariant(subject) || subject.tag !== pattern.tag) {
			return null;
		}
		const bindings: { [name: string]: Value } = Object.create(null);
		if (pattern.binding) {
			const binding = pattern.binding;
			if (binding.kind === "BindingPattern") {
				bindings[binding.name] = subject.payload;
			} else if (binding.kind === "RecordPattern") {
				const payload = subject.payload as { fields: Record<string, Value> };
				for (const name of binding.names) {
					bindings[name] = payload.fields[name] ?? null;
				}
			} else {
				// TuplePattern — type checker guarantees tuple/array shape.
				const payload = subject.payload as Value[];
				binding.names.forEach((name, index) => {
					bindings[name] = payload[index] ?? null;
				});
			}
		}
		return bindings;
	}
	if (pattern.kind === "LiteralPattern") {
		const literalValue = yield* evalExpression(pattern.expression, env);
		const literalNum = isChar(literalValue) ? literalValue.codepoint : literalValue;
		const subjectNum = isChar(subject) ? subject.codepoint : subject;
		return literalNum === subjectNum ? Object.create(null) : null;
	}
	if (pattern.kind === "RangePattern") {
		const lowValue = yield* evalExpression(pattern.low, env);
		const highValue = yield* evalExpression(pattern.high, env);
		const low = isChar(lowValue) ? lowValue.codepoint : (lowValue as number);
		const high = isChar(highValue) ? highValue.codepoint : (highValue as number);
		const subjectNum = isChar(subject) ? subject.codepoint : subject;
		if (typeof subjectNum !== "number") {
			return null;
		}
		const inRange =
			subjectNum >= low && (pattern.inclusive ? subjectNum <= high : subjectNum < high);
		return inRange ? Object.create(null) : null;
	}
	if (pattern.kind === "GuardPattern") {
		const value = yield* evalExpression(pattern.expression, env);
		return value ? Object.create(null) : null;
	}
	return null;
}

function* interpolateString(
	raw: string,
	env: RuntimeEnv
): Generator<RuntimeEvent, string, string> {
	let out = "";
	for (const part of splitInterp(raw)) {
		if ("text" in part) {
			out += unescText(part.text);
			continue;
		}
		try {
			const inner = parse(tokenize(part.interp));
			let value: Value = null;
			for (const stmt of inner.body) {
				value = yield* evalStatement(stmt, env);
			}
			out += display(value);
		} catch (error) {
			out += "<err:" + (error as Error).message + ">";
		}
	}
	return out;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function annotate(
	error: unknown,
	line: number | undefined,
	col: number | undefined
): void {
	if (error instanceof RukaError) {
		if (error.line === undefined && line !== undefined) {
			error.line = line;
		}
		if (error.col === undefined && col !== undefined) {
			error.col = col;
		}
	}
}
