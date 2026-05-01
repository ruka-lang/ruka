import {
	parseSource,
	checkScope,
	checkTypes,
	run,
	RukaError,
	type RuntimeEvent
} from "$lib/interpreter";

export type CheckResult =
	| { ok: true }
	| { ok: false; line?: number; col?: number; message: string };

export function checkSource(source: string): CheckResult {
	try {
		const ast = parseSource(source);
		const scopeError = checkScope(ast);
		if (scopeError)
			return {
				ok: false,
				line: scopeError.line,
				col: scopeError.col,
				message: scopeError.message
			};
		const typeError = checkTypes(ast);
		if (typeError)
			return {
				ok: false,
				line: typeError.line,
				col: typeError.col,
				message: typeError.message
			};
		return { ok: true };
	} catch (error) {
		if (error instanceof RukaError)
			return { ok: false, line: error.line, col: error.col, message: error.message };
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, message };
	}
}

export type RunHooks = {
	onStdout: (text: string) => void;
	onStderr: (text: string) => void;
	requestInput: () => Promise<string>;
};

export type RunResult =
	| { ok: true }
	| { ok: false; line?: number; col?: number; message: string };

// Drives a parsed-and-checked program through the synchronous generator,
// pumping events into the supplied hooks. Returns when the program halts.
// Awaits the hosts' input promise on each `inputRequest`, so the loop stays
// fair across async stdin while the body itself runs synchronously between
// events.
export async function runSource(source: string, hooks: RunHooks): Promise<RunResult> {
	let ast;
	try {
		ast = parseSource(source);
		const scopeError = checkScope(ast);
		if (scopeError)
			return {
				ok: false,
				line: scopeError.line,
				col: scopeError.col,
				message: scopeError.message
			};
		const typeError = checkTypes(ast);
		if (typeError)
			return {
				ok: false,
				line: typeError.line,
				col: typeError.col,
				message: typeError.message
			};
	} catch (error) {
		if (error instanceof RukaError)
			return { ok: false, line: error.line, col: error.col, message: error.message };
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, message };
	}

	try {
		const generator = run(ast);
		let next = generator.next();
		while (!next.done) {
			const event: RuntimeEvent = next.value;
			if (event.kind === "stdout") {
				hooks.onStdout(event.text);
				next = generator.next();
			} else if (event.kind === "stderr") {
				hooks.onStderr(event.text);
				next = generator.next();
			} else {
				const line = await hooks.requestInput();
				next = generator.next(line);
			}
		}
		return { ok: true };
	} catch (error) {
		if (error instanceof RukaError)
			return { ok: false, line: error.line, col: error.col, message: error.message };
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, message };
	}
}
