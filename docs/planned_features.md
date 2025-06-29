# Ruka

Ruka is planned to be a general use, programming language. Ruka's planned features include:
- Build system, package manager, compiler, repl, and lsp integrated into one tool.
- Compiled.
- Garbage collected by default with ability to control lifetimes and manually manage memory as needed.
- Immutable borrow (reference without taking ownership) by default, with binding and parameter modes to control lifetimes:
  - stk: Stack-allocated, passing to a parameter which allows escaping the function scope will cause a compile error. When used on parameters, it will be passed by value (copied) and will not take ownership of the original value.
  - loc: Immutable borrow which cannot escape the function scope, does not take ownership.
  - mov: Function takes ownership of the parameter and can use it however. Similar to a stk parameter in behaviour but without a copy.
  - mut: Mutable borrow, parameter can be changed, the reference cannot escape the function scope and ownership is not taken.
  - `#` (Interpreted): Parameter is constant and must be known at compile time and the value is interpreted during compilation.
- Records (structures) used for namespaces as well as data structures.
- Types (records, unions, enums, built-ins), and fuctions are first class values, but must be known at compile time and stored in const or local bindings.
- Mutable semantics.
- Pattern matching.
- Strong static typing.
- Interfaces for shared functionality.
- Named arguments.
- Type inference, with type annotations necessary only for clearing up ambiguity.
- Meta-programming by interpretation of Ruka code and type reflection.
- Built in testing functionality.
- Expression based language.
- Do end for scope, { } for defining and instancing types.
- Hybrid of Methods and Uniform Function Call Syntax (UFCS):
  - fn defined in the same scope as the type whose first parameter is that type in question will have access to private fields. Only the type needs to be in scope for the function is called (this last bit would be for importing ease as with pure UFCS you would have to import each method or just build import everything from that file which may not be desired/cause naming conflicts).
  - and fn defined in a different scope whose first parameter is the type in question will be callable with UFCS but only have access to public fields and the function must be in scope where called.
- Last line in functions is returned (maybe).