// @author: ruka-lang
// @created: 2024-03-04

const std = @import("std");
const Allocator = std.mem.Allocator;
const ArrayList = std.ArrayList;

const ruka = @import("../prelude.zig");
const Position = ruka.Position;

const Token = @This();

/// Represents a lexeme: it's kind, file, and position within that file
kind: Kind,
file: []const u8,
pos: Position,

/// Creates a new token
pub fn init(kind: Kind, file: []const u8, pos: Position) Token {
    return Token {
        .kind = kind,
        .file = file,
        .pos = pos
    };
}

///
pub fn deinit(self: Token) void {
    self.kind.deinit();
}

/// Represents the kind of lexeme and corresponding value when applicable
pub const Kind = union(enum) {
    // Literals
    identifier: ArrayList(u8),
    @"enum": ArrayList(u8),
    string: ArrayList(u8),
    character: ArrayList(u8),
    integer: ArrayList(u8),
    float: ArrayList(u8),
    keyword: Keyword,
    mode: Mode,
    // Assignment
    assign,        // =
    assign_exp,    // :=
    // Punctuation
    dot,           // .
    comma,         // ,
    lparen,        // (
    rparen,        // )
    lbracket,      // [
    rbracket,      // ]
    lsquirly,      // {
    rsquirly,      // }
    quote,         // '
    double_quote,      // "
    backtick,      // `
    backslash,     // \
    colon,         // :
    semicolon,     // ;
    arrow,         // ->
    wide_arrow,    // =>
    // Operators
    address,       // @
    cash,          // $
    pound,         // #
    bang,          // !
    question,      // ?
    range_exc,     // ..
    range_inc,     // ..=
    forward_app,   // <|
    reverse_app,   // |>
    concat,        // <>
    // Arithmetic
    plus,          // +
    minus,         // -
    asterisk,      // *
    slash,         // /
    percent,       // %
    increment,     // ++
    decrement,     // --
    square,        // **
    // Bitwise
    ampersand,     // &
    pipe,          // |
    caret,         // ^
    tilde,         // ~
    lshift,        // <<
    rshift,        // >>
    // Comparators
    lesser,        // <
    lesser_eq,     // <=
    greater,       // >
    greater_eq,    // >=
    equal,         // ==
    not_equal,     // !=
    // Miscelaneous
    newline,       // \n
    illegal,
    eof,           // \x00

    pub fn initIdentifier(source: []const u8, allocator: Allocator) !Kind {
        var identifier = ArrayList(u8).init(allocator);
        try identifier.appendSlice(source);

        return Kind {
            .identifier = identifier
        };
    }

    pub fn initEnum(source: []const u8, allocator: Allocator) !Kind {
        var enum_literal = ArrayList(u8).init(allocator);
        try enum_literal.appendSlice(source);

        return Kind {
            .@"enum" = enum_literal
        };
    }

    pub fn initString(source: []const u8, allocator: Allocator) !Kind {
        var string = ArrayList(u8).init(allocator);
        try string.appendSlice(source);

        return Kind {
            .string = string
        };
    }

    pub fn initCharacter(source: []const u8, allocator: Allocator) !Kind {
        var character = ArrayList(u8).init(allocator);
        try character.appendSlice(source);

        return Kind {
            .character = character
        };
    }

    pub fn initInteger(source: []const u8, allocator: Allocator) !Kind {
        var integer = ArrayList(u8).init(allocator);
        try integer.appendSlice(source);

        return Kind {
            .integer = integer
        };
    }

    pub fn initFloat(source: []const u8, allocator: Allocator) !Kind {
        var float = ArrayList(u8).init(allocator);
        try float.appendSlice(source);

        return Kind {
            .float = float
        };
    }

    // Tries to create a Kind from a byte
    pub fn fromByte(byte: u8) Kind {
        return switch(byte) {
            // Assignment
            '='    => .assign,
            // Punctuation
            '.'    => .dot,
            ','    => .comma,
            '('    => .lparen,
            ')'    => .rparen,
            '['    => .lbracket,
            ']'    => .rbracket,
            '{'    => .lsquirly,
            '}'    => .rsquirly,
            '\''   => .quote,
            '"'    => .double_quote,
            '`'    => .backtick,
            '\\'   => .backslash,
            ':'    => .colon,
            ';'    => .semicolon,
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
            // Miscelaneous
            '\n'   => .newline,
            '\x00' => .eof,
            else   => .illegal
        };
    }

    pub fn deinit(self: Kind) void {
        switch (self) {
            .identifier   => |id| id.deinit(),
            .@"enum"      => |en| en.deinit(),
            .string       => |st| st.deinit(),
            .character    => |ch| ch.deinit(),
            .integer      => |in| in.deinit(),
            .float        => |fl| fl.deinit(),
            else => {}
        }
    }

    // Converts a Kind into a string slice
    pub fn toStr(self: *const Kind) []const u8 {
        return switch(self.*) {
            // Kinds with associated values
            .identifier   => |id| id.items,
            .@"enum"      => |en| en.items,
            .string       => |st| st.items,
            .character    => |ch| ch.items,
            .integer      => |in| in.items,
            .float        => |fl| fl.items,
            .keyword      => |ke| ke.toStr(),
            .mode         => |mo| mo.toStr(),
            // Assignment
            .assign       => "=",
            .assign_exp   => ":=",
            // Punctuation
            .dot          => ".",
            .comma        => ",",
            .lparen       => "(",
            .rparen       => ")",
            .lbracket     => "[",
            .rbracket     => "]",
            .lsquirly     => "{",
            .rsquirly     => "}",
            .quote        => "'",
            .double_quote => "\"",
            .backtick     => "`",
            .backslash    => "\\",
            .colon        => ":",
            .semicolon    => ";",
            .arrow        => "->",
            .wide_arrow   => "=>",
            // Operators
            .address      => "@",
            .cash         => "$",
            .pound        => "#",
            .bang         => "!",
            .question     => "?",
            .range_exc    => "..",
            .range_inc    => "..=",
            .forward_app  => "<|",
            .reverse_app  => "|>",
            .concat       => "<>",
            // Arithmetic
            .plus         => "+",
            .minus        => "-",
            .asterisk     => "*",
            .slash        => "/",
            .percent      => "%",
            .increment    => "++",
            .decrement    => "--",
            .square       => "**",
            // Bitwise
            .ampersand    => "&",
            .pipe         => "|",
            .caret        => "^",
            .tilde        => "~",
            .lshift       => "<<",
            .rshift       => ">>",
            // Comparators
            .lesser       => "<",
            .lesser_eq    => "<=",
            .greater      => ">",
            .greater_eq   => ">=",
            .equal        => "==",
            .not_equal    => "!=",
            // Miscelaneous
            .newline      => "\\n",
            .illegal      => "ILLEGAL",
            .eof          => "EOF"
        };
    }

    /// Tries to create a keyword Kind from a string slice
    pub fn tryKeyword(slice: []const u8) ?Kind {
        const keyword = keywords.get(slice) orelse return null;
        return .{ .keyword = keyword };
    }

    /// Tries to create a mode Kind from a string slice
    pub fn tryMode(slice: []const u8) ?Kind {
        const mode = modes.get(slice) orelse return null;
        return .{ .mode = mode };
    }
};

/// Represents the official keywords of Ruka, and the reserved
pub const Keyword = enum {
    @"const",
    let,
    @"var",
    local,
    @"return",
    do,
    end,
    record,
    tuple,
    @"enum",
    literal,
    interface,
    any,
    @"error",
    @"defer",
    interpret,
    true,
    false,
    @"for",
    @"while",
    @"break",
    @"continue",
    match,
    @"if",
    @"else",
    @"and",
    @"or",
    not,
    @"test",
    in,
    // Reserved
    @"inline",
    derive,
    module,
    static,
    macro,
    @"pub",
    @"fn",
    from,
    impl,
    when,
    with,
    use,
    as,

    /// Converts a keyword into a string slice
    pub fn toStr(self: *const Keyword) []const u8 {
        for (keywords.keys(), keywords.values()) |key, value| {
            if (value == self.*) {
                return key;
            }
        }
        unreachable;
    }
};

// Map representing Keywords and their string representation
const keywords = std.StaticStringMap(Keyword).initComptime(.{
    .{"const", .@"const"},
    .{"let", .let},
    .{"var", .@"var"},
    .{"local", .local},
    .{"return", .@"return"},
    .{"do", .do},
    .{"end", .end},
    .{"record", .record},
    .{"tuple", .tuple},
    .{"enum", .@"enum"},
    .{"literal", .literal},
    .{"interface", .interface},
    .{"any", .any},
    .{"error", .@"error"},
    .{"defer", .@"defer"},
    .{"interpret", .interpret},
    .{"true", .true},
    .{"false", .false},
    .{"for", .@"for"},
    .{"while", .@"while"},
    .{"break", .@"break"},
    .{"continue", .@"continue"},
    .{"match", .match},
    .{"if", .@"if"},
    .{"else", .@"else"},
    .{"and", .@"and"},
    .{"or", .@"or"},
    .{"not", .not},
    .{"test", .@"test"},
    .{"in", .in},
    // Reserved
    .{"inline", .@"inline"},
    .{"derive", .derive},
    .{"module", .module},
    .{"static", .static},
    .{"macro", .macro},
    .{"pub", .@"pub"},
    .{"fn", .@"fn"},
    .{"from", .from},
    .{"impl", .impl},
    .{"when", .when},
    .{"with", .with},
    .{"use", .use},
    .{"as", .as}
});

// Compile time assert no missing or extra entries in keywords
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

/// Represent various parameter modes
pub const Mode = enum {
    @"interpreted", // Parameter is constant and must be known at compile time and the value is interpreted during compilation.
    loc,            // Immutable reference which cannot escape the function scope.
    mov,            // Function takes ownership of the parameter, parameter cannot escape the function scope, 'by value'.
    mut,            // Mutable reference, parameter can be changed, but the reference cannot escape the function scope.
    ref,            // Immutable refernce which can escape the function scope, default mode.

    /// Converts a mode into a string slice
    pub fn toStr(self: *const Mode) []const u8 {
        for (modes.keys(), modes.values()) |key, value| {
            if (value == self.*) {
                return key;
            }
        }
        unreachable;
    }
};

// Map representing Keywords and their string representation
const modes = std.StaticStringMap(Mode).initComptime(.{
    .{"#", .@"interpreted"},
    .{"loc", .loc},
    .{"mov", .mov},
    .{"mut", .mut},
    .{"ref", .ref}
});

// Compile time assert no missing or extra entries in modes
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

    const mode: Kind = .{ .mode = .mut };
    const mode2 = Kind.tryMode("mut").?;

    try testing.expectEqual(mode.mode, mode2.mode);
}
