// @author: ruka-lang
// @created: 2024-03-04

const rukac = @import("../root.zig");
const util = rukac.util;

const std = @import("std");

/// Represents a lexeme: it's kind, file, and position within that file
pub const Token = struct {
    const Self = @This();

    kind: Kind,
    file: []const u8,
    pos: util.Position,
    /// Creates a new token
    pub fn init(kind: Kind, file: []const u8, pos: util.Position) Self {
        return Self {
            .kind = kind,
            .file = file,
            .pos = pos
        };
    }
};

/// Represents the kind of lexeme and corresponding value when applicable
pub const Kind = union(enum) {
    const Self = @This();

    Identifier: []const u8,
    String: []const u8,
    Integer: []const u8,
    Float: []const u8,
    Keyword: Keyword,
    Mode: Mode,
    // Assignment
    Assign,        // =
    Assignexp,     // :=
    // Punctuation
    Dot,           // .
    Comma,         // ,
    Lparen,        // (
    Rparen,        // )
    Lbracket,      // [
    Rbracket,      // ]
    Lsquirly,      // {
    Rsquirly,      // }
    Quote,         // '
    Dblquote,      // "
    Backtick,      // `
    Backslash,     // \
    Colon,         // :
    Semicolon,     // ;
    Arrow,         // ->
    Widearrow,     // =>
    // Operators
    Address,       // @
    Cash,          // $
    Pound,         // #
    Bang,          // !
    Question,      // ?
    Excrange,      // ..
    Incrange,      // ..=
    Forapp,        // <|
    Revapp,        // |>
    // Arithmetic
    Plus,          // +
    Minus,         // -
    Asterisk,      // *
    Slash,         // /
    Percent,       // %
    Increment,     // ++
    Decrement,     // --
    Square,        // **
    // Bitwise
    Ampersand,     // &
    Pipe,          // |
    Caret,         // ^
    Tilde,         // ~
    Lshift,        // <<
    Rshift,        // >>
    // Comparators
    Lesser,        // <
    Lessereq,      // <=
    Greater,       // >
    Greatereq,     // >=
    Equal,         // ==
    Notequal,      // !=
    // Miscelaneous
    Newline,       // \n
    Illegal,
    Eof,

    // Tries to create a Kind from a byte
    pub fn from_byte(byte: u8) Self {
        return switch(byte) {
            // Assignment
            '='    => .Assign,
            // Punctuation
            '.'    => .Dot,
            ','    => .Comma,
            '('    => .Lparen,
            ')'    => .Rparen,
            '['    => .Lbracket,
            ']'    => .Rbracket,
            '{'    => .Lsquirly,
            '}'    => .Rsquirly,
            '\''   => .Quote,
            '"'    => .Dblquote,
            '`'    => .Backtick,
            '\\'   => .Backslash,
            ':'    => .Colon,
            ';'    => .Semicolon,
            // Operators
            '@'    => .Address,
            '$'    => .Cash,
            '#'    => .Pound,
            '!'    => .Bang,
            '?'    => .Question,
            // Arithmetic
            '+'    => .Plus,
            '-'    => .Minus,
            '*'    => .Asterisk,
            '/'    => .Slash,
            '%'    => .Percent,
            // Bitwise
            '&'    => .Ampersand,
            '|'    => .Pipe,
            '^'    => .Caret,
            '~'    => .Tilde,
            // Comparators
            '<'    => .Lesser,
            '>'    => .Greater,
            // Miscelaneous
            '\n'   => .Newline,
            '\x00' => .Eof,
            else   => .Illegal
        };
    }

    // Converts a Kind into a string slice
    pub fn to_str(self: *const Kind) []const u8 {
        return switch(self.*) {
            // Kinds with associated values
            .Identifier   => |id| id,
            .String       => |st| st,
            .Integer      => |in| in,
            .Float        => |fl| fl,
            .Keyword      => |ke| ke.to_str(),
            .Mode         => |mo| mo.to_str(),
            // Assignment
            .Assign       => "=",
            .Assignexp    => ":=",
            // Punctuation
            .Dot          => ".",
            .Comma        => ",",
            .Lparen       => "(",
            .Rparen       => ")",
            .Lbracket     => "[",
            .Rbracket     => "]",
            .Lsquirly     => "{",
            .Rsquirly     => "}",
            .Quote        => "'",
            .Dblquote     => "\"",
            .Backtick     => "`",
            .Backslash    => "\\",
            .Colon        => ":",
            .Semicolon    => ";",
            .Arrow        => "->",
            .Widearrow    => "=>",
            // Operators
            .Address      => "@",
            .Cash         => "$",
            .Pound        => "#",
            .Bang         => "!",
            .Question     => "?",
            .Excrange     => "..",
            .Incrange     => "..=",
            .Forapp       => "<|",
            .Revapp       => "|>",
            // Arithmetic
            .Plus         => "+",
            .Minus        => "-",
            .Asterisk     => "*",
            .Slash        => "/",
            .Percent      => "%",
            .Increment    => "++",
            .Decrement    => "--",
            .Square       => "**",
            // Bitwise
            .Ampersand    => "&",
            .Pipe         => "|",
            .Caret        => "^",
            .Tilde        => "~",
            .Lshift       => "<<",
            .Rshift       => ">>",
            // Comparators
            .Lesser       => "<",
            .Lessereq     => "<=",
            .Greater      => ">",
            .Greatereq    => ">=",
            .Equal        => "==",
            .Notequal     => "!=",
            // Miscelaneous
            .Newline      => "\n",
            .Illegal      => "ILLEGAL",
            .Eof          => "EOF"
        };
    }

    /// Tries to create a keyword Kind from a string slice
    pub fn try_keyword(slice: []const u8) ?Self {
        const keyword = keywords.get(slice) orelse return null;
        return Self{.Keyword = keyword};
    }

    /// Tries to create a mode Kind from a string slice
    pub fn try_mode(slice: []const u8) ?Self {
        const mode = modes.get(slice) orelse return null;
        return Self{.Mode = mode};
    }
};

/// Represents the official keywords of Ruka, and the reserved
const Keyword = enum {
    const Self = @This();

    Const,
    Let,
    Pub,
    Return,
    Do,
    End,
    Record,
    Variant,
    Interface,
    Module,
    Defer,
    True,
    False,
    For,
    While,
    Break,
    Continue,
    Match,
    If,
    Else,
    And,
    Or,
    Not,
    Inline,
    Test,
    // Reserved
    Private,
    Derive,
    Static,
    Macro,
    From,
    Impl,
    When,
    Any,
    Use,
    As,
    Fn,
    In,

    /// Converts a Keyword into a string slice
    pub fn to_str(self: *const Keyword) []const u8 {
        for (keywords.kvs) |pair| {
            if (pair.value == self.*) {
                return pair.key;
            }
        }
        unreachable;
    }
};

// Map representing Keywords and their string representation
const keywords = std.ComptimeStringMap(Keyword, .{
    .{"const", .Const},
    .{"let", .Let},
    .{"pub", .Pub},
    .{"return", .Return},
    .{"do", .Do},
    .{"end", .End},
    .{"record", .Record},
    .{"variant", .Variant},
    .{"interface", .Interface},
    .{"module", .Module},
    .{"defer", .Defer},
    .{"true", .True},
    .{"false", .False},
    .{"for", .For},
    .{"while", .While},
    .{"break", .Break},
    .{"continue", .Continue},
    .{"match", .Match},
    .{"if", .If},
    .{"else", .Else},
    .{"and", .And},
    .{"or", .Or},
    .{"not", .Not},
    .{"inline", .Inline},
    .{"test", .Test},
    // Reserved
    .{"private", .Private},
    .{"derive", .Derive},
    .{"static", .Static},
    .{"macro", .Macro},
    .{"from", .From},
    .{"impl", .Impl},
    .{"when", .When},
    .{"any", .Any},
    .{"use", .Use},
    .{"as", .As},
    .{"fn", .Fn},
    .{"in", .In}
});

// Compile time assert no missing or extra entries in keywords
comptime {
    const keyword_fields = @typeInfo(Keyword).Enum.fields;

    if (keyword_fields.len != keywords.kvs.len) {
        var buf: [100]u8 = undefined;
        const msg = std.fmt.bufPrint(&buf,
            "Keywords map has an incorrect number of elements, expected: {}, got: {}",
            .{keyword_fields.len, keywords.kvs.len}
            ) catch unreachable;

        @compileError(msg);
    }
}

/// Represent various parameter modes
const Mode = enum {
    const Self = @This();

    Comptime,
    Loc,
    Mov,
    Mut,

    /// Converts a Mode into a string slice
    pub fn to_str(self: *const Mode) []const u8 {
        for (modes.kvs) |pair| {
            if (pair.value == self.*) {
                return pair.key;
            }
        }
        unreachable;
    }
};

// Map representing Keywords and their string representation
const modes = std.ComptimeStringMap(Mode, .{
    .{"comptime", .Comptime},
    .{"loc", .Loc},
    .{"mov", .Mov},
    .{"mut", .Mut}
});

// Compile time assert no missing or extra entries in modes
comptime {
    const mode_fields = @typeInfo(Mode).Enum.fields;

    if (mode_fields.len != modes.kvs.len) {
        var buf: [100]u8 = undefined;
        const msg = std.fmt.bufPrint(&buf,
            "Modes map has an incorrect number of elements, expected: {}, got: {}",
            .{mode_fields.len, keywords.kvs.len}
            ) catch unreachable;

        @compileError(msg);
    }
}

test "mode comparision" {
    const testing = std.testing;

    const mode: Kind = .{.Mode = .Mut};
    const mode2 = Kind.try_mode("mut").?;

    try testing.expect(mode.Mode == mode2.Mode);
}
