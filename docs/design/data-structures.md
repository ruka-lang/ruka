# Ruka Toolchain — Core Data Structures

This document specifies every major data structure used across the pipeline. Zig pseudocode is used throughout; field names and types reflect the intended implementation.

---

## 1. SourceMap

Owns the raw bytes of every source file and provides O(1) byte-offset → line/col lookup via a pre-built newline index table.

```zig
pub const SourceMap = struct {
    files: std.ArrayList(File),

    pub const FileId = enum(u32) { _ };

    pub const File = struct {
        path: []const u8,         // interned absolute path
        source: [:0]const u8,     // null-terminated source bytes (mmapped or read)
        line_offsets: []u32,      // line_offsets[i] = byte offset of line i+1's first char
    };

    // Returns FileId; mmaps or reads the file into gpa memory.
    pub fn load(self: *SourceMap, gpa: Allocator, path: []const u8) !FileId;

    // Convert a byte offset into a 0-based (line, col) pair.
    pub fn location(self: SourceMap, fid: FileId, offset: u32) Location;

    pub const Location = struct { line: u32, col: u32 };
};
```

`line_offsets` is built in a single O(n) pass over the source on load. Binary search over this array yields O(log n) line lookup, which is fast enough for diagnostics (not a hot path).

---

## 2. InternPool

A single global string table. Every identifier, keyword string, type name, and string literal (after escape processing) is stored here as a deduplicated byte slice. Code throughout the pipeline passes `InternPool.Index` values instead of `[]const u8` slices, enabling O(1) equality checks.

```zig
pub const InternPool = struct {
    map: std.StringHashMap(Index),
    bytes: std.ArrayList(u8),       // packed, length-prefixed strings
    lengths: std.ArrayList(u32),    // lengths[i] = byte length of string i

    pub const Index = enum(u32) {
        // Pre-interned keyword indices assigned at comptime:
        kw_let, kw_test,
        kw_if, kw_else, kw_match, kw_with,
        kw_while, kw_for, kw_in, kw_do, kw_end,
        kw_return, kw_break, kw_continue, kw_defer,
        kw_and, kw_or, kw_not, kw_true, kw_false,
        kw_record, kw_variant, kw_behaviour, kw_self,
        // everything above is reserved; user strings start here
        _,
    };

    pub fn intern(self: *InternPool, gpa: Allocator, s: []const u8) !Index;
    pub fn get(self: InternPool, idx: Index) []const u8;
    pub fn eql(idx_a: Index, idx_b: Index) bool; // just integer comparison
};
```

Keywords are pre-interned at startup so the tokenizer can classify an identifier as a keyword in O(1) with a single map lookup.

---

## 3. Token

A token is a tag (8-bit) plus the byte offset of its first character in the source. Length is not stored; it is recovered by re-scanning or by looking at the next token's start.

```zig
pub const Token = struct {
    tag: Tag,
    start: u32,

    pub const Tag = enum(u8) {
        // keywords
        kw_let, kw_test,
        kw_if, kw_else, kw_match, kw_with,
        kw_while, kw_for, kw_in, kw_do, kw_end,
        kw_return, kw_break, kw_continue, kw_defer,
        kw_and, kw_or, kw_not, kw_true, kw_false,
        kw_record, kw_variant, kw_behaviour, kw_self,
        // mode prefixes (appear directly before an identifier)
        mode_mut,      // *
        mode_move,     // &
        mode_stack,    // $
        mode_comptime, // @
        // named-param prefix
        tilde,         // ~
        // literals
        lit_int, lit_float, lit_string, lit_multiline_string, lit_char,
        // identifiers
        identifier,
        // arithmetic operators
        plus, minus, star, slash, percent,
        // comparison operators
        eq_eq, bang_eq, lt, lt_eq, gt, gt_eq,
        // assignment
        eq,
        // range operators
        dot_dot, dot_dot_eq,
        // pipeline
        pipe_gt,            // |>
        // delimiters
        lparen, rparen,
        lbracket, rbracket,
        lbrace, rbrace,
        // punctuation
        dot, comma, colon, arrow,              // ->
        // collection/record literal prefix
        dot_lbrace,                             // .{
        // option/result postfix
        dot_question_lparen, dot_bang_lparen,   // .?() .!()
        // special
        eof,
        invalid,
    };
};
```

The tokenizer produces tokens into a `std.MultiArrayList(Token)` so tags and starts are stored in separate contiguous arrays for better cache performance when the parser iterates.

---

## 4. Abstract Syntax Tree (Ast)

The AST uses a `MultiArrayList`-based flat storage pattern: every node is stored in parallel arrays rather than individually heap-allocated. This keeps node data dense and pointer-free.

### 4a. Node

```zig
pub const Node = struct {
    tag: Tag,
    main_token: u32,   // index into the token array; the "representative" token
    data: Data,

    pub const Data = struct {
        lhs: u32,   // meaning depends on tag (child node index, token index, extra_data index, …)
        rhs: u32,
    };

    pub const Tag = enum(u8) {
        // ── file root ──────────────────────────────────────────
        file,                  // lhs=first decl index, rhs=decl count  (in extra_data)

        // ── declarations ──────────────────────────────────────
        binding_let,           // lhs=binding_lhs node, rhs=expr node
        binding_test,          // lhs=identifier token, rhs=function-expr node

        // ── binding left-hand sides ────────────────────────────
        // Each LHS carries an optional mode prefix token and the target identifier
        // or pattern. Privacy is derived from the first letter of the identifier
        // (lowercase = public, uppercase = private) — no flag is stored on the node.
        binding_lhs_simple,    // main_token=identifier token; lhs=mode prefix token (0 if none)
        binding_lhs_fn,        // lhs=binding_lhs_simple, rhs=receiver node
        binding_lhs_destruct,  // lhs=first ident token, rhs=ident count  (in extra_data)
        receiver_static,       // main_token=type name token
        receiver_method,       // main_token=self token; lhs=mode prefix token (0 if none)

        // ── expressions ───────────────────────────────────────
        binary,                // lhs=left node, rhs=right node; main_token=operator token
        unary_neg,             // lhs=operand node
        unary_not,
        assign,                // lhs=place node, rhs=value node
        pipeline,              // lhs=value node, rhs=call node
        ternary,               // extra_data: [cond, then, else] node indices
        call,                  // lhs=callee node, rhs=arg_list index in extra_data
        call_named_arg,        // lhs=name token, rhs=value node
        trailing_arg,          // lhs=name token, rhs=function_expr node
        field_access,          // lhs=receiver node, main_token=field name token
        index,                 // lhs=receiver node, rhs=index node
        unwrap_option,         // lhs=operand node  (.?())
        unwrap_result,         // lhs=operand node  (.!())
        method_call,           // lhs=receiver node; extra_data: [method token, arg_list index]

        // ── literals ──────────────────────────────────────────
        lit_int,               // main_token=lit_int token
        lit_float,             // main_token=lit_float token
        lit_string,            // main_token=lit_string token; lhs=InternPool index of processed value
        lit_multiline_string,  // lhs=InternPool index of processed value
        lit_char,              // main_token=lit_char token; lhs=codepoint value
        lit_true,
        lit_false,

        // ── collections ───────────────────────────────────────
        collection_lit,        // lhs=first expr index in extra_data, rhs=expr count
        record_lit,            // extra_data: [type_name_token (0 if omitted), field_init count, ...field_init indices]
        field_init_explicit,   // lhs=name token, rhs=value node
        field_init_shorthand,  // main_token=name token (value is same identifier)
        variant_ctor,          // lhs=tag token, rhs=payload node (0 if none)

        // ── control flow ──────────────────────────────────────
        block,                 // lhs=first stmt index in extra_data, rhs=stmt count
        if_expr,               // extra_data: [cond, then_block, else_node (0 if none)]
        while_expr,            // lhs=cond node, rhs=body block node
        for_expr,              // extra_data: [pattern node, iter node, body block node]
        match_expr,            // extra_data: [scrutinee node, arm count, ...arm nodes]
        match_arm,             // lhs=pattern node, rhs=body node
        return_expr,           // lhs=value node (always present — `return` requires a payload)
        break_expr,
        continue_expr,
        defer_stmt,            // lhs=expr node

        // ── patterns ──────────────────────────────────────────
        pattern_variant_unit,  // main_token=tag name token
        pattern_variant_payload, // lhs=tag name token, rhs=payload pattern node
        pattern_payload_bind,  // main_token=identifier token
        pattern_payload_destruct, // lhs=first ident token, rhs=ident count (extra_data)
        pattern_literal,       // lhs=literal node
        pattern_guard,         // lhs=expr node

        // ── function expressions ───────────────────────────────
        function_expr,         // extra_data: [param count, ...param nodes, return_type node (0 if none), body node]
        param,                 // lhs=mode prefix token (0 if none); main_token=identifier; rhs=type node (0 if none)
        param_named,           // same layout; ~ marker on main_token

        // ── type expressions ───────────────────────────────────
        type_unit,
        type_named,            // main_token=identifier token
        type_primitive,        // main_token=keyword token (kw_int, kw_u8, etc.)
        type_array,            // lhs=element type node
        type_tuple,            // lhs=first type index in extra_data, rhs=count
        type_option,           // lhs=inner type node
        type_result,           // lhs=ok type node, rhs=err type node
        type_function,         // extra_data: [param count, ...param type nodes, return type node]
        type_record,           // extra_data: [field count, ...field nodes]
        type_record_field,     // lhs=name token, rhs=type node  (privacy from name case)
        type_variant,          // extra_data: [tag count, ...tag nodes]
        type_variant_tag,      // lhs=name token, rhs=type node (0 if unit tag)
        type_behaviour,        // extra_data: [method_sig count, ...method_sig nodes]
        type_method_sig,       // extra_data: [name token, receiver mode token, param count, ...param types, return type]
    };
};
```

### 4b. Ast Container

```zig
pub const Ast = struct {
    source_id: SourceMap.FileId,
    tokens: std.MultiArrayList(Token).Slice,   // tags + starts, separate arrays
    nodes: std.MultiArrayList(Node).Slice,     // tags + main_tokens + data, separate arrays
    extra_data: []const u32,                   // overflow index data referenced by nodes
    string_bytes: []const u8,                  // processed string/char literal content
    errors: []const ParseError,

    pub const ParseError = struct {
        token: u32,
        message: []const u8,  // static string; no allocation
    };
};
```

`extra_data` is a flat array of `u32` indices. A node whose `data` cannot fit in two fields stores a base index into `extra_data` plus a count; the caller slices `extra_data[base..][0..count]`.

---

## 5. High-Level IR (HIR)

The HIR is the output of Sema. It is a fully typed, name-resolved, monomorphized representation. Unlike the AST it has no source ambiguity — every identifier is resolved to a definition, every expression has an assigned type.

```zig
pub const Hir = struct {
    // All definitions in the program, keyed by DefId.
    defs: std.MultiArrayList(Def).Slice,
    // All HIR instructions, keyed by InstId.
    insts: std.MultiArrayList(Inst).Slice,
    // Extra index data for instructions with variable-length operands.
    extra: []const u32,
    // String content for string literals (after escape processing).
    string_bytes: []const u8,
    // Type pool reference.
    types: *TypePool,
    // Intern pool reference.
    intern: *InternPool,

    pub const DefId  = enum(u32) { _ };
    pub const InstId = enum(u32) { _ };
    pub const BlockId = enum(u32) { _ };

    pub const Def = struct {
        tag: Tag,
        name: InternPool.Index,
        type_id: TypePool.Id,
        data: Data,

        pub const Tag = enum {
            function, global_let, type_def, behaviour_def,
        };
        pub const Data = union {
            function: struct {
                params: []const Param,
                body: BlockId,
                is_test: bool,
            },
            global: InstId,      // initializer instruction
            type_def: TypePool.Id,
        };
    };

    pub const Param = struct {
        name: InternPool.Index,
        type_id: TypePool.Id,
        mode: Mode,
        is_named: bool,         // ~ parameter

        pub const Mode = enum { default, mut, move, stack, comptime_ };
    };

    pub const Inst = struct {
        tag: Tag,
        type_id: TypePool.Id,
        data: Data,

        pub const Tag = enum {
            // values
            int_lit, float_lit, bool_lit, string_lit, unit_lit, char_lit,
            // bindings
            local_var, local_let,
            // expressions
            binary, unary, assign,
            // control
            block, if_, while_, for_, match_, return_, break_, continue_, defer_,
            // calls
            call, method_call, builtin_call,
            // field/index
            field_access, index,
            // type constructors
            collection, record_init, variant_ctor,
            // unwrapping
            unwrap_option, unwrap_result,
            // pipeline
            pipeline,
        };
        pub const Data = union {
            int_lit: i128,
            float_lit: f64,
            bool_lit: bool,
            string_lit: struct { offset: u32, len: u32 },  // into string_bytes
            char_lit: u21,
            binary: struct { op: BinaryOp, lhs: InstId, rhs: InstId },
            unary: struct { op: UnaryOp, operand: InstId },
            assign: struct { place: InstId, value: InstId },
            block: struct { base: u32, len: u32 },          // into extra (InstId[])
            if_: struct { cond: InstId, then_: BlockId, else_: ?BlockId },
            while_: struct { cond: InstId, body: BlockId },
            call: struct { callee: InstId, args_base: u32, args_len: u32 },
            field_access: struct { receiver: InstId, field: InternPool.Index },
            // … etc.
        };
    };

    pub const BinaryOp = enum {
        add, sub, mul, div, mod,
        eq, ne, lt, le, gt, ge,
        and_, or_,
        range_ex, range_in,
    };

    pub const UnaryOp = enum { neg, not_ };
};
```

---

## 6. Type System

### TypePool

A canonical, deduplicated store for `Type` values. Two types that are structurally identical share the same `TypePool.Id`.

```zig
pub const TypePool = struct {
    map: std.HashMap(Type, Id, TypeContext, 80),
    types: std.ArrayList(Type),

    pub const Id = enum(u32) {
        // Pre-assigned primitive IDs (0–31 reserved):
        unit = 0,
        bool_ = 1,
        int = 2, uint = 3,
        i8 = 4, i16 = 5, i32 = 6, i64 = 7, i128 = 8,
        u8 = 9, u16 = 10, u32 = 11, u64 = 12, u128 = 13,
        float = 14, f32 = 15, f64 = 16,
        string = 17,
        type_ = 18,       // the type of types
        _,
    };

    pub fn intern(self: *TypePool, gpa: Allocator, t: Type) !Id;
    pub fn get(self: TypePool, id: Id) Type;
};
```

### Type

```zig
pub const Type = union(enum) {
    // primitives — represented as pre-assigned TypePool.Id values, never stored here
    // constructed types:
    array: TypePool.Id,
    tuple: []const TypePool.Id,           // owned by TypePool
    option: TypePool.Id,
    result: struct { ok: TypePool.Id, err: TypePool.Id },
    function: struct {
        params: []const ParamType,
        ret: TypePool.Id,
    },
    record: struct {
        fields: []const Field,
        is_file_record: bool,
    },
    variant: struct { tags: []const VariantTag },
    behaviour: struct { methods: []const MethodSig },
    // named type (user-defined): resolved to a TypePool.Id after Sema
    named: InternPool.Index,

    pub const ParamType = struct {
        name: ?InternPool.Index,  // set for named (~) params
        type_id: TypePool.Id,
        mode: Hir.Param.Mode,
    };
    pub const Field = struct {
        name: InternPool.Index,
        type_id: TypePool.Id,
        is_private: bool,
    };
    pub const VariantTag = struct {
        name: InternPool.Index,
        payload: ?TypePool.Id,
    };
    pub const MethodSig = struct {
        name: InternPool.Index,
        receiver_mode: Hir.Param.Mode,
        fn_type: TypePool.Id,
    };
};
```

---

## 7. Machine IR (MIR)

The MIR is a flat, function-scoped list of instructions over unlimited virtual registers. It is close enough to real machine instructions that the encoder can translate each MIR instruction to 0–4 native instructions without lookahead.

```zig
pub const Mir = struct {
    // One MIR per function.
    functions: []Function,
    // Intern pool and type pool references carried for symbol emission.
    intern: *InternPool,

    pub const Function = struct {
        name: InternPool.Index,
        params: []const VReg,          // one VReg per parameter (in calling-convention order)
        insts: []Inst,
        blocks: []Block,               // instruction ranges within insts
        stack_slots: []StackSlot,      // spill/alloca slots
        vreg_types: []MirType,         // parallel to vreg count; tracks int/float/ptr width
        vreg_count: u32,

        pub const Block = struct {
            label: u32,           // unique label id within function
            inst_start: u32,
            inst_end: u32,
        };
        pub const StackSlot = struct {
            size: u32,
            align_: u32,
        };
    };

    pub const VReg = enum(u32) { _ };

    pub const MirType = enum(u8) {
        i8, i16, i32, i64, i128,
        u8, u16, u32, u64, u128,
        f32, f64,
        ptr,  // pointer-sized integer
    };

    pub const Inst = struct {
        tag: Tag,
        ops: [4]Operand,

        pub const Tag = enum(u8) {
            // data movement
            copy,           // dst = src
            load_imm_i,     // dst = immediate (integer)
            load_imm_f,     // dst = immediate (float)
            load_addr,      // dst = address of symbol or stack slot
            load,           // dst = *src  (load from memory)
            store,          // *dst = src  (store to memory)

            // arithmetic (integer)
            add_i, sub_i, mul_i, div_s, div_u, mod_s, mod_u, neg_i,
            // arithmetic (float)
            add_f, sub_f, mul_f, div_f, neg_f,
            // bitwise
            and_i, or_i, xor_i, shl, shr_l, shr_a,

            // comparison → bool in dst
            cmp_eq, cmp_ne,
            cmp_lt_s, cmp_le_s, cmp_gt_s, cmp_ge_s,  // signed
            cmp_lt_u, cmp_le_u, cmp_gt_u, cmp_ge_u,  // unsigned
            cmp_lt_f, cmp_le_f, cmp_gt_f, cmp_ge_f,  // float

            // type conversions
            int_to_float, float_to_int, trunc, extend_s, extend_u,

            // control flow
            jmp,            // unconditional jump to block label
            jmp_if,         // conditional jump: ops[0]=cond vreg, ops[1]=true label, ops[2]=false label
            ret,            // ops[0]=return vreg (absent for void)

            // function calls (ABI handled by caller/callee save convention)
            call,           // ops[0]=dst, ops[1]=func symbol, ops[2..]=args
            call_indirect,  // ops[0]=dst, ops[1]=func ptr vreg, ops[2..]=args

            // stack frame
            alloca,         // ops[0]=dst ptr vreg, ops[1]=stack slot index
        };

        pub const Operand = union(enum) {
            none,
            vreg: VReg,
            imm_i: i64,
            imm_u: u64,
            imm_f: f64,
            label: u32,           // block label
            slot: u32,            // stack slot index
            symbol: InternPool.Index,  // global/function symbol
        };
    };
};
```

---

## 8. Register Allocator Output

After linear-scan register allocation each `VReg` is mapped to either a physical register or a stack slot. The encoder reads this map to emit real instructions.

```zig
pub const Allocation = struct {
    vreg_map: []Location,   // indexed by VReg integer value

    pub const Location = union(enum) {
        reg: PhysReg,
        spill: u32,    // stack slot index
    };

    pub const PhysReg = enum(u8) {
        // x86-64
        x86_rax, x86_rcx, x86_rdx, x86_rbx,
        x86_rsi, x86_rdi, x86_r8,  x86_r9,
        x86_r10, x86_r11, x86_r12, x86_r13, x86_r14, x86_r15,
        x86_xmm0, x86_xmm1, x86_xmm2, x86_xmm3,
        x86_xmm4, x86_xmm5, x86_xmm6, x86_xmm7,
        // AArch64
        aa64_x0,  aa64_x1,  aa64_x2,  aa64_x3,
        aa64_x4,  aa64_x5,  aa64_x6,  aa64_x7,
        aa64_x8,  aa64_x9,  aa64_x10, aa64_x11,
        aa64_x12, aa64_x13, aa64_x14, aa64_x15,
        aa64_x16, aa64_x17,
        aa64_v0,  aa64_v1,  aa64_v2,  aa64_v3,
        aa64_v4,  aa64_v5,  aa64_v6,  aa64_v7,
    };
};
```

---

## 9. Interpreter Value

The tree-walk interpreter represents runtime values as a tagged union. Values that are larger than a pointer are heap-allocated via the GC allocator.

```zig
pub const Value = union(enum) {
    unit,
    int: i64,
    uint: u64,
    float: f64,
    bool_: bool,
    char_: u21,
    string: []const u8,       // interned or GC-managed slice
    array: *Array,
    tuple: *Tuple,
    option: ?*Value,
    result: Result,
    record: *Record,
    variant: Variant,
    function: *Closure,
    type_val: TypePool.Id,
    builtin: *const BuiltinFn,

    pub const Array  = struct { items: []Value, elem_type: TypePool.Id };
    pub const Tuple  = struct { items: []Value };
    pub const Record = struct { fields: []Field };
    pub const Field  = struct { name: InternPool.Index, value: Value };
    pub const Variant = struct { tag: InternPool.Index, payload: ?*Value };
    pub const Result = union(enum) { ok: *Value, err: *Value };

    pub const Closure = struct {
        def: Hir.DefId,
        env: []EnvEntry,   // captured variables

        pub const EnvEntry = struct {
            name: InternPool.Index,
            value: Value,
        };
    };

    pub const BuiltinFn = fn (args: []Value, out: *Value) anyerror!void;
};
```

---

## 10. Scope (Sema)

Sema uses a flat array of scopes with a parent-index chain to avoid repeated heap allocations when pushing/popping scopes. Each scope maps `InternPool.Index` → `ScopeEntry`.

```zig
pub const Scope = struct {
    parent: ?u32,           // index into ScopeStack.scopes; null for root
    bindings: std.AutoHashMap(InternPool.Index, Entry),

    pub const Entry = struct {
        def_id: Hir.DefId,
        type_id: TypePool.Id,
        is_mutable: bool,
        is_comptime: bool,
    };
};

pub const ScopeStack = struct {
    scopes: std.ArrayList(Scope),
    current: u32,

    pub fn push(self: *ScopeStack, gpa: Allocator) !u32;   // returns new scope index
    pub fn pop(self: *ScopeStack) void;                     // restores current to parent
    pub fn resolve(self: *ScopeStack, name: InternPool.Index) ?Scope.Entry;
};
```

---

## 11. Diagnostics

```zig
pub const Diagnostic = struct {
    severity: Severity,
    file: SourceMap.FileId,
    span: Span,
    message: []const u8,     // arena-allocated or static literal

    pub const Severity = enum { err, warn, hint };
    pub const Span = struct { start: u32, end: u32 };
};

pub const DiagList = struct {
    items: std.ArrayList(Diagnostic),
    has_error: bool,

    pub fn add(self: *DiagList, gpa: Allocator, d: Diagnostic) !void;
    pub fn render(self: DiagList, map: SourceMap, writer: anytype) !void;
};
```
