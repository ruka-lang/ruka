// @author: ruka-lang
// @created: 2024-03-04

const rukac = @import("../root.zig");
const util = rukac.util;

const std = @import("std");

const Token = @This();

/// Represents a lexeme: it's kind, file, and position within that file
kind: Kind,
file: []const u8,
pos: util.Position,

/// Creates a new token
pub fn init(kind: Kind, file: []const u8, pos: util.Position) Token {
    return Token {
        .kind = kind,
        .file = file,
        .pos = pos
    };
}

/// Represents the kind of lexeme and corresponding value when applicable
pub const Kind = union(enum) {
    identifier: []const u8,
    string: []const u8,
    character: u8,
    integer: []const u8,
    float: []const u8,
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
    dblquote,      // "
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

    // Tries to create a Kind from a byte
    pub fn from_byte(byte: u8) Kind {
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
            '"'    => .dblquote,
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

    // Converts a Kind into a string slice
    pub fn to_str(self: *const Kind, allocator: std.mem.Allocator) ![]const u8 {
        return switch(self.*) {
            // Kinds with associated values
            .identifier   => |id| id,
            .string       => |st| st,
            .character    => |ch| try self.char_to_string(ch, allocator),
            .integer      => |in| in,
            .float        => |fl| fl,
            .keyword      => |ke| ke.to_str(),
            .mode         => |mo| mo.to_str(),
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
            .dblquote     => "\"",
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
            .newline      => "\n",
            .illegal      => "ILLEGAL",
            .eof          => "EOF"
        };
    }

    fn char_to_string(_: *const Kind, ch: u8, allocator: std.mem.Allocator) ![]const u8 {
        var str = try allocator.alloc(u8, 1);
        str[0] = ch;
        return str[0..];
    }

    /// Tries to create a keyword Kind from a string slice
    pub fn try_keyword(slice: []const u8) ?Kind {
        const keyword = keywords.get(slice) orelse return null;
        return .{ .keyword = keyword };
    }

    /// Tries to create a mode Kind from a string slice
    pub fn try_mode(slice: []const u8) ?Kind {
        const mode = modes.get(slice) orelse return null;
        return .{ .mode = mode };
    }
};

/// Represents the official keywords of Ruka, and the reserved
pub const Keyword = enum {
    @"const",
    let,
    @"pub",
    @"return",
    do,
    end,
    record,
    variant,
    interface,
    module,
    @"defer",
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
    @"inline",
    @"test",
    @"fn",
    in,
    // Reserved
    private,
    derive,
    static,
    macro,
    from,
    impl,
    when,
    any,
    use,
    as,

    /// Converts a keyword into a string slice
    pub fn to_str(self: *const Keyword) []const u8 {
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
    .{"pub", .@"pub"},
    .{"return", .@"return"},
    .{"do", .do},
    .{"end", .end},
    .{"record", .record},
    .{"variant", .variant},
    .{"interface", .interface},
    .{"module", .module},
    .{"defer", .@"defer"},
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
    .{"inline", .@"inline"},
    .{"test", .@"test"},
    .{"fn", .@"fn"},
    .{"in", .in},
    // Reserved
    .{"private", .private},
    .{"derive", .derive},
    .{"static", .static},
    .{"macro", .macro},
    .{"from", .from},
    .{"impl", .impl},
    .{"when", .when},
    .{"any", .any},
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
    @"comptime",
    loc,
    mov,
    mut,

    /// Converts a mode into a string slice
    pub fn to_str(self: *const Mode) []const u8 {
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
    .{"comptime", .@"comptime"},
    .{"loc", .loc},
    .{"mov", .mov},
    .{"mut", .mut}
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
    const mode2 = Kind.try_mode("mut").?;

    try testing.expect(mode.mode == mode2.mode);
}
