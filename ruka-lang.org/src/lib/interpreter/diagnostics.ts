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
	constructor(message: string, line?: number) {
		super(message);
		this.name = "RukaError";
		this.line = line;
	}
}

export function isRukaError(e: unknown): e is RukaError {
	return e instanceof Error && (e as RukaError).line !== undefined;
}
