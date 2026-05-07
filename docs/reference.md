# Reference

This page is the language specification. It describes the surface syntax, semantics, and the contract every implementation should satisfy. This document serves as the defacto source of truth when it comes to langauge functionality.

Ruka is an opinionated, statically typed programming language. Ruka is garbage collected by default, with modes allowing control over reference lifetimes and mutability; even allowing stack allocation. Ruka uses aggressive bi-directional type inferrence, only requiring explicit annotations to clear up ambiguity. Examples in this document omit type annotations except where the annotation is the point of the example.

## Comments

Line comments begin with `//` and run to the end of the line. There are no block comments.

```ruka
// this is a comment
let x = 1   // trailing comments are fine
```

## Identifiers & privacy

Identifiers are letters, digits, and underscores; they cannot start with a digit. Visibility is encoded in the first letter:

- **lowercase first letter** — exported from the module (public).
- **uppercase first letter** — module-private.

There is no separate `pub` keyword. Renaming a binding to change its case changes its visibility.

```ruka
let greet = () do ruka.println("hi")    // exported
let Helper = () do ruka.println("...")  // private
```

## Bindings

A `let` binding introduces a name. The type is inferred from the right-hand side; an explicit annotation is only needed when inference cannot reach the type you want. Binding can be shadowed by reusing the same name.

```ruka
let answer = 42
let pi     = 3.14159
let name   = "Ruka"
let count: u32 = 0   // annotation pins the integer type
```

Bindings are immutable by default. To make a binding mutable, or to change how it is stored or evaluated, use a *mode prefix* directly before the name (no space). See [Modes](#modes).

```ruka
let *count = 0    // mutable
count = count + 1
```

### Destructuring

A `let` binding may take any irrefutable [pattern](#patterns) on the left-hand side. Destructuring patterns never include a type prefix or leading `.` — those forms belong to *literals*, not patterns.

```ruka
let (x, y) = .(1, 2)     // tuple pattern; .(...) is the tuple literal
let {x, y} = origin      // record pattern; identifiers must match record members
```

### File scope is declarative

A Ruka file's top level holds declarations only — `let` bindings, type definitions, methods, statics, behaviours, tests. There are no executable statements at file scope. Every top-level right-hand side is therefore evaluated at compile time.

## Modes

Mode prefixes adjust how a binding or parameter is stored, captured, or evaluated. The same four prefixes apply in both positions.

| Prefix | Meaning |
| --- | --- |
| `*` | Mutable. Bindings may be reassigned; parameters mutate in place and the change is visible to the caller. |
| `&` | Move. Ownership transfers — only into a closure on capture (annotated on bindings), variables pulled into the function on call (annotated on parameters). The original is invalid afterwards. |
| `$` | Stack-allocated. Not GC-managed; passed by pointer or copy. Movable as a compile error only. |
| `@` | Compile-time. The value must be known at compile time. See [Compile-time evaluation](#compile-time-evaluation). |

```ruka
let *counter = 0                    // mutable binding
let consume = (&buf) do ...         // takes ownership of buf
let hash    = ($data) do ...        // stack copy
let repeat  = (@n: uint, msg) do .. // n must be comptime
```

The `@` prefix is rarely written explicitly. At file scope and on methods/statics, compile-time evaluation is the default; inside function bodies it is inferred whenever a parameter's type is `type`.

## Literals

### Numbers

Integer literals default to `int`; literals containing a `.` default to `float`. The literal text is preserved — `2` and `2.0` are different literals. An explicit annotation pins a more specific type.

```ruka
let a = 42
let b = 0.5
let c: u8 = 255   // annotated when a smaller integer type is needed
```

### Characters

A character literal is a single byte wrapped in single quotes; it has type `u8`. There is no separate `char` type. Escapes: `\n`, `\t`, `\r`, `\\`, `\'`, `\"`, `\0`.

```ruka
let nl = '\n'
let q  = '\''
```

### Strings

Strings are double-quoted and may interpolate any expression with `${…}`. Escapes match the character literal set.

```ruka
let name = "Ruka"
let s = "hello, ${name}!"
```

### Multiline strings

A multiline string opens with `|"` on its own line and closes with `|"` on its own line. Interior lines begin with `|`; one optional space after the bar is stripped. Interpolation works the same as in single-line strings.

```ruka
let report =
    |"
    | hello ${name}!
    | line two
    |"
```

### Booleans & unit

```ruka
let yes = true
let no  = false
let nothing = ()    // the unit value, type ()
```

### Tuples and arrays

Tuples are heterogeneous fixed-arity; arrays are homogeneous and variable-length. Both literals begin with `.`, mirroring the leading `.` of record and variant literals — the dot is what tells the parser this is a value being constructed, not a destructuring pattern.

```ruka
let pair = .(1, "one")     // tuple, inferred [int, string]
let xs   = .{1, 2, 3}     // array,  inferred [int]
let prefixed = [u8].{0, 1, 2}   // type prefix initializes the enforces element type
let typed: [u8] = .{0, 1, 2}   // can also use annotation to pin the element type
```

### Records

A record literal is written as `.{...}` and the record type is inferred from context. Prefix the literal with a type name only when no context is available to drive inference. See [Records & variants](#records--variants) for declaration syntax.

```ruka
let Point = record {
    x: f64
    y: f64
}

let make = (p: Point) do p
let p = make(.{ x = 1.0, y = 2.0 })   // inferred from parameter type
let q = Point.{ x = 1.0, y = 2.0 }    // explicit when there is no context
```

### Variant constructors

A variant value is written `.tag` for a payloadless case or `.tag(value)` with a payload. The variant type is inferred from context.

```ruka
let report = (h: Hit) do
    match h with
        critical(d) do ...
        miss        do ...
    end
end

report(.critical(20))    // tag is resolved against Hit
report(.miss)
```

### Option & result

Option and result are ordinary variants in the prelude with shorthand type syntax: `?(T)` for option, `!(T, E)` for result. Constructors are `.some(v)` / `.none` and `.ok(v)` / `.err(e)`.

### Ranges

`a..b` is half-open; `a..=b` is inclusive. Both are first-class values of type `[T..]` and double as iterators.

```ruka
for i in 0..10 do ruka.println("${i}")
let r: [int..] = 1..=5
```

## Built-in types

The following types are always in scope.

| Group | Types |
| --- | --- |
| Signed integers | `i8 i16 i32 i64`, `int` (target word size) |
| Unsigned integers | `u8 u16 u32 u64`, `uint` |
| Floats | `f32 f64`, `float` (target word size) |
| Other primitives | `bool`, `string`, `()` (unit) |
| Collections | `[T]` (array), `[T, U, …]` (tuple), `[T..]` (range) |
| Generic prelude | `?(T)` (option), `!(T, E)` (result) |
| Compile-time | `type` (the type of types) |

### Type annotations

A type appears after `:` on a binding or parameter, and after `->` on a function return.

```ruka
let count: u32 = 0
let pair: [int, string] = .(1, "one")
let lookup = (key: string) -> ?(int) do ...
```

## Operators

From lowest to highest precedence:

| Tier | Operators |
| --- | --- |
| Pipeline | `\|>` |
| Logical or | `or` |
| Logical and | `and` |
| Equality | `==` `!=` |
| Comparison | `<` `<=` `>` `>=` |
| Range | `..` `..=` |
| Bitwise | `\|` `^` `&` `<<` `>>` |
| Additive | `+` `-` |
| Multiplicative | `*` `/` `%` |
| Exponent | `**` (right-assoc) |
| Unary | `not` `-` |
| Postfix | call `f(x)`, member `x.f`, index `x[i]` |

`and` / `or` short-circuit. The pipeline `x |> f` rewrites to `f(x)`; chains compose left-to-right.

```ruka
let n = nums |> filter(~pred=(x) do x % 2 == 0)
            |> map(~f=(x) do x * x)
            |> sum()
```

Operators on user-defined types are dispatched via [operator behaviours](#behaviours): defining a method named `add` makes `+` available for the type.

## Patterns

Patterns appear in `let` destructuring, `match` arms, and `for` loop binders. Patterns may be *refutable* (may not match) or *irrefutable* (always match) — only irrefutable patterns are allowed in `let` and `for`.

Destructuring patterns are bare: tuple patterns are `(a, b)` and record patterns are `{ a, b }`. The leading `.` is reserved for value literals.

| Form | Example | Refutable? |
| --- | --- | --- |
| Identifier | `x` | no |
| Tuple | `(a, b)` | no (when arity matches) |
| Record | `{ x, y }` | no |
| Literal | `0`, `"yes"` | yes |
| Range | `1..=9` | yes |
| Variant | `some(x)`, `miss` | yes |
| Guard | `x if x > 0` | yes |

Inside variant patterns the payload may itself be a tuple or binding pattern — `ok((a, b))`, `some(value)`.

## Control flow

Every block in Ruka follows one rule, regardless of whether it belongs to a function, an `if`, a loop, or a `match` arm. `do expr` on a single line is a single-expression body closed by the newline. `do` followed by a newline opens a multi-statement block closed by `end`. The two forms are interchangeable; pick whichever reads better.

### If / else

`if` is an expression. The condition is followed by `do`; `else` is optional and may chain with another `if`. A multi-statement branch uses `do … end`, or `do … else …` when the `else` closes the branch. The ternary form swaps the leading `do` with `if`: `value if condition else other`.

```ruka
let sign = if n > 0 do 1 else if n < 0 do -1 else 0
let label = if score >= 60 do "pass" else "fail"
let bucket = "larger" if x >= 100 else "smaller"
```

### While

```ruka
let *i = 0
while i < 10 do
    ruka.println("${i}")
    i = i + 1
end
```

### For

`for x in iter do … end` — `iter` must satisfy `ruka.iterable`. The loop variable is immutable within the body.

```ruka
for n in 0..5 do ruka.println("${n}")
for (k, v) in pairs do ruka.println("${k}=${v}")
```

### Break, continue, return

`break` and `continue` apply to the nearest enclosing loop. `return` exits the enclosing function with the given value.

### Defer

`defer expr` schedules `expr` to run when the enclosing `do…end` block exits — by reaching the end, by `return`, or by `break`. Multiple `defer`s in the same block run in LIFO order.

```ruka
let read_file = (path) do
    let f = open(path)
    defer f.close()
    // ... use f
end   // f.close() runs here
```

A deferred expression captures variables by reference; it observes their values at the moment the block exits, not at declaration.

## Match

`match e with` dispatches on a value using [patterns](#patterns). Each arm is `pattern do expression`. Match is an expression — every arm must produce a value of the same type.

```ruka
let report = (h) do
    match h with
        critical(d) do "critical for ${d}"
        normal(d)   do "hit for ${d}"
        miss        do "missed"
    end
end
```

Match must be *exhaustive*: the patterns together must cover every possible value of the subject's type. A trailing `else` arm covers anything not matched explicitly. A multi-statement `else` branch uses `do … end` like any other branch.

```ruka
match n with
    0..=9   do "small"
    10..=99 do "medium"
    else       "large"
end
```

## Functions

A function literal is `(params) do body end`. The empty parameter list is `()`. Body forms:

- **Single expression:** `(x) do x + 1`.
- **Block:** `(x) do … end` — multiple statements; the value of the block is its last expression.

Bind a function with `let` like any other value:

```ruka
let inc = (x) do x + 1
let main = () do
    ruka.println("${inc(41)}")
end
```

Parameter and return types are inferred from use. Annotate a parameter or return only when inference cannot reach the type you need, or when the annotation is documentation. Parameter modes follow the [mode](#modes) rules.

### Closures

Function literals capture their lexical environment. A binding declared with `&` moves into the closure rather than being captured by reference.

## Named parameters

Prefixing a parameter with `~` makes it *named*. Named arguments are passed as `~label=value` at the call site and may appear in any order. Positional and named parameters can be mixed; positional arguments come first.

```ruka
let greet = (~name, ~greeting) do
    "${greeting}, ${name}!"
end

greet(~name="Ruka", ~greeting="Hello")
greet(~greeting="Hi", ~name="World")
```

### Label shorthand

If a local variable shares the label name, the `=value` may be omitted.

```ruka
let name = "Ruka"
let greeting = "Hello"
greet(~name, ~greeting)
```

### Optional named parameters

A named parameter typed `?(T)` is optional. When omitted, it receives `.none`; when given a bare value, the value is automatically wrapped in `.some(...)`. This is the one place where annotating a named parameter is required — the `?(T)` annotation is what marks it optional.

```ruka
let greet = (~name, ~title: ?(string)) do
    match title with
        some(t) do "${t} ${name}"
        none    do name
    end
end

greet(~name="Ruka")                  // "Ruka"
greet(~name="Ruka", ~title="Dr.")    // "Dr. Ruka"
```

### Trailing block syntax

A single named argument may follow the closing parenthesis. This reads naturally for higher-order functions whose closure parameter is named and placed last.

```ruka
let map = (t, xs: [t], ~f) do ...

let doubled = map(nums) ~f=(x) do x * 2
let squared = map(nums) ~f=(x) do
    let s = x * x
    s
end
```

## Records & variants

### Records

A record is a fixed set of named, typed fields. Declare with `record { … }`. In a multi-line declaration the fields are separated by newlines; commas are only needed when fields share a single line.

```ruka
let Point = record {
    x: f64
    y: f64
}

let Inline = record { x: f64, y: f64 }   // commas required on one line
```

Construct a record with `.{...}`; the type is inferred from context. Records destructure with the same field names — **without** a leading `.` or type prefix, since destructuring is a pattern, not a literal.

```ruka
let move = (p: Point) do .{ x = p.x + 1.0, y = p.y }

let { x, y } = move(.{ x = 0.0, y = 0.0 })
```

### Variants

A variant (tagged union) names a fixed set of cases, each with an optional payload type. Cases are separated by newlines in a multi-line declaration; commas are only needed on a single line.

```ruka
let Hit = variant {
    critical: int
    normal:   int
    miss
}
```

Construct a variant with `.tag` or `.tag(payload)` and consume it with [`match`](#match). The tag is resolved against the variant type that flows in from context.

## Methods & statics

Methods and statics are declared with the same `let` form, distinguished by what appears in parentheses after the name:

- `let name (Type) = …` — **static** on `Type`, called as `Type.name(...)`.
- `let name (self) = …` — **method**, called as `value.name(...)`.
- `let name (*self) = …` — **mutating method**; the receiver follows the `*` mode rules.

```ruka
let counter = record {
    count: int
}

// statics — accessed as counter.zero, counter.new(...)
let zero (counter) = .{ count = 0 }
let new  (counter) = (start) do .{ count = start }

// method — accessed as c.bump()
let bump (self) = () do .{ count = self.count + 1 }

// mutating method
let inc (*self) = () do
    self.count = self.count + 1
end
```

Ruka has no concept of constructors or destructors. By convention, a *constructor* is a function that returns a value of the type and a *destructor* is a method that takes moves the receivers ownership into the method disallowing it's further use.

### Extending types

An imported may be extended with additional methods and statics but they cannot access locals and shadowing is disallowed (at least implicitly).

## Type inference

Bidirectional inference flows in two directions: a known type can drive the shape of an expression (the *checking* direction), and the shape of an expression can determine its type (the *synthesis* direction). Annotations are needed only when neither direction reaches a unique answer.

### Numeric defaults

An integer literal with no contextual type takes `int`; a literal containing `.` takes `float`. A type-annotated binding or parameter pulls the literal toward a more specific numeric type.

### Record literals

A `.{...}` record literal first looks for an expected type from context — a binding annotation, a parameter type, the field type of an enclosing record. If context exists, that type wins and the literal is checked against it.

With no context, the compiler searches the surrounding scope for record types whose field set matches the literal exactly. If exactly one type fits, the literal infers to that type. If two or more types fit, the literal is ambiguous and an annotation or type prefix is required.

```ruka
let Point = record { x: f64, y: f64 }

let p = .{ x = 1.0, y = 2.0 }   // ok — only Point matches in scope
let q = Point.{ x = 1.0, y = 2.0 }   // explicit prefix when ambiguous
```

### Variant constructors

A constructor written `.tag` or `.tag(value)` is resolved against the expected type from context. With no context, the compiler searches scope for variant types that declare the tag with a compatible payload. If exactly one matches, the constructor infers to that type.

### Record parameters

A parameter that is used only as a record (field access, record destructuring) but has no annotation is inferred structurally. The compiler collects every field the body reads and searches scope for record types whose declared fields are a superset of that set. If exactly one type fits, the parameter takes that type; otherwise the function is ambiguous and the parameter must be annotated.

```ruka
let Point = record { x: f64, y: f64 }

// uses .x and .y — only Point has both → param inferred as Point
let length = (p) do ruka.sqrt(p.x * p.x + p.y * p.y)
```

### Variant parameters

The same rule applies to a parameter used only by `match`: the compiler collects the tags the arms require, and if exactly one variant in scope declares those tags (with compatible payload arities), the parameter infers to that variant.

### Method receivers

On a method declared `let name (self) = …`, the receiver type is inferred by the same record-or-variant structural rule against the bodies field accesses, mutations, and pattern arms.

### Return types

A function's return type is inferred from its body. Recursive functions and mutually recursive groups infer through their call graph; an annotation is only needed to break a cycle the checker cannot resolve.

### Behaviours never infer

A behaviour-typed parameter is **never** inferred. The behaviour must be written explicitly as the parameter annotation. This is what distinguishes a structurally-inferred record parameter (concrete type, monomorphic) from a behaviour parameter (polymorphic over every type that satisfies the behaviour, monomorphised per call site).

```ruka
let area = (s) do s.area()             // inferred to a single concrete type
let area = (s: Shape) do s.area()      // polymorphic over Shape
```

## Behaviours

A behaviour declares a set of method signatures. Any type whose methods cover those signatures *satisfies* the behaviour — no `implements` declaration is required. Like records and variants, signatures are separated by newlines in a multi-line declaration; commas are only needed on a single line.

```ruka
let Shape = behaviour {
    area(self):      () -> f64
    perimeter(self): () -> f64
}
```

### Using a behaviour

A behaviour may appear as a parameter type. Each call site monomorphises against the concrete argument type — this is static dispatch, not virtual.

```ruka
let describe = (s: Shape) do
    ruka.println("area: ${s.area()}")
end
```

Behaviour types may only appear in parameter position. Using one as a return type, field type, or binding type is a compile error — behaviours describe behaviour, not storage.

### Builtin behaviours

The compiler recognises three families of behaviours specially.

#### `ruka.printable`

A type satisfying `printable` may appear inside `${…}` string interpolation and may be passed to `ruka.print` / `ruka.println`.

```ruka
let printable = behaviour {
    format(self): () -> string
}

let format (self) = () do "(${self.x}, ${self.y})"   // makes Point printable
```

#### `ruka.iterable`

A type satisfying `iterable` may be used in a `for` loop. The compiler calls `next` per iteration; `.none` ends the loop.

```ruka
let iterable = behaviour {
    next(*self): () -> ?(T)
}
```

#### Operator behaviours

Methods with names like `add`, `sub`, `mul`, `div`, `eq`, `lt`, `index` are recognised as operator implementations. Defining one of these enables the corresponding operator on the type.

## Modules & imports

A Ruka file *is* a module — its top-level declarations are the module's fields. Lowercase-named declarations are exported; uppercase-named declarations are private.

`ruka.import("path")` evaluates at compile time and returns the imported file as a record value. Access fields, or destructure to bring names into scope.

```ruka
let math = ruka.import("math")
let r = math.sqrt(2.0)

// destructuring import — bare record pattern, no leading dot
let { sqrt, pow } = ruka.import("math")
let { Dog, Cat } = ruka.import("animals")
```

Because the result is compile-time known, an imported type may be passed to a `type`-typed parameter directly:

```ruka
let describe = (t: type) do ruka.println("${t}")
describe(animals.Dog)
```

## Tests

A `test` binding declares a zero-argument function that runs as part of the test suite. Tests are compiled in *debug* and *test* builds and elided entirely in *release* — assertions inside a `test` have no runtime cost in production.

```ruka
let add = (a, b) do a + b

test addition = () do
    ruka.expect_eq(add(1, 2), 3)
    ruka.expect_eq(add(0, 0), 0)
end
```

Tests live in their module's scope and can therefore call uppercase-named (private) declarations directly. There is no separate test-visibility mechanism.

## Compile-time evaluation

Ruka has a compile-time interpreter. Functions with `@`-prefixed parameters run at compile time; their results are compile-time constants. Types, functions, and modules are first-class values in compile-time contexts.

### Inferring `@` from `type`

A parameter typed `type` infers the `@` prefix automatically. A parameter used to annotate another parameter infers both.

```ruka
// all three forms are equivalent
let min = (@t: type, a: t, b: t) do if a < b do a else b
let min = (t: type,  a: t, b: t) do if a < b do a else b
let min = (t,        a: t, b: t) do if a < b do a else b
```

### Generics

Each unique compile-time argument set produces a distinct specialisation, much like monomorphisation in Rust or `comptime` in Zig.

```ruka
let x = min(i32, 3, 7)      // i32 instantiation
let y = min(f64, 1.5, 2.0)  // f64 instantiation
```

### Generating types

A compile-time function may return a type. Non-`type` parameters that must be compile-time still need an explicit `@`.

```ruka
let FixedArray = (t, @cap: uint) do
    record {
        data: [t]
        len:  uint
    }
end

let IntBuf   = FixedArray(i32, 64)
let FloatBuf = FixedArray(f64, 16)
```

### Storing compile-time results

At file scope, `let` already evaluates its right-hand side at compile time, so no prefix is needed. Inside a function body, prefix the binding with `@` to force compile-time storage.

```ruka
let SQRT_2 = ruka.sqrt(2.0)    // top level — comptime by default

let run = () do
    let @table = build_lookup_table(256)   // forced to comptime
    let rows   = fetch_rows()              // runtime
end
```

### Reflection

`ruka.type_of(e)` returns the type of `e` as a compile-time value. `ruka.fields_of`, `ruka.methods_of`, and `ruka.statics_of` return the structural pieces of a type. `ruka.record_of(fields)` constructs a new record type from a list of field descriptors. All four take `@`-prefixed type arguments and run at compile time — there is no runtime reflection.

```ruka
// derive: produce an option-of-every-field version of any record
let Partial = (t) do
    let fs = ruka.fields_of(t)
        |> map((f) do .{ name = f.name, type = ?(f.type) })
    ruka.record_of(fs)
end

let User = record {
    id: i32
    name: string
}
let PartialUser = Partial(User)
// PartialUser ≡ record { id: ?(i32), name: ?(string) }
```

## The `ruka` module

`ruka` is the prelude — always in scope, never imported. The members below are referenced throughout this document.

### I/O

| Member | Purpose |
| --- | --- |
| `print(printable)` | Write an argument implementing `ruka.printable` to stdout, no newline. |
| `println(printable)` | Like `print`, appends a newline. |
| `readln()` | Read a single line of input from stdin and return it as a `string`. |
| `read()` | Like `readln()` but continues until user terminates with a ctrl-d. |

### Type conversions

`float_to_int()`, `int_to_float()`, `int_cast()`, `float_cast()`.

### Math

`abs`, `sqrt`, `pow`, `exp`, `floor`, `ceil`, `min`, `max`, `sin`, `cos`, `tan`, `random`.

### Testing

`expect_eq(a, b)` returns an `!((), string)`.

### File Import

`import("path")` — see [Modules & imports](#modules--imports).

### Compile-time

`type_of`, `fields_of`, `methods_of`, `statics_of`, `record_of`, `compile_error(msg)`. See [Compile-time evaluation](#compile-time-evaluation).
