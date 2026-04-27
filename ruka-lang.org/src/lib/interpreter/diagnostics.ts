/**
 * A diagnostic produced by parsing, scope checking, type checking, or runtime.
 * `line` is 1-based source line; absent when the location is unknown.
 */
export interface Diagnostic {
	line?: number;
	message: string;
}

/**
 * Errors thrown by the parser/checkers/evaluator. `line` mirrors the JS
 * implementation's convention of attaching `e.line = tok.line`.
 */
export class RukaError extends Error {
	line?: number;
	/**
	 * Set on type errors that should not be swallowed during candidate-matching
	 * inference (record-literal resolution, variant constructor resolution,
	 * etc.). Such errors propagate even when the surrounding code is exploring
	 * multiple type alternatives.
	 */
	fatal?: boolean;
	constructor(message: string, line?: number, fatal = false) {
		super(message);
		this.name = "RukaError";
		this.line = line;
		if (fatal) {
			this.fatal = true;
		}
	}
}

export function isRukaError(e: unknown): e is RukaError {
	return e instanceof Error && (e as RukaError).line !== undefined;
}
