/**
 * A diagnostic produced by parsing, scope checking, type checking, or runtime.
 * `line` is 1-based source line; `col` is 1-based column on that line. Both
 * are absent when the location is unknown.
 */
export interface Diagnostic {
	line?: number;
	col?: number;
	message: string;
}

/**
 * Errors thrown by the parser/checkers/evaluator. `line` mirrors the JS
 * implementation's convention of attaching `e.line = tok.line`; `col` is
 * the 1-based column on that line, used by the editor to position diagnostic
 * overlays at the offending token.
 */
export class RukaError extends Error {
	line?: number;
	col?: number;
	/**
	 * Set on type errors that should not be swallowed during candidate-matching
	 * inference (record-literal resolution, variant constructor resolution,
	 * etc.). Such errors propagate even when the surrounding code is exploring
	 * multiple type alternatives.
	 */
	fatal?: boolean;
	/**
	 * Project-relative path of the module the error originated in. Set when
	 * the error surfaces during cross-module checking; absent for single-file
	 * runs. The playground prepends it to the message when reporting.
	 */
	path?: string;
	constructor(message: string, line?: number, col?: number, fatal = false) {
		super(message);
		this.name = "RukaError";
		this.line = line;
		this.col = col;
		if (fatal) {
			this.fatal = true;
		}
	}
}

export function isRukaError(e: unknown): e is RukaError {
	return e instanceof Error && (e as RukaError).line !== undefined;
}
