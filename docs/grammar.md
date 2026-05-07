# Grammar

This page is the formal grammar of Ruka, written in a variant of Extended Backus–Naur Form. It pairs with the [reference](./reference.md): the reference describes semantics in prose, and this page pins down the surface syntax. This is the defacto single source of truth for the language syntax.

## Notation

Each production has the form:

```ebnf
rule-name  ::=  production
```

The following meta-syntax is used throughout:

| Form | Meaning |
| --- | --- |
| `A B` | Concatenation — A followed by B. |
| `A | B` | Alternation — A or B. |
| `A?` | Option — zero or one occurrence of A. |
| `A*` | Repetition — zero or more occurrences of A. |
| `A+` | One or more occurrences of A. |
| `( A )` | Grouping — treats A as a single unit. |
| `"terminal"` | A literal character sequence. |
| `[a-z]` | A character class — any character in the given range. |
| `<description>` | An informal prose description of a terminal set. |
| `-- comment` | An explanatory note; not part of the production. |

Lexical rules describe raw text; syntactic rules describe token sequences. Both use lowercase-with-hyphens names. Whitespace and comments between tokens are always permitted and are omitted from syntactic rules for clarity.

## Lexical grammar

The lexical grammar describes how raw source text is divided into tokens. The scanner reads left-to-right and always produces the longest possible token at each position (maximal munch).

### Source encoding

Ruka source files are encoded in UTF-8. The term *char* below means any Unicode scalar value.

### Whitespace & comments

Whitespace and comments are discarded by the scanner and do not appear in the syntactic grammar. Block comments are not supported.

```ebnf
whitespace    ::=  ( " " | "\t" | "\r" | "\n" )+

comment       ::=  "//" <any char except "\n">* "\n"?
```

### Identifiers

An identifier begins with a letter or underscore and is followed by zero or more letters, digits, or underscores. Any identifier that matches a keyword or mode keyword is reserved and cannot be used as a user-defined name. The first letter of an identifier determines visibility at file scope: lowercase exports, uppercase is private.

```ebnf
letter        ::=  [a-zA-Z_]
digit         ::=  [0-9]

identifier    ::=  letter ( letter | digit )*
                   -- must not be a keyword or mode keyword
```

### Keywords & modes

The following identifiers are reserved as keywords:

`and` `behaviour` `break` `continue` `defer` `do` `else` `end` `false` `for` `if` `in` `let` `match` `not` `or` `record` `return` `self` `test` `true` `variant` `while` `with`

The following symbols are reserved as *mode prefixes*. A mode prefix is placed directly before a parameter or binding identifier with no whitespace between the prefix and the identifier.

```ebnf
mode-prefix   ::=  "*"    -- mutable; binding may be reassigned, parameter mutates in place
               |   "&"    -- move (ownership transfer); on parameters, caller cannot use the value after the call;
                          --   on runtime bindings, capture by a closure transfers ownership into the closure
               |   "$"    -- stack-allocated; value cannot escape the function scope
               |   "@"    -- compile-time; value must be known at compile time
```

`self` is reserved for the method receiver; it may only appear in the receiver clause of a binding declaration or as a parameter inside a method body. `with` is used only as part of `match` syntax. `ruka` is a reserved identifier referring to the built-in module; it is implicitly in scope in every source file and cannot be shadowed or rebound.

### Literals

#### Integer literals

```ebnf
decimal-digit ::=  [0-9]
hex-digit     ::=  [0-9a-fA-F]
binary-digit  ::=  "0" | "1"

decimal-lit   ::=  decimal-digit+
hex-lit       ::=  "0x" hex-digit+
binary-lit    ::=  "0b" binary-digit+

integer-lit   ::=  decimal-lit | hex-lit | binary-lit
                   -- a leading minus sign is parsed as a unary operator, not part of the literal
                   -- default type: int; overridden by type context
```

#### Float literals

```ebnf
float-lit     ::=  decimal-digit+ "." decimal-digit+
                   -- leading minus is a unary operator
                   -- default type: float; overridden by type context
```

#### Boolean literals

```ebnf
bool-lit      ::=  "true" | "false"
```

#### Character literals

A character literal is a single byte in single quotes. It has type `u8`; there is no separate `char` primitive.

```ebnf
char-escape   ::=  "\\" ( "n" | "t" | "r" | "\\" | "'" | '"' | "0" )
char-lit      ::=  "'" ( <any char except "'", "\\", "\n"> | char-escape ) "'"
```

#### String literals

String literals are delimited by double quotes. Expressions may be embedded with `${…}`; the interpolated expression must satisfy the `ruka.printable` behaviour.

```ebnf
str-escape    ::=  "\\" ( "n" | "t" | "r" | "\\" | "'" | '"' | "0" )
str-interp    ::=  "${" expr "}"
str-content   ::=  ( <any char except '"', "\\", or "$"> | str-escape | str-interp )*
string-lit    ::=  '"' str-content '"'
```

#### Multiline string literals

Multiline strings begin with `|"` followed by a newline. Each content line must begin with `|`, which is stripped from the resulting string value (a single space immediately after the bar is also stripped). The literal ends with `|"` on its own line.

```ebnf
ml-content    ::=  <any char except "\n">
ml-line       ::=  "|" ml-content* "\n"
multiline-lit ::=  '|"' "\n" ml-line* '|"'
```

## Syntactic grammar

The syntactic grammar is defined over token sequences. Whitespace and comments between any two tokens are implicitly permitted and ignored. A few rules below refer explicitly to `newline` as a structural marker — these are the cases where the scanner's line breaks become syntactically significant (single-expression block bodies).

### Program

A Ruka source file is a flat sequence of declarations. Every file is implicitly a compile-time record: top-level `let` declarations whose names begin with a lowercase letter become its public fields; those whose names begin with an uppercase letter are private fields, inaccessible to importers. `ruka.import` returns this record value; there is no separate module concept.

```ebnf
program       ::=  declaration*
```

### Declarations

There are two declaration forms: ordinary `let` bindings and `test` bindings. There is no separate `fn`, `type`, or `mod` keyword. Mutability and evaluation time are expressed through modes; privacy is determined by the case of the binding name.

```ebnf
declaration   ::=  binding | test-binding

binding       ::=  "let" binding-lhs "=" expr
               |   "let" binding-lhs ":" type "=" expr

binding-lhs   ::=  mode-prefix? identifier                  -- simple value binding
               |   mode-prefix? identifier receiver         -- function or method binding
               |   destructure-pattern                      -- destructuring binding

receiver      ::=  "(" type-receiver ")"
type-receiver ::=  identifier                               -- static function: associated type name
               |   mode-prefix? "self"                      -- method: instance receiver

destructure-pattern
              ::=  record-pattern | tuple-pattern
                   -- destructures any irrefutable pattern; see Patterns
                   -- e.g.  let { x, y } = point
                   -- e.g.  let (a, b)   = pair
                   -- e.g.  let { sqrt, pow } = ruka.import("math")

test-binding  ::=  "test" identifier "=" expr
                   -- the value must be a function expression; compiled in debug/test builds only
```

**Uniform declarations.** Functions, types, behaviours, and modules are all values stored in ordinary `let` bindings. A *receiver* in the binding left-hand side associates the value with a named type as either a static function (type-name receiver) or a method (`self` receiver). The receiver appears between the binding name and the `=` sign.

**Type extension.** The type named by a receiver is not required to be declared in the current scope — any type is a valid receiver, including primitives (`i32`, `bool`, etc.) and built-in generics. An extension declared outside the type's original scope shadows the type within the extending scope rather than mutating it. See [Methods & statics](./reference.md#methods--statics).

**Privacy.** Visibility is determined by the first letter of the binding name — the inverse of Go's convention. A binding whose name begins with a lowercase letter is public (exported from the file record); a binding whose name begins with an uppercase letter is private. The same rule applies to methods, statics, and record or variant fields. Privacy does not apply inside function bodies, where name case is purely conventional.

**Mutability.** By default a `let` binding is immutable. The `*` mode prefix makes the binding a mutable variable: `let *count = 0`. Reassignment is only permitted on bindings declared with `*`.

**Evaluation time.** Bindings at file scope (including methods, statics, and type declarations) are implicitly compile-time. The `@` mode may be written explicitly but is redundant there. Inside an inner scope (function body, block) a plain `let` is runtime; `@` must be written explicitly to force compile-time evaluation of the right-hand side.

**Test bindings.** A `test` binding declares a function that is only compiled in debug and test builds and elided entirely in optimised builds. The value must be a function expression. Test bindings have no visibility qualifier and no receiver clause. The name is an ordinary identifier used by the test runner to identify the test.

### Types

Type expressions appear after `:` in parameter and binding annotations, after `->` in return-type annotations, and as values passed to `type`-typed parameters.

```ebnf
type          ::=  "()"                              -- unit type
               |   primitive-type
               |   array-type
               |   tuple-type
               |   range-type
               |   option-type
               |   result-type
               |   function-type
               |   record-type
               |   variant-type
               |   behaviour-type
               |   identifier                         -- named type (user-defined or type parameter)

-- ── Primitive types ───────────────────────────────

primitive-type
              ::=  "int"                              -- signed integer, platform-native width (default)
               |   "uint"                             -- unsigned integer, platform-native width
               |   "i8"   | "i16"  | "i32"  | "i64"  | "i128"
               |   "u8"   | "u16"  | "u32"  | "u64"  | "u128"
               |   "float"                            -- floating-point, platform-native width (default)
               |   "f32"  | "f64"
               |   "string"                           -- UTF-8 string
               |   "bool"                             -- boolean
               |   "type"                             -- the type of types; used in compile-time contexts

-- ── Collection types ──────────────────────────────

array-type    ::=  "[" type "]"                      -- homogeneous array:        [i32]
tuple-type    ::=  "[" type ( "," type )+ "]"        -- fixed-length tuple:        [i32, string]
range-type    ::=  "[" type ".." "]"                 -- iterator range:            [int..]

-- ── Generic built-in types ────────────────────────
-- Both have shorthand forms; the shorthand is canonical.

option-type   ::=  "?" "(" type ")"                  -- value that may be absent:  ?(int)
result-type   ::=  "!" "(" type "," type ")"         -- value or error:            !(int, string)

-- ── Function type ─────────────────────────────────

function-type ::=  "(" type-list? ")" "->" type
type-list     ::=  type ( "," type )*

-- ── User-defined types ────────────────────────────
-- Inside record / variant / behaviour blocks, members are separated by
-- newlines. Commas are only required when two members share a single line.

record-type   ::=  "record" "{" field-list? "}"
field-list    ::=  field ( field-sep field )* field-sep?
field         ::=  identifier ":" type               -- private iff identifier starts with an uppercase letter

variant-type  ::=  "variant" "{" tag-list? "}"
tag-list      ::=  tag ( field-sep tag )* field-sep?
tag           ::=  identifier ( ":" type )?          -- payload type is optional; absent means unit

behaviour-type
              ::=  "behaviour" "{" method-sig-list? "}"
method-sig-list
              ::=  method-sig ( field-sep method-sig )* field-sep?
method-sig    ::=  identifier "(" mode-prefix? "self" ")" ":" function-type

field-sep     ::=  newline | ","                     -- newline separates members; comma only required on a single line
```

**Result-location semantics.** The collection literal `.{…}` produces an array, and `.(…)` produces a tuple. The element type of an array literal and the field types of a record literal flow in from context; an annotation pins them when context is unavailable.

### Expressions

Ruka is expression-based: blocks, conditionals, match expressions, and function bodies all evaluate to a value. The following layered grammar encodes operator precedence structurally, from lowest-binding (outermost rule) to highest-binding (innermost rule). The reference's operator table presents the same precedence in tabular form.

```ebnf
expr          ::=  ternary-expr
                   -- see "Conditional expression (ternary)" under Control Flow

assign-expr   ::=  pipeline-expr ( "=" assign-expr )?
                   -- right-associative; left-hand side must be a mutable place expression

pipeline-expr ::=  or-expr ( "|>" or-expr )*
                   -- left-associative; inserts the left value as the first argument of the right call

or-expr       ::=  and-expr ( "or" and-expr )*

and-expr      ::=  eq-expr ( "and" eq-expr )*

eq-expr       ::=  compare-expr ( ( "==" | "!=" ) compare-expr )?
                   -- non-associative

compare-expr  ::=  range-expr ( ( "<" | "<=" | ">" | ">=" ) range-expr )?
                   -- non-associative

range-expr    ::=  bit-or-expr ( ( ".." | "..=" ) bit-or-expr )?
                   -- ".."  — exclusive: lower <= i < upper
                   -- "..=" — inclusive: lower <= i <= upper

bit-or-expr   ::=  bit-xor-expr ( "|" bit-xor-expr )*

bit-xor-expr  ::=  bit-and-expr ( "^" bit-and-expr )*

bit-and-expr  ::=  shift-expr ( "&" shift-expr )*

shift-expr    ::=  add-expr ( ( "<<" | ">>" ) add-expr )*

add-expr      ::=  mul-expr ( ( "+" | "-" ) mul-expr )*

mul-expr      ::=  pow-expr ( ( "*" | "/" | "%" ) pow-expr )*

pow-expr      ::=  unary-expr ( "**" pow-expr )?
                   -- right-associative

unary-expr    ::=  "not" unary-expr
               |   "-" unary-expr
               |   postfix-expr
```

### Operator precedence

The table below summarises all operators from lowest to highest precedence.

| Level | Operator(s) | Associativity | Description |
| --- | --- | --- | --- |
| 1 (lowest) | `=` | Right | Assignment |
| 2 | `\|>` | Left | Pipeline (forward application) |
| 3 | `or` | Left | Logical OR |
| 4 | `and` | Left | Logical AND |
| 5 | `==` `!=` | None | Equality |
| 6 | `<` `<=` `>` `>=` | None | Comparison |
| 7 | `..` `..=` | None | Range construction |
| 8 | `\|` | Left | Bitwise OR |
| 9 | `^` | Left | Bitwise XOR |
| 10 | `&` | Left | Bitwise AND |
| 11 | `<<` `>>` | Left | Bitwise shift |
| 12 | `+` `-` | Left | Additive arithmetic |
| 13 | `*` `/` `%` | Left | Multiplicative arithmetic |
| 14 | `**` | Right | Exponentiation |
| 15 | `not`, `-` (prefix) | Prefix | Logical NOT, arithmetic negation |
| 16 (highest) | `.` `[]` `()` `.?()` `.!()` | Left | Field access, index, call, unwrap |

### Postfix expressions

Postfix operations bind tighter than any prefix or infix operator and are left-associative, allowing arbitrary chaining.

```ebnf
postfix-expr  ::=  primary postfix-op*

postfix-op    ::=  "." identifier                         -- field access
               |   "." identifier "(" arg-list? ")"       -- method call
               |   ".?()"                                 -- option force-unwrap; panics if .none
               |   ".!()"                                 -- result force-unwrap; panics if .err
               |   "[" expr "]"                           -- index (array, tuple, range slice)
               |   "(" arg-list? ")" trailing-arg*        -- function call

arg-list      ::=  arg ( "," arg )*
arg           ::=  named-arg | expr

named-arg     ::=  "~" identifier ( "=" expr )?
                   -- "~label=value" passes a labelled argument
                   -- "~label" shorthand: variable in scope shares the label name

trailing-arg  ::=  "~" identifier "=" function-expr
                   -- a named closure argument passed after the closing parenthesis
                   -- e.g.  map(nums) ~f=(x) do x * 2
```

### Primary expressions

```ebnf
primary       ::=  literal-expr
               |   identifier                              -- `ruka` is reserved as the built-in module reference
               |   block-expr
               |   if-expr
               |   match-expr
               |   while-expr
               |   for-expr
               |   return-expr
               |   break-expr
               |   continue-expr
               |   function-expr
               |   array-lit
               |   tuple-lit
               |   record-lit
               |   variant-ctor
               |   "(" expr ")"                           -- parenthesised expression

-- ── Literal expressions ───────────────────────────

literal-expr  ::=  integer-lit
               |   float-lit
               |   bool-lit
               |   char-lit
               |   string-lit
               |   multiline-lit
               |   unit-lit

unit-lit      ::=  "(" ")"                                -- the unit value; the only inhabitant of the unit type

-- ── Block expression ──────────────────────────────
-- A sequence of statements; evaluates to its last expression.
-- "do" is shared by every block-introducing construct (function body,
-- if/else branches, while/for body, match arms). Everywhere it appears, the
-- two forms below apply uniformly: a single expression on the same line is
-- closed by the newline; a multi-statement body opens a new line and is
-- closed by "end".

block-expr    ::=  "do" expr                                  -- single-expression block; closed by newline
               |   "do" newline stmt* "end"                   -- multi-statement block; closed by "end"

stmt          ::=  declaration | defer-stmt | expr

-- ── Array and tuple literals ──────────────────────
-- Array literals use ".{...}" and are homogeneous. Tuple literals use
-- ".(...)" and are heterogeneous fixed-arity. The leading "." marks a value
-- being constructed and distinguishes literals from destructuring patterns.

array-lit     ::=  ".{" "}"                               -- empty array
               |   ".{" expr-items "}"                    -- non-empty array
               |   identifier "." array-lit               -- explicit element-type prefix: [u8].{0, 1, 2}

tuple-lit     ::=  ".(" ")"                               -- empty tuple
               |   ".(" expr-items ")"                    -- non-empty tuple

expr-items    ::=  expr ( "," expr )* ","?

-- ── Record literals ───────────────────────────────
-- Constructs a value of a record type. Field initialisers are separated by
-- newlines or commas using the same "field-sep" rule as type declarations.

record-lit    ::=  ( identifier "." )? ".{" field-inits? "}"
                   -- optional "TypeName." prefix forces the type; omitted when inferrable

field-inits   ::=  field-init ( field-sep field-init )* field-sep?
field-init    ::=  identifier "=" expr                    -- explicit:   name = value
               |   identifier                             -- shorthand:  variable name matches field name

-- ── Variant constructors ──────────────────────────
-- Constructs a value of a variant type.

variant-ctor  ::=  "." identifier                         -- unqualified, no payload: .tagName
               |   "." identifier "(" expr ")"            -- unqualified, with payload: .tagName(expr)
               |   identifier "." identifier              -- qualified, no payload:   Type.tagName
               |   identifier "." identifier "(" expr ")" -- qualified, with payload: Type.tagName(expr)
```

### Function expressions

Functions are anonymous values. A function expression is a parameter list, an optional return-type annotation, and a body introduced by `do`. The body uses the same `block-expr` rule as every other block.

```ebnf
function-expr ::=  "(" param-list? ")" return-annot? block-expr

return-annot  ::=  "->" type

param-list    ::=  param ( "," param )*
param         ::=  mode-prefix? "~"? identifier type-annot?     -- positional or named parameter
               |   mode-prefix? "self"                          -- method receiver (keyword only)

type-annot    ::=  ":" type
```

**Receiver and function expression.** When a binding declaration carries a receiver clause, the `param-list` describes only the *explicit* parameters — the receiver itself is declared by the binding, not by the function expression. See [Declarations](#declarations).

#### Named parameters

Prepending `~` to a parameter name makes it a *named parameter*. Named parameters are always passed by label at the call site and may appear in any order. A named parameter may also be passed as a trailing argument outside the closing parenthesis, which is useful for higher-order functions that accept a closure.

```ebnf
-- Declaration (in param-list)
--   mode-prefix? "~" identifier type-annot?
--   e.g.  ~name: string,  ~f: (int) -> int

-- Call site (in arg-list)
--   "~" identifier "=" expr     standard form:  ~name="Ruka"
--   "~" identifier              shorthand form: ~name  (variable in scope has the same name)

-- Trailing form (after the closing parenthesis)
--   "~" identifier "=" function-expr
--   e.g.  map(nums) ~f=(x) do x * 2
--   e.g.  reduce(nums, 0) ~f=(acc, x) do
--             acc + x
--         end
```

### Control flow

All control flow constructs are expressions and produce a value. When used purely for side effects the result is the unit type `()`. Each construct's body is a `block-expr` (see Block expression above) — the single-line and multi-line forms apply uniformly.

#### If expression

A multi-statement `if` chain is closed by a single trailing `end`; an all-single-expression chain has no `end`, since each branch closes at its newline.

```ebnf
if-expr       ::=  "if" expr block-expr
                   ( "else" "if" expr block-expr )*
                   ( "else" block-expr )?
                   -- when any branch uses the multi-statement block-expr form, the chain ends with "end"
                   -- when every branch is single-expression, the chain has no "end"
```

**Conditional expression (ternary).** A right-hand-side conditional uses `value if cond else value` — the same keywords, rearranged. The form sits at the top of the expression hierarchy (just below `expr`), is right-associative on the `else` branch, and parses the `cond` at `or-expr` precedence — a nested ternary in the condition position requires parentheses.

```ebnf
ternary-expr  ::=  assign-expr ( "if" or-expr "else" ternary-expr )?
                   -- right-associative on the else branch; the value may chain freely
                   -- e.g.  let label = "positive" if x > 0 else "non-positive"
                   -- e.g.  let grade = "A" if score >= 90 else
                   --                   "B" if score >= 80 else
                   --                   "C"
```

#### While expression

```ebnf
while-expr    ::=  "while" expr block-expr
```

#### For expression

```ebnf
for-expr      ::=  "for" for-pattern "in" expr block-expr
               |   "for" expr block-expr            -- iterator without a binding variable

for-pattern   ::=  identifier                       -- simple binding
               |   tuple-pattern                    -- "(a, b, ...)"   tuple destructure
               |   record-pattern                   -- "{ a, b, ... }" record destructure
```

#### Return

```ebnf
return-expr   ::=  "return" expr
                   -- "return" always carries a payload expression
                   -- a unit-returning function exits early with `return ()`
```

#### Break and continue

`break` and `continue` are only valid inside a `while` or `for` loop body. Both produce the unit value.

```ebnf
break-expr    ::=  "break"
                   -- immediately exits the innermost enclosing loop

continue-expr ::=  "continue"
                   -- skips the remainder of the current iteration and begins the next
```

### Defer

A `defer` statement schedules an expression to execute at the end of the enclosing `do…end` block, regardless of how control exits that block. Multiple defers in the same block execute in LIFO order (last deferred, first to run).

```ebnf
defer-stmt    ::=  "defer" expr
                   -- expr is evaluated when the enclosing block exits
                   -- expr is typically a function call or a do...end block
                   -- defers in the same block run LIFO: last defer statement runs first
```

### Patterns

Patterns appear in `let`-destructuring, `match` arms, and `for` loop binders. Patterns are *refutable* (may not match) or *irrefutable* (always match) — only irrefutable patterns are allowed in `let` and `for`.

**No leading dot in patterns.** The leading `.` of `.tag`, `.{…}`, and `.(…)` belongs to *value literals*; in patterns the same shapes are written bare.

```ebnf
match-expr    ::=  "match" expr "with" arm+ else-arm? "end"

arm           ::=  pattern block-expr
else-arm      ::=  "else" block-expr

pattern       ::=  identifier                              -- binds the value (irrefutable)
               |   literal-expr                            -- exact value: integer, float, bool, char, string
               |   range-pattern                           -- numeric range: 0..=9, 'a'..='z'
               |   tuple-pattern                           -- "(a, b)"          irrefutable when arity matches
               |   record-pattern                          -- "{ x, y }"        irrefutable when fields match
               |   variant-pattern                         -- "tag" or "tag(p)"  refutable
               |   guard-pattern                           -- pattern with boolean guard

range-pattern ::=  literal-expr ( ".." | "..=" ) literal-expr

tuple-pattern ::=  "(" pattern ( "," pattern )* ","? ")"

record-pattern
              ::=  "{" identifier ( field-sep identifier )* field-sep? "}"

variant-pattern
              ::=  identifier                              -- payloadless tag:           miss
               |   identifier "(" pattern ")"              -- tag with payload pattern:  some(x), ok((a, b))

guard-pattern ::=  pattern "if" expr
                   -- e.g.  n if n < 0   in   match n with  n if n < 0 do "negative" ... end
```

**Option and result patterns.** `?(T)` and `!(T, E)` are built-in variant types and follow the same variant-pattern syntax: `some(name)`, `none`, `ok(name)`, `err(name)`.
