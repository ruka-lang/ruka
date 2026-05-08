# Data Structures

This document specifies the concrete data structures used throughout the Ruka compiler. The guiding constraint is **simplicity**: prefer one node type with a kind discriminator over a proliferation of distinct node types. Code that works with the AST should not need to import a zoo of types or write exhaustive type switches over dozens of cases.

All Go types below are in the `internal/` packages noted at the top of each section.

---

## Token (`internal/token`)

```go
type TokenKind uint8

const (
    // Literals
    TokInt        TokenKind = iota // 42, 0xFF, 0b101
    TokFloat                       // 3.14
    TokString                      // "hello ${name}"
    TokMultiline                   // |" ... |"
    TokChar                        // 'a'
    TokBool                        // true | false
    TokIdent                       // any identifier

    // Keywords
    TokLet
    TokLocal
    TokTest
    TokRecord
    TokVariant
    TokBehaviour
    TokIf
    TokElse
    TokWhile
    TokFor
    TokIn
    TokWith
    TokMatch
    TokDo
    TokEnd
    TokReturn
    TokBreak
    TokContinue
    TokDefer
    TokAnd
    TokOr
    TokNot
    TokAs
    TokSelf

    // Mode prefixes (attached to the following identifier token)
    TokStar    // *
    TokAmpersand // &
    TokDollar  // $
    TokAt      // @

    // Punctuation
    TokLParen   // (
    TokRParen   // )
    TokLBrace   // {
    TokRBrace   // }
    TokLBracket // [
    TokRBracket // ]
    TokComma    // ,
    TokColon    // :
    TokSemicolon // ;
    TokDot      // .
    TokDotDot   // ..
    TokDotDotEq // ..=
    TokArrow    // ->
    TokFatArrow // =>
    TokPipe     // |>
    TokEq       // =
    TokEqEq     // ==
    TokBangEq   // !=
    TokLt       // <
    TokLtEq     // <=
    TokGt       // >
    TokGtEq     // >=
    TokPlus     // +
    TokMinus    // -
    TokSlash    // /
    TokPercent  // %
    TokStarStar // **
    TokCaret    // ^
    TokTilde    // ~
    TokLShift   // <<
    TokRShift   // >>
    TokBar      // |
    TokBang     // !
    TokQuestion // ?
    TokNewline  // significant newline (member/statement separator)
    TokEOF
)

type Token struct {
    Kind TokenKind
    Text string // the raw source text of this token
    Pos  Pos
}
```

`Text` is stored as a slice into the original source string (zero-copy where possible).

---

## Source Positions (`internal/diag`)

```go
type Pos struct {
    File   string
    Line   int
    Col    int
    Offset int // byte offset from start of file
}

type Span struct {
    Start Pos
    End   Pos
}
```

Every AST node carries a `Span`. The lexer fills in positions from a running offset counter.

---

## AST (`internal/ast`)

The AST uses four node types: `Decl`, `Expr`, `Pattern`, and `TypeExpr`. Each has a `Kind` discriminator. Fields that are unused for a given kind are zero/nil. This avoids a proliferation of types at the cost of some unused struct fields per node — an acceptable trade for the simplicity it buys.

### File

```go
type File struct {
    Path  string
    Decls []*Decl
}
```

### Declarations

```go
type DeclKind uint8

const (
    DeclBinding  DeclKind = iota // let / local binding
    DeclTest                     // test binding
)

type Decl struct {
    Kind    DeclKind
    Span    Span
    Keyword string    // "let" | "local" | "test"
    Name    string    // bound name
    Mode    Mode      // *, &, $, @ — zero value means no mode
    // For method/member receivers:
    Receiver *Receiver // nil for plain bindings
    // Annotation (optional):
    TypeExpr *TypeExpr
    // Right-hand side:
    Value *Expr
}

// Receiver is the clause in parentheses after a declaration name.
// IsType=true means a type-receiver (member): the value is a compile-time constant
//   attached to the named type and accessed as TypeName.declName.
//   The value may be any type — a pre-initialized instance, a function, a constant.
// IsType=false means a self-receiver (method): the value must be a TyFn and is
//   called on an instance as value.declName(args).
type Receiver struct {
    Span   Span
    IsType bool   // true → member (type receiver); false → method (self receiver)
    Name   string // IsType=true: the type name; IsType=false: always "self"
    Mode   Mode   // IsType=false: mode on self (0, ModeMut, ModeMove)
}
```

### Expressions

```go
type ExprKind uint8

const (
    // Literals
    ExprInt     ExprKind = iota // integer literal
    ExprFloat                   // float literal
    ExprString                  // string literal (may contain interp segments)
    ExprMultiline               // multiline string
    ExprChar                    // char literal
    ExprBool                    // true | false
    ExprUnit                    // ()

    // Composites
    ExprTuple   // (a, b, ...)
    ExprBrace   // { ... } — array, record, or map; resolved by item shape and context
    ExprTypedBrace // TypePrefix { ... }

    // Reference
    ExprIdent   // bare identifier

    // Operations
    ExprUnary   // not / -
    ExprBinary  // all infix operators
    ExprCast    // value as Type
    ExprIndex   // a[i]
    ExprField   // a.b
    ExprCall    // f(args...)

    // Control flow (all expressions in Ruka)
    ExprBlock   // do ... end
    ExprIf      // if cond do ... else ...
    ExprWhile   // while cond do ... end
    ExprFor     // for pat in iter do ... end
    ExprMatch   // match e with arms end
    ExprReturn  // return e
    ExprBreak   // break
    ExprContinue // continue
    ExprDefer   // defer e

    // Type-level
    ExprRecord   // record { fields }
    ExprVariant  // variant { tags }
    ExprBehaviour // behaviour { sigs }
    ExprFn       // (params) -> ret do body

    // Comprehension (inside a brace literal)
    ExprComprehension

    // Sentinel for error recovery
    ExprBad
)

// Mode is the prefix character on a binding or parameter (* & $ @).
type Mode rune // 0 means no mode

const (
    ModeMut    Mode = '*'
    ModeMove   Mode = '&'
    ModeStack  Mode = '$'
    ModeComptime Mode = '@'
)

type Expr struct {
    Kind ExprKind
    Span Span

    // ExprInt | ExprFloat | ExprChar | ExprBool | ExprIdent
    Text string

    // ExprString | ExprMultiline — segments alternate raw text and interpolated exprs
    Segments []StringSegment

    // ExprUnary
    Op      string // "not" | "-"
    Operand *Expr

    // ExprBinary | ExprCast
    Left  *Expr
    Right *Expr

    // ExprField | ExprIndex | ExprCall
    // ExprField: Base.Name
    // ExprIndex: Base[Index]
    // ExprCall:  Base(Args)
    Base  *Expr
    Name  string  // for ExprField
    Index *Expr   // for ExprIndex
    Args  []Arg

    // ExprTuple | ExprBrace | ExprTypedBrace | ExprBlock
    Elems []*Expr

    // ExprBrace record items — parallel to Elems (one name per elem; empty string = shorthand)
    FieldNames []string

    // ExprBrace map items — Keys parallel to Elems (values)
    Keys []*Expr

    // ExprTypedBrace — the type prefix
    TypePrefix *TypeExpr

    // ExprIf
    IfBranches []IfBranch

    // ExprWhile
    WhileCond *WhileCond

    // ExprFor
    ForOuter *Expr    // nil unless "for outer with pat in inner" sugar
    ForPat   *Pattern // nil for "for expr do" (no binding)
    ForIter  *Expr
    Body     *Expr    // reused for ExprWhile, ExprFor, ExprBlock body

    // ExprMatch
    Subject *Expr
    Arms    []MatchArm

    // ExprFn
    Params     []Param
    ReturnType *TypeExpr
    // Body is in Body field above

    // ExprRecord | ExprVariant | ExprBehaviour
    TypeBody TypeBody

    // ExprComprehension
    CompExpr  *Expr    // value expression (array) or key (map)
    CompValue *Expr    // value expression for map; nil for array
    CompPat   *Pattern
    CompIter  *Expr
    CompGuard *Expr    // nil if no "if" guard

    // ExprReturn | ExprDefer | ExprCast
    // Return/defer value, or cast target type, lives in Right

    // ExprCast type target
    CastType *TypeExpr

    // Block statements (ExprBlock)
    Stmts []*Stmt
}

type StringSegment struct {
    IsExpr bool
    Text   string // IsExpr=false: raw string content
    Expr   *Expr  // IsExpr=true: interpolated expression
}

type Arg struct {
    Label string // "" for positional; "~label" sets this
    Value *Expr
}

type Param struct {
    Mode  Mode
    Named bool   // ~ prefix
    Name  string
    Type  *TypeExpr // nil → inferred
}

type IfBranch struct {
    Cond    *CondPattern // nil for final else
    Body    *Expr
}

// CondPattern covers both "expr" and "pattern = expr" condition forms.
type CondPattern struct {
    Pat  *Pattern // nil → plain boolean condition
    Expr *Expr
}

type WhileCond = CondPattern

type MatchArm struct {
    Pat  *Pattern // nil for the "else" arm
    Body *Expr
}

type Stmt struct {
    Span Span
    Decl *Decl // non-nil for declaration statements
    Expr *Expr // non-nil for expression statements
}
```

### Patterns

A single `Pattern` type covers all pattern forms. This is the key simplification: every place a pattern appears (match arms, `let` destructuring, `for` binders, `if`/`while` conditional bindings) uses exactly this type.

```go
type PatternKind uint8

const (
    PatIdent   PatternKind = iota // bare identifier — binds the value (irrefutable)
    PatLiteral                    // integer, float, bool, char, string literal (refutable)
    PatRange                      // lo..hi or lo..=hi (refutable)
    PatTuple                      // (a, b, ...) — irrefutable when arity matches
    PatRecord                     // { a, b } — irrefutable when fields match
    PatVariant                    // tag or tag(inner) — refutable
    PatGuard                      // inner pattern + boolean guard (refutable)
    PatWild                       // _ (future extension; irrefutable)
)

type Pattern struct {
    Kind    PatternKind
    Span    Span

    // PatIdent
    Name    string
    Mode    Mode // mode prefix on the bound name

    // PatLiteral
    Literal *Expr // reuses ExprInt/ExprFloat/ExprBool/ExprChar/ExprString

    // PatRange
    Low       *Expr
    High      *Expr
    Inclusive bool  // true → ..=, false → ..

    // PatTuple: Sub[0], Sub[1], ...
    // PatVariant: Tag + optional Sub[0] (the payload pattern)
    Sub  []*Pattern
    Tag  string // PatVariant: the tag name

    // PatRecord: Fields[i] is the field name; each bound as an identifier
    Fields []string

    // PatGuard
    Guard *Expr // the boolean condition; the guarded pattern is Sub[0]
}
```

### Type Expressions

```go
type TypeExprKind uint8

const (
    TypeUnit      TypeExprKind = iota // ()
    TypeNamed                          // int, string, user-defined name
    TypeArray                          // [T]
    TypeTuple                          // (T, U, ...)
    TypeRange                          // [T..]
    TypeMap                            // [K => V]
    TypeOption                         // ?(T)
    TypeResult                         // !(T, E)
    TypeFn                             // (T, U) -> R
    TypeRecord                         // record { ... } inline
    TypeVariant                        // variant { ... } inline
    TypeBehaviour                      // behaviour { ... } inline
)

type TypeExpr struct {
    Kind  TypeExprKind
    Span  Span

    Name  string     // TypeNamed
    Elems []*TypeExpr // TypeArray → [0]; TypeTuple → all; TypeFn → params + [last]=return
    Key   *TypeExpr  // TypeMap key; TypeOption value; TypeResult value
    Val   *TypeExpr  // TypeMap value; TypeResult error

    // TypeRecord | TypeVariant | TypeBehaviour
    TypeBody TypeBody
}

// TypeBody is shared by record/variant/behaviour both in TypeExpr and in ExprRecord/Variant/Behaviour.
type TypeBody struct {
    Fields   []FieldDecl    // record fields; behaviour method sigs
    Tags     []TagDecl      // variant tags
    Methods  []MethodSig    // behaviour method signatures
}

type FieldDecl struct {
    Span    Span
    Private bool   // local prefix
    Name    string
    Type    *TypeExpr
}

type TagDecl struct {
    Span    Span
    Private bool
    Name    string
    Type    *TypeExpr // nil → unit payload
}

type MethodSig struct {
    Span     Span
    Private  bool
    Name     string
    Receiver Mode      // mode on "self"
    FnType   *TypeExpr // TypeFn
}
```

---

## Type Representation (`internal/types`)

These are the *resolved* types produced by the type checker, distinct from the syntactic `TypeExpr` nodes in the AST.

### All types are records at compile time

During compilation every type — primitive, built-in generic, user-defined, or module — is represented as a record. This is a compiler-internal choice; it has no effect on runtime representation. An `i32` is still a machine integer at runtime. The uniform compile-time representation means method dispatch, behaviour satisfaction, and type extension have exactly one code path regardless of the type being worked on. There are no special cases for `i32` vs a user-defined `point` in the type checker or monomorphiser.

The `TypeKind` discriminator is therefore minimal. It distinguishes only the four genuinely structural cases: record, variant, behaviour, and function. All primitives and built-in generics are `TyRecord`; the `Builtin` flag and `Name` field are what tells codegen to lower `i32 + i32` to a native addition instruction rather than a method call.

```go
type TypeKind uint8

const (
    TyRecord    TypeKind = iota // all types, including primitives and built-in generics
    TyVariant                   // tagged union
    TyBehaviour                 // interface / constraint
    TyFn                        // function type
    TyType                      // the type of types (compile-time only)
    TyModule                    // a file-as-record (compile-time constant)
    TyUnknown                   // placeholder during inference; must not survive type-checking
)

type Type struct {
    Kind    TypeKind
    Name    string     // canonical name: "i32", "bool", "string", "[T]", user-defined name, etc.
    Builtin bool       // true for compiler-known types; codegen lowers them to native operations
    Params  []*Type    // type parameters: element type for arrays/ranges, (key,val) for maps,
                       //   (val,err) for results, type params for user generics, etc.
    Decl    *TypeDecl  // fields, tags, and methods; shared across all instances of the same type

    // TyFn only
    ParamNames  []string // label for each parameter ("" = positional)
    ParamModes  []Mode   // mode prefix for each parameter
}
```

### Built-in record types

The type environment is pre-populated with the following built-in records before any user code is checked. Each is `Builtin: true`; codegen maps them to native representations.

| Name | Params | Notes |
|---|---|---|
| `()` | — | unit; the only value-less record |
| `bool` | — | |
| `int` | — | platform word-size signed |
| `uint` | — | platform word-size unsigned |
| `i8` `i16` `i32` `i64` `i128` | — | fixed-width signed |
| `u8` `u16` `u32` `u64` `u128` | — | fixed-width unsigned |
| `float` | — | platform word-size float |
| `f32` `f64` | — | fixed-width float |
| `string` | — | UTF-8 heap string |
| `[T]` | `[elem]` | homogeneous array |
| `(T, U, …)` | `[elems…]` | heterogeneous tuple |
| `[T..]` | `[elem]` | range / iterator |
| `[K => V]` | `[key, val]` | map |
| `?(T)` | `[inner]` | option (also a variant: `some`/`none`) |
| `!(T, E)` | `[val, err]` | result (also a variant: `ok`/`err`) |
| `type` | — | the type of types; compile-time only |

Because primitives are records, any file can attach methods to them:

```ruka
// adds a method to i32 in the file that declares this
let is_positive (self) = () -> bool do self > 0
```

And any type can be extended to satisfy a behaviour by defining the required methods — there is no `implements` declaration.

### TypeDecl

The declaration holds the structural content of a type: its fields (for records), its tags (for variants), methods (self-receiver), and members (type-receiver). Members and methods are kept in separate slices because they are fundamentally different things: a method is always a function called on a value, while a member is any compile-time value attached to the type — a constant, a pre-initialized instance, a factory function, or anything else.

```go
type TypeDecl struct {
    Name    string
    Fields  []ResolvedField  // record fields; empty for primitives and built-in generics
    Tags    []ResolvedTag    // variant tags; empty unless TyVariant
    Methods []ResolvedMethod // self-receiver declarations: instance methods
    Members []ResolvedMember // type-receiver declarations: static values of any kind
}

type ResolvedField struct {
    Name    string
    Private bool
    Type    *Type
}

type ResolvedTag struct {
    Name    string
    Private bool
    Payload *Type // nil → unit payload
}

// ResolvedMethod is a self-receiver declaration. Its type is always TyFn.
// Called as value.name(args).
type ResolvedMethod struct {
    Name     string
    Private  bool
    Receiver Mode  // mode on self: 0=immutable, ModeMut=mutating, ModeMove=consuming
    Type     *Type // TyFn
}

// ResolvedMember is a type-receiver declaration. Its type may be anything —
// a TyFn for factory functions, a record type for pre-initialized instances
// (e.g. Vector.zero), a primitive for constants, etc.
// Accessed as TypeName.name or TypeName.name(args) when the value is a function.
type ResolvedMember struct {
    Name    string
    Private bool
    Type    *Type     // any type
    Value   *ConstVal // non-nil when the value is a compile-time constant (all members are)
}
```

Because file scope is compile-time, every member is a compile-time constant — its `Value` is always known after the monomorphiser runs. The codegen emits member accesses as direct constant references rather than loads.

Examples of the distinction:

```ruka
let counter = record { count: int }

let zero  (counter) = { count = 0 }          // member: a pre-initialized counter instance
let new   (counter) = (start: int) do { count = start }  // member: a factory function
let bump  (self)    = () do { count = self.count + 1 }   // method: called on an instance
let inc  (*self)    = () do self.count = self.count + 1  // method: mutating
```

`counter.zero` → `ResolvedMember`, `Type = TyRecord(counter)`, `Value = {count=0}`
`counter.new`  → `ResolvedMember`, `Type = TyFn`
`counter.bump` → `ResolvedMethod`, `Receiver = 0`
`counter.inc`  → `ResolvedMethod`, `Receiver = ModeMut`

### Interning

`*Type` values are interned: the type checker calls `env.Intern(t)` which returns the canonical pointer for that structurally equal type. After interning, structural equality is pointer equality — no recursive comparison needed anywhere in the compiler.

Interning is keyed by `(Kind, Name, Params…)`. Two `[i32]` array types produced by different parts of the checker resolve to the same pointer.

---

## Scope (`internal/scope`)

```go
type Scope struct {
    Parent   *Scope
    Bindings map[string]*Binding
}

type BindingKind uint8

const (
    BindLet    BindingKind = iota // let binding
    BindLocal                     // local binding
    BindParam                     // function parameter
    BindTest                      // test binding
)

type Binding struct {
    Kind    BindingKind
    Name    string
    Mode    Mode
    DeclPos Span

    // Set by the type checker
    Type    *types.Type

    // Capture tracking
    Moved   bool // true after a & capture or & parameter call
}
```

The scope checker builds the `Scope` tree and records, for each `*ast.Expr` node of kind `ExprIdent`, which `*Binding` it resolves to. This is stored in a side map `map[*ast.Expr]*Binding` keyed by the AST pointer. The type checker reads this map.

---

## IR (`internal/ir`)

A flat three-address code. Functions contain basic blocks; blocks contain instructions. Every value is an `ID` (a monotonically increasing integer). No pointers between instructions — references are by `ID`.

```go
type ID uint32

const NoID ID = 0

type Program struct {
    Funcs []*Func
}

type Func struct {
    Name   string
    Params []Param // ID + Type for each parameter
    Ret    *types.Type
    Blocks []*Block
    Entry  BlockID
}

type BlockID uint32

type Block struct {
    ID    BlockID
    Instrs []Instr
    // last instruction must be a terminator (Jump, Branch, Return, Unreachable)
}

type InstrKind uint8

const (
    // Values
    IConst     InstrKind = iota // dst = constant literal
    IMove                       // dst = src
    IUnary                      // dst = op src
    IBinary                     // dst = lhs op rhs
    ILoad                       // dst = *ptr
    IStore                      // *ptr = src
    IAlloc                      // dst = alloc(type)   heap allocation
    IAllocStack                 // dst = stack(type)   stack allocation
    IFieldPtr                   // dst = &base.field   field address
    IIndexPtr                   // dst = &base[index]  element address
    ICall                       // dst = callee(args...)
    IBuiltin                    // dst = builtin(args...)
    ICast                       // dst = src as type

    // Terminators
    IJump        // unconditional branch to block
    IBranch      // conditional branch: if cond then t else f
    IReturn      // return value
    IUnreachable // should never execute (exhaustiveness-guaranteed by checker)
)

type Instr struct {
    Kind InstrKind
    Dst  ID              // result value; NoID for void instructions (IStore, IJump, etc.)
    Type *types.Type     // type of Dst

    // IConst
    Const ConstVal

    // IUnary
    UnOp string

    // IBinary
    BinOp string
    Lhs   ID
    Rhs   ID

    // ILoad | IStore | IFieldPtr | IIndexPtr | IAlloc | IAllocStack | ICast
    Src    ID
    Field  string   // IFieldPtr
    Index  ID       // IIndexPtr (NoID if constant)

    // ICall | IBuiltin
    Callee  ID       // ICall: function value; IBuiltin: ignored, use Name
    Name    string   // IBuiltin name
    Args    []ID

    // Terminators
    TargetTrue  BlockID
    TargetFalse BlockID
    Cond        ID

    // IReturn
    RetVal ID
}

type ConstVal struct {
    Int    int64
    Float  float64
    Str    string
    Bool   bool
    IsNil  bool // unit value
}
```

---

## Diagnostics (`internal/diag`)

```go
type Severity uint8

const (
    Error   Severity = iota
    Warning
)

type Diagnostic struct {
    Severity Severity
    Span     Span
    Message  string
    Fatal    bool // suppress downstream errors caused by this root-cause diagnostic
}

type Diagnostics []Diagnostic

func (d Diagnostics) HasErrors() bool { ... }
```

---

## Incremental Cache (`internal/bouquet`)

Each compiled file produces a cache entry. The key is the SHA-256 of the source bytes XOR'd with the keys of its direct imports. The value stores the resolved type info and IR, serialised with `encoding/gob` or a hand-rolled binary format.

```go
type CacheKey [32]byte

type CacheEntry struct {
    Key      CacheKey
    File     string
    TypeInfo []byte // serialised *types.TypeDecl slice
    IR       []byte // serialised *ir.Func slice
}
```

The cache is stored in `<bouquet-root>/.ruka-cache/`. On a build, the driver checks each file's key before running the pipeline; a hit skips lexing through codegen and deserialises the stored IR directly.
