# Ruka

Ruka is planned to be a general use, compiled programming language. Ruka's planned features include:
    - Strong static typing
    - Pattern matching
    - Errors as values
    - Interfaces for shared functionality
    - All data are first class values, including types, interfaces, and modules
    - Meta-programming by Compile time execution of Ruka code
    - Mutable semantics
    - Named arguments
    - Borrow by default
    - Named parameters
    - Type inference, Result location semantics
    - Either 
        - methods or 
        - uniform function call syntax which would make interfaces interesting

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
    );
  
    arch (
        z = x and y;
    );
};

let and = @andGate.{}; // This creates an instance of AndGate, 
                       // which must be done at compile time

and.put(x: 1, y: 1);

let result = and.get(:z); // Output ports are setup with signals,
                          // so reading from a output port blocks 
                          // execution until the signal is high
```
