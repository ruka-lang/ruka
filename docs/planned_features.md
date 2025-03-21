# Ruka

Ruka is planned to be a general use, programming language. Ruka's planned features include:
    - Compiles to binary
    - Strong static typing
    - Type inference
    - Mutable semantics, var vs. let
    - Meta-programming by Compile-time interpretation of Ruka code and type reflection
    - Everything is first class values, including modules, and types
    - A combination of Methods and UFCS
        - fn defined in the same module whose first parameter is the type in question will
      be callable as a method and have access to private fields and the type only needs to be
      in scope where the method is called, like typical OO
        - fn defined in a different module whose first parameter is the type in question will
      be callable with UFCS but only have access to public fields and the function name must be
      in scope where called
      - Or just Methods and Reverse function application
    - Borrow by default
    - Garbage collected with ability to stack allocate and create traditional heap allocators
    - Interfaces for shared functionality
    - Named arguments
    - Pattern matching
