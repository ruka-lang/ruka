# Ruka

Ruka is planned to be a general use, programming language. Ruka's planned features include:
- Build system, package manager, compiler, repl, and lsp integrated into one tool.
- Compiled.
- Records (structures) used for namespaces as well as data structures (a la Zig).
- Mutable semantics (var vs let).
- Borrow by default, with parameter modes to control reference lifetimes:
  - ref: Immutable reference which can escape the function scope, default mode.
  - loc: Immutable reference which cannot escape the function scope.
  - mov:  Function takes ownership of the parameter, parameter cannot escape the function scope, 'by value'.
  - mut: Mutable reference, parameter can be changed, but the reference cannot escape the function scope.
  - `#` (Interpreted): Parameter is constant and must be known at compile time and the value is interpreted during compilation.
- Types (records, unions, enums, built-ins), and fuctions are first class values, but must be known at compile time and stored in const or local bindings.
- Pattern matching.
- Strong static typing.
- Interfaces for shared functionality.
- Named arguments (a la Ocaml).
- Type inference (a la Ocaml), with type annotations necessary only for clearing up ambiguity.
- Meta-programming by Compile-time interpretation of Ruka code and type reflection (a la Zig).
- Built in testing functionality.
- Expression based language (a la Rust).

Features being considered:
- Manual memory management with allocators (a la Zig) or
- Garbage collected by default with ability to control memory as needed (a la Jane Street's Ocaml compiler).
- A combination of Methods and Uniform Function Call Syntax (UFCS):
  - fn defined in the same record whose first parameter is the type in question will be callable as a method and have access to private fields and the type only needs to be in scope where the method is called, appearing like typical OO.
  - and fn defined in a different record whose first parameter is the type in question will be callable with UFCS but only have access to public fields and the function name must be in scope where called.
  - or use UFCS but functions defined in the same record as the type will be treated as "methods" for the sake of LSP autocomplete.
- Implicit returns.
- Do end for scope, { } for defining and instancing types.