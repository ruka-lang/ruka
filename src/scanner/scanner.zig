// @author: ruka-lang
// @created: 2024-03-04

const rukac = @import("../root.zig");
const compiler = rukac.compiler;
const util = rukac.util;

const std = @import("std");

pub const token = @import("token.zig");

/// Scans the file it's compiler is responsible for, only scans one token at a time
pub const Scanner = struct {
    current_pos: util.Position,
    token_pos: util.Position,
    compiler: *compiler.Compiler,
    idx: usize,

    /// Creates a new scanner instance
    pub fn init(comp: *compiler.Compiler) Scanner {
        return Scanner{
            .current_pos = .{.line = 1, .col = 1},
            .token_pos = .{.line = 1, .col = 1},
            .compiler = comp,
            .idx = 0
        };
    }

    /// Returns the next token from the files, when eof is reached,
    /// will repeatedly return eof tokens
    pub fn next_token(self: *Scanner) !token.Token {
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
                    .{2, "<|", token.Kind.Forwardapp},
                    .{2, "<>", token.Kind.Concat}
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
                    .{3, "..=", token.Kind.Rangeinc},
                    .{2, "..", token.Kind.Rangeexc}
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
                    .{2, "|>", token.Kind.Reverseapp}
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
    fn new_token(self: *Scanner, kind: token.Kind) token.Token {
        return token.Token.init(
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
    fn read_identifier_keyword_mode(self: *Scanner) token.Token {
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

    // Reads a character literal from the file
    fn read_character(self: *Scanner) ?token.Token {
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
        return self.new_token(.{.Character = str[0]});
    }

    // Reads a integer or float literal from the file
    fn read_integer_float(self: *Scanner) token.Token {
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
    fn read_integer(self: *Scanner) void {
        self.advance(1);

        var byte = self.read();
        while (util.is_integral(byte)) {
            self.advance(1);
            byte = self.read();
        }
    }

    const Match = std.meta.Tuple(&.{usize, []const u8, token.Kind});
    // Tries to create a token.Kind based on the passed in tuple of tuples
    fn try_compound_operator(self: *Scanner, comptime matches: anytype) ?token.Kind {
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
    fn read_single_string(self: *Scanner) !token.Token {
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

        return self.new_token(.{.String = str});
    }

    // Reads a multi line string
    fn read_multi_string(self: *Scanner) !token.Token {
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
        return self.new_token(.{.String = str});
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
};

test "test all scanner modules" {
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
            .Identifier => |eide| switch (at.kind) {
                .Identifier => |aide| try testing.expect(std.mem.eql(u8, eide, aide)),
                else => try testing.expectEqual(et.kind, at.kind)
            },
            .String => |estr| switch (at.kind) {
                .String => |astr| try testing.expect(std.mem.eql(u8, estr, astr)),
                else => try testing.expectEqual(et.kind, at.kind)
            },
            .Character => |echr| switch (at.kind) {
                .Character => |achr| try testing.expectEqual(echr, achr),
                else => try testing.expectEqual(et.kind, at.kind)
            },
            .Integer => |eint| switch (at.kind) {
                .Integer => |aint| try testing.expect(std.mem.eql(u8, eint, aint)),
                else => try testing.expectEqual(et.kind, at.kind)
            },
            .Float => |eflo| switch (at.kind) {
                .Float => |aflo| try testing.expect(std.mem.eql(u8, eflo, aflo)),
                else => try testing.expectEqual(et.kind, at.kind)
            },
            .Keyword => |ekey| switch (at.kind) {
                .Keyword => |akey| try testing.expectEqual(ekey, akey),
                else => try testing.expectEqual(et.kind, at.kind)
            },
            .Mode => |emod| switch (at.kind) {
                .Mode => |amod| try testing.expectEqual(emod, amod),
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

        while (tok.kind != .Eof) {
            try compare_tokens(&e[i], &tok);
            i = i + 1;
            tok = try s.next_token();
        }

        try compare_tokens(&e[i], &tok);
        try testing.expectEqual(e.len, i + 1);
    }

    test "next token" {
        const source = "let x = 12_000 12_000.50 '\\n'";

        const expected = [_]Token{
            Token.init(.{.Keyword = .Let}, "next token", .{.line = 1, .col = 1}),
            Token.init(.{.Identifier = "x"}, "next token", .{.line = 1, .col = 5}),
            Token.init(.Assign, "next token", .{.line = 1, .col = 7}),
            Token.init(.{.Integer = "12_000"}, "next token", .{.line = 1, .col = 9}),
            Token.init(.{.Float = "12_000.50"}, "next token", .{.line = 1, .col = 16}),
            Token.init(.{.Character = '\n'}, "next token", .{.line = 1, .col = 26}),
            Token.init(.Eof, "next token", .{.line = 1, .col = 30}),
        };

        var c = Compiler.init_str("next token", source, testing.allocator);
        defer c.deinit();
        var s = Scanner.init(&c);

        try check_results(&s, &expected);
    }

    test "compound operators" {
        const source = "== != >= <= |> <| << <> >> ++ -- ** -> => .. ..= :=";

        const expected = [_]Token{
            Token.init(.Equal, "compound operators", .{.line = 1, .col = 1}),
            Token.init(.Notequal, "compound operators", .{.line = 1, .col = 4}),
            Token.init(.Greatereq, "compound operators", .{.line = 1, .col = 7}),
            Token.init(.Lessereq, "compound operators", .{.line = 1, .col = 10}),
            Token.init(.Reverseapp, "compound operators", .{.line = 1, .col = 13}),
            Token.init(.Forwardapp, "compound operators", .{.line = 1, .col = 16}),
            Token.init(.Lshift, "compound operators", .{.line = 1, .col = 19}),
            Token.init(.Concat, "compound operators", .{.line = 1, .col = 22}),
            Token.init(.Rshift, "compound operators", .{.line = 1, .col = 25}),
            Token.init(.Increment, "compound operators", .{.line = 1, .col = 28}),
            Token.init(.Decrement, "compound operators", .{.line = 1, .col = 31}),
            Token.init(.Square, "compound operators", .{.line = 1, .col = 34}),
            Token.init(.Arrow, "compound operators", .{.line = 1, .col = 37}),
            Token.init(.Widearrow, "compound operators", .{.line = 1, .col = 40}),
            Token.init(.Rangeexc, "compound operators", .{.line = 1, .col = 43}),
            Token.init(.Rangeinc, "compound operators", .{.line = 1, .col = 46}),
            Token.init(.Assignexp, "compound operators", .{.line = 1, .col = 50}),
            Token.init(.Eof, "compound operators", .{.line = 1, .col = 52})
        };

        var c = Compiler.init_str("compound operators", source, testing.allocator);
        defer c.deinit();
        var s = Scanner.init(&c);

        try check_results(&s, &expected);
    }

    test "string reading" {
        const source = "let x = \"Hello, world!\"";

        const expected = [_]Token{
            Token.init(.{.Keyword = .Let}, "string reading", .{.line = 1, .col = 1}),
            Token.init(.{.Identifier = "x"}, "string reading", .{.line = 1, .col = 5}),
            Token.init(.Assign, "string reading", .{.line = 1, .col = 7}),
            Token.init(.{.String = "Hello, world!"}, "string reading", .{.line = 1, .col = 9}),
            Token.init(.Eof, "string reading", .{.line = 1, .col = 24}),
        };

        var c = Compiler.init_str("string reading", source, testing.allocator);
        defer c.deinit();
        var s = Scanner.init(&c);

        try check_results(&s, &expected);
    }

    test "mulit string reading" {
        const source = \\let x = "|
                       \\         | Hello, world!
                       \\         |"
                       ;

        const expected = [_]Token{
            Token.init(.{.Keyword = .Let}, "string reading", .{.line = 1, .col = 1}),
            Token.init(.{.Identifier = "x"}, "string reading", .{.line = 1, .col = 5}),
            Token.init(.Assign, "string reading", .{.line = 1, .col = 7}),
            Token.init(.{.String = "\n Hello, world!\n"}, "string reading", .{.line = 1, .col = 9}),
            Token.init(.Eof, "string reading", .{.line = 3, .col = 12}),
        };

        var c = Compiler.init_str("string reading", source, testing.allocator);
        defer c.deinit();
        var s = Scanner.init(&c);

        try check_results(&s, &expected);
    }

    test "escape charaters" {
        const source = "let x = \"Hello, \\n\\sworld!\"";

        const expected = [_]Token{
            Token.init(.{.Keyword = .Let}, "string reading", .{.line = 1, .col = 1}),
            Token.init(.{.Identifier = "x"}, "string reading", .{.line = 1, .col = 5}),
            Token.init(.Assign, "string reading", .{.line = 1, .col = 7}),
            Token.init(.{.String = "Hello, \n\\sworld!"}, "string reading", .{.line = 1, .col = 9}),
            Token.init(.Eof, "string reading", .{.line = 1, .col = 28}),
        };

        var c = Compiler.init_str("string reading", source, testing.allocator);
        defer c.deinit();
        var s = Scanner.init(&c);

        try check_results(&s, &expected);
    }
    
    test "skip single comment" {
        const source = "let x = //12_000 12_000.50";

        const expected = [_]Token{
            Token.init(.{.Keyword = .Let}, "single comment", .{.line = 1, .col = 1}),
            Token.init(.{.Identifier = "x"}, "single comment", .{.line = 1, .col = 5}),
            Token.init(.Assign, "single comment", .{.line = 1, .col = 7}),
            Token.init(.Eof, "single comment", .{.line = 1, .col = 27})
        };

        var c = Compiler.init_str("single comment", source, testing.allocator);

        defer c.deinit();
        var s = Scanner.init(&c);

        try check_results(&s, &expected);
    }
    
    test "skip multi comment" {
        const source = \\let x = /*
                       \\12_000 12_000.50
                       \\*/ 
                       ;

        const expected = [_]Token{
            Token.init(.{.Keyword = .Let}, "multi comment", .{.line = 1, .col = 1}),
            Token.init(.{.Identifier = "x"}, "multi comment", .{.line = 1, .col = 5}),
            Token.init(.Assign, "multi comment", .{.line = 1, .col = 7}),
            Token.init(.Eof, "multi comment", .{.line = 3, .col = 4})
        };

        var c = Compiler.init_str("multi comment", source, testing.allocator);
        defer c.deinit();
        var s = Scanner.init(&c);

        try check_results(&s, &expected);
    }
};
