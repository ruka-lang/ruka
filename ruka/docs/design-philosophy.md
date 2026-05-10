# Design Philosophy

This document captures the guiding principles behind the Ruka compiler implementation in Go. It explains *why* decisions were made — not just what was chosen.

## Why Go

Go is chosen as the implementation language for the following reasons:

- **Readability as default.** A compiler is a large codebase read by many contributors over time. Go's explicit style, lack of magic, and single formatting standard keep the code accessible.
- **Fast compile times.** The compiler compiles fast. This matters when iterating on the compiler itself and when driving the test suite.
- **Strong standard library.** Go ships with everything needed for a compiler: unicode handling, buffered I/O, string building, sorting, maps, and a testing framework — with no dependency churn.
- **Explicit error handling.** Compiler passes produce rich, structured errors. Go's `(value, error)` convention maps naturally to passes that can either succeed or accumulate diagnostics.
- **Garbage collection.** The compiler does not need to manually manage AST nodes or interned strings. GC removes a large class of bugs without meaningful runtime cost for a compiler workload.
- **Concurrency without complexity.** Goroutines and channels are available if parallel compilation (e.g. compiling independent files concurrently) becomes worthwhile, without forcing the architecture to commit to it up front.

Go is *not* chosen because it is the fastest possible host language or because it matches Ruka's own semantics — it is chosen because it is the right tool for writing a clear, correct compiler.

## Relationship to the TypeScript Interpreter

The TypeScript interpreter in `ruka-lang.org/` is a *simulator* for development purposes — it demonstrates the language semantics and powers the playground. The Go compiler is the *production implementation*. They share only:

- The same language specification (`docs/reference.md`, `docs/grammar.md`).

## Compile-time vs Runtime — The Core Distinction

Ruka is a statically typed, compiled langauge that uses an interpreter to allow executing Ruka code during compilation for metaprogramming or generating complex constants. 

1. All names are resolved (scope check).
2. All types are consistent (type check).
3. All match expressions are exhaustive (exhaustiveness check).
4. All `#`-prefixed values are actually available at compile time.
5. Ownership/move and mutable semantics are respected (`&` mode, `*` mode).
6. `@`-mode declarations are never captured by closures that outlive their declaring function.

If a program reaches codegen, it is already known to be correct. 

## Error Philosophy

The compiler should produce *actionable* diagnostics:

- Every error carries a source location (file, line, column).
- Error messages identify the root cause, not the symptom. "undefined name 'foo'" is better than "cannot resolve type".
- The type checker propagates a `fatal` flag on inference failures so that downstream errors caused by a single root cause are suppressed. Surface one good error, not a cascade.
- Error recovery during parsing should be good enough to continue and report multiple independent parse errors in a single run, but must not produce a partially-formed AST that confuses later passes.

## Bidirectional Type Inference

Ruka's type inference is *resolution*, not synthesis. Every type must already exist in scope; inference finds which one. The bidirectional checker flows type information both top-down (from expected types) and bottom-up (from expression shapes).

Design consequences:

- The type checker receives an *expected type* at each call site. Callers that have no expectation pass `nil` / a sentinel `Unknown` type.
- When inference cannot uniquely resolve a type, that is always a *compile error*, never a silent default (except for numeric literals, which default to `int` / `float`).
- Behaviours are *never* inferred structurally; they must be written explicitly. This distinguishes monomorphic record parameters from polymorphic behaviour parameters.
- Compile-time (`#`) parameters propagate their result as a constant that can be used in other parameter types (e.g. `(#t: type, a: t, b: t)` — the type of `a` depends on the compile-time value of `t`). Modes are never inferred; `#` must always be written explicitly.

## Generics via Monomorphisation

Ruka has no separate generic syntax. Compile-time `type`-valued parameters *are* generics. The compiler monomorphises each unique set of compile-time arguments into a distinct specialisation. This means:

- The type checker operates over monomorphised instances, not over generic templates.
- The monomorphiser runs before the final codegen pass.
- Two calls `min(i32, 3, 7)` and `min(f64, 1.5, 2.0)` produce two distinct functions: `min__i32` and `min__f64` (or whatever mangling scheme is chosen).

## File-as-Record Semantics

A Ruka file *is* a record. Its `let` declarations are public members; its `@`-mode declarations are private. `ruka.import("path")` returns this record as a compile-time constant. Consequences:

- The compiler builds a *file record type* for every compiled file.
- Circular imports are not a compile error (just ignore sub-imports that point to the current file (Similar to C's #ifndef)).
- The import resolution pass runs before type checking and produces a DAG of file records.
- Because import results are compile-time constants, an imported type can appear in a `type`-typed parameter directly without a cast or reflection step.

## Test-Driven Development

Every new feature must have a failing test before implementation begins. The test suite mirrors the interpreter fixture layout:

- `fixtures/ok/` — programs that must compile and run successfully.
- `fixtures/scope-err/` — programs with name resolution errors; first-line comment declares the expected error substring.
- `fixtures/type-err/` — programs with type errors; same convention.

Tests are auto-discovered: dropping a `.ruka` file in the right directory is sufficient. This removes friction from writing regression tests.
