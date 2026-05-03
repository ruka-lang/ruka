// The `ruka` builtin module. Each member is a `FnValue` whose `host`
// callback returns either a plain `Value` (sync builtins like math) or an
// `AsyncBuiltinResult` for io builtins that need to emit events or request
// input from the host.
//
// The evaluator inspects the return value: if it is an `AsyncBuiltinResult`
// envelope, the events are yielded first and the input request (if any)
// resolves into the value the builtin returns to the program.

import { RukaError } from "../diagnostics";
import type { RuntimeEvent } from "./events";
import { display, numericOf, type FnValue, type ModuleValue, type Value } from "./value";

// Emitted by io builtins. The evaluator unwraps these envelopes after the
// host call returns; programs only ever see the final `value` (for stdout
// builtins) or the input string (for input builtins).
export type BuiltinEnvelope =
	| { kind: "events"; events: RuntimeEvent[]; value: Value }
	| { kind: "input"; prompt: string | null };

export function isBuiltinEnvelope(value: unknown): value is BuiltinEnvelope {
	return (
		typeof value === "object" &&
		value !== null &&
		"kind" in value &&
		((value as { kind: string }).kind === "events" ||
			(value as { kind: string }).kind === "input")
	);
}

function syncFn(host: (args: Value[]) => Value): FnValue {
	return { kind: "fn", host };
}

function ioFn(host: (args: Value[]) => BuiltinEnvelope): FnValue {
	return { kind: "fn", host };
}

function expectEqHost(args: Value[]): Value {
	if (args[0] !== args[1]) {
		throw new RukaError(
			"expect_eq failed: " + display(args[0]) + " != " + display(args[1])
		);
	}
	return null;
}

export function makeRukaModule(): ModuleValue {
	return {
		kind: "module",
		members: {
			println: ioFn((args) => ({
				kind: "events",
				events: [{ kind: "stdout", text: args.map(display).join(" ") + "\n" }],
				value: null
			})),
			print: ioFn((args) => ({
				kind: "events",
				events: [{ kind: "stdout", text: args.map(display).join("") }],
				value: null
			})),
			read: ioFn(() => ({ kind: "input", prompt: null })),
			readln: ioFn(() => ({ kind: "input", prompt: null })),
			expect_eq: syncFn(expectEqHost),
			abs: syncFn((args) => Math.abs(numericOf(args[0]))),
			sin: syncFn((args) => Math.sin(numericOf(args[0]))),
			cos: syncFn((args) => Math.cos(numericOf(args[0]))),
			tan: syncFn((args) => Math.tan(numericOf(args[0]))),
			sqrt: syncFn((args) => Math.sqrt(numericOf(args[0]))),
			floor: syncFn((args) => Math.floor(numericOf(args[0]))),
			ceil: syncFn((args) => Math.ceil(numericOf(args[0]))),
			min: syncFn((args) => Math.min(numericOf(args[0]), numericOf(args[1]))),
			max: syncFn((args) => Math.max(numericOf(args[0]), numericOf(args[1]))),
			pow: syncFn((args) => Math.pow(numericOf(args[0]), numericOf(args[1]))),
			exp: syncFn((args) => Math.exp(numericOf(args[0]))),
			log: syncFn((args) => Math.log(numericOf(args[0]))),
			log2: syncFn((args) => Math.log2(numericOf(args[0]))),
			log10: syncFn((args) => Math.log10(numericOf(args[0])))
		}
	};
}
