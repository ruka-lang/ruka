# Ruka Toolchain — Architecture

## Goals

- **Extreme compilation speed**: single-pass codegen directly to native machine code; no LLVM, no global optimization passes in the default path. Fast iteration is the priority — optimization passes are a future opt-in layer.
- **Simplicity of implementation**: each component has one clear job; the pipeline is linear and easy to reason about; every cross-stage reference is an integer index, not a pointer.

---

## The `ruka` Executable

A single binary exposes every tool via subcommands:

| Subcommand     | Purpose                                              |
|----------------|------------------------------------------------------|
| `ruka new`     | Scaffold a new project                               |
| `ruka build`   | Compile the project to a native binary               |
| `ruka run`     | Build and execute                                    |
| `ruka test`    | Discover and run all `test` bindings                 |
| `ruka check`   | Type-check without producing an artifact             |
| `ruka lsp`     | Start the Language Server (JSON-RPC over stdio)      |
| `ruka version` | Print version information                            |
| `ruka help`    | Print usage                                          |

---

## Compilation Pipeline

```
Source Files
     │
     ▼
 SourceMap          load + mmap files; byte-offset → line/col table
     │
     ▼
 Tokenizer          source slice → []Token  (tags + byte offsets)
     │
     ▼
 Parser             []Token → Ast  (MultiArrayList nodes + extra_data)
     │
     ▼
 Sema               Ast → HIR  (name resolution, type inference, monomorphization)
     │
     ├──▶  Interpreter        HIR → Value  (tree-walk; used by `run` and `test`)
     │
     ├──▶  MirGen             HIR → MIR   (machine-level IR, virtual registers)
     │         │
     │         ▼
     │      RegAlloc          MIR virtual regs → physical regs / stack slots
     │         │
     │         ▼
     │      Encoder           MIR → native bytes  (x86-64 or AArch64)
     │         │
     │         ▼
     │      ObjectWriter      bytes → ELF / Mach-O / COFF object file
     │         │
     │         ▼
     │      (system linker)   object file → executable
     │
     ├──▶  LspServer          HIR + Diagnostics → LSP responses
     │
     └──▶  TestRunner         HIR test bindings → structured pass/fail
```

Each stage is a pure transformation that accumulates `Diagnostic` values rather than aborting. The pipeline short-circuits at stage boundaries: any `err`-severity diagnostic from Sema prevents MirGen and beyond from running.

---

## Source Layout

```
src/
├── main.zig                   entry-point; dispatches subcommands
├── cli/
│   ├── args.zig               CLI argument parsing
│   └── commands.zig           subcommand dispatch + per-tool entry points
├── source/
│   ├── SourceMap.zig          file loading, mmap, byte-offset → line/col
│   └── InternPool.zig         string interning; canonical identifier storage
├── syntax/
│   ├── Token.zig              Token and Token.Tag
│   ├── Tokenizer.zig          lexer: source slice → []Token
│   ├── Ast.zig                Node types, extra_data encoding, Ast container
│   └── Parser.zig             recursive-descent parser: []Token → Ast
├── sema/
│   ├── Scope.zig              lexical scope chain (flat array + generation index)
│   ├── Type.zig               Type representation
│   ├── TypePool.zig           canonical deduped type storage
│   └── Sema.zig               Ast → HIR; name resolution, type inference
├── ir/
│   └── Hir.zig                high-level typed IR (output of Sema)
├── interp/
│   ├── Interpreter.zig        tree-walk interpreter: HIR → Value
│   └── Value.zig              runtime Value union
├── compiler/
│   ├── MirGen.zig             HIR → MIR lowering
│   ├── Mir.zig                machine-level IR (virtual registers, flat inst list)
│   ├── RegAlloc.zig           linear-scan register allocator
│   └── backend/
│       ├── x86_64/
│       │   ├── Encoder.zig    MIR → x86-64 bytes
│       │   └── Abi.zig        System V / Windows x64 calling convention
│       ├── aarch64/
│       │   ├── Encoder.zig    MIR → AArch64 bytes
│       │   └── Abi.zig        AAPCS64 calling convention
│       └── obj/
│           ├── Elf.zig        ELF-64 object file writer
│           ├── MachO.zig      Mach-O object file writer
│           └── Coff.zig       PE/COFF object file writer
├── lsp/
│   ├── Server.zig             JSON-RPC loop over stdio
│   ├── Protocol.zig           LSP type structs (parsed with std.json)
│   └── handlers.zig           per-method handlers
├── test_runner/
│   └── Runner.zig             discovers test bindings, runs them, reports results
└── project/
    ├── Manager.zig            reads/writes ruka.toml, orchestrates build steps
    └── scaffold.zig           `ruka new` template generation
```

---

## Custom Backend Rationale

LLVM delivers great code quality but pays a large compilation-time tax:
- LLVM IR construction, verification, and serialization are not free.
- Even `-O0` runs several mandatory passes.
- LLVM startup and per-module overhead dominate for small-to-medium programs.

The custom backend trades peak optimization for compilation throughput:

| Property              | LLVM              | Ruka custom backend        |
|-----------------------|-------------------|----------------------------|
| Time to first binary  | seconds           | milliseconds               |
| Code quality (default)| good              | acceptable (fast reg alloc)|
| Optimization passes   | many              | none by default            |
| Target ISAs           | all               | x86-64 + AArch64 initially |
| Implementation cost   | near-zero (link)  | significant but finite     |

The approach is the same used by tcc, Zig's self-hosted backend, and QBE:
1. A simple, flat Machine IR with unlimited virtual registers.
2. A single-pass linear-scan register allocator.
3. A thin ISA encoder that reads MIR and emits bytes directly.
4. Minimal object file writers (ELF-64, Mach-O 64, PE/COFF).
5. Linking delegated to the system linker (`ld`/`lld`/`link.exe`).

Optimization passes (constant folding, dead-code elimination, inlining) can be layered onto the HIR→MIR lowering step later without touching the encoder or allocator.

---

## Memory Model

| Allocator       | Lifetime                | Used for                                               |
|-----------------|-------------------------|--------------------------------------------------------|
| `gpa`           | process lifetime        | SourceMap, InternPool, TypePool, HIR, long-lived errors |
| `arena`         | per compilation unit    | Parser scratch, Sema scratch; freed as a block         |
| `fixed_buffer`  | per tight inner loop    | Tokenizer escape formatting, tiny temp strings         |

Debug/ReleaseSafe builds wrap `gpa` with `std.heap.DebugAllocator`. Release builds use `std.heap.smp_allocator`.

---

## Diagnostic Model

```zig
pub const Diagnostic = struct {
    severity: Severity,
    file: SourceMap.FileId,
    span: Span,            // byte offsets { start: u32, end: u32 }
    message: []const u8,   // arena or interned

    pub const Severity = enum { err, warn, hint };
    pub const Span = struct { start: u32, end: u32 };
};
```

All stages accumulate diagnostics into a shared list. The list is flushed to stderr (or to the LSP client) after the pipeline finishes or short-circuits.

---

## Project File (`ruka.toml`)

```toml
[package]
name    = "my_project"
version = "0.1.0"

# entry is src/main.ruka
# outputs written to .out/<name>

[dependencies]
# future: local paths and package registry
```

---

## Design Constraints

- Token byte offsets are `u32`; source files are limited to 4 GiB.
- AST node indices are `u32`; a file may have at most 2³² nodes.
- MIR instruction indices are `u32`; a function may have at most 2³² instructions.
- Virtual register indices are `u32`.
- All cross-stage references are integer indices — no raw pointers — so stages can be trivially serialized or cached to disk later.
