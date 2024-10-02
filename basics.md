# Ruka

Ruka is planned to be a general use, compiled programming language. Ruka's planned features include:
    - Strong static typing
    - Type inference, Result location semantics
    - Mutable semantics, var vs. let
    - Meta-programming by Compile time execution of Ruka code
    - All kinds of data are first class values, including modules, and types 
    - A combination of Methods and UFCS
        - fn defined in the same module whose first parameter is the type in question will 
      be callable as a method and have access to private fields and the type only needs to be 
      in scope where the method is called, like typical OO 
        - fn defined in a different module whose first parameter is the type in question will
      be callable with UFCS but only have access to public fields and the function name must be 
      in scope where called
    - Borrow by default
    - Garbage collected with ability to stack allocate and create traditional heap allocators
    - Interfaces for shared functionality
    - Named arguments
    - Pattern matching
    - Record for a structure which defaults to private, Struct for a structure which does not

# Old Stuff 

## Circuits
`Ruka` has an extension called `Silver`, which integrates HDL into the language for simple FPGA development.

Refer to `Silver` for details
```rust
// Hardware circuit instantiation must be done at compile time
// Ports will connect to mmio
// The returned structure contains functions to interact w/ hardware through the mmio

// This creates a circuit type
const AndGate = circuit { 
    port (
        x(in: u1)
        y(in: u1)
        z(out: u1)
    )
  
    arch (
        z = x and y
    )
}

let and = andGate.{}   // This creates an instance of AndGate, 
                       // which must be done at compile time

and.put(x: 1, y: 1)

let result = and.get('z)  // Output ports are setup with signals,
                          // so reading from a output port blocks 
                          // execution until the signal is high
```
