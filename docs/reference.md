# Reference

This page is the language specification. It describes the surface syntax, semantics, and the contract every implementation should satisfy. This document serves as the defacto source of truth when it comes to langauge functionality.

Ruka is an opinionated, statically typed programming language. Ruka is garbage collected by default, with modes allowing control over reference lifetimes and mutability; even allowing stack allocation. Ruka uses aggressive bi-directional type inferrence, only requiring explicit annotations to clear up ambiguity. Examples in this document omit type annotations except where the annotation is the point of the example.

## Comments

Line comments begin with `//` and run to the end of the line. There are no block comments.

```ruka
// this is a comment
let x = 1   // trailing comments are fine
```

## Identifiers

Identifiers are letters, digits, and underscores; they cannot start with a digit. Casing carries no semantic weight — visibility is controlled by the [`local`](#privacy) keyword, not by case.

By convention, **imported files are capitalised** to distinguish a file's record value from ordinary bindings. Type bindings, members, methods, and locals are lowercase like any other value.

```ruka
let point = record { x: f64, y: f64 }      // type binding
let Math  = ruka.import("Math.ruka")       // imported file
```

## Privacy

Ruka has two binding keywords. `let` declares a binding that may escape its scope: at file scope it is exported as part of the file's public record, and at function scope it may be captured by a closure. `local` declares a non-escaping binding: at file scope it is private to the file (importers cannot see it), and at function scope it cannot be captured by a closure that outlives the declaring function. See [Closures](#closures) for the capture rule.

`let` and `local` are alternative binding forms, not modifiers — write `local x = …`, never `let local x = …`.

A field of a record (or a tag of a variant, or a member of a behaviour) prefixed with `local` is private in the same sense — accessible inside the declaring file, hidden everywhere else.

```ruka
local helper = () do ruka.println("...")   // private file-scope binding

let point = record {
    x: f64
    y: f64
    local cache: f64    // private field
}
```

`local` is the only privacy modifier; there is no `pub` keyword.

## Bindings

`let` and `local` introduce names. The right-hand side drives type inference; an explicit annotation is only needed when inference cannot reach the type you want. Bindings can be shadowed by reusing the same name.

```ruka
let answer = 42
let pi     = 3.14159
let name   = "Ruka"
let count: u32 = 0   // annotation pins the integer type

local cache = ruka.sqrt(2.0)   // file-private; same syntax, different keyword
```

See [Privacy](#privacy) for what `local` does and where it differs from `let`.

Bindings are immutable by default. To make a binding mutable, or to change how it is stored or evaluated, use a *mode prefix* directly before the name (no space). See [Modes](#modes).

```ruka
let *count = 0     // mutable
count = count + 1
```

### Destructuring

A binding may take any irrefutable [pattern](#patterns) on the left-hand side. Destructuring patterns reuse the same shapes as value literals — a tuple pattern is `(a, b)`, a record pattern is `{ a, b }`.

```ruka
let (x, y) = (1, 2)         // tuple pattern
let { x, y } = origin       // record pattern; identifiers must match record fields
```

### File scope is declarative

A Ruka file's top level holds declarations only — `let`/`local` bindings, type definitions, methods, members, behaviours, tests. There are no executable statements at file scope. Every top-level right-hand side is therefore evaluated at compile time.

## Modes

Mode prefixes adjust how a binding or parameter is stored, captured, or evaluated. The same four prefixes apply in both positions, and on method receivers.

| Prefix | Meaning |
| --- | --- |
| `*` | Mutable. Bindings may be reassigned; parameters mutate in place and the change is visible to the caller. |
| `&` | Move. Ownership transfers — into a closure on capture (annotated on the binding being captured), or into a function on call (annotated on parameters). The original is invalid afterwards. |
| `$` | Stack-allocated. Not GC-managed; passed by pointer or copy. Cannot be moved. |
| `@` | Compile-time. The value must be known at compile time. See [Compile-time evaluation](#compile-time-evaluation). |

```ruka
let *counter = 0                    // mutable binding
let consume = (&buf) do ...         // takes ownership of buf
let hash    = ($data) do ...        // stack copy
let repeat  = (@n: uint, msg) do .. // n must be comptime
```

The `@` prefix is rarely written explicitly. At file scope and on methods/members, compile-time evaluation is the default; inside function bodies it is inferred whenever a parameter's type is `type`.

Method receivers also accept mode prefixes. `*self` is a mutating receiver; `&self` consumes the receiver (a destructor-like method); `$self` and `@self` are reserved for cases where the receiver itself is stack-bound or compile-time known. See [Methods & members](#methods--members).

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

Tuples are heterogeneous fixed-arity; arrays are homogeneous and variable-length. Both literals share the brace/paren shapes used by their type annotations: arrays use `{ … }`, tuples use `( …, … )`. Tuple literals always contain at least one comma; a single parenthesised expression is just a grouping.

```ruka
let pair = (1, "one")           // tuple, inferred (int, string)
let xs   = { 1, 2, 3 }          // array, inferred [int]
let prefixed = [u8] { 0, 1, 2 } // type prefix pins the element type
let typed: [u8] = { 0, 1, 2 }   // annotation does the same
```

In multi-line literals, members may be separated by newlines instead of commas. Commas are only required when two members share a single line.

```ruka
let xs = {
    1
    2
    3
}
```

### Records

A record literal is `{ field = value, … }` and the record type is inferred from context. Prefix the literal with the type name when no context is available to drive inference. See [Records & variants](#records--variants) for declaration syntax.

```ruka
let point = record {
    x: f64
    y: f64
}

let make = (p: point) do p
let p = make({ x = 1.0, y = 2.0 })   // inferred from parameter type
let q = point { x = 1.0, y = 2.0 }   // explicit when there is no context
```

A record literal disambiguates from an array literal by the `=` in each field initialiser. A single-element shape such as `{ x }` is treated as a record shorthand when an enclosing record type is expected, and as an array literal when an array type is expected; if neither context is available it is a compile error.

### Variant constructors

A variant value is constructed by writing the tag name like a function call: `tag(value)` for a tag with payload, `tag` for a payloadless tag. The constructor resolves against context — if an in-scope binding shares the name, that binding wins; otherwise the compiler searches in-scope variant types for a tag of that name. Use a type-prefixed form `type.tag(value)` to disambiguate or to read more explicitly.

```ruka
let report = (h: hit) do
    match h with
        critical(d) do ...
        miss        do ...
    end
end

report(critical(20))      // resolved against hit
report(miss)
report(hit.critical(20))  // type-prefixed; always unambiguous
```

### Maps

A map is a homogeneous key→value collection. The type annotation is `[K => V]`; the literal is `{ k => v, … }` or `[K => V] { k => v, … }` when context is unavailable.

```ruka
let scores: [string => int] = { "alice" => 91, "bob" => 84 }
let prefixed = [string => int] { "alice" => 91 }
```

Multi-line map literals separate entries with newlines like every other braced literal; commas are only needed on a single line.

### Option & result

Option and result are ordinary variants in the prelude with shorthand type syntax: `?(T)` for option, `!(T, E)` for result. Constructors are `some(v)` / `none` and `ok(v)` / `err(e)`.

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
| Signed integers | `i8 i16 i32 i64 i128`, `int` (target word size) |
| Unsigned integers | `u8 u16 u32 u64 u128`, `uint` |
| Floats | `f32 f64`, `float` (target word size) |
| Other primitives | `bool`, `string`, `()` (unit) |
| Collections | `[T]` (array), `(T, U, …)` (tuple), `[T..]` (range), `[K => V]` (map) |
| Generic prelude | `?(T)` (option), `!(T, E)` (result) |
| Compile-time | `type` (the type of types) |

### Type annotations

A type appears after `:` on a binding or parameter, and after `->` on a function return.

```ruka
let count: u32 = 0
let pair: (int, string) = (1, "one")
let lookup = (key: string) -> ?(int) do ...
```

### Implicit numeric widening

An integer or float value may be implicitly converted to a larger type of the same family — `i32` to `i64`, `f32` to `f64`, `u8` to `u32`, and so on. Narrowing or cross-family conversions (signed↔unsigned, int↔float) require an explicit [cast](#casting).

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
| Cast | `as` |
| Postfix | call `f(x)`, member `x.f`, index `x[i]` |

`and` / `or` short-circuit. The pipeline `x |> f` rewrites to `f(x)`; chains compose left-to-right.

```ruka
let n = nums |> filter(~pred=(x) do x % 2 == 0)
            |> map(~f=(x) do x * x)
            |> sum()
```

Operators on user-defined types are dispatched via [operator behaviours](#behaviours): defining a method named `add` makes `+` available for the type.

## Casting

The `as` operator converts a value to a target type: `value as Type`. Implicit widening (see [Built-in types](#built-in-types)) is the only conversion the compiler performs without an explicit cast — every other conversion goes through `as`.

`as` is a behaviour-driven operator. It dispatches on `ruka.cast`: any type that defines a `cast` method satisfying the behaviour can be the source of an `as` conversion to whichever target types its `cast` method enumerates. The prelude provides casts between numeric types, between numeric types and characters, and between numeric types and strings.

```ruka
let n: i64 = 10
let m = n as i32       // explicit narrowing
let s = n as string    // numeric → string
let c = 65 as u8       // implicit (u8 is wider for an unsigned literal here)
```

A type customises `as` by defining a `cast` member that matches the [`ruka.cast`](#rukacast) behaviour. Casting source code is checked at compile time; if the conversion is invalid for the source/target pair, the program fails to compile.

## Patterns

Patterns appear in `let`/`local` destructuring, `match` arms, `for` loop binders, and the [conditional pattern forms](#conditional-pattern-binding) of `if` and `while`. Patterns may be *refutable* (may not match) or *irrefutable* (always match) — only irrefutable patterns are allowed in `let`/`local` and in the pattern position of `for` (where non-matching elements are skipped instead of failing).

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

`if` is an expression. The condition is followed by `do`; `else` is optional and may chain with another `if`. A multi-statement branch uses `do … end`. The ternary form swaps the leading `do` with `if`: `value if condition else other`.

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

`for x in iter do … end` — `iter` must satisfy `ruka.iterable`. The loop variable is immutable within the body. The `x in` clause may be omitted when the body does not need the iterated value, useful for "do this N times":

```ruka
for n in 0..5 do ruka.println("${n}")
for (k, v) in pairs do ruka.println("${k}=${v}")

for 0..3 do ruka.println("tick")    // no binding — runs 3 times
```

#### Nested for with `with`

A common shape is "repeat a body N times, each time iterating over a collection". Writing this as two nested `for` loops works, but reads heavily because the outer loop has no useful binding. The `for outer with pattern in inner do …` form is sugar for that nesting:

```ruka
for 0..epochs with (input, target) in training do
    self.fit(input, target)
end

// equivalent to:
for 0..epochs do
    for (input, target) in training do
        self.fit(input, target)
    end
end
```

The outer iterator never binds a name (use a plain nested `for x in … do for y in …` if you need the outer value). `break` and `continue` apply to the *inner* loop.

### Conditional pattern binding

`if`, `while`, and `for` accept a *refutable* pattern in place of a plain condition or binding. Each construct interprets a non-match differently:

- `if pattern = expr do …` — evaluates `expr`, runs the block (with the bindings introduced by `pattern`) only if the pattern matches. May chain with `else if` / `else`.
- `while pattern = expr do …` — re-evaluates `expr` each iteration; terminates the first time the pattern fails to match.
- `for pattern in iter do …` — silently skips elements that fail to match. Useful for filtering by shape.

```ruka
if some(name) = lookup(id) do
    ruka.println("hello, ${name}")
else
    ruka.println("unknown")
end

while some(line) = stream.next() do
    process(line)
end

for ok(row) in rows do
    handle(row)    // err(_) elements are skipped
end
```

Use the form whose semantics match the intent: `if` for opportunistic action, `while` to drain matching values until the first non-match, `for` to filter as you iterate.

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

Match must be *exhaustive*: the patterns together must cover every possible value of the subject's type. A trailing `else` arm covers anything not matched explicitly.

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

## Closures

A *closure* is a runtime function value that references runtime bindings from an enclosing scope. Its *capture set* is exactly those referenced bindings — every name the body uses that is not one of the function's parameters and not a top-level (compile-time) value. The compiler infers the set from the body. Functions defined at file scope are *not* closures: file scope is compile-time, so there is no runtime state to close over.

Two rules constrain capture:

1. **Only `let` runtime bindings may be captured.** A `local` runtime binding cannot escape its declaring function, so a closure that outlives that function cannot reference it.
2. **`&`-annotated bindings transfer ownership on capture.** A binding declared `let &name = …` *moves* into the first closure that captures it; the original binding is invalid afterwards. Without `&`, capture is by reference.

```ruka
let make_counter = () do
    let *n = 0
    () do
        n = n + 1
        n
    end
end

let counter = make_counter()
ruka.println("${counter()}")   // 1
ruka.println("${counter()}")   // 2
```

In the example above, the inner function captures `n` (a `let` binding) from `make_counter`. If `n` had been declared `local *n = 0`, the inner closure could not have escaped `make_counter` and the program would fail to compile.

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

A named parameter typed `?(T)` is optional. When omitted, it receives `none`; when given a bare value, the value is automatically wrapped in `some(...)`. This is the one place where annotating a named parameter is required — the `?(T)` annotation is what marks it optional.

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
let map = (~t: type, xs: [t], ~f) do ...

let doubled = map(nums) ~f=(x) do x * 2
let squared = map(nums) ~f=(x) do
    let s = x * x
    s
end
```

### Compile-time type inference from a trailing named parameter

When a function declares a `~t: type` named parameter and the call site does not pass `~t` explicitly, the compiler infers `t` from the *result location* — the type of the binding, parameter, or field that will receive the call's result. This makes generic factory functions read like ordinary literals at the call site.

```ruka
let empty = (~t: type) -> [t] do [t] {}

let xs: [i32] = empty()         // ~t=i32 inferred from the binding's type
let ys: [string] = empty()      // ~t=string inferred similarly
```

If no result-location type is available, the compiler falls back to the usual rules — ambiguity is a compile error.

## Records & variants

### Records

A record is a fixed set of named, typed fields. Declare with `record { … }`. In a multi-line declaration the fields are separated by newlines; commas are only needed when fields share a single line. Fields prefixed with `local` are private to the declaring file.

```ruka
let point = record {
    x: f64
    y: f64
    local cache: f64
}

let inline = record { x: f64, y: f64 }   // commas required on one line
```

Construct a record with `{ field = value, … }`; the type is inferred from context, or written as a type-name prefix when not. Records destructure with the same field names — `{ a, b }`.

```ruka
let move = (p: point) do { x = p.x + 1.0, y = p.y, cache = p.cache }

let { x, y } = move({ x = 0.0, y = 0.0, cache = 0.0 })
```

A record type with **no fields** cannot be instantiated — there is no value to construct, since there are no fields to give. An empty `record { }` is reserved for use as a type-level marker (a declaration that exists only to attach members to). To express "no information", use the unit type `()`.

### Variants

A variant (tagged union) names a fixed set of cases, each with an optional payload type. Cases are separated by newlines in a multi-line declaration; commas are only needed on a single line.

```ruka
let hit = variant {
    critical: int
    normal:   int
    miss
}
```

Construct a variant with `tag` or `tag(payload)` (resolved against context, with a binding of the same name winning over a tag — see [Variant constructors](#variant-constructors)) and consume it with [`match`](#match).

## Methods & members

Methods and *members* are declared with the same `let` form, distinguished by what appears in parentheses after the name. (Members are constants attached to a type — what other languages call statics. Reserve "fields" for the runtime data of a record.)

- `let name (type) = …` — **member** on `type`, called as `type.name(...)`.
- `let name (self) = …` — **method**, called as `value.name(...)`.
- `let name (*self) = …` — **mutating method**.
- `let name (&self) = …` — **consuming method**; ownership of the receiver moves into the method (the destructor-style form). The receiver is invalid after the call.

```ruka
let counter = record {
    count: int
}

// members — accessed as counter.zero, counter.new(...)
let zero (counter) = { count = 0 }
let new  (counter) = (start) do { count = start }

// method — accessed as c.bump()
let bump (self) = () do { count = self.count + 1 }

// mutating method
let inc (*self) = () do
    self.count = self.count + 1
end
```

Ruka has no concept of constructors or destructors. By convention, a *constructor* is a function that returns a value of the type and a *destructor* is a method declared `(&self)` that consumes the receiver, disallowing its further use.

### Type receivers vs file-as-type

A type receiver (`let name (type) = …`) is most useful for *extending* foreign types — primitives, prelude generics, or types imported from another file. For first-party types, the cleanest pattern is a file-per-type: bind the type to `t` at the top of its file, define members and methods alongside it, and consumers refer to it through the imported file.

```ruka
// Vector.ruka
let t = record {
    x: f64
    y: f64
}

let new = (x: f64, y: f64) -> t do { x, y }

let length (self) = () do ruka.sqrt(self.x * self.x + self.y * self.y)
```

```ruka
// main.ruka
local Vector = ruka.import("Vector.ruka")

let main = () do
    let v: Vector.t = Vector.new(3.0, 4.0)
    ruka.println("${v.length()}")
end
```

Type receivers remain available for genuine extension — adding a method to `i32`, to a third-party record, or to a prelude type — where the file-per-type pattern is not possible.

## Type inference

Type inference in Ruka is *resolution*, not *synthesis*. Every value's type must already exist somewhere in scope; inference figures out which one. Bidirectional flow lets a known type drive the shape of an expression, and the shape of an expression narrows which in-scope type matches it. Annotations are needed only when more than one in-scope type fits — ambiguity is always a compile error, never an excuse to invent an anonymous type.

### Numeric defaults

An integer literal with no contextual type takes `int`; a literal containing `.` takes `float`. A type-annotated binding or parameter pulls the literal toward a more specific numeric type. Implicit widening between numeric types of the same family is allowed; everything else needs an explicit [cast](#casting).

### Record literals

A `{ … }` record literal first looks for an expected type from context — a binding annotation, a parameter type, the field type of an enclosing record. If context exists, that type wins and the literal is checked against it.

With no context, the compiler searches the surrounding scope for record types whose field set matches the literal exactly. If exactly one type fits, the literal infers to that type. If two or more types fit, the literal is ambiguous and a type-name prefix or annotation is required.

```ruka
let point = record { x: f64, y: f64 }

let p = { x = 1.0, y = 2.0 }       // ok — only point matches in scope
let q = point { x = 1.0, y = 2.0 } // explicit prefix when ambiguous
```

### Variant constructors

A constructor written `tag` or `tag(value)` is first resolved as an ordinary identifier — if a binding of that name is in scope, it wins. Otherwise the compiler searches in-scope variant types for a tag of that name with a compatible payload. If exactly one variant matches, the constructor infers to that type; ambiguity requires a `type.tag` prefix.

### Record parameters

A parameter that is used only as a record (field access, record destructuring) but has no annotation is inferred structurally. The compiler collects every field the body reads and searches scope for record types whose declared fields are a superset of that set. If exactly one type fits, the parameter takes that type; otherwise the function is ambiguous and the parameter must be annotated.

```ruka
let point = record { x: f64, y: f64 }

// uses .x and .y — only point has both → param inferred as point
let length = (p) do ruka.sqrt(p.x * p.x + p.y * p.y)
```

### Variant parameters

The same rule applies to a parameter used only by `match`: the compiler collects the tags the arms require, and if exactly one variant in scope declares those tags (with compatible payload arities), the parameter infers to that variant.

### Method receivers

On a method declared `let name (self) = …`, the receiver type is inferred by the same record-or-variant structural rule against the body's field accesses, mutations, and pattern arms.

### Return types

A function's return type is inferred from its body. Recursive functions and mutually recursive groups infer through their call graph; an annotation is only needed to break a cycle the checker cannot resolve.

### Behaviours never infer

A behaviour-typed parameter is **never** inferred. The behaviour must be written explicitly as the parameter annotation. This is what distinguishes a structurally-inferred record parameter (concrete type, monomorphic) from a behaviour parameter (polymorphic over every type that satisfies the behaviour, monomorphised per call site).

```ruka
let area = (s) do s.area()             // inferred to a single concrete type
let area = (s: shape) do s.area()      // polymorphic over shape
```

## Behaviours

A behaviour declares a set of method signatures. Any type whose methods cover those signatures *satisfies* the behaviour — no `implements` declaration is required. Like records and variants, signatures are separated by newlines in a multi-line declaration; commas are only needed on a single line.

```ruka
let shape = behaviour {
    area(self):      () -> f64
    perimeter(self): () -> f64
}
```

### Using a behaviour

A behaviour may appear as a parameter type. Each call site monomorphises against the concrete argument type — this is static dispatch, not virtual.

```ruka
let describe = (s: shape) do
    ruka.println("area: ${s.area()}")
end
```

Behaviour types may only appear in parameter position. Using one as a return type, field type, or binding type is a compile error — behaviours describe behaviour, not storage.

### Builtin behaviours

The compiler recognises four families of behaviours specially.

#### `ruka.printable`

A type satisfying `printable` may appear inside `${…}` string interpolation and may be passed to `ruka.print` / `ruka.println`.

```ruka
let printable = behaviour {
    format(self): () -> string
}

let format (self) = () do "(${self.x}, ${self.y})"   // makes point printable
```

#### `ruka.iterable`

A type satisfying `iterable` may be used in a `for` loop. The compiler calls `next` per iteration; `none` ends the loop.

```ruka
let iterable = behaviour {
    next(*self): () -> ?(T)
}
```

#### `ruka.cast`

A type satisfying `cast` is the source type of `value as Target`. The behaviour declares which target types are reachable from the source; the operator dispatches to the matching overload at compile time.

```ruka
let cast = behaviour {
    cast(self): (~t: type) -> t
}
```

#### Operator behaviours

Methods with names like `UNDECIDED` are recognised as operator implementations. Defining one of these enables the corresponding operator on the type.

## Comprehensions

A comprehension builds a collection from an iterator. Two forms are recognised — they share the same outer brace shape used by every braced literal, and disambiguate by what their body expression looks like.

**Array comprehension** — body is a single expression:

```ruka
let squares = { x * x for x in 0..10 }
let evens   = { x for x in 0..100 if x % 2 == 0 }
let pairs   = { (k, v) for (k, v) in scores if v >= 90 }
```

**Map comprehension** — body is a `key => value` pair:

```ruka
let lookup  = { name => id for (name, id) in roster }
let squares = { n => n * n for n in 1..=10 }
let passing = { name => score for (name, score) in scores if score >= 60 }
```

The pattern follows the same rules as a `for` loop pattern — refutable patterns silently skip non-matching elements, so `{ x for some(x) in maybes }` extracts the values of every `some` element.

The element type is inferred from the body expression and may be pinned by a type prefix or surrounding annotation: `[u32] { f(x) for x in src }`, `[string => i32] { k => f(k) for k in keys }`.

## Files & imports

A Ruka file *is* a record — a record type whose only constituents are members (constants attached at compile time), with no runtime fields. Every top-level `let` declaration becomes a member of that record; `local` declarations are members the file uses internally but does not export. There is no separate "module" concept.

`ruka.import("path")` evaluates at compile time and returns the imported file as that record value. Access members through it, or destructure to bring names into scope.

```ruka
let Math = ruka.import("Math.ruka")
let r = Math.sqrt(2.0)

// destructuring import
let { sqrt, pow } = ruka.import("Math.ruka")
```

Because the result is compile-time known, an imported type may be passed to a `type`-typed parameter directly:

```ruka
let Animals = ruka.import("Animals.ruka")
let describe = (t: type) do ruka.println("${t}")
describe(Animals.dog)
```

## Bouquets

A *bouquet* is Ruka's package unit. Bouquets are created and managed through the `ruka` CLI:

```
ruka bouquet new my-package
```

Every bouquet has an *index* file conventionally called `petal.ruka`. The index file is the entry point: it is what `ruka.import("bouquet-name")` returns. Library-only bouquets place their petal at `src/petal.ruka` to keep the project root uncluttered; binary bouquets typically place it at the root and accompany it with an executable entry.

A bouquet may import other bouquets; the resolver looks them up by name against the project's manifest and returns each one's petal as a record.

## Tests

A `test` binding declares a zero-argument function that runs as part of the test suite. Tests are compiled in *debug* and *test* builds and elided entirely in *release* — assertions inside a `test` have no runtime cost in production.

```ruka
let add = (a, b) do a + b

test addition = () do
    ruka.expect_eq(add(1, 2), 3)
    ruka.expect_eq(add(0, 0), 0)
end
```

Tests live in their declaring file's scope and can therefore call `local` declarations directly. There is no separate test-visibility mechanism.

## Compile-time evaluation

Ruka has a compile-time interpreter. Functions with `@`-prefixed parameters run at compile time; their results are compile-time constants. Types, functions, and records-of-members are first-class values in compile-time contexts.

**Type values are compile-time only.** Any code that *creates*, *inspects*, or *passes around* a `type` value must run at compile time. There is no runtime reflection — `ruka.type_of`, `ruka.fields_of`, `ruka.record_of`, and friends are all compile-time. A binding of type `type` is, by definition, compile-time.

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
let fixed_array = (t, @cap: uint) do
    record {
        data: [t]
        len:  uint
    }
end

let int_buf   = fixed_array(i32, 64)
let float_buf = fixed_array(f64, 16)
```

### Storing compile-time results

At file scope, `let` already evaluates its right-hand side at compile time, so no prefix is needed. Inside a function body, prefix the binding with `@` to force compile-time storage.

```ruka
let sqrt_2 = ruka.sqrt(2.0)    // top level — comptime by default

let run = () do
    let @table = build_lookup_table(256)   // forced to comptime
    let rows   = fetch_rows()              // runtime
end
```

### Reflection

`ruka.type_of(e)` returns the type of `e` as a compile-time value. `ruka.fields_of`, `ruka.methods_of`, and `ruka.members_of` return the structural pieces of a type. `ruka.record_of(fields)` constructs a new record type from a list of field descriptors. All four take `@`-prefixed type arguments and run at compile time — there is no runtime reflection.

```ruka
// derive: produce an option-of-every-field version of any record
let partial = (t) do
    let fs = ruka.fields_of(t)
        |> map((f) do { name = f.name, type = ?(f.type) })
    ruka.record_of(fs)
end

let user = record {
    id: i32
    name: string
}
let partial_user = partial(user)
// partial_user ≡ record { id: ?(i32), name: ?(string) }
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

### Behaviours

`printable` driving string interpolation.
`iterable` driving for loops.
`cast` driving the [`as` operator](#casting).
There are also behaviours driving the mathematical, indexing, and bitwise operators.

### Math

`abs`, `sqrt`, `pow`, `exp`, `floor`, `ceil`, `min`, `max`, `sin`, `cos`, `tan`, `random`.

### Testing

`expect_eq(a, b)` returns an `!((), string)`.

### File import

`import("path")` — see [Files & imports](#files--imports).

### Compile-time

`type_of`, `fields_of`, `methods_of`, `members_of`, `record_of`, `compile_error(msg)`. See [Compile-time evaluation](#compile-time-evaluation).
