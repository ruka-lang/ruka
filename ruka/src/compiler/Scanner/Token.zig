const std = @import("std");
const Allocator = std.mem.Allocator;
const ArrayList = std.ArrayList;

const ruka = @import("../../prelude.zig");
const Position = ruka.Position;

kind: Kind,
file: []const u8,
pos: Position,

const Token = @This();

pub fn init(kind: Kind, file: []const u8, pos: Position) Token {
    return Token{
        .kind = kind,
        .file = file,
        .pos = pos,
    };
}

pub fn deinit(self: *Token, gpa: Allocator) void {
    self.kind.deinit(gpa);
}

pub const Kind = union(enum) {
    // Literals
    identifier: ArrayList(u8),
    //atom: ArrayList(u8),
    string: ArrayList(u8),
    character: ArrayList(u8),
    integer: ArrayList(u8),
    floating: ArrayList(u8),
    keyword: Keyword,
    mode: Mode,
    // Assignment
    assignment,                 // =
    walrus,                     // :=
    // Punctuation
    dot,                        // .
    comma,                      // ,
    left_parenthesis,           // (
    right_parenthesis,          // )
    left_bracket,               // [
    right_bracket,              // ]
    left_squirly,               // {
    right_squirly,              // }
    single_quote,               // '
    double_quote,               // "
    backtick,                   // `
    backslash,                  // \
    colon,                      // :
    semicolon,                  // ;
    arrow,                      // ->
    double_arrow,               // =>
    // Operators
    address,                    // @
    cash,                       // $
    pound,                      // #
    bang,                       // !
    question,                   // ?
    range_exc,                  // ..
    range_inc,                  // ..=
    forward_triangle,           // <|
    reverse_triangle,           // |>
    diamond,                    // <>
    // Arithmetic
    plus,                       // +
    minus,                      // -
    asterisk,                   // *
    slash,                      // /
    percent,                    // %
    increment,                  // ++
    decrement,                  // --
    square,                     // **
    // Bitwise
    ampersand,                  // &
    pipe,                       // |
    caret,                      // ^
    tilde,                      // ~
    left_shift,                 // <<
    right_shift,                // >>
    // Comparators
    lesser,                     // <
    lesser_equal,               // <=
    greater,                    // >
    greater_equal,              // >=
    equal,                      // ==
    not_equal,                  // !=
    // Miscellaneous
    newline,                    // \n
    illegal,
    eof,                        // \x00
    
    pub fn initIdentifier(gpa: *Allocator, value: []const u8) !Kind {
        var identifier = ArrayList(u8).init(gpa);
        try identifier.appendSlice(value);

        return Kind.identifier(identifier);
    }

    pub fn initString(gpa: *Allocator, value: []const u8) !Kind {
        var string = ArrayList(u8).init(gpa);
        try string.appendSlice(value);

        return Kind.string(string);
    }

    pub fn initCharacter(gpa: *Allocator, value: []const u8) !Kind {
        var character = ArrayList(u8).init(gpa);
        try character.appendSlice(value);

        return Kind.character(character);
    }

    pub fn initInteger(gpa: *Allocator, value: []const u8) !Kind {
        var integer = ArrayList(u8).init(gpa);
        try integer.appendSlice(value);

        return Kind.integer(integer);
    }

    pub fn initFloating(gpa: *Allocator, value: []const u8) !Kind {
        var floating = ArrayList(u8).init(gpa);
        try floating.appendSlice(value);

        return Kind.floating(floating);
    }

    pub fn fromByte(byte: u8) Kind {
        return switch (byte) {
            // Assignment
            '='    => .assignment,
            // Punctuation
            '.'    => .dot,
            ','    => .comma,
            '('    => .left_parenthesis,
            ')'    => .right_parenthesis,
            '['    => .left_bracket,
            ']'    => .right_bracket,
            // Operators
            '@'    => .address,
            '$'    => .cash,
            '#'    => .pound,
            '!'    => .bang,
            '?'    => .question,
            // Arithmetic
            '+'    => .plus,
            '-'    => .minus,
            '*'    => .asterisk,
            '/'    => .slash,
            '%'    => .percent,
            // Bitwise
            '&'    => .ampersand,
            '|'    => .pipe,
            '^'    => .caret,
            '~'    => .tilde,
            // Comparators
            '<'    => .lesser,
            '>'    => .greater,
            // Miscellaneous
            '\n'   => .newline,
            '\x00' => .eof,
            else   => .illegal
        };
    }            

    pub fn deinit(self: *Kind, gpa: *Allocator) void {
        switch (self) {
            .identifier => |list| list.deinit(gpa),
            .string     => |list| list.deinit(gpa),
            .character  => |list| list.deinit(gpa),
            .integer    => |list| list.deinit(gpa),
            .floating   => |list| list.deinit(gpa),
            else        => {},
        }
    }

    pub fn toStr(self: Kind) []const u8 {
        return switch (self) {
            .identifier        => |id| id.items,
            .string            => |st| st.items,
            .character         => |ch| ch.items,
            .integer           => |in| in.items,
            .floating          => |fl| fl.items,
            .keyword           => |ke| ke.toStr(),
            .mode              => |mo| mo.toStr(),
            // Assignment
            .assignment        => "=",
            .walrus            => ":=",
            // Punctuation
            .dot               => ".",
            .comma             => ",",
            .left_parenthesis  => "(",
            .right_parenthesis => ")",
            .left_bracket      => "[",
            .right_bracket     => "]",
            .left_squirly      => "{",
            .right_squirly     => "}",
            .single_quote      => "'",
            .double_quote      => "\"",
            .backtick          => "`",
            .backslash         => "\\",
            .colon             => ":",
            .semicolon         => ";",
            .arrow             => "->",
            .double_arrow      => "=>",
            // Operators
            .address           => "@",
            .cash              => "$",
            .pound             => "#",
            .bang              => "!",
            .question          => "?",
            .range_exc         => "..",
            .range_inc         => "..=",
            .forward_triangle  => "<|",
            .reverse_triangle  => "|>",
            .diamond           => "<>",
            // Arithmetic
            .plus              => "+",
            .minus             => "-",
            .asterisk          => "*",
            .slash             => "/",
            .percent           => "%",
            .increment         => "++",
            .decrement         => "--",
            .square            => "**",
            // Bitwise
            .ampersand         => "&",
            .pipe              => "|",
            .caret             => "^",
            .tilde             => "~",
            .left_shift        => "<<",
            .right_shift       => ">>",
            // Comparators
            .lesser            => "<",
            .lesser_equal      => "<=",
            .greater           => ">",
            .greater_equal     => ">=",
            .equal             => "==",
            .not_equal         => "!=",
            // Miscelaneous
            .newline           => "\\n",
            .illegal           => "ILLEGAL",
            .eof               => "EOF"

        };
    }

    pub fn tryKeyword(slice: []const u8) ?Kind {
        const keyword = keywords.get(slice) orelse return null;
        return Kind.keyword(keyword);
    }

    pub fn tryMode(slice: []const u8) ?Kind {
        const mode = modes.get(slice) orelse return null;
        return Kind.mode(mode);
    }
};

pub const Keyword = enum {
    // Types
    record,
    variant,
    behaviour,
    // Assignment
    let,
    local,
    @"const",
    @"test",
    self,
    // Delimiters
    do,
    end,
    // Control flow
    @"if",
    @"else",
    @"and",
    @"or",
    not,
    match,
    with,
    @"defer",
    @"return",
    // Looping
    @"for",
    @"while",
    in,
    @"break",
    @"continue",
    // Boolean
    true,
    false,

    pub fn toStr(self: *const Keyword) []const u8 {
        for (keywords.keys(), keywords.values()) |key, value| {
            if (value == self.*) {
                return key;
            }
        }
        unreachable;
    }
};

const keywords = std.StaticStringMap(Keyword).initComptime(.{
    // Types
    .{"record", .record},
    .{"variant", .variant},
    .{"behaviour", .behaviour},
    // Assignment
    .{"let", .let},
    .{"local", .local},
    .{"const", .@"const"},
    .{"test", .@"test"},
    .{"self", .self},
    // Delimiters
    .{"do", .do},
    .{"end", .end},
    // Control flow
    .{"if", .@"if"},
    .{"else", .@"else"},
    .{"and", .@"and"},
    .{"not", .not},
    .{"match", .match},
    .{"with", .with},
    .{"defer", .@"defer"},
    .{"return", .@"return"},
    // Looping
    .{"for", .@"for"},
    .{"while", .@"while"},
    .{"in", .in},
    .{"break", .@"break"},
    .{"continue", .@"continue"},
    // Boolean
    .{"true", .true},
    .{"false", .false}
});

comptime {
    const fields = switch (@typeInfo(Keyword)) {
        .@"enum" => |e| e.fields,
        else => unreachable
    };

    if (fields.len != keywords.kvs.len) {
        var buf: [100]u8 = undefined;
        const msg = std.fmt.bufPrint(&buf,
            "Keywords map has an incorrect number of elements, expected: {}, got: {}",
            .{fields.len, keywords.kvs.len}
        ) catch unreachable;

        @compileError(msg);
    }
}

pub const Mode = enum {
    mut, // Mutable borrow
    mov, // Ownership transfer
    loc, // Non-escaping borrow (might be done using the local keyword)
    stk, // Stack allocation
    cmp, // Compile time evaluation

    pub fn toStr(self: *const Mode) []const u8 {
        for (modes.keys(), modes.values()) |key, value| {
            if (value == self.*) {
                return key;
            }
        }
        unreachable;
    }
};

const modes = std.StaticStringMap(Mode).initComptime(.{
    .{"mut", .mut},
    .{"mov", .mov},
    .{"loc", .loc},
    .{"stk", .stk},
    .{"cmp", .cmp}
});

comptime {
    const fields = switch (@typeInfo(Mode)) {
        .@"enum" => |e| e.fields,
        else => unreachable
    };

    if (fields.len != modes.kvs.len) {
        var buf: [100]u8 = undefined;
        const msg = std.fmt.bufPrint(&buf,
            "Modes map has an incorrect number of elements, expected: {}, got: {}",
            .{fields.len, modes.kvs.len}
        ) catch unreachable;

        @compileError(msg);
    }
}

test "mode comparision" {
    const testing = std.testing;

    const mode = Kind.mode(.mut);
    const mode2 = Kind.tryMode("mut").?;

    try testing.expectEqual(mode.mode, mode2.mode);
}
