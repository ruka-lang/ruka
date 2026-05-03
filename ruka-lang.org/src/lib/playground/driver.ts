import {
	parseSource,
	checkScope,
	checkTypes,
	checkProject,
	checkProjectFull,
	run,
	RukaError,
	type RuntimeEvent,
	type RuntimeProject
} from "$lib/interpreter";

import { getEntrySource, type Project } from "./project";

export type CheckResult =
	| { ok: true }
	| {
			ok: false;
			line?: number;
			col?: number;
			path?: string;
			message: string;
			/** Location of the ruka.import() call in the importing file. */
			importLine?: number;
			importCol?: number;
	  };

function projectSources(project: Project): Map<string, string> {
	const map = new Map<string, string>();
	for (const file of project.files) {
		if (file.kind === "ruka") map.set(file.path, file.source);
	}
	return map;
}

/**
 * Check the project's entry against the in-memory file map so that
 * `ruka.import("./other.ruka")` resolves across files. Returns the first
 * diagnostic with `path` set when the offending location is not the entry.
 */
export function checkProjectSource(project: Project): CheckResult {
	const error = checkProject(projectSources(project), project.entry);
	if (!error) return { ok: true };
	return {
		ok: false,
		line: error.line,
		col: error.col,
		path: error.path,
		message: error.message,
		importLine: error.importLine,
		importCol: error.importCol
	};
}


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
	| { ok: false; line?: number; col?: number; path?: string; message: string };

/**
 * Drive the project's entry source through the evaluator with a runtime
 * project context, so `ruka.import(...)` resolves across files.
 */
export async function runProject(project: Project, hooks: RunHooks): Promise<RunResult> {
	const sources = projectSources(project);
	const { error: checkError, asts } = checkProjectFull(sources, project.entry);
	if (checkError) {
		return {
			ok: false,
			line: checkError.line,
			col: checkError.col,
			path: checkError.path,
			message: checkError.message
		};
	}

	let ast;
	try {
		ast = parseSource(getEntrySource(project));
	} catch (error) {
		if (error instanceof RukaError)
			return { ok: false, line: error.line, col: error.col, message: error.message };
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, message };
	}

	const runtimeProject: RuntimeProject = {
		sources,
		moduleValues: new Map(),
		visiting: new Set(),
		asts
	};

	try {
		const generator = run(ast, runtimeProject, project.entry);
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
			return {
				ok: false,
				line: error.line,
				col: error.col,
				path: error.path,
				message: error.message
			};
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, message };
	}
}


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
