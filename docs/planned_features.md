# Ruka

Modular compiler programming language

# Ruka.web
- Frontend and backend compiler supporting Fullstack web development.
- First class JSX-like syntax for HTML and CSS templating directly in Ruka.

# Ruka.hdl
- Hardware description language using Ruka syntax.
- Similar to SolidJS signals, Hardware modules return interfaces which interact with the hardware.

# Old

Ruka is planned to be a general use, programming language. Ruka's planned features include:
- Build system, package manager, and compiler integrated into one tool.
  - Packages are called `Root`s and are managed with the `Branch` package manager.
- Compiled.
- Garbage collected by default with ability to control lifetimes and manually manage memory as needed.
- Borrow (not ownership change) by default, with parameter modes to control lifetimes and ownership:
  - loc: Defualt, immutable borrow which cannot escape the scope.
  - mut: Mutable borrow which cannot escape the function scope.
  - ref: Immutable borrow which can escape function scope. (&)
  - ptr: Mutabe borrow which can escape function scope. (*)
  - mov: Function takes ownership and responiblity of the parameter. Similar to a stk parameter in behaviour but without a copy.
  - stc: Stack-allocated, passing to a parameter which allows escaping the function scope will cause a compile error. When used on parameters, it will be passed by value (copied) and will not take ownership of the original value.
  - eva (evaluated): Parameter is constant and must be known at compile time and the value is interpreted during compilation.
- Types(records, variants, built-ins, types, functions, etc.), are first class values, but must be known at compile time and stored in const or local bindings.
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
  1) (implicit methods) functions defined in the same scope as the type whose first parameter is that type in question will have access to private fields. Only the type needs to be in scope for the function is called (this last bit would be for importing ease as with pure UFCS you would have to import each method or just bulk import everything from that file which may not be desired/cause naming conflicts).
  2) and functions defined in a different scope whose first parameter is the type in question will be callable with UFCS but only have access to public fields and the function must be in scope where called.
  3*) or (traditional) explicit methods with private access and UFCS / Pipelines with public access.
