// Events emitted by the evaluator's AsyncGenerator. The host (browser
// terminal, future CLI) consumes these to drive its UI:
//   - stdout / stderr text is appended to the output area
//   - inputRequest tells the host to read a line from the user, then resume
//     the generator with `.next(line)` to deliver it back to the program
//
// Control-flow signals (break/continue/return) are *not* events; they are
// thrown as ControlSignal instances and caught by the relevant evaluator
// frame. They never leak to the host.

import type { Value } from "./value.js";

export type RuntimeEvent =
	| { kind: "stdout"; text: string }
	| { kind: "stderr"; text: string }
	| { kind: "inputRequest"; prompt: string | null };

export type ControlKind = "break" | "continue" | "return";

export class ControlSignal extends Error {
	readonly signal: ControlKind;
	readonly value: Value;

	constructor(signal: ControlKind, value: Value = null) {
		super(signal);
		this.signal = signal;
		this.value = value;
	}
}
