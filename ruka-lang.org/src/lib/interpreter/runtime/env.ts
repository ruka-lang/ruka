// Runtime environment. Each scope holds its own bindings and a parent
// pointer; lookups walk up the chain. Mutability is tracked separately so
// `=` can reject assignments to immutable bindings (created without `*`).

import { RukaError } from "../diagnostics.js";
import type { Value } from "./value.js";

export type RuntimeEnv = {
	vars: { [name: string]: Value };
	mut: { [name: string]: boolean };
	parent: RuntimeEnv | null;
};

export function makeEnv(parent: RuntimeEnv | null): RuntimeEnv {
	return { vars: Object.create(null), mut: Object.create(null), parent };
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
