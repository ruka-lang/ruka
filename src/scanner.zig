// @author: ruka-lang
// @created: 2024-03-04

// Responsible for scanning the source file contained in the compiler which
// owns this scanner

const rukac = @import("root.zig").prelude;
const Compiler = rukac.Compiler;

const std = @import("std");

pub const Token = @import("scanner/token.zig");

const Scanner = @This();

current_pos: rukac.Position,
token_pos: rukac.Position,
index: usize,

prev_char: u8,
read_char: u8,
peek_char: u8,
peep_char: ?u8,

compiler: *Compiler,

allocator: std.mem.Allocator,

/// Creates a new scanner instance
pub fn init(compiler: *Compiler) Scanner {
    return Scanner{
        .current_pos = .{.line = 1, .col = 1},
        .token_pos = .{.line = 1, .col = 1},
        .index = 0,

        .prev_char = undefined,
        .read_char = compiler.transport.readByte() catch '\x00',
        .peek_char = compiler.transport.readByte() catch '\x00',
        .peep_char = null,

        .compiler = compiler,

        .allocator = compiler.arena.allocator()
    };
}

/// Returns the next token from the files, when eof is reached,
/// will repeatedly return eof tokens
pub fn nextToken(self: *Scanner) !Token {
    self.skipWhitespace();
    self.token_pos = self.current_pos;

    const byte = self.read();
    const token = switch(byte) {
        // Strings
        '"' => blk: {
            break :blk switch (self.peek()) {
                '|' => try self.readMultiString(),
                else => try self.readSingleString()
            };
        },
        // Characters
        '\'' => {
            return try self.readCharacter() orelse blk: {
                self.advance(1);
                break :blk self.nextToken();
            };
        },
        // Comments or '/'
        '/' => blk: {
            switch (self.peek()) {
                '/' => {
                    self.skipSingleComment();
                    break :blk self.nextToken();
                },
                '*' => {
                    try self.skipMultiComment();
                    break :blk self.nextToken();
                },
                else => {
                    self.advance(1);
                    break :blk self.newToken(.slash);
                }
            }
        },
        // Operators which may be multiple characters long
        '=' => blk: {
            var kind = try self.tryCompoundOperator(.{
                .{2, "=>", Token.Kind.wide_arrow},
                .{2, "==", Token.Kind.equal}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.assign;
            }

            break :blk self.newToken(kind.?);
        },
        ':' => blk: {
            var kind = try self.tryCompoundOperator(.{
                .{2, ":=", Token.Kind.assign_exp}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.colon;
            }

            break :blk self.newToken(kind.?);
        },
        '>' => blk: {
            var kind = try self.tryCompoundOperator(.{
                .{2, ">=", Token.Kind.greater_eq},
                .{2, ">>", Token.Kind.rshift}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.greater;
            }

            break :blk self.newToken(kind.?);
        },
        '<' => blk: {
            var kind = try self.tryCompoundOperator(.{
                .{2, "<=", Token.Kind.lesser_eq},
                .{2, "<<", Token.Kind.lshift},
                .{2, "<|", Token.Kind.forward_app},
                .{2, "<>", Token.Kind.concat}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.lesser;
            }

            break :blk self.newToken(kind.?);
        },
        '-' => blk: {
            var kind = try self.tryCompoundOperator(.{
                .{2, "->", Token.Kind.arrow},
                .{2, "--", Token.Kind.decrement}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.minus;
            }

            break :blk self.newToken(kind.?);
        },
        '+' => blk: {
            var kind = try self.tryCompoundOperator(.{
                .{2, "++", Token.Kind.increment}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.plus;
            }

            break :blk self.newToken(kind.?);
        },
        '*' => blk: {
            var kind = try self.tryCompoundOperator(.{
                .{2, "**", Token.Kind.square}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.asterisk;
            }

            break :blk self.newToken(kind.?);
        },
        '.' => blk: {
            var kind = try self.tryCompoundOperator(.{
                .{3, "..=", Token.Kind.range_inc},
                .{2, "..", Token.Kind.range_exc}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.dot;
            }

            break :blk self.newToken(kind.?);
        },
        '!' => blk: {
            var kind = try self.tryCompoundOperator(.{
                .{2, "!=", Token.Kind.not_equal}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.bang;
            }

            break :blk self.newToken(kind.?);
        },
        '|' => blk: {
            var kind = try self.tryCompoundOperator(.{
                .{2, "|>", Token.Kind.reverse_app}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.pipe;
            }

            break :blk self.newToken(kind.?);
        },
        '\x00' => self.newToken(Token.Kind.eof),
        // Single characters, identifiers, keywords, modes, numbers
        else => blk: {
            if (rukac.isAlphabetical(byte)) {
                break :blk try self.readIdentifierKeywordMode();
            } else if (rukac.isIntegral(byte)) {
                break :blk try self.readIntegerFloat();
            }

            // Single character
            self.advance(1);
            break :blk self.newToken(Token.Kind.fromByte(byte));
        }
    };

    return token;
}

// Advances the scanner count number of times
fn advance(self: *Scanner, count: usize) void {
    for (0..count) |_| {
        if (self.peep_char) |peep| {
            self.prev_char = self.read_char;
            self.read_char = self.peek_char;
            self.peek_char = peep;
            self.peep_char = null;
        } else {
            self.prev_char = self.read_char;
            self.read_char = self.peek_char;
            self.peek_char = self.compiler.transport.readByte() catch '\x00';
        }

        self.index = self.index + 1;

        self.current_pos.col = self.current_pos.col + 1;
        if (self.prev() == '\n') {
            self.current_pos.line = self.current_pos.line + 1;
            self.current_pos.col = 1;
        }
    }
}

// Returns the character at the current index
fn read(self: *Scanner) u8 {
    return self.read_char;
}

// Returns the character after the current index
fn peek(self: *Scanner) u8 {
    return self.peek_char;
}

// Returns the character previous to the current index
fn prev(self: *Scanner) u8 {
    return self.prev_char;
}

// Creates a new token of the kind passed in
fn newToken(self: *Scanner, kind: Token.Kind) Token {
    return Token.init(
        kind,
        self.compiler.input,
        self.token_pos
    );
}

// Skips characters until the current character is not a space or tab
fn skipWhitespace(self: *Scanner) void {
    switch (self.read()) {
        inline ' ', '\t' => {
            self.advance(1);
            self.skipWhitespace();
        },
        else => {}
    }
}

// Reads an identifier, keyword, or mode literal from the file
fn readIdentifierKeywordMode(self: *Scanner) !Token {
    var string = std.ArrayList(u8).init(self.allocator);

    var byte = self.read();
    while (rukac.isAlphanumerical(byte)) {
        try string.append(byte);
        self.advance(1);
        byte = self.read();
    }

    var is_identifier = false;
    var kind = Token.Kind.tryMode(string.items);
    if (kind == null) {
        kind = Token.Kind.tryKeyword(string.items);

        // If string doesn't represent a keyword or mode,
        // then kind is identifier
        if (kind == null) {
            kind = .{ .identifier = string };
            is_identifier = true;
        }    
    }
    
    if (!is_identifier) string.deinit();

    return self.newToken(kind.?);
}

// Reads a character literal from the file
fn readCharacter(self: *Scanner) !?Token {
    var string = std.ArrayList(u8).init(self.allocator);
    defer string.deinit();

    // Iterate until the final delimiter or EOF is reached
    while (self.peek() != '\'' and self.peek() != '\x00') {
        try string.append(self.peek());
        self.advance(1);
    }

    // Check if character literal contains a escape character
    string = try self.handleEscapeCharacters(string.items);

    // Create errors if string length isn't 1
    if (string.items.len > 1) {
        try self.createError("too many characters in character literal");
    } else if (string.items.len < 1) {
        try self.createError("character literal is empty");
    }

    self.advance(2);
    return self.newToken(.{ .character = string.items[0] });
}

// Reads a integer or float literal from the file
fn readIntegerFloat(self: *Scanner) !Token {
    var string = std.ArrayList(u8).init(self.allocator);
    var float = false;

    // Iterate while self.read() is numeric, if self.read() is a '.',
    // read only integer values afterwards
    var byte = self.read();
    while (rukac.isNumeric(byte)) {
        if (byte == '.') {
            try string.append(byte);
            try self.readMantissa(&string);
            float = true;
            break;
        }

        try string.append(byte);
        self.advance(1);
        byte = self.read();
    }

    const kind: Token.Kind = switch (float) {
        false => .{ .integer = string },
        true  => .{ .float = string }
    };

    return self.newToken(kind);
}

// Reads only integral numbers from the file, no decimals allowed
fn readMantissa(self: *Scanner, string: *std.ArrayList(u8)) !void {
    self.advance(1);

    var byte = self.read();

    if (!rukac.isIntegral(byte)) {
        try string.append('0');
        return;
    }

    while (rukac.isIntegral(byte)) {
        try string.append(byte);
        self.advance(1);
        byte = self.read();
    }
}

const Match = std.meta.Tuple(&.{usize, []const u8, Token.Kind});
// Tries to create a token.Kind based on the passed in tuple of tuples
fn tryCompoundOperator(self: *Scanner, comptime matches: anytype) !?Token.Kind {
    var string = std.ArrayList(u8).init(self.allocator);
    defer string.deinit();
    try string.append(self.read());
    try string.append(self.peek());

    // Iterate through each passed in sub-tuple, checking if the second
    // element matches the following chars in the file, if it does
    // return the third element of the sub-tuple
    inline for (matches) |match| {
        if (match[0] == 3) {
            self.peep_char = try self.compiler.transport.readByte(); 
            try string.append(self.peep_char.?);
        }

        if (std.mem.eql(u8, string.items[0..match[1].len], match[1])) {
            self.advance(match[0]);
            return match[2];
        }
    }

    return null;
}

// Skips a single line comment
fn skipSingleComment(self: *Scanner) void {
    switch (self.read()) {
        '\n', '\x00' => {},
        else => {
            self.advance(1);
            self.skipSingleComment();
        }
    }
}

// Skips a multi line comment
fn skipMultiComment(self: *Scanner) !void {
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
        try self.createError("unterminated multiline comment");
    }
}

// Reads a single line string
fn readSingleString(self: *Scanner) !Token {
    var string = std.ArrayList(u8).init(self.allocator);

    while (self.peek() != '"' and self.peek() != '\x00') {
        try string.append(self.peek());
        self.advance(1);
    }

    self.advance(2);

    if (self.prev() != '"') try self.createError("unterminated string literal");

    string = try self.handleEscapeCharacters(string.items);
    return self.newToken(.{ .string = string });
}

// Reads a multi line string
fn readMultiString(self: *Scanner) !Token {
    var string = std.ArrayList(u8).init(self.allocator);

    self.advance(1);
    while (self.peek() != '"' and self.peek() != '\x00') {
        switch (self.peek()) {
            '\n' => {
                try string.append('\n');
                self.advance(2);
                self.skipWhitespace();

                switch (self.read()) {
                    '|' => {
                        switch (self.peek()) {
                            '"' => break,
                            else => |ch| try string.append(ch)
                        }
                    },
                    else => try self.createError("missing start of line delimiter '|'")
                }
            },
            else => |ch| try string.append(ch)
        }

        self.advance(1);
    }

    self.advance(2);

    if (self.prev() != '"') try self.createError("unterminated string literal");

    string = try self.handleEscapeCharacters(string.items);
    return self.newToken(.{ .string = string });
}

/// Checks if a string represents an escape character, if it does return that character
fn tryEscapeChar(str: []const u8) ?u8 {
    // Check for \u{xxxxxx} and \x{xx}
    return escapes.get(str);
}

// Map representing escape sequences and their string representation
const escapes = std.StaticStringMap(u8).initComptime(.{
    .{"\\n", '\n'},
    .{"\\r", '\r'},
    .{"\\t", '\t'},
    .{"\\\\", '\\'},
    .{"\\|", '|'},
    .{"\\'", '\''},
    .{"\\\"", '"'},
    .{"\\0", '\x00'}
});

// Replaces escape characters
// TODO make this more efficient
fn handleEscapeCharacters(self: *Scanner, str: [] const u8) !std.ArrayList(u8) {
    var string = std.ArrayList(u8).init(self.allocator);

    var i: usize = 0;
    while (i < str.len) {
        switch (str[i]) {
            '\\' => {
                // Adjust to check for hex and unicode escape characters
                const esc_ch = tryEscapeChar(str[i..i+2]);

                if (esc_ch) |esc| {
                    i = i + 2;
                    try string.append(esc);
                } else {
                    try self.createEscapeError(i, string.items);

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

    return string;
}

fn createError(self: *Scanner, msg: []const u8) !void {
    try self.compiler.createError(self, "scanner error", msg);
}

// Creates an escape character compilation error
fn createEscapeError(self: *Scanner, i: usize, string: []const u8) !void {
    if (i + 1 > string.len) {
        return try self.createError("unterminated escape character");
    }

    var buf = [_]u8{0} ** 40;
    try self.createError(try std.fmt.bufPrint(&buf,
        "unrecognized escape character: //{}",
        .{string[i + 1]}
    ));
}

test "test all scanner modules" {
    _ = Token;
    _ = tests;
}

const tests = struct {
    const testing = std.testing;

    fn compareTokens(et: *const Token, at: *const Token) !void {
        switch (et.kind) {
            .identifier => |eide| switch (at.kind) {
                .identifier => |aide| try testing.expect(std.mem.eql(u8, eide.items, aide.items)),
                else => try testing.expectEqual(et.kind, at.kind)
            },
            .string => |estr| switch (at.kind) {
                .string => |astr| try testing.expect(std.mem.eql(u8, estr.items, astr.items)),
                else => try testing.expectEqual(et.kind, at.kind)
            },
            .character => |echr| switch (at.kind) {
                .character => |achr| try testing.expectEqual(echr, achr),
                else => try testing.expectEqual(et.kind, at.kind)
            },
            .integer => |eint| switch (at.kind) {
                .integer => |aint| try testing.expect(std.mem.eql(u8, eint.items, aint.items)),
                else => try testing.expectEqual(et.kind, at.kind)
            },
            .float => |eflo| switch (at.kind) {
                .float => |aflo| try testing.expect(std.mem.eql(u8, eflo.items, aflo.items)),
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

    fn checkResults(scanner: *Scanner, e: []const Token) !void {
        var i: usize = 0;
        var token = try scanner.nextToken();

        while (token.kind != .eof) {
            try compareTokens(&e[i], &token);
            i = i + 1;
            token = try scanner.nextToken();
        }

        try compareTokens(&e[i], &token);
        try testing.expectEqual(e.len, i + 1);
    }

    test "next token" {
        const source = "let x = 12_000 12_000.50 '\\n'";
        var input = std.io.fixedBufferStream(source);

        var buf: [10]u8 = undefined;
        var output = std.io.fixedBufferStream(&buf);

        var compiler = try Compiler.init(.testing(input.reader().any(), output.writer().any()));
        defer compiler.deinit();
        var scanner = Scanner.init(compiler);

        const allocator = compiler.arena.allocator();

        const expected = [_]Token{
            .init(.{ .keyword = .let }, "test source", .init(1, 1)),
            .init(try .initIdentifier("x", allocator), "test source", .init(1, 5)),
            .init(.assign, "test source", .init(1, 7)),
            .init(try .initInteger("12_000", allocator), "test source", .init(1, 9)),
            .init(try .initFloat("12_000.50", allocator), "test source", .init(1, 16)),
            .init(.{ .character = '\n' }, "test source", .init(1, 26)),
            .init(.eof, "test source", .init(1, 30)),
        };

        try checkResults(&scanner, &expected);
    }

    test "compound operators" {
        const source = "== != >= <= |> <| << <> >> ++ -- ** -> => .. ..= :=";
        var input = std.io.fixedBufferStream(source);

        var buf: [10]u8 = undefined;
        var output = std.io.fixedBufferStream(&buf);

        var compiler = try Compiler.init(.testing(input.reader().any(), output.writer().any()));
        defer compiler.deinit();
        var scanner = Scanner.init(compiler);

        const expected = [_]Token{
            .init(.equal, "test source", .init(1, 1)),
            .init(.not_equal, "test source", .init(1, 4)),
            .init(.greater_eq, "test source", .init(1, 7)),
            .init(.lesser_eq, "test source", .init(1, 10)),
            .init(.reverse_app, "test source", .init(1, 13)),
            .init(.forward_app, "test source", .init(1, 16)),
            .init(.lshift, "test source", .init(1, 19)),
            .init(.concat, "test source", .init(1, 22)),
            .init(.rshift, "test source", .init(1, 25)),
            .init(.increment, "test source", .init(1, 28)),
            .init(.decrement, "test source", .init(1, 31)),
            .init(.square, "test source", .init(1, 34)),
            .init(.arrow, "test source", .init(1, 37)),
            .init(.wide_arrow, "test source", .init(1, 40)),
            .init(.range_exc, "test source", .init(1, 43)),
            .init(.range_inc, "test source", .init(1, 46)),
            .init(.assign_exp, "test source", .init(1, 50)),
            .init(.eof, "test source", .init(1, 52))
        };

        try checkResults(&scanner, &expected);
    }

    test "string reading" {
        const source = "let x = \"Hello, world!\"";
        var input = std.io.fixedBufferStream(source);

        var buf: [10]u8 = undefined;
        var output = std.io.fixedBufferStream(&buf);

        var compiler = try Compiler.init(.testing(input.reader().any(), output.writer().any()));
        defer compiler.deinit();
        var scanner = Scanner.init(compiler);

        const allocator = compiler.arena.allocator();

        const expected = [_]Token{
            .init(.{ .keyword = .let }, "test source", .init(1, 1)),
            .init(try .initIdentifier("x", allocator), "test source", .init(1, 5)),
            .init(.assign, "test source", .init(1, 7)),
            .init(try .initString("Hello, world!", allocator), "test source", .init(1, 9)),
            .init(.eof, "test source", .init(1, 24)),
        };

        try checkResults(&scanner, &expected);
    }

    test "multi string reading" {
        const source = \\let x = "|
                       \\         | Hello, world!
                       \\         |"
                       ;
        var input = std.io.fixedBufferStream(source);

        var buf: [10]u8 = undefined;
        var output = std.io.fixedBufferStream(&buf);

        var compiler = try Compiler.init(.testing(input.reader().any(), output.writer().any()));
        defer compiler.deinit();
        var scanner = Scanner.init(compiler);

        const allocator = compiler.arena.allocator();

        const expected = [_]Token{
            .init(.{ .keyword = .let }, "test source", .init(1, 1)),
            .init(try .initIdentifier("x", allocator), "test source", .init(1, 5)),
            .init(.assign, "test source", .init(1, 7)),
            .init(try .initString("\n Hello, world!\n", allocator), "test source", .init(1, 9)),
            .init(.eof, "test source", .init(3, 12)),
        };

        try checkResults(&scanner, &expected);
    }

    test "escape charaters" {
        const source = "let x = \"Hello, \\n\\sworld!\"";
        var input = std.io.fixedBufferStream(source);

        var buf: [10]u8 = undefined;
        var output = std.io.fixedBufferStream(&buf);

        var compiler = try Compiler.init(.testing(input.reader().any(), output.writer().any()));
        defer compiler.deinit();
        var scanner = Scanner.init(compiler);

        const allocator = compiler.arena.allocator();

        const expected = [_]Token{
            .init(.{ .keyword = .let }, "test source", .init(1, 1)),
            .init(try .initIdentifier("x", allocator), "test source", .init(1, 5)),
            .init(.assign, "test source", .init(1, 7)),
            .init(try .initString("Hello, \n\\sworld!", allocator), "test source", .init(1, 9)),
            .init(.eof, "test source", .init(1, 28)),
        };

        try checkResults(&scanner, &expected);
    }

    test "read function identifier" {
        const source = "let x = hello()";
        var input = std.io.fixedBufferStream(source);

        var buf: [10]u8 = undefined;
        var output = std.io.fixedBufferStream(&buf);

        var compiler = try Compiler.init(.testing(input.reader().any(), output.writer().any()));
        defer compiler.deinit();
        var scanner = Scanner.init(compiler);

        const allocator = compiler.arena.allocator();

        const expected = [_]Token{
            .init(.{ .keyword = .let}, "test source", .init(1, 1)),
            .init(try .initIdentifier("x", allocator), "test source", .init(1, 5)),
            .init(.assign, "test source", .init(1, 7)),
            .init(try .initIdentifier("hello", allocator), "test source", .init(1, 9)),
            .init(.lparen, "test source", .init(1, 14)),
            .init(.rparen, "test source", .init(1, 15)),
            .init(.eof, "test source", .init(1, 16))
        };

        try checkResults(&scanner, &expected);
    }

    test "skip single comment" {
        const source = "let x = //12_000 12_000.50";
        var input = std.io.fixedBufferStream(source);

        var buf: [10]u8 = undefined;
        var output = std.io.fixedBufferStream(&buf);

        var compiler = try Compiler.init(.testing(input.reader().any(), output.writer().any()));
        defer compiler.deinit();
        var scanner = Scanner.init(compiler);

        const allocator = compiler.arena.allocator();

        const expected = [_]Token{
            .init(.{ .keyword = .let }, "test source", .init(1, 1)),
            .init(try .initIdentifier("x", allocator), "test source", .init(1, 5)),
            .init(.assign, "test source", .init(1, 7)),
            .init(.eof, "test source", .init(1, 27))
        };

        try checkResults(&scanner, &expected);
    }

    test "skip multi comment" {
        const source = \\let x = /*
                       \\12_000 12_000.50
                       \\*/
                       ;
        var input = std.io.fixedBufferStream(source);

        var buf: [10]u8 = undefined;
        var output = std.io.fixedBufferStream(&buf);

        var compiler = try Compiler.init(.testing(input.reader().any(), output.writer().any()));
        defer compiler.deinit();
        var scanner = Scanner.init(compiler);

        const allocator = compiler.arena.allocator();

        const expected = [_]Token{
            .init(.{ .keyword = .let}, "test source", .init(1, 1)),
            .init(try .initIdentifier("x", allocator), "test source", .init(1, 5)),
            .init(.assign, "test source", .init(1, 7 )),
            .init(.eof, "test source", .init(3, 3))
        };

        try checkResults(&scanner, &expected);
    }
};
