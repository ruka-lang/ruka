// @author: ruka-lang
// @created: 2024-03-04

/// Responsible for scanning the source file contained in the compiler which
/// owns this scanner

const rukac = @import("../root.zig");
const Compiler = rukac.Compiler;
const util = rukac.util;

const std = @import("std");

pub const Token = @import("token.zig");

const Scanner = @This();

current_pos: util.Position,
token_pos: util.Position,
compiler: *Compiler,
idx: usize,

/// Creates a new scanner instance
pub fn init(comp: *Compiler) Scanner {
    return Scanner{
        .current_pos = .{.line = 1, .col = 1},
        .token_pos = .{.line = 1, .col = 1},
        .compiler = comp,
        .idx = 0
    };
}

/// Returns the next token from the files, when eof is reached,
/// will repeatedly return eof tokens
pub fn next_token(self: *Scanner) !Token {
    self.skip_whitespace();
    self.token_pos = self.current_pos;

    const byte = self.read();
    const tok = switch(byte) {
        // Strings
        '"' => blk: {
            break :blk switch (self.peek()) {
                '|' => try self.read_multi_string(),
                else => try self.read_single_string()
            };
        },
        // Characters
        '\'' => {
            return self.read_character() orelse blk: {
                self.advance(1);
                break :blk self.next_token();
            };
        },
        // Comments or '/'
        '/' => blk: {
            switch (self.peek()) {
                '/' => {
                    self.skip_single_comment();
                    break :blk self.next_token();
                },
                '*' => {
                    try self.skip_multi_comment();
                    break :blk self.next_token();
                },
                else => {
                    self.advance(1);
                    break :blk self.new_token(.slash);
                }
            }
        },
        // Operators which may be multiple characters long
        '=' => blk: {
            var kind = self.try_compound_operator(.{
                .{2, "=>", Token.Kind.wide_arrow},
                .{2, "==", Token.Kind.equal}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.assign;
            }

            break :blk self.new_token(kind.?);
        },
        ':' => blk: {
            var kind = self.try_compound_operator(.{
                .{2, ":=", Token.Kind.assign_exp}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.colon;
            }

            break :blk self.new_token(kind.?);
        },
        '>' => blk: {
            var kind = self.try_compound_operator(.{
                .{2, ">=", Token.Kind.greater_eq},
                .{2, ">>", Token.Kind.rshift}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.greater;
            }

            break :blk self.new_token(kind.?);
        },
        '<' => blk: {
            var kind = self.try_compound_operator(.{
                .{2, "<=", Token.Kind.lesser_eq},
                .{2, "<<", Token.Kind.lshift},
                .{2, "<|", Token.Kind.forward_app},
                .{2, "<>", Token.Kind.concat}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.lesser;
            }

            break :blk self.new_token(kind.?);
        },
        '-' => blk: {
            var kind = self.try_compound_operator(.{
                .{2, "->", Token.Kind.arrow},
                .{2, "--", Token.Kind.decrement}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.minus;
            }

            break :blk self.new_token(kind.?);
        },
        '+' => blk: {
            var kind = self.try_compound_operator(.{
                .{2, "++", Token.Kind.increment}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.plus;
            }

            break :blk self.new_token(kind.?);
        },
        '*' => blk: {
            var kind = self.try_compound_operator(.{
                .{2, "**", Token.Kind.square}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.asterisk;
            }

            break :blk self.new_token(kind.?);
        },
        '.' => blk: {
            var kind = self.try_compound_operator(.{
                .{3, "..=", Token.Kind.range_inc},
                .{2, "..", Token.Kind.range_exc}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.dot;
            }

            break :blk self.new_token(kind.?);
        },
        '!' => blk: {
            var kind = self.try_compound_operator(.{
                .{2, "!=", Token.Kind.not_equal}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.bang;
            }

            break :blk self.new_token(kind.?);
        },
        '|' => blk: {
            var kind = self.try_compound_operator(.{
                .{2, "|>", Token.Kind.reverse_app}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.pipe;
            }

            break :blk self.new_token(kind.?);
        },
        '\x00' => self.new_token(Token.Kind.eof),
        // Single characters, identifiers, keywords, modes, numbers
        else => blk: {
            if (util.is_alphabetical(byte)) {
                break :blk self.read_identifier_keyword_mode();
            } else if (util.is_integral(byte)) {
                break :blk self.read_integer_float();
            }

            // Single character
            self.advance(1);
            break :blk self.new_token(Token.Kind.from_byte(byte));
        }
    };

    return tok;
}

// Advances the scanner count number of times
fn advance(self: *Scanner, count: usize) void {
    for (0..count) |_| {
        self.idx = self.idx + 1;

        self.current_pos.col = self.current_pos.col + 1;
        if (self.prev() == '\n') {
            self.current_pos.line = self.current_pos.line + 1;
            self.current_pos.col = 1;
        }
    }
}

// Returns the character at the current index
fn read(self: *Scanner) u8 {
    if (self.idx >= self.compiler.contents.len) {
        return '\x00';
    }

    return self.compiler.contents[self.idx];
}

// Returns the character after the current index
fn peek(self: *Scanner) u8 {
    if (self.idx + 1 >= self.compiler.contents.len) {
        return '\x00';
    }

    return self.compiler.contents[self.idx + 1];
}

// Returns the character previous to the current index
fn prev(self: *Scanner) u8 {
    if (self.idx - 1 >= self.compiler.contents.len) {
        return '\x00';
    }

    return self.compiler.contents[self.idx - 1];
}

// Creates a new token of the kind passed in
fn new_token(self: *Scanner, kind: Token.Kind) Token {
    return Token.init(
        kind,
        self.compiler.input,
        self.token_pos
    );
}

// Skips characters until the current character is not a space or tab
fn skip_whitespace(self: *Scanner) void {
    switch (self.read()) {
        inline ' ', '\t' => {
            self.advance(1);
            self.skip_whitespace();
        },
        else => {}
    }
}

// Reads an identifier, keyword, or mode literal from the file
fn read_identifier_keyword_mode(self: *Scanner) Token {
    const start = self.idx;

    var byte = self.read();
    while (util.is_alphanumerical(byte)) {
        self.advance(1);
        byte = self.read();
    }

    const str = self.compiler.contents[start..self.idx];

    var kind = Token.Kind.try_mode(str);
    if (kind == null) {
        kind = Token.Kind.try_keyword(str);

        // If str doesn't represent a keyword or mode,
        // then kind is identifier
        if (kind == null) {
            kind = .{ .identifier = str };
        }
    }

    self.advance(1);
    return self.new_token(kind.?);
}

// Reads a character literal from the file
fn read_character(self: *Scanner) ?Token {
    const start = self.idx + 1;
    var end = start;

    // Iterate until the final delimiter or EOF is reached
    while (self.peek() != '\'' and self.peek() != '\x00') {
        end = end + 1;
        self.advance(1);
    }

    // Check if character literal contains a escape character
    const str = self.handle_escape_characters(self.compiler.contents[start..end]) catch unreachable;

    // Create errors if str length isn't 1
    if (str.len > 1) {
        self.compiler.errors.append(.{
            .file = self.compiler.input,
            .kind = "scanning error",
            .msg = "too many characters in charater literal",
            .pos = self.current_pos
        }) catch unreachable;

        return null;
    } if (str.len < 1) {
        self.compiler.errors.append(.{
            .file = self.compiler.input,
            .kind = "scanning error",
            .msg = "charater literal is empty",
            .pos = self.current_pos
        }) catch unreachable;

        return null;
    }

    self.advance(2);
    return self.new_token(.{ .character = str[0] });
}

// Reads a integer or float literal from the file
fn read_integer_float(self: *Scanner) Token {
    const start = self.idx;
    var float = false;

    // Iterate while self.read() is numeric, if self.read() is a '.',
    // read only integer values afterwards
    var byte = self.read();
    while (util.is_numeric(byte)) {
        if (self.read() == '.') {
            self.read_integer();
            float = true;
            break;
        }

        self.advance(1);
        byte = self.read();
    }

    const str = self.compiler.contents[start..self.idx];
    const kind: Token.Kind = switch (float) {
        false => .{ .integer = str },
        true  => .{ .float = str }
    };

    return self.new_token(kind);
}

// Reads only integral numbers from the file, no decimals allowed
fn read_integer(self: *Scanner) void {
    self.advance(1);

    var byte = self.read();
    while (util.is_integral(byte)) {
        self.advance(1);
        byte = self.read();
    }
}

const Match = std.meta.Tuple(&.{usize, []const u8, Token.Kind});
// Tries to create a token.Kind based on the passed in tuple of tuples
fn try_compound_operator(self: *Scanner, comptime matches: anytype) ?Token.Kind {
    const contents = self.compiler.contents;
    var start: usize = undefined;
    var end: usize = undefined;

    // Iterate through each passed in sub-tuple, checking if the second
    // element matches the following chars in the file, if it does
    // return the third element of the sub-tuple
    inline for (matches) |match| {
        start = self.idx;
        end = std.math.clamp((start + match[0]), 0, contents.len);

        if (std.mem.eql(u8, contents[start..end], match[1])) {
            self.advance(match[0]);
            return match[2];
        }
    }

    return null;
}

// Skips a single line comment
fn skip_single_comment(self: *Scanner) void {
    switch (self.read()) {
        '\n', '\x00' => {},
        else => {
            self.advance(1);
            self.skip_single_comment();
        }
    }
}

// Skips a multi line comment
fn skip_multi_comment(self: *Scanner) !void {
    var next = self.peek();

    while (self.read() != '\x00') {
        if (self.read() == '*' and next == '/') {
            self.advance(2);
            break;
        }

        self.advance(1);
        next = self.peek();
    }

    if (next != '/') {
        try self.compiler.errors.append(.{
            .file = self.compiler.input,
            .kind = "scanning error",
            .msg = "unterminated multiline comment",
            .pos = self.current_pos
        });
    }
}

// Reads a single line string
fn read_single_string(self: *Scanner) !Token {
    const start = self.idx + 1;
    var end = start;

    while (self.peek() != '"' and self.peek() != '\x00') {
        end = end + 1;
        self.advance(1);
    }

    self.advance(2);

    if (self.prev() != '"') {
        try self.compiler.errors.append(.{
            .file = self.compiler.input,
            .kind = "scanning error",
            .msg = "unterminated string literal",
            .pos = self.current_pos
        });
    }

    const str = try self.handle_escape_characters(self.compiler.contents[start..end]);

    return self.new_token(.{.string = str});
}

// Reads a multi line string
fn read_multi_string(self: *Scanner) !Token {
    var string = std.ArrayList(u8).init(self.compiler.arena.allocator());
    defer string.deinit();

    self.advance(1);
    while (self.peek() != '"' and self.peek() != '\x00') {
        switch (self.peek()) {
            '\n' => {
                try string.append('\n');
                self.advance(2);
                self.skip_whitespace();

                switch (self.read()) {
                    '|' => {
                        switch (self.peek()) {
                            '"' => break,
                            else => |ch| try string.append(ch)
                        }
                    },
                    else => try self.compiler.errors.append(.{
                        .file = self.compiler.input,
                        .kind = "scanning error",
                        .msg = "missing start of line delimiter '|'",
                        .pos = self.current_pos
                    })
                }
            },
            else => |ch| try string.append(ch)
        }

        self.advance(1);
    }

    self.advance(2);

    if (self.prev() != '"') try self.compiler.errors.append(.{
        .file = self.compiler.input,
        .kind = "scanning error",
        .msg = "unterminated string literal",
        .pos = self.current_pos
    });

    const str = try self.handle_escape_characters(string.items);
    return self.new_token(.{.string = str});
}

// Replaces escape characters
fn handle_escape_characters(self: *Scanner, str: [] const u8) ![]const u8 {
    var string = std.ArrayList(u8).init(self.compiler.arena.allocator());

    var i: usize = 0;
    while (i < str.len) {
        switch (str[i]) {
            '\\' => {
                // Adjust to check for hex and unicode escape characters
                const esc_ch = util.try_escape_char(str[i..i+2]);

                if (esc_ch) |esc| {
                    i = i + 2;
                    try string.append(esc);
                } else {
                    try self.create_escape_error(i, str);

                    i = i + 1;
                    try string.append('\\');
                }
            },
            else => |ch| {
                i = i + 1;
                try string.append(ch);
            }
        }
    }

    return string.items;
}

// Creates an escape character compilation error
fn create_escape_error(self: *Scanner, i: usize, str: []const u8) !void {
    if (i + 1 > str.len) {
        return try self.compiler.errors.append(.{
            .file = self.compiler.input,
            .kind = "scanning error",
            .msg = "unterminated escape character",
            .pos = self.current_pos
        });
    }

    const allocator = self.compiler.arena.allocator();
    const buf = try allocator.alloc(u8, 40);

    try self.compiler.errors.append(.{
        .file = self.compiler.input,
        .kind = "scanning error",
        .msg = try std.fmt.bufPrint(buf,
            "unrecognized escape character: //{}",
            .{str[i + 1]}
        ),
        .pos = self.current_pos
    });
}

test "test all scanner modules" {
    _ = Token;
    _ = tests;
}

const tests = struct {
    const testing = std.testing;
    const Pos = util.Position;

    fn compare_tokens(et: *const Token, at: *const Token) !void {
        switch (et.kind) {
            .identifier => |eide| switch (at.kind) {
                .identifier => |aide| try testing.expect(std.mem.eql(u8, eide, aide)),
                else => try testing.expectEqual(et.kind, at.kind)
            },
            .string => |estr| switch (at.kind) {
                .string => |astr| try testing.expect(std.mem.eql(u8, estr, astr)),
                else => try testing.expectEqual(et.kind, at.kind)
            },
            .character => |echr| switch (at.kind) {
                .character => |achr| try testing.expectEqual(echr, achr),
                else => try testing.expectEqual(et.kind, at.kind)
            },
            .integer => |eint| switch (at.kind) {
                .integer => |aint| try testing.expect(std.mem.eql(u8, eint, aint)),
                else => try testing.expectEqual(et.kind, at.kind)
            },
            .float => |eflo| switch (at.kind) {
                .float => |aflo| try testing.expect(std.mem.eql(u8, eflo, aflo)),
                else => try testing.expectEqual(et.kind, at.kind)
            },
            .keyword => |ekey| switch (at.kind) {
                .keyword => |akey| try testing.expectEqual(ekey, akey),
                else => try testing.expectEqual(et.kind, at.kind)
            },
            .mode => |emod| switch (at.kind) {
                .mode => |amod| try testing.expectEqual(emod, amod),
                else => try testing.expectEqual(et.kind, at.kind)
            },
            else => {
                try testing.expectEqual(et.kind, at.kind);
            }
        }

        try testing.expect(std.mem.eql(u8, et.file, at.file));
        try testing.expectEqual(et.pos, at.pos);
    }

    fn check_results(s: *Scanner, e: []const Token) !void {
        var i: usize = 0;
        var tok = try s.next_token();

        while (tok.kind != .eof) {
            try compare_tokens(&e[i], &tok);
            i = i + 1;
            tok = try s.next_token();
        }

        try compare_tokens(&e[i], &tok);
        try testing.expectEqual(e.len, i + 1);
    }

    test "next token" {
        const source = "let x = 12_000 12_000.50 '\\n'";
        var stream = std.io.fixedBufferStream(source);

        const expected = [_]Token{
            Token.init(.{ .keyword = .let }, "next token", .{ .line = 1, .col = 1 }),
            Token.init(.{ .identifier = "x" }, "next token", .{ .line = 1, .col = 5 }),
            Token.init(.assign, "next token", .{ .line = 1, .col = 7 }),
            Token.init(.{ .integer = "12_000" }, "next token", .{ .line = 1, .col = 9 }),
            Token.init(.{ .float = "12_000.50" }, "next token", .{ .line = 1, .col = 16 }),
            Token.init(.{ .character = '\n' }, "next token", .{ .line = 1, .col = 26 }),
            Token.init(.eof, "next token", .{ .line = 1, .col = 30 }),
        };

        var c = try Compiler.init("next token", stream.reader().any(), null, testing.allocator);
        defer c.deinit();
        var s = Scanner.init(&c);

        try check_results(&s, &expected);
    }

    test "compound operators" {
        const source = "== != >= <= |> <| << <> >> ++ -- ** -> => .. ..= :=";
        var stream = std.io.fixedBufferStream(source);

        const expected = [_]Token{
            Token.init(.equal, "compound operators", .{ .line = 1, .col = 1 }),
            Token.init(.not_equal, "compound operators", .{ .line = 1, .col = 4 }),
            Token.init(.greater_eq, "compound operators", .{ .line = 1, .col = 7 }),
            Token.init(.lesser_eq, "compound operators", .{ .line = 1, .col = 10 }),
            Token.init(.reverse_app, "compound operators", .{ .line = 1, .col = 13 }),
            Token.init(.forward_app, "compound operators", .{ .line = 1, .col = 16 }),
            Token.init(.lshift, "compound operators", .{ .line = 1, .col = 19 }),
            Token.init(.concat, "compound operators", .{ .line = 1, .col = 22 }),
            Token.init(.rshift, "compound operators", .{ .line = 1, .col = 25 }),
            Token.init(.increment, "compound operators", .{ .line = 1, .col = 28 }),
            Token.init(.decrement, "compound operators", .{ .line = 1, .col = 31 }),
            Token.init(.square, "compound operators", .{ .line = 1, .col = 34 }),
            Token.init(.arrow, "compound operators", .{ .line = 1, .col = 37 }),
            Token.init(.wide_arrow, "compound operators", .{ .line = 1, .col = 40 }),
            Token.init(.range_exc, "compound operators", .{ .line = 1, .col = 43 }),
            Token.init(.range_inc, "compound operators", .{ .line = 1, .col = 46 }),
            Token.init(.assign_exp, "compound operators", .{ .line = 1, .col = 50 }),
            Token.init(.eof, "compound operators", .{ .line = 1, .col = 52 })
        };

        var c = try Compiler.init("compound operators", stream.reader().any(), null, testing.allocator);
        defer c.deinit();
        var s = Scanner.init(&c);

        try check_results(&s, &expected);
    }

    test "string reading" {
        const source = "let x = \"Hello, world!\"";
        var stream = std.io.fixedBufferStream(source);

        const expected = [_]Token{
            Token.init(.{ .keyword = .let }, "string reading", .{ .line = 1, .col = 1 }),
            Token.init(.{ .identifier = "x" }, "string reading", .{ .line = 1, .col = 5 }),
            Token.init(.assign, "string reading", .{ .line = 1, .col = 7 }),
            Token.init(.{ .string = "Hello, world!" }, "string reading", .{ .line = 1, .col = 9 }),
            Token.init(.eof, "string reading", .{ .line = 1, .col = 24 }),
        };

        var c = try Compiler.init("string reading", stream.reader().any(), null, testing.allocator);
        defer c.deinit();
        var s = Scanner.init(&c);

        try check_results(&s, &expected);
    }

    test "mulit string reading" {
        const source = \\let x = "|
                       \\         | Hello, world!
                       \\         |"
                       ;
        var stream = std.io.fixedBufferStream(source);

        const expected = [_]Token{
            Token.init(.{ .keyword = .let }, "string reading", .{ .line = 1, .col = 1 }),
            Token.init(.{ .identifier = "x" }, "string reading", .{ .line = 1, .col = 5 }),
            Token.init(.assign, "string reading", .{ .line = 1, .col = 7 }),
            Token.init(.{ .string = "\n Hello, world!\n" }, "string reading", .{ .line = 1, .col = 9 }),
            Token.init(.eof, "string reading", .{ .line = 3, .col = 12 }),
        };

        var c = try Compiler.init("string reading", stream.reader().any(), null, testing.allocator);
        defer c.deinit();
        var s = Scanner.init(&c);

        try check_results(&s, &expected);
    }

    test "escape charaters" {
        const source = "let x = \"Hello, \\n\\sworld!\"";
        var stream = std.io.fixedBufferStream(source);

        const expected = [_]Token{
            Token.init(.{ .keyword = .let }, "string reading", .{ .line = 1, .col = 1 }),
            Token.init(.{ .identifier = "x" }, "string reading", .{ .line = 1, .col = 5 }),
            Token.init(.assign, "string reading", .{ .line = 1, .col = 7 }),
            Token.init(.{ .string = "Hello, \n\\sworld!" }, "string reading", .{ .line = 1, .col = 9 }),
            Token.init(.eof, "string reading", .{ .line = 1, .col = 28 }),
        };

        var c = try Compiler.init("string reading", stream.reader().any(), null, testing.allocator);
        defer c.deinit();
        var s = Scanner.init(&c);

        try check_results(&s, &expected);
    }

    test "skip single comment" {
        const source = "let x = //12_000 12_000.50";
        var stream = std.io.fixedBufferStream(source);

        const expected = [_]Token{
            Token.init(.{ .keyword = .let }, "single comment", .{ .line = 1, .col = 1 }),
            Token.init(.{ .identifier = "x" }, "single comment", .{ .line = 1, .col = 5 }),
            Token.init(.assign, "single comment", .{ .line = 1, .col = 7 }),
            Token.init(.eof, "single comment", .{ .line = 1, .col = 27 })
        };

        var c = try Compiler.init("single comment", stream.reader().any(), null, testing.allocator);

        defer c.deinit();
        var s = Scanner.init(&c);

        try check_results(&s, &expected);
    }

    test "skip multi comment" {
        const source = \\let x = /*
                       \\12_000 12_000.50
                       \\*/
                       ;
        var stream = std.io.fixedBufferStream(source);

        const expected = [_]Token{
            Token.init(.{ .keyword = .let}, "multi comment", .{ .line = 1, .col = 1 }),
            Token.init(.{ .identifier = "x" }, "multi comment", .{ .line = 1, .col = 5 }),
            Token.init(.assign, "multi comment", .{ .line = 1, .col = 7 }),
            Token.init(.eof, "multi comment", .{ .line = 3, .col = 3 })
        };

        var c = try Compiler.init("multi comment", stream.reader().any(), null, testing.allocator);
        defer c.deinit();
        var s = Scanner.init(&c);

        try check_results(&s, &expected);
    }
};
