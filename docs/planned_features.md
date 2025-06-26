# Ruka

Ruka is planned to be a general use, programming language. Ruka's planned features include:
    - Build system, package manager, compiler, repl, and lsp integrated into one tool.
    - Compiled.
    - Records (structures) used for namespaces as well as data structures (a la Zig).
    - Mutable semantics.
    - Pattern matching.
    - Manual memory management with allocators (a la Zig).
    - Strong static typing.
    - Types (records, enums, built-ins), and fuctions are first class values, but must be 
        known at compile time and stored in const bindings.
    - Interfaces for shared functionality.
    - Named arguments (a la Ocaml).
    - Type inference (a la Ocaml).
    - Meta-programming by Compile-time interpretation of Ruka code and type reflection (a la Zig).

Features being considered:
    - A combination of Methods and Uniform Function Call Syntax (UFCS):
        - fn defined in the same module whose first parameter is the type in question will
            be callable as a method and have access to private fields and the type only 
            needs to be in scope where the method is called, appearing like typical OO.
        - fn defined in a different module whose first parameter is the type in question 
            will be callable with UFCS but only have access to public fields and the 
            function name must be in scope where called.
    - Borrow by default, with modes to control lifetimes.
    - Garbage collected by default with ability to control memory as needed.
    - Implicit returns.
    - Optional type annotations.
    - Do end for scope, { } for defining and instancing types.
