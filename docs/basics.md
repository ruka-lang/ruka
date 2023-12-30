# Language Syntax
 
## Comments
```
// A single-line comment

/*
 * multi-line comment
 */

/**
  *  Documentation comment
  */
```

## Bindings
Bindings in `Cosmic` follow the form of:  
<pre>
  kind tag [: type] [= expression];
</pre>
with the parts surrounded by [] being optional.  

## Binding Declaration and Initialization
There are two kinds of bindings:

- `const`  
```rust
// Constants must be assign a value when declared, and cannot be reassigned, they must be known at compile time, either a literal or a comptime expression result
const msg = "Hello, world!";
```

- `let`  
```rust
// A variable
let year = 2023;
year = 2024;
```

`Cosmic` supports multiple assignment
```rust
let x = 12;
let y = 31;
x, y = y, x; # swaps bindings with no need for temporary bindings
```

Bindings of the same type can be grouped together.
```rust
// let bindings still don't need to be initialized right away
let (
    x = 72;
    y;
)
// If done on the same line, must be separated by commas
let (x, y);

```

## Polish notation
```rust
(operator)(args);
(++)(x);
```
## Type specification basics

When declaring bindings, types are usually inferred based on later usage of the binding, 
but types can be specified if desired.

<pre>
    kind tag [: type] [= expression];
</pre>

If the binding is not initialized,
then a type specification must be added.
```rust
let x = 83;

let name: string;
```

## Memory Management
In `Cosmic` memory is GC/stack allocated by default. Memory can be allocated manually using an allocator if desired. And GC can be disabled completely on a pre project basis.
- Manual management:
  - Using an allocator, you can manage memory manually, which will return a pointer to the memory which must be freed before the program ends
  - Allocators use the built-in memory functions under the hood like cosmic.new() rex.free() (for many pointers), rex.create(), rex.delete() (for individual variables)
```rust
let name: int = 12; // Stack allocated

let allocator = std.mem.testingAllocator.{};

let names: *[5]string = allocator.create([5]string); // Allocates an array and returns a pointer to it
defer allocator.delete(names); // Manual memory must be freed
```
In `Cosmic`, any type that implements the `Free` trait will have their `free` method called at the end of their scope
```rust
const Free = trait {
    free: fn (mut&)() -> void
};

const Vector = (@type: typeid, allocator: std.mem.Allocator) => moduleid {
    return module {
        const t = record {
            data: [*]type,
            size: int,
            capacity: int,
            allocator = allocator // Properites can have default values which will infer the type
        };

        // Will be called when a Vector(type) goes out of scope
        const free = (mut self: &t) => {
            self.allocator.free(self.data);
        };
    }
};

```

## Basic Primitive Types
Here is a list of `Cosmic`'s primitive types:
- `int`    
  - 12, architecture dependent size
- `i#`     
  - \# bit signed integer i.e. i16
- `uint` 
  - 12, architecture dependent size
- `u#`     
  - \# bit unsigned integer i.e. u8
- `float`  
  - 12.2, architecture dependent size
- `f#`     
  - \# bit float i.e. f32
- `byte`   
  - 'a' or 0xfd
- `string`
  - "Hello, world!"
  - "| Multi
     | line
     | string
     |"
- `regex`
  - \`foo|bar\`
- `bool` 
  - true, false
- `void` 
  - also ().
- `null`
- `typeid` 
  - i32, int, char, MyRecord. Types are values in `Cosmic`
- `moduleid`
- `error`
- `range` 
  - 0..10, 5...15
- `tag`   
  - :quick :skip
  - Polymorphic enums, i.e. don't need to be part of a type. 
  - Also used for identifiers, when used for identifiers the ":" can be omitted.
  - When used for map keys, the ":" is moved to the rhs
- `any`
- `rawptr`

## Primitive Data Collections
`Cosmic` has a few primitive data collections for you to use:
- `Array`
```rust
// Arrays are static, their sizes cannot change and must be known at compile time
let arr = [5]{1, 2, 3, 4, 5};
let num = arr[2];
std.testing.expect(num == 3);
```

- `Dynamic Array`
```rust
// Can change size
let arr = [..]{1, 2, 3};
let num = arr[1];
std.testing.expect(num == 2);
```

- `Tuple`  
Tuples can be indexed, or destructured using pattern matching. The cosmic.len() function can be used to assess the length of a tuple
```rust
let pos = {10, 15};

std.testing.expect(cosmic.len(pos) == 2);

let {x, y} = {pos[0], pos[1]};
let x, y = pos; // The lhs braces are not required

std.testing.expect(x == 10 and y == 15);
```

- `Map`
```rust
// Can change size
let atomic_mass: %{tag, f32} = %{
    beryllium: 9.1022,
    carbon: 15.999
};

let atomic_mass = %{
    "beryllium" => 9.1022,
    "carbon" => 15.999
};

let carbon_mass = atomic_mass[:carbon];
std.testing.expect(carbon_mass == 15.999); // For floats == only compares the whole number
```

## String interpolation
```rust
let fname = "foo";
let lname = "bar";

let name = "#{foo} #{bar}";
```

## String concatenation
```rust
let fname = "foo";
let lname = "bar";

let name = foo ++ " " ++ bar;
```

## Blocks

Multi-line blocks are enclosed using braces: {}
```rust
{
    let x = 83;
}
```
Blocks can also have capture groups
```rust
{ |&| // captures reference to all variables in above scope

}
```

## Function Basics
All functions in `Cosmic` are anonymous closures, so function definition involves storing a function literal in a binding. Captured variables must be explicitly captured.

Anonymous function creation follows the form of:
<pre>
  ([mode] parameter [: type]) [: return type] body;
</pre>
the body is a block or single-line =>

Function definition follows the form of:
<pre>
  kind tag [: type] = anonymous fn;
</pre>

A single-line body function
```rust
const hello = () => return "Hello, world!";
```
values must be returned explicitly

A multi line body.
```rust
const add = (x, y) => {
    return x + y
};
```
Parameters can be positional, or named. Named parameters must be declared with ~ preceding the tag. They are inferred to be optional types, but their types can be set to standard types. If used as optional types, must be after all positional parameters.
```rust
const add = (x, y) => {
    return x + y
};

add(1, 2); // x = 1, y = 2

const add = (x, ~y) => {
    return x + y
};

add(y: 1, 2); //# y = 1, x = 2
add(1); //# x = 1, y = null
```

## Error Handling
```rust
// Returns a result, which is a union (string or error)
const func1 = () => !string {
    if (...) {
        return error.someError;
    }
};

// Returns a result, which is a union (void or error)
const func1 = () => !void {
    if (...) {
        return error.someError;
    }
};

// Will throw exception if error
let s: string = func1() as string;
// If error, returns error from current function
let s: string = func1().!;

// Returns a optional, which is a union (int or null)
const func2 = () => ?int {

};

// Will throw exception if null
let i: int = func2() as int;
// If null, returns error from current function
let i: int = func2().?;
// Null and false is treated as false, everything else is treated as true
// Can give a default value if return is null with or
let i: int = func2() or 12; 
```

## Context
Every scope contains an implicitly defined context binding, which is passed to scopes and functions called in the scope either implicitly or explicity
```rust
context.x = 12;
context.y = 15;

const add = () => int {
   return context.x + context.y;
};

add(); // Context passed implicitly

let newContext = cosmic.Context.{}; // Create a new context
newContext.x = 10.0;
newContext.y = 8.1;

// Unsure on syntax for passing context explicitly
cosmic.context(newContext)
add(); // Error, mismatched types
add(context: newContext); // Error, mismatched types
```

## Pattern Matching
```rust
const Result = union {
    ok(int),
    err(string),
    other
};

let x = Result.ok(12);

match (x) {
    | Result.ok do |val| std.fmt.println("{}", val),
    | .err do |err| std.fmt.println(err), // The enum type can be inferred to be the type of x
    // Cases can be guarded using when followed by a condition
    // If the condition returns true, that case will execute
    | x when x.ok?() => {},
    | _ => {},
}

let source = "int main() {}";

// The beginning of strings can be pattern matched,
// capturing the remaining portion of the string as a slice
match (source) {
    | "int", ... => { |rest|
        std.io.printf("{}\n", rest); // " main() {}"
    }
}

let nums = [5]{1, 4, 2, 6, 8};

// Slices can be matched
match (nums[..]) {
    | [] => {
        // Matches an empty slice
    },
    | [] => { |elem|
        // Matches a slice with one element
    },
    | [..] => { |elem, rest|
        // Matches a slice with atleast two elements
    },
    | [..] => { |_, rest|
        // Captures can be ignored with "_"
    }
}

```

`Cosmic` also has a pattern matching operator `=~`, which returns rhs if pattern matches, otherwise returns null.
```rust
let input = "foo";
let reg = `foo|bar`;

if (foo =~ reg) {

}

let tup = {52, 74, 412, 33, 87, 36};

if (pos ~= {_, 74, ...}) { |rest|

}

let nums = [5]{1, 2, 5, 3, 2};

if (nums[..] ~= []{1, 2, ...}) { |rest|

}
```


## Conditionals
```rust
if (condition) {

} else if (another_condition) {

} else if (variant =~ value) { |inner|

} else if (optional()) { |not_null|

} else if (result()) { |not_error|

} catch { |error|

} else {

}

unless (condition) {

}
```

## Loops
`Cosmic` has two looping constructs, range-based for loops, and while loops.
```rust
for (iterable, iterable2) { |i, i2|

}

while (condition) {

}

while (optional()) { |value|

}

while (result()) { |value|

} catch { |error|

}
```

## Function type specification
```rust
// Functions that take no parameters have empty "()" before the arrow.
// Void returns can be specified in two ways.
// The return type must always be specified in type specifications.
const foo: fn () -> ();
const bar: fn void -> void;

// Types can be specified for multiple parameters at a time.
const add = (x, y: int) => int {
    return x + y
};

// Function types can be specified separately
cosmic.type(fn (int, int, int) -> int)
const add_three = (x, y, z) do return x + y + z;
```

## Reference Modes
Reference parameters can have constraints on them, called modes. Borrow types can only be mutated
in the scope they are defined in. Values passed to functions by borrow
cannot be mutated, unless they are passed in the unique or exclusive modes. This
may be able to be relaxed, so all values behind borrows can be modified
- Borrow types
  - `&` borrow mode, pass by reference
      - `loc` local mode, borrow cannot escape scope
      - `mov` unique mode, ownership of borrow is moved into function
      - `mut` exclusive mode, only one active borrow to value so safe to mutate
- All types
  - `@` or `comptime@` compile time mode
```rust
let x, y = 12, 11;

const use = (mov x: &int) => {};

const add = (x, y: &int) => {
    use(&x);
    return x + y; // Error x used after move
};

let name = "foo";

const rename = (name: mut& string) => {
    name = "bar";
};

rename(&name);
name; # "bar"

```

## Creating new types
- `Record`  

All records are anonymous. Members can be accessed with the `.` operator. Members can also be accessed by indexing with a tag, provided the tag is known at compile time.
```rust
// Record definitions only contain data members, methods are added separately
const Pos = record { // record{} is the syntax to create anonymous record type
    x: int, 
    y: int
};

// Record members can be given default values, the types will be inferred
const Other = record {
    x = 12, # int
    y = 32.1 # float
};

let pos = .{x = 12, y = 13}; // .{} is the syntax to create anonymous record instances, type will be inferred
let pos = Pos.{x = 12, y = 13}; // Can also specify name of record
// Functional updates, creates a copy of pos, with y changed to 11
let pos2 = .{...pos, y = 11};

let pos_x = pos.x;
let pos_y = pos.y;
let pos_z = pos[:x];
```

- `Union`  

Tagged unions, anonymous. If a tag is not given a type, it is given void. Can specify tag integer type
```rust
const Result = union(u8) {
    ok(int),
    err(string),
    other
};

let x = Result.ok(12);
let y = Result.err("Some error message");
let o = Result.other;

// Variant can be pattern matched, to access inner values, errors if rhs is not the matching tag
let Result.ok(z) = x;

std.testing.expect(z == 12);

// Variant can also be used for branching based on if the pattern matches or not
// The variant type can be inferred
if (.ok =~ x) { |z|
    std.io.printf("{}", z);
}
```

## Modules
In `Cosmic`, modules are collections of bindings. Bindings can be let or const.
All modules are anonymous, named modules are made by storing modules in bindings
``` rust
const Constants = module {
    const PI = 3.14
};

let area = Constants.PI * (radius ** 2);
```
Modules can be extended using functional updates
```rust
const Constants = module {
    const PI = 3.14;
};

const MoreConstants = module {
    ...Constants;
    const TwoPi = Constants.PI * 2;
    const Avogadros = 6.022e-23;
};
```

## Methods and Receivers

There are no methods in Cosmic, instead Cosmic uses UFCS(Uniform Function Call Syntax), meaning any function can be used as a method aslong as the first parameter matches the type of the variable it is being called on
```rust
const Player = record {
    pos: {f32, f32},
    health: int
};

// Methods for types are declared by specifying a reciever after the indentifier
// This can be used to add functionality to primitive types
const set_pos = (mut self: &Player, pos: {f32, f32}) do self.pos = pos;

const set_health = (self: &Player, health: int) do self.health = health;

let player = Player.{};
player.set_pos(pos: {0.0, 10.0}); // Arguments can be passed with labels
```

## File imports
When files are imported, they are stored as modules.
Builtin functions are under the implicitly imported cosmic module
```rust
const std = cosmic.import("std");
```

## Signals
Reactivity
```rust
// name: &string, update_name: signal
let {name, update_name} = cosmic.signal(string);
```

## Threads
Green threads
```rust
let tid = cosmic.spawn(() => {
    // Some code
});
defer tid.join();
```

## Channels
```rust
let chan = cosmic.channel(string);

for (0..10) { |i|
    cosmic.spawn(() { |*chan|
        chan.*.send(i);
    });
}

let sum = 0;
for (0..10) {
    sum += chan.receive();
}

for (chan.queue) { |msg|
    sum += msg;
}
```

## More on functions
```rust
// Returning a tuple or record allows the return to be stored in a single binding or destructured
const div = (x, y: int) => {int, int} {
    let quo = x / y;
    let rem = x % y;
    return {quo, rem};
};

let result: {int, int} = div(12, 5);
let {quo, rem} = div(12, 5);

const div = (x, y: int) => record{quo, rem: int} {
    let quo = x / y;
    let rem = x % y;
    // return .{quo = quo, rem = rem};
    return .{quo, rem}; // if names match field tags, can ommit field name 
}

let result = div(12, 5);
std.testing.expect(result.quo == 2);

// Any infers the function type at compile time where called, think templates
// If multiple args, they are treated as a tuple
// Must be the final argument
// ...tag can be used as shorthand for $any tuples
const variadic = (...args) => {
    let size = cosmic.len(args);

    for (0..size) { |i|
        std.fmt.printf("{} ", args[i]);
    }
};

const members = (@tup: any) => {
    inline for (cosmic.typeOf(tup).members) { |member|

    }
};

// Can be run at compile time, so result is known at compile time
comptime.{
    members(.{...});
}

@members(.{...}); // Shorthand for compile time execution
// Can be run at runtime, but result is not known at compile time
members(.{...});

// Functions can be taken as parameters and returned from functions
const sort = (slice: []i32, pred: fn (i32, i32) -> bool) => {
    // code
    if pred(slice[i], slice[j]) {
    // code
};

const arr = [41, 22, 31, 84, 75];
// The types of the anonymous function passed will be inferred
sort(arr[..], (lhs, rhs) do lhs > rhs);

```

## Pipeline Operator
The `Pipeline` operator "|>" takes the result of the expression before it,
and inputs it into the first argument of the function after it
```rust
const scan = (source: string) []tokens => // code;
const parse = (source: []tokens) Ast => // code;

let source = "some source code";

// Normally if you didnt want to save any of the intermediate steps you would write code like this.
let ast = parse(scan(source));
// Instead, this can be decomposed into steps, which follows the order of execution.
let ast = source
    |> scan()
    |> parse();

// Can also be written with UFCS, but the functions cannot be under a namespace
let ast = source
    .scan()
    .parse();

// If scan and parse were part of a module called "compiler"
// you could not use UFCS, as you would be trying to property of the variable not the module
let ast = source
    .compiler.scan()
    .compiler.parse();

// Instead you must use the pipeline, or use the `use` keyword to temporarily open the compiler module to expose it's properties directly
// Varibles cannot be declared inside of a opened module
let ast;
use compiler.{
    ast = source
        .scan()
        .parse();
}

```

## Traits
`Cosmic` doesn't have inheritance, instead `Cosmic` uses interfaces called `traits`.

Traits cannot specify data members, only methods
```rust
// Trait definition
const Entity = trait {
    // Trait method types have restrictions on the receiver type, which goes after fn
    // Both of these methods require receivers to be mut& (a exclusive mode borrow)
    // Reviever is the first parenthesis, the second is the parameter types
    update_pos: fn (mut&)({f32, f32}) -> (),
    update_health: fn (mut&)(int) -> ()
};

const system = (mut entity: &Entity) => // code;

// Traits are implemented implicitly
const Player = record {
    // Members which are unique to each instance of the record are declared like parameters
    pos: {f32, f32},
    health: int,
    ...
};

// To implement the Entity Behaviour, it must have all methods defined with matching
//   tagifiers, parameter types, and return types
const update_pos = (mut self: &Player, pos: {f32, f32}) => // code;
const update_health = (mut self: &Player, health: int) => // code;

let player = Player.{}; // If field values are not provided they will be set to the 
                       //   default values of that type, typically 0 or equivalent.
system(&player);
```

## Metaprogramming
In `Cosmic`, metaprogramming is done using comptime expressions, which is just `Cosmic` code executed at compile time

The return of compile time expressions is a reference to a static variable
```rust
// `@` or `comptime@` preceeding a identifier states that this parameter must be known at compile time
const Vector = (comptime@t: typeid) => typeid {
    return record {
        x: t,
        y: t
    };
};

// Code can be run at compile time using comptime.{} or @.{} for a block of code, @ for a single expression 
comptime.{
    let _ = Vector(string);
    ...
}

const Pos = @Vector(string);

const t = int;
// The function :Vector could be called at runtime:
let Pos = Vector(t); // This cannot be used in meta expressions 
                     //   because it is executed at runtime
// Or compile time (@ is used to run an expression at comptime):
let Pos = @Vector(t); // This can be used in later compile time expressions as long as it is not assigned to again
const Pos = @Vector(t); // This can be used in later compile time expressions

// Blocks can also be run at compile time
const screen_size = @.{
    return {1920, 1080};
};
```
## First Class Modules
In `Cosmic`, modules are first class, so they can be passed into and out of functions
```rust
// To create a generic ds with methods, you must return a record with static bindings
const List = (comptime@type: typeid) => moduleid {
    return module {
        const Node = record {
            next: cosmic.this(),
            data: type
        };   
    
        pub const t = record {
            head: Node,
            size: uint
        };

        const insert = (mut self: &t, value: type) => {...};
    };
};

let intList = List(int).t.{};
intList.insert(12);
```

## Operators
`Cosmic` has many operators and symbols, some have different meaning depending on context:
```
- Miscelaneous Operators
  - /   : Namespace Resolution
  - =   : Assignment 
  - :=  : Assignment Expression
  - =~  : Pattern Match
  - !~  : Pattern Not Match
  - []  : Index 
  - .   : Member Access 
  - ()  : Function Call 
  - &   : Borrow 
  - @   : Comptime Mode
  - *   : Dereference
  - $   : Built in function
- Arithmetic Operators          - Wrapping - Saturating
  - +   : Addition                - +%      - +|
  - -   : Subtraction             - -%      - -|
  - *   : Multiplication          - *%      - *|
  - /   : Division                - /%      - /|
  - **  : Exponentiation          - ^%      - ^|
  - %   : Modulus or Remainder
  - ++  : Increment
  - --  : Decrement
  - Can be combined with the assignment operator, for example: += or ^|=
- Comparison Operators
  - >   : Greater than
  - >=  : Greater than or equal
  - <   : Less than
  - <=  : Less than or equal
  - ==  : Equal to
  - !=  : Not equal to
- Logical Operators
  - and : Logical And
  - or  : Logical Or
  - not : Logical Negation
- Bitwise Operators
  - &   : Bitwise AND
  - |   : Bitwise OR
  - ^   : Bitwise XOR
  - not : Bitwise Negation
  - <<  : Bitshift Left
  - >>  : Bitshift Right
- Type Symbols
  - any             : Comptime Inferred type
  - (type or type)  : Union
  - !type           : type or error
  - ?type           : type or null
  - *type           : Pointer
  - []type          : Slice, which is a pointer and a length
  - [size]type      : Array
  - [dyn]type       : Dynamic Array
  - [&]type         : Multi Pointer
  - {type, ...}     : Tuple
  - %{key, value}   : Map
  - ..(type)        : Exclusive Range, type must be integer types or byte
  - ...(type)       : Inclusive Range, type must be integer types or byte
  - fn () -> ()     : Function
  - fn () -> ()     : Closure
  - fn ()() -> ()   : Trait Method
```

## Example: Linked List
```rust
const List = (comptime@type: typeid) => moduleid {
    return module {
        let max_size = 100;

        const node = record {
            next: cosmic.this()?,
            data: type
        };

        pub const t = record {
            head: node?,
            size: uint
        };

        const insert = (mut self: &t, value: type) => { |*max_size|
            if (self.size == 0) {
                self.head = node {
                    next: null,
                    data: value
                };
                self.size++ ;
            } else if (self.size <= max_size.*) {
                let tmp = self.head;

                self.head = node {
                    next: tmp,
                    data: value
                };
                self.size++ ;
            }
        };

        const set_max = (size: usize) => { |*max_size|
            max_size.* = size;
        };
    };
};

let names = List(string).t.{};

names.insert("foo");
names.insert("bar");
names.insert("foobar");
```

## Circuits
`Cosmic` has an extension called `Silver`, which integrates HDL into the language for simple FPGA development.

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

let and = @AndGate.{}; // This creates an instance of AndGate, 
                      // which must be done at compile time

and.put(x: 1, y: 1);

let result = and.get(:z); // Output ports are setup with signals,
                          // so reading from a output port blocks 
                          // execution until the signal is high
```
