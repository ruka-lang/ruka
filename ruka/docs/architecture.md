# Compiler Architecture

This document describes the structure and pipeline of the Ruka compiler, implemented in Go.

## Pipeline Overview

```
Source text
    │
    ▼
┌──────────┐
│  Lexer   │  []Token
└──────────┘
    │
    ▼
┌──────────┐
│  Parser  │  *ast.File
└──────────┘
    │
    ▼
┌──────────────┐
│ Scope Check  │  resolves names, validates captures/moves
└──────────────┘
    │
    ▼
┌─────────────┐
│ Type Check  │  bidirectional inference, exhaustiveness
└─────────────┘
    │
    ▼
┌────────────────┐
│ Monomorphiser  │  specialises comptime-parameterised functions
└────────────────┘
    │
    ▼
┌──────────┐
│   IR     │  flat three-address code
└──────────┘
    │
    ▼
┌──────────────┐
│   Codegen    │  native machine code (x86-64 / arm64)
└──────────────┘
```

Each stage is a pure function: input in, output + diagnostics out. No stage mutates the output of an earlier one. This keeps the pipeline easy to test in isolation and enables incremental re-use.

## Go Package Layout

```
ruka/
├── cmd/
│   └── ruka/
│       └── main.go               CLI entry point
├── internal/
│   ├── token/                    Token, TokenKind
│   ├── lexer/                    Tokenize(src) → ([]Token, Diagnostics)
│   ├── ast/                      File, Decl, Expr, Pattern, TypeExpr nodes
│   ├── parser/                   Parse(tokens) → (*ast.File, Diagnostics)
│   ├── scope/                    CheckScope(file) → (*Scope, Diagnostics)
│   ├── types/                    Type representation; CheckTypes → Diagnostics
│   ├── mono/                     Monomorphise → flat function list
│   ├── ir/                       IR instruction types; Builder
│   ├── codegen/                  Emit(ir) → machine code
│   ├── interp/                   Tree-walk interpreter (for ruka run on a single file)
│   ├── lsp/                      Language server (uses the pipeline with error recovery)
│   ├── bouquet/                  Package manifest, resolver, build graph
│   └── diag/                     Diagnostic, Severity, Pos, Span
└── fixtures/
    ├── ok/
    ├── scope-err/
    └── type-err/
```

## Parallel and Incremental Compilation

These are first-class concerns, not afterthoughts.

### File-level parallelism

Each Ruka file compiles independently through the lexer, parser, and scope-check stages. These three passes have no cross-file dependencies and can run concurrently. A worker pool processes files in the import DAG level-by-level: all files at depth N finish before any file at depth N+1 begins type-checking (which may need imported types).

```
import DAG level 0:  file A, file B          ← lex/parse/scope in parallel
import DAG level 1:  file C (imports A, B)   ← type-check after level 0 completes
```

The pipeline driver builds the import graph from `ruka.import` calls found during parsing. Circular imports are handled with a visited-set guard: if a file is already in the current import chain, the re-import returns the partial record built so far (analogous to C's include guard). The scheduler uses `sync.WaitGroup` over a bounded goroutine pool.

### Incremental compilation

Each file's output is cached on disk keyed by a hash of its source content plus the hashes of its transitive imports. On a subsequent build, a file whose hash matches its cached entry is skipped — the cached type info and IR are loaded directly. The cache is a directory of content-addressed blobs alongside a small manifest JSON.

Cache invalidation is conservative: if any transitive dependency changes, all files that import it (directly or transitively) are recompiled. This is safe and simple; a finer-grained tracker is deferred until the need is measured.

## The `ruka` Tool

`ruka` is the single binary. All functionality lives in subcommands.

```
ruka run <file>          interpret or compile-and-run a single .ruka file
ruka build <file>        compile a single .ruka file to a native binary
ruka check <file>        run the pipeline through type-check only; print diagnostics
ruka fmt <file>          pretty-print source
ruka lsp                 start the language server on stdin/stdout
ruka bouquet new <name>  scaffold a new bouquet (package)
ruka bouquet build       build the current bouquet
ruka bouquet run         build and run the current bouquet's entry point
ruka bouquet test        build and run all test declarations
```

`ruka run` chooses between interpreting and compiling based on a threshold (small files or interactive use → interpreter, otherwise compile). Both paths share the same pipeline through type-checking, so the same diagnostics appear regardless of the execution mode.

## Stage Details

### Lexer

Produces a flat `[]Token` from raw UTF-8 source. Never builds a stream. Discards whitespace and comments, but emits `TokNewline` — newlines are structurally significant as statement terminators and member separators in braced blocks (see grammar). On an unknown character or unterminated literal the lexer emits a diagnostic and continues scanning.

### Parser

Hand-written recursive-descent following `docs/grammar.md` exactly. Builds an `*ast.File`. On a syntax error the parser emits a diagnostic and resynchronises at the next safe boundary (`end`, top-level newline, EOF), inserting `BadExpr`/`BadDecl` sentinel nodes so later passes can continue without crashing.

### Scope Check

Resolves every name to its declaration. Builds a tree of `Scope` structs mirroring the lexical structure. Annotates each name reference with a pointer into the scope tree. Reports:

- Unresolved names.
- Duplicate declarations in the same scope.
- `local` declarations captured by an escaping closure.
- `&` (move) declarations used after their move point.

### Type Checker

Bidirectional inference. Each node is checked with an expected type hint; `nil` when the caller has no expectation. Resolves:

- Record literal → record type from context or from unique field-set match in scope.
- Variant constructor → variant type from context or from unique tag match in scope.
- Numeric literals → `int` / `float` by default, narrowed by context.
- Generic functions → deferred to the monomorphiser; the type checker only verifies that every call site provides compatible compile-time arguments.
- Match exhaustiveness: computed from the subject's type and the set of arm patterns.

A `Fatal` flag on a diagnostic suppresses cascading errors from the same root cause.

### Monomorphiser

Traverses call sites where the callee has `type`-valued parameters. Evaluates compile-time arguments (always concrete after type-checking). Produces a distinct specialisation for each unique argument tuple. Replaces call sites with calls to the specialisation. The output is a flat list of monomorphic function definitions with no remaining `type`-valued parameters.

### IR

A simple three-address IR. Each function is a list of basic blocks; each block is a list of instructions. The IR has no fancy features — its purpose is to be an easy target for the codegen pass and an easy input for an eventual optimiser.

See `data-structures.md` for the full IR instruction set.

### Codegen

Walks the IR and emits native machine code. Targets x86-64 first, arm64 second. The codegen is a straightforward instruction selector with a linear-scan register allocator. No sophisticated optimisation; correctness and simplicity first.

The runtime library is a small Go or C file that provides:

- `ruka_println`, `ruka_readln`, `ruka_read` — I/O
- `ruka_alloc`, `ruka_gc_root` — GC interface
- `ruka_panic` — unreachable / match non-exhaustion (should never fire after a correct type check)

### Interpreter

A tree-walk interpreter used by `ruka run` for single-file execution. It shares the same pipeline through type-checking and uses the same AST. It is *not* used by the compiler pipeline and has no influence on codegen.

### LSP

Runs the pipeline in error-recovery mode on every file change. Publishes diagnostics as LSP `textDocument/publishDiagnostics` notifications. Provides:

- Diagnostics (all pipeline errors).
- Hover (type of expression under cursor, read from the type map).
- Go-to-definition (scope info maps name → declaration site).
- Completions (in-scope declarations at cursor position).

The LSP server reuses the incremental cache so unchanged files are not re-analysed on every keystroke.

## Diagnostics

```go
type Diagnostic struct {
    Severity Severity  // Error | Warning
    Span     Span      // file + start + end positions
    Message  string
    Fatal    bool      // suppress downstream errors caused by this one
}
```

All passes return `[]Diagnostic` alongside their output. The driver accumulates them, prints in source order, and exits non-zero if any `Error` diagnostic is present.
