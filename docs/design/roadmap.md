# Ruka Development Roadmap

The primary near-term goal is an interpreter that can run a single-file Ruka project plus a basic LSP, so the language is pleasant to use in an editor and can reach users early. Early user feedback shapes language design decisions while they are still cheap to make, and a working interpreter is the foundation for eventual self-hosting.

Phases are sequential. Within a phase, items can be parallelized. Each item is a discrete, testable unit of work.

---

## Phase 0 — Project Skeleton

- [ ] Update `build.zig` for Zig 0.16.0 idioms (`std.process.Init`, updated APIs)
- [ ] Wire up subcommand dispatch in `cli/commands.zig` (`run`, `check`, `lsp`, `test`, `new`, `version`, `help`)
- [ ] `SourceMap`: file loading (mmap with read fallback), byte-offset → line/col table
- [ ] `InternPool`: string interning, pre-intern all keywords at startup
- [ ] `DiagList`: accumulate and render diagnostics to stderr with file/line/col context
- [ ] Custom test runner (`runners/test.zig`) confirms the harness works

---

## Phase 1 — Lexer

- [ ] `Token.Tag` enum — all keywords, operators, mode prefixes, literals, delimiters
- [ ] `Tokenizer`: source slice → `std.MultiArrayList(Token)`
  - [ ] Whitespace and `//` comment skipping
  - [ ] Integer literals: decimal, hex (`0x`), binary (`0b`)
  - [ ] Float literals
  - [ ] Boolean literals (`true`, `false`)
  - [ ] Character literals (`'a'`, `'\n'`, etc.)
  - [ ] String literals with escape sequences
  - [ ] String interpolation spans (`${...}`) tokenized as delimited regions
  - [ ] Multiline string literals (`|"...|"`)
  - [ ] Identifiers; keyword classification via `InternPool` lookup
  - [ ] All operators and punctuation (including `|>`, `..`, `..=`, `.{`, `.?()`, `.!()`)
  - [ ] Mode prefix tokens (`*`, `&`, `$`, `@`) adjacent to identifier
  - [ ] Named-param prefix (`~`) adjacent to identifier
  - [ ] Invalid-byte recovery (emit `invalid` token, continue)
- [ ] Unit tests covering every token kind and edge case
- [ ] Unit tests for error recovery (unterminated strings, invalid chars)

---

## Phase 2 — Parser

- [ ] `Ast` container: `std.MultiArrayList(Node)` + `extra_data: []u32`
- [ ] `Parser`: `[]Token` → `Ast`, recursive descent following `docs/grammar.html`
  - [ ] Declarations: `let`, `share`, `local`, `test` bindings
  - [ ] Binding LHS: simple, function+receiver (static/method), destructuring
  - [ ] Type annotations (all type forms from the grammar)
  - [ ] Literals: int, float, bool, char, string, multiline string
  - [ ] Collection literals `.{...}` (array/tuple resolved later by Sema)
  - [ ] Record literals (with and without type prefix)
  - [ ] Variant constructors (`.tag`, `.tag(expr)`, `Type.tag`)
  - [ ] Function expressions: params, return annotation, single-line and block bodies
  - [ ] Named parameters (`~name`, `~name=expr`) and trailing args
  - [ ] All operators with correct precedence (see grammar operator table)
  - [ ] Assignment (right-associative)
  - [ ] Pipeline operator `|>`
  - [ ] Ternary expression (`value if cond else value`)
  - [ ] Block expressions (`do ... end`)
  - [ ] `if` / `else if` / `else` (single-line and block forms)
  - [ ] `while` loop
  - [ ] `for` loop with simple and destructuring patterns
  - [ ] `match ... with ... end` with variant, literal, and guard arms
  - [ ] `return`, `break`, `continue`
  - [ ] `defer`
  - [ ] Postfix: field access, method call, index, `.?()`, `.!()`
  - [ ] Parenthesized expressions
  - [ ] Error recovery: skip to next declaration on parse error, collect all errors
- [ ] Unit tests for every grammar construct
- [ ] Unit tests for error recovery producing useful spans

---

## Phase 3 — Semantic Analysis

- [ ] `ScopeStack`: push/pop scopes, resolve names up the chain
- [ ] `TypePool`: canonical type deduplication, pre-assign primitive IDs
- [ ] `Sema`: `Ast` → `Hir` + `DiagList`
  - [ ] Resolve all identifier references to `Hir.DefId`
  - [ ] Type inference for literals, bindings, and expressions
  - [ ] Type-check binary and unary operators
  - [ ] Unify types at assignment and function call sites
  - [ ] Resolve collection literals to array or tuple based on context
  - [ ] Check `share` RHS is a compile-time value
  - [ ] Check `let` in mutable position, `local` is immutable
  - [ ] Binding mode checking (`$`, `@`)
  - [ ] Named-parameter matching at call sites (order-independent)
  - [ ] `match` exhaustiveness checking for variant types
  - [ ] `return` type compatibility with enclosing function
  - [ ] `break` / `continue` only inside loops
  - [ ] `self` only inside method receivers
  - [ ] Undefined name errors with helpful suggestions (Levenshtein distance)
  - [ ] Type mismatch errors with actual/expected types in the message
  - [ ] `ruka` builtin namespace — treat as a pre-declared record in the root scope

---

## Phase 4 — Interpreter

- [ ] `Value` union covering all runtime types
- [ ] Simple mark-sweep GC (or arena-per-call-frame as a first pass)
- [ ] `Interpreter`: tree-walk over `Hir`
  - [ ] Evaluate all literal types
  - [ ] Evaluate arithmetic, comparison, logical, range operators
  - [ ] Evaluate `let`, `local`, `share` bindings; mutable assignment
  - [ ] Evaluate block expressions (returns last value)
  - [ ] Evaluate `if` / `ternary`
  - [ ] Evaluate `while` and `for` with `break` / `continue`
  - [ ] Evaluate `match` with all pattern kinds
  - [ ] Evaluate `return`
  - [ ] Evaluate `defer` (LIFO at block exit)
  - [ ] Function calls (closures capturing their environment)
  - [ ] Named parameters and trailing argument calls
  - [ ] Method calls and static function calls
  - [ ] Field access, index access
  - [ ] `.?()` and `.!()` unwrapping (panic on failure with source location)
  - [ ] Pipeline operator `|>` (desugars to call)
  - [ ] Record construction and field access
  - [ ] Variant construction and pattern matching
  - [ ] String interpolation (call `to_string` equivalent on each interpolated value)
  - [ ] Multiline string literals
  - [ ] `option` and `result` as built-in variant types
- [ ] Built-in `ruka.*` functions
  - [ ] `ruka.print(s)` / `ruka.println(s)`
  - [ ] `ruka.import(path)` — load and evaluate another `.ruka` file, return as record
  - [ ] `ruka.type_of(expr)` — return type as a string at runtime
  - [ ] `ruka.len(collection)` — length of array, tuple, or string
  - [ ] `ruka.abs(n)` / `ruka.sqrt(n)`
  - [ ] `ruka.assert_eq(a, b)` — panic with message on failure
  - [ ] `ruka.compile_error(msg)` — emit diagnostic during Sema
  - [ ] `ruka.heap_alloc(size)` / `ruka.heap_free(bytes)`
- [ ] `ruka run` subcommand: load `src/main.ruka`, run pipeline, call `main()`
- [ ] Exit code reflects whether the program panicked or returned normally
- [ ] Runtime panic messages include source file, line, and column

---

## Phase 5 — Basic LSP

Goal: diagnostics, hover, and go-to-definition. Enough to make the language feel supported in any LSP-capable editor.

- [ ] `lsp/Server.zig`: JSON-RPC message framing over stdio (`Content-Length` headers)
- [ ] `lsp/Protocol.zig`: request/response/notification structs parsed with `std.json`
- [ ] Lifecycle
  - [ ] `initialize` / `initialized` handshake (declare capabilities)
  - [ ] `shutdown` / `exit`
- [ ] Document sync
  - [ ] `textDocument/didOpen` — parse and analyse the opened file; store result
  - [ ] `textDocument/didChange` — re-parse and re-analyse on every change
  - [ ] `textDocument/didClose` — evict cached state
- [ ] Diagnostics
  - [ ] Push `textDocument/publishDiagnostics` after every parse/analyse cycle
  - [ ] Map `Diagnostic.Span` byte offsets to LSP `Range` (line/character)
  - [ ] Severity mapping: `err` → Error, `warn` → Warning, `hint` → Hint
- [ ] Hover (`textDocument/hover`)
  - [ ] Identify the node at the cursor position
  - [ ] Return the inferred type of the expression as a Markdown code block
  - [ ] Return the doc comment above a binding, if present
- [ ] Go to definition (`textDocument/definition`)
  - [ ] Resolve the identifier under cursor to its `Hir.DefId`
  - [ ] Return the `Location` (file URI + range) of the binding
- [ ] Completion (`textDocument/completion`)
  - [ ] Emit all keywords
  - [ ] Emit all bindings in scope at the cursor position
  - [ ] Emit `ruka.*` builtin names after `ruka.`
- [ ] `ruka lsp` subcommand starts the server

---

## Phase 6 — Test Runner

- [ ] `ruka test` subcommand
- [ ] Discover all `test` bindings across all `.ruka` files in `src/`
- [ ] Run each test function through the interpreter
- [ ] Collect pass / fail / panic results per test
- [ ] Output: one line per test (`ok` / `FAIL` / `PANIC`) then a summary count
- [ ] Non-zero exit code if any test failed or panicked
- [ ] `--filter <name>` flag to run a single test by name

---

## Phase 7 — Project Manager

- [ ] Parse `ruka.toml` (package name, version, entry, output)
- [ ] `ruka new <name>` — scaffold directory: `src/main.ruka`, `ruka.toml`
- [ ] `ruka build` — run the full pipeline over the project's source files
  - [ ] Walk `src/` for all `.ruka` files
  - [ ] Process imports (`ruka.import`) to build a dependency graph
  - [ ] Topological sort; analyse files in dependency order
- [ ] `ruka check` — pipeline up to Sema only; print diagnostics; no output artifact
- [ ] `ruka version` — print semver from build options

---

## Phase 8 — Compiler (Custom Backend)

_Start after the interpreter and LSP are solid and the language design has stabilized._

- [ ] `MirGen`: `Hir` → `Mir` (flat virtual-register instruction list)
  - [ ] Lower all expression types
  - [ ] Lower control flow to labeled blocks and conditional jumps
  - [ ] Lower function calls to call instructions with ABI-ordered operands
  - [ ] Lower `defer` to explicit cleanup blocks
- [ ] `RegAlloc`: linear-scan register allocator
  - [ ] Live range computation from the flat instruction list
  - [ ] Greedy physical register assignment
  - [ ] Spill to stack slots when physical registers are exhausted
- [ ] `backend/x86_64/Encoder`: `Mir` + `Allocation` → bytes
  - [ ] Encode the ~25 instruction variants needed (MOV, ADD, SUB, IMUL, IDIV, CMP, Jcc, CALL, RET, LEA, PUSH, POP, XMM ops for floats)
  - [ ] System V AMD64 ABI (Linux/macOS)
  - [ ] Windows x64 ABI
- [ ] `backend/aarch64/Encoder`: `Mir` + `Allocation` → bytes
  - [ ] AAPCS64 calling convention
- [ ] `backend/obj/Elf.zig`: emit ELF-64 object file (`.text`, `.rodata`, `.data`, symbol table, relocations)
- [ ] `backend/obj/MachO.zig`: emit Mach-O 64-bit object file
- [ ] `backend/obj/Coff.zig`: emit PE/COFF object file (Windows)
- [ ] Invoke system linker (`ld` / `lld` / `link.exe`) to produce final executable
- [ ] `ruka build` switches from interpreter-based execution to compiled output

---

## Phase 9 — Self-Hosting Preparation

_When the compiler can produce correct binaries for non-trivial programs._

- [ ] Port the standard library stubs (`std/root.ruka`) to real Ruka code
- [ ] Write the tokenizer in Ruka; verify output matches the Zig tokenizer
- [ ] Write the parser in Ruka
- [ ] Write Sema in Ruka
- [ ] Compile the Ruka-written front-end with the Zig-written compiler
- [ ] Bootstrap: use the compiled Ruka front-end to compile itself
