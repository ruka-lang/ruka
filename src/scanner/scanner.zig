// @author: ruka-lang
// @created: 2024-03-04

const rukac = @import("../root.zig");
const compiler = rukac.compiler;
const util = rukac.util;

const std = @import("std");

pub const token = @import("token.zig");

/// Scans the file it's compiler is responsible for, only scans one token at a time
pub const Scanner = struct {
    const Self = @This();

    cur_pos: util.Position,
    tok_pos: util.Position,
    compiler: *compiler.Compiler,
    idx: usize,

    /// Creates a new scanner instance
    pub fn init(comp: *compiler.Compiler) Self {
        return Self{
            .cur_pos = .{.line = 1, .col = 1},
            .tok_pos = .{.line = 1, .col = 1},
            .compiler = comp,
            .idx = 0
        };
    }

    /// Returns the next token from the files, when eof is reached,
    /// will repeatedly return eof tokens
    pub fn next_token(self: *Self) !token.Token {
        self.skip_whitespace();
        self.tok_pos = self.cur_pos;

        const byte = self.read();
        const tok = switch(byte) {
            // Strings
            '"' => blk: {
                break :blk switch (self.peek()) {
                    '|' => try self.read_multi_string(),
                    else => try self.read_single_string()
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
                        break :blk self.new_token(.Slash);
                    }
                }
            },
            // Operators which may be multiple characters long
            '=' => blk: {
                var kind = self.try_compound_operator(.{
                    .{2, "=>", token.Kind.Widearrow},
                    .{2, "==", token.Kind.Equal}
                });

                if (kind == null) {
                    self.advance(1);
                    kind = token.Kind.Assign;
                }

                break :blk self.new_token(kind.?);
            },
            ':' => blk: {
                var kind = self.try_compound_operator(.{
                    .{2, ":=", token.Kind.Assignexp}
                });

                if (kind == null) {
                    self.advance(1);
                    kind = token.Kind.Colon;
                }

                break :blk self.new_token(kind.?);
            },
            '>' => blk: {
                var kind = self.try_compound_operator(.{
                    .{2, ">=", token.Kind.Greatereq},
                    .{2, ">>", token.Kind.Rshift}
                });

                if (kind == null) {
                    self.advance(1);
                    kind = token.Kind.Greater;
                }

                break :blk self.new_token(kind.?);
            },
            '<' => blk: {
                var kind = self.try_compound_operator(.{
                    .{2, "<=", token.Kind.Lessereq},
                    .{2, "<<", token.Kind.Lshift},
                    .{2, "<|", token.Kind.Forapp}
                });

                if (kind == null) {
                    self.advance(1);
                    kind = token.Kind.Lesser;
                }

                break :blk self.new_token(kind.?);
            },
            '-' => blk: {
                var kind = self.try_compound_operator(.{
                    .{2, "->", token.Kind.Arrow},
                    .{2, "--", token.Kind.Decrement}
                });

                if (kind == null) {
                    self.advance(1);
                    kind = token.Kind.Minus;
                }

                break :blk self.new_token(kind.?);
            },
            '+' => blk: {
                var kind = self.try_compound_operator(.{
                    .{2, "++", token.Kind.Increment}
                });

                if (kind == null) {
                    self.advance(1);
                    kind = token.Kind.Plus;
                }

                break :blk self.new_token(kind.?);
            },
            '*' => blk: {
                var kind = self.try_compound_operator(.{
                    .{2, "**", token.Kind.Square}
                });

                if (kind == null) {
                    self.advance(1);
                    kind = token.Kind.Asterisk;
                }

                break :blk self.new_token(kind.?);
            },
            '.' => blk: {
                var kind = self.try_compound_operator(.{
                    .{2, "..", token.Kind.Excrange},
                    .{3, "..=", token.Kind.Incrange}
                });

                if (kind == null) {
                    self.advance(1);
                    kind = token.Kind.Dot;
                }

                break :blk self.new_token(kind.?);
            },
            '!' => blk: {
                var kind = self.try_compound_operator(.{
                    .{2, "!=", token.Kind.Notequal}
                });

                if (kind == null) {
                    self.advance(1);
                    kind = token.Kind.Bang;
                }

                break :blk self.new_token(kind.?);
            },
            '|' => blk: {
                var kind = self.try_compound_operator(.{
                    .{2, "|>", token.Kind.Revapp}
                });

                if (kind == null) {
                    self.advance(1);
                    kind = token.Kind.Pipe;
                }

                break :blk self.new_token(kind.?);
            },
            '\x00' => self.new_token(token.Kind.Eof),
            // Single characters, identifiers, keywords, modes, numbers
            else => blk: {
                if (util.is_alphabetical(byte)) {
                    break :blk self.read_identifier_keyword_mode();
                } else if (util.is_integral(byte)) {
                    break :blk self.read_integer_float();
                }

                // Single character
                self.advance(1);
                break :blk self.new_token(token.Kind.from_byte(byte));
            }
        };

        return tok;
    }

    // Advances the scanner count number of times
    fn advance(self: *Self, count: usize) void {
        const c = std.math.clamp(count, 0, 3);

        for (0..c) |_| {
            self.idx = self.idx + 1;

            self.cur_pos.col = self.cur_pos.col + 1;
            if (self.prev() == '\n') {
                self.cur_pos.line = self.cur_pos.line + 1;
                self.cur_pos.col = 1;
            }
        }
    }

    // Returns the character at the current index
    fn read(self: *Self) u8 {
        if (self.idx >= self.compiler.contents.len) {
            return '\x00';
        }

        return self.compiler.contents[self.idx];
    }

    // Returns the character after the current index
    fn peek(self: *Self) u8 {
        if (self.idx + 1 >= self.compiler.contents.len) {
            return '\x00';
        }

        return self.compiler.contents[self.idx + 1];
    }

    // Returns the character previous to the current index
    fn prev(self: *Self) u8 {
        if (self.idx - 1 >= self.compiler.contents.len) {
            return '\x00';
        }

        return self.compiler.contents[self.idx - 1];
    }

    // Creates a new token of the kind passed in
    fn new_token(self: *Self, kind: token.Kind) token.Token {
        return token.Token.init(
            kind,
            self.compiler.input,
            self.tok_pos
        );
    }

    // Skips characters until the current character is not a space or tab
    fn skip_whitespace(self: *Self) void {
        switch (self.read()) {
            inline ' ', '\t' => {
                self.advance(1);
                self.skip_whitespace();
            },
            else => {}
        }
    }

    // Reads an identifier, keyword, or mode from the file
    fn read_identifier_keyword_mode(self: *Self) token.Token {
        const start = self.idx;

        var byte = self.read();
        while (util.is_alphanumerical(byte)) {
            self.advance(1);
            byte = self.read();
        }

        const str = self.compiler.contents[start..self.idx];

        var kind = token.Kind.try_mode(str);
        if (kind == null) {
            kind = token.Kind.try_keyword(str);

            // If str doesn't represent a keyword or mode,
            // then kind is identifier
            if (kind == null) {
                kind = .{.Identifier = str};
            }
        }

        self.advance(1);
        return self.new_token(kind.?);
    }

    // Reads a integer or float from the file
    fn read_integer_float(self: *Self) token.Token {
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
        const kind: token.Kind = switch (float) {
            false => .{.Integer = str},
            true  => .{.Float = str}
        };

        return self.new_token(kind);
    }

    // Reads only integral numbers from the file, no decimals allowed
    fn read_integer(self: *Self) void {
        self.advance(1);

        var byte = self.read();
        while (util.is_integral(byte)) {
            self.advance(1);
            byte = self.read();
        }
    }

    const Match = std.meta.Tuple(&.{usize, []const u8, token.Kind});
    // Tries to create a token.Kind based on the passed in tuple of tuples
    fn try_compound_operator(self: *Self, comptime matches: anytype) ?token.Kind {
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
    fn skip_single_comment(self: *Self) void {
        switch (self.read()) {
            '\n' | '\x00' => {},
            else => {
                self.advance(1);
                self.skip_single_comment();
            }
        }
    }

    // Skips a multi line comment
    fn skip_multi_comment(self: *Self) !void {
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
                .pos = self.cur_pos
            });
        }
    }

    // Reads a single line string
    fn read_single_string(self: *Self) !token.Token {
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
                .pos = self.cur_pos
            });
        }

        const str = try self.handle_escape_characters(self.compiler.contents[start..end]);

        return self.new_token(.{.String = str});
    }

    // Reads a multi line string
    fn read_multi_string(self: *Self) !token.Token {
        var string = std.ArrayList(u8).init(self.compiler.arena.allocator());

        self.advance(1);
        while (self.peek() != '"' and self.peek() != '\x00') {
            switch (self.peek()) {
                '\\' => {
                    self.advance(1);

                    switch (self.peek()) {
                        '|' => try string.append('|'),
                        '"' => break,
                        else => |ch| {
                            try string.append('\\');
                            try string.append(ch);
                        }
                    }
                },
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
                        '"' => break,
                        else => try self.compiler.errors.append(.{
                            .file = self.compiler.input,
                            .kind = "scanning error",
                            .msg = "missing start of line delimiter '|'",
                            .pos = self.cur_pos
                        })
                    }
                },
                else => |ch| try string.append(ch)
            }

            self.advance(1);
        }

        return self.new_token(.Illegal);
    }

    // Replaces escape characters
    fn handle_escape_characters(self: *Self, str: [] const u8) ![]const u8 {
        const allocator = self.compiler.arena.allocator();

        var new_str = try allocator.alloc(u8, str.len);
        var i: usize = 0;
        var new_i: usize = 0;

        while (i < new_str.len) {
            switch (str[i]) {
                '\\' => {
                    const esc_ch = util.try_escape_char(str[i..i+2]);

                    if (esc_ch) |esc| {
                        new_str[new_i] = esc;
                        new_i = new_i + 1;
                    } else {
                        try self.create_escape_error(i, str);
                        i = i + 1;

                        new_str[new_i] = '\\';
                        new_i = new_i + 1;
                    }
                },
                else => |ch| {
                    new_str[new_i] = ch;
                    new_i = new_i + 1;
                    i = i + 1;
                }
            }
        }

        return new_str;
    }

    // Creates an escape character compilation error
    fn create_escape_error(self: *Self, i: usize, str: []const u8) !void {
        if (i + 1 >= str.len) {
            return try self.compiler.errors.append(.{
                .file = self.compiler.input,
                .kind = "scanning error",
                .msg = "unterminated escape character",
                .pos = self.cur_pos
            });
        }

        const allocator = self.compiler.arena.allocator();
        const buf = try allocator.alloc(u8, 35);

        try self.compiler.errors.append(.{
            .file = self.compiler.input,
            .kind = "scanning error",
            .msg = try std.fmt.bufPrint(buf,
                "unrecognized escape character: //{}",
                .{str[i + 1]}
                ),
            .pos = self.cur_pos
        });
    }
};

test "test all scanner [sub]modules" {
    _ = token;
    _ = tests;
}

const tests = struct {
    const testing = std.testing;
    const Token = token.Token;
    const Pos = util.Position;
    const Compiler = compiler.Compiler;

    fn compare_tokens(et: *const token.Token, at: *const token.Token) !void {
        switch (et.kind) {
            .Identifier => |eide| {
                switch (at.kind) {
                    .Identifier => |aide| {
                        try testing.expect(std.mem.eql(u8, eide, aide));
                    },
                    else => try testing.expect(false)
                }
            },
            .String => |estr| {
                switch (at.kind) {
                    .String => |astr| {
                        try testing.expect(std.mem.eql(u8, estr, astr));
                    },
                    else => try testing.expect(false)
                }
            },
            .Integer => |eint| {
                switch (at.kind) {
                    .Integer => |aint| {
                        try testing.expect(std.mem.eql(u8, eint, aint));
                    },
                    else => try testing.expect(false)
                }
            },
            .Float => |eflo| {
                switch (at.kind) {
                    .Float => |aflo| {
                        try testing.expect(std.mem.eql(u8, eflo, aflo));
                    },
                    else => try testing.expect(false)
                }
            },
            .Keyword => |ekey| {
                switch (at.kind) {
                    .Keyword => |akey| {
                        try testing.expectEqual(ekey, akey);
                    },
                    else => try testing.expect(false)
                }
            },
            .Mode => |emod| {
                switch (at.kind) {
                    .Mode => |amod| {
                        try testing.expectEqual(emod, amod);
                    },
                    else => try testing.expect(false)
                }
            },
            else => {
                try testing.expectEqual(et.*, at.*);
            }
        }

        try testing.expect(std.mem.eql(u8, et.file, at.file));
        try testing.expectEqual(et.pos, at.pos);
    }

    fn check_results(s: *Scanner, e: []const Token) !void {
        var i: usize = 0;
        var tok = try s.next_token();

        while (tok.kind != .Eof) {
            try compare_tokens(&e[i], &tok);
            i = i + 1;
            tok = try s.next_token();
        }

        try compare_tokens(&e[i], &tok);
        try testing.expectEqual(e.len, i + 1);
    }

    test "next_token" {
        const source = "let x = 12_000 12_000.50";

        const expected = [_]Token{
            Token.init(.{.Keyword = .Let}, "next token", Pos{.line = 1, .col = 1}),
            Token.init(.{.Identifier = "x"}, "next token", Pos{.line = 1, .col = 5}),
            Token.init(.Assign, "next token", Pos{.line = 1, .col = 7}),
            Token.init(.{.Integer = "12_000"}, "next token", Pos{.line = 1, .col = 9}),
            Token.init(.{.Float = "12_000.50"}, "next token", Pos{.line = 1, .col = 16}),
            Token.init(.Eof, "next token", Pos{.line = 1, .col = 25}),
        };

        var c = try Compiler.init_str("next token", source, testing.allocator);
        var s = Scanner.init(&c);

        try check_results(&s, &expected);
    }
};