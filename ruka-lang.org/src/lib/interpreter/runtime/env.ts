// Runtime environment. Each scope holds its own bindings and a parent
// pointer; lookups walk up the chain. Mutability is tracked separately so
// `=` can reject assignments to immutable bindings (created without `*`).

import { RukaError } from "../diagnostics";
import type { Program } from "../ast";
import type { ModuleValue, Value } from "./value";

/**
 * Runtime project context. Set on the root env of each module so that
 * `ruka.import(...)` calls can resolve paths and reach the cached
 * module-value table. `modulePath` identifies which module the env
 * belongs to so relative imports resolve from the right directory.
 *
 * `asts` is optional: when provided, `loadModuleValue` uses these
 * pre-parsed, type-checker-annotated ASTs instead of re-parsing source
 * files, so receiver.resolvedTypeName and other annotations are intact.
 */
export type RuntimeProject = {
	sources: ReadonlyMap<string, string>;
	moduleValues: Map<string, ModuleValue>;
	visiting: Set<string>;
	asts?: Map<string, Program>;
};

export type RuntimeEnv = {
	vars: { [name: string]: Value };
	mut: { [name: string]: boolean };
	parent: RuntimeEnv | null;
	project?: RuntimeProject;
	modulePath?: string;
};

export function makeEnv(parent: RuntimeEnv | null): RuntimeEnv {
	return { vars: Object.create(null), mut: Object.create(null), parent };
}

export function envProject(env: RuntimeEnv): RuntimeProject | undefined {
	let current: RuntimeEnv | null = env;
	while (current !== null) {
		if (current.project) return current.project;
		current = current.parent;
	}
	return undefined;
}

export function envModulePath(env: RuntimeEnv): string {
	let current: RuntimeEnv | null = env;
	while (current !== null) {
		if (current.modulePath !== undefined) return current.modulePath;
		current = current.parent;
	}
	return "";
}

export function envGet(env: RuntimeEnv, name: string): Value {
	let current: RuntimeEnv | null = env;
	while (current !== null) {
		if (name in current.vars) {
			return current.vars[name];
		}
		current = current.parent;
	}
	throw new RukaError("Undefined: " + name);
}

export function envHas(env: RuntimeEnv, name: string): boolean {
	let current: RuntimeEnv | null = env;
	while (current !== null) {
		if (name in current.vars) {
			return true;
		}
		current = current.parent;
	}
	return false;
}

export function envSet(env: RuntimeEnv, name: string, value: Value): void {
	env.vars[name] = value;
}

// Update an existing binding by walking up the chain. Used by `=` assignment
// (distinct from `let`, which always introduces a new binding in the current
// scope). Refuses to write to an immutable binding.
export function envUpdate(env: RuntimeEnv, name: string, value: Value): void {
	let current: RuntimeEnv | null = env;
	while (current !== null) {
		if (name in current.vars) {
			if (!current.mut[name]) {
				throw new RukaError(
					"Cannot assign to immutable binding '" +
						name +
						"' (use 'let *" +
						name +
						"' to make it mutable)"
				);
			}
			current.vars[name] = value;
			return;
		}
		current = current.parent;
	}
	throw new RukaError("Undefined: " + name);
}
