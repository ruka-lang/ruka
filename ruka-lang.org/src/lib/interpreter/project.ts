// Multi-module support. The single-file pipeline (`parseSource` →
// `checkScope` → `checkTypes` → `run`) is augmented with a project context
// when the playground compiles a tree of `.ruka` files: relative `import(...)`
// calls resolve against the project's path map, and the scope/type checkers
// recursively descend through imported modules.
//
// `import` is handled as a *special form* in the scope and type checker — not
// a regular builtin function — because its return type depends on the literal
// path argument (the module's public binding set), and its argument must be a
// string literal so resolution can happen at compile time.

import type { Program } from "./ast";
import { parse } from "./parser";
import { tokenize } from "./tokenizer";
import { RukaError } from "./diagnostics";
import type { RecordDef } from "./check/type";
import { checkScope } from "./check/scope";
import { checkTypes } from "./check/types";

export type ProjectSources = ReadonlyMap<string, string>;

/**
 * Shared state threaded through the scope and type checkers when a project
 * context is in scope. Callers create one per top-level check; the checkers
 * fill the AST and type caches lazily as imports are resolved.
 */
export type ProjectContext = {
	sources: ProjectSources;
	/** Parsed AST per module path. Populated on demand by `loadModuleAst`. */
	asts: Map<string, Program>;
	/** RecordDef (no fields, statics = public exports) per module path. Populated by the type checker. */
	moduleTypes: Map<string, RecordDef>;
	/** Modules whose top-level scope check has finished. */
	scopeChecked: Set<string>;
	/** Stack of modules currently being type-checked (cycle detection). */
	visitingTypes: Set<string>;
	/** Stack of modules currently being scope-checked (cycle detection). */
	visitingScope: Set<string>;
};

export function createProjectContext(sources: ProjectSources): ProjectContext {
	return {
		sources,
		asts: new Map(),
		moduleTypes: new Map(),
		scopeChecked: new Set(),
		visitingTypes: new Set(),
		visitingScope: new Set()
	};
}

/**
 * Resolve an import target against the path of the importing module. The
 * target is a project-relative path: a bare name (`foo.ruka`) resolves in
 * the importing module's directory, `./` and `../` segments work the way
 * you'd expect, and a leading `/` is rejected (no project-root escapes).
 *
 * Returns the canonical project path on success, or `null` for invalid
 * inputs (absolute paths, escaping above the project root, empty result).
 */
export function resolveImportPath(fromPath: string, target: string): string | null {
	if (target.startsWith("/")) return null;

	const lastSlash = fromPath.lastIndexOf("/");
	const baseParts = lastSlash === -1 ? [] : fromPath.slice(0, lastSlash).split("/");
	const stack: string[] = [...baseParts];

	for (const part of target.split("/")) {
		if (part === "" || part === ".") continue;

		if (part === "..") {
			if (stack.length === 0) return null;
			stack.pop();
			continue;
		}

		stack.push(part);
	}

	if (stack.length === 0) return null;

	return stack.join("/");
}

/**
 * Parse + scope-check + type-check a project starting from `entry`. Imports
 * are resolved against `sources` and recursively checked. Returns the first
 * RukaError encountered, or null on success. The error's `path` field tells
 * the caller which module produced it.
 */
export function checkProject(
	sources: ProjectSources,
	entry: string
): RukaError | null {
	return checkProjectFull(sources, entry).error;
}

/**
 * Like `checkProject` but also returns the annotated AST map so the
 * evaluator can reuse the type-checker's parsed+annotated Program objects
 * (preserving receiver.resolvedTypeName and other compile-time annotations).
 */
export function checkProjectFull(
	sources: ProjectSources,
	entry: string
): { error: RukaError | null; asts: Map<string, Program> } {
	const ctx = createProjectContext(sources);

	let entryAst: Program;
	try {
		entryAst = loadModuleAst(ctx, entry);
	} catch (error) {
		if (error instanceof RukaError) return { error, asts: ctx.asts };
		throw error;
	}

	const scopeError = checkScope(entryAst, ctx, entry);
	if (scopeError) return { error: scopeError, asts: ctx.asts };

	const typeError = checkTypes(entryAst, ctx, entry);
	if (typeError) return { error: typeError, asts: ctx.asts };

	return { error: null, asts: ctx.asts };
}

/**
 * Lazily parse and cache a module's AST. Errors are tagged with the module's
 * path so the playground can surface "in lib/util.ruka: …" diagnostics.
 */
export function loadModuleAst(ctx: ProjectContext, path: string): Program {
	const cached = ctx.asts.get(path);
	if (cached) return cached;

	const source = ctx.sources.get(path);
	if (source === undefined) {
		const error = new RukaError(`module not found: ${path}`);
		error.path = path;
		throw error;
	}

	try {
		const ast = parse(tokenize(source));
		ctx.asts.set(path, ast);
		return ast;
	} catch (error) {
		if (error instanceof RukaError && !error.path) {
			error.path = path;
		}
		throw error;
	}
}
