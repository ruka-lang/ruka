// @author: ruka-lang
// @created: 2024-03-04

const std = @import("std");
const Allocator = std.mem.Allocator;
const ArenaAllocator = std.heap.ArenaAllocator;
const ArrayList = std.ArrayList;
const ArrayListUnmanaged = std.ArrayListUnmanaged;
const Mutex = std.Thread.Mutex;
const eql = std.mem.eql;

const ruka = @import("prelude.zig");
const Compiler = ruka.Compiler;
const Error = ruka.Error;
const Position = ruka.Position;
const Transport = ruka.Transport;

prev_char: u8,
read_char: u8,
peek_char: u8,
peep_char: u8,

file: []const u8,
current_pos: Position,
token_pos: Position,
index: usize,

transport: *Transport,
errors: ArrayListUnmanaged(Error),

allocator: Allocator,
arena: *ArenaAllocator,
mutex: *Mutex,

pub const Token = @import("scanner/Token.zig");

const Scanner = @This();

pub fn init(allocator: Allocator, arena: *ArenaAllocator, mutex: *Mutex, transport: *Transport, file: []const u8) !*Scanner {
    const scanner = try allocator.create(Scanner);

    scanner.* = .{
        .prev_char = undefined,
        .read_char = transport.readByte() catch '\x00',
        .peek_char = transport.readByte() catch '\x00',
        .peep_char = transport.readByte() catch '\x00',
        .file = file,
        .current_pos = .init(1, 1),
        .token_pos = .init(1, 1),
        .index = 0,
        .transport = transport,
        .errors = .{},
        .allocator = allocator,
        .arena = arena,
        .mutex = mutex
    };

    return scanner;
}

pub fn deinit(self: *Scanner) void {
    self.errors.deinit(self.allocator);
    self.allocator.destroy(self);
}

/// Returns the next token from the files, when eof is reached,
/// will repeatedly return eof tokens
pub fn nextToken(self: *Scanner) !Token {
    self.skipWhitespace();
    self.token_pos = self.current_pos;

    const byte = self.read();
    const token = switch(byte) {
        // Strings
        '"' => block: {
            break :block switch (self.peek()) {
                '|' => try self.readMultiString(),
                else => try self.readSingleString()
            };
        },
        // Characters and Enum Literals
        '\'' => return try self.readCharacterEnum(),
        // Comments or '/'
        '/' => block: {
            switch (self.peek()) {
                '/' => {
                    self.skipSingleComment();
                    break :block self.nextToken();
                },
                '*' => {
                    try self.skipMultiComment();
                    break :block self.nextToken();
                },
                else => {
                    self.advance(1);
                    break :block self.createToken(.slash);
                }
            }
        },
        // Operators which may be multiple characters long
        '=' => block: {
            var kind = try self.tryCompoundOperator(.{
                .{2, "=>", Token.Kind.wide_arrow},
                .{2, "==", Token.Kind.equal}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.assign;
            }

            break :block self.createToken(kind.?);
        },
        ':' => block: {
            var kind = try self.tryCompoundOperator(.{
                .{2, ":=", Token.Kind.assign_exp}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.colon;
            }

            break :block self.createToken(kind.?);
        },
        '>' => block: {
            var kind = try self.tryCompoundOperator(.{
                .{2, ">=", Token.Kind.greater_eq},
                .{2, ">>", Token.Kind.rshift}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.greater;
            }

            break :block self.createToken(kind.?);
        },
        '<' => block: {
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

            break :block self.createToken(kind.?);
        },
        '-' => block: {
            var kind = try self.tryCompoundOperator(.{
                .{2, "->", Token.Kind.arrow},
                .{2, "--", Token.Kind.decrement}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.minus;
            }

            break :block self.createToken(kind.?);
        },
        '+' => block: {
            var kind = try self.tryCompoundOperator(.{
                .{2, "++", Token.Kind.increment}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.plus;
            }

            break :block self.createToken(kind.?);
        },
        '*' => block: {
            var kind = try self.tryCompoundOperator(.{
                .{2, "**", Token.Kind.square}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.asterisk;
            }

            break :block self.createToken(kind.?);
        },
        '.' => block: {
            var kind = try self.tryCompoundOperator(.{
                .{3, "..=", Token.Kind.range_inc},
                .{2, "..", Token.Kind.range_exc}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.dot;
            }

            break :block self.createToken(kind.?);
        },
        '!' => block: {
            var kind = try self.tryCompoundOperator(.{
                .{2, "!=", Token.Kind.not_equal}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.bang;
            }

            break :block self.createToken(kind.?);
        },
        '|' => block: {
            var kind = try self.tryCompoundOperator(.{
                .{2, "|>", Token.Kind.reverse_app}
            });

            if (kind == null) {
                self.advance(1);
                kind = Token.Kind.pipe;
            }

            break :block self.createToken(kind.?);
        },
        '\x00' => self.createToken(Token.Kind.eof),
        // Single characters, identifiers, keywords, modes, numbers
        else => block: {
            if (ruka.isAlphabetical(byte)) {
                break :block try self.readIdentifierKeywordMode();
            } else if (ruka.isIntegral(byte)) {
                break :block try self.readIntegerFloat();
            }

            // Single character
            self.advance(1);
            break :block self.createToken(Token.Kind.fromByte(byte));
        }
    };

    return token;
}

fn read(self: Scanner) u8 {
    return self.read_char;
}

fn peek(self: Scanner) u8 {
    return self.peek_char;
}

fn peep(self: Scanner) u8 {
    return self.peep_char;
}

fn prev(self: Scanner) u8 {
    return self.prev_char;
}

fn advance(self: *Scanner, count: usize) void {
    for (0..count) |_| {
        self.prev_char = self.read_char;
        self.read_char = self.peek_char;
        self.peek_char = self.peep_char;
        self.peep_char = self.transport.readByte() catch '\x00';

        self.index = self.index + 1;

        self.current_pos.col = self.current_pos.col + 1;
        if (self.prev() == '\n') {
            self.current_pos.line = self.current_pos.line + 1;
            self.current_pos.col = 1;
        }
    }
}


fn createToken(self: *Scanner, kind: Token.Kind) Token {
    return Token.init(
        kind,
        self.file,
        self.token_pos
    );
}

fn createError(self: *Scanner, msg: []const u8) !void {
    try self.errors.append(self.allocator, .{
        .file = self.file,
        .kind = "scanner",
        .msg = msg,
        .pos = self.current_pos
    });
}

fn createEscapeError(self: *Scanner, i: usize, slice: []const u8) !void {
    if (i + 1 > slice.len) {
        return try self.createError("unterminated escape character");
    }

    self.mutex.lock();
    defer self.mutex.unlock();

    try self.createError(try std.fmt.allocPrint(self.arena.allocator(),
        "unrecognized escape character: //{}",
        .{slice[i + 1]}
    ));
}

fn skipWhitespace(self: *Scanner) void {
    switch (self.read()) {
        inline ' ', '\t' => {
            self.advance(1);
            self.skipWhitespace();
        },
        else => {}
    }
}

fn skipSingleComment(self: *Scanner) void {
    switch (self.read()) {
        '\n', '\x00' => {},
        else => {
            self.advance(1);
            self.skipSingleComment();
        }
    }
}

fn skipMultiComment(self: *Scanner) !void {
    var next = self.peek();

    while (self.read() != '\x00'): (next = self.peek()) {
        if (self.read() == '*' and next == '/') {
            self.advance(2);
            break;
        }

        self.advance(1);
    }

    if (next != '/') {
        try self.createError("unterminated multiline comment");
    }
}

fn readCharacterEnum(self: *Scanner) !Token {
    var string = ArrayList(u8).init(self.allocator);
    errdefer string.deinit();

    if (self.peep() != '\'' and self.peek() != '\\') {
        // A character follows the forms "'a'" where a is any single character
        // or "'\a'" where a can be any one or more characters.
        // Therefor without advancing we can tell wether this is a char literal or enum literal
        // which is a '\'' followed by a identifier
        return try self.readEnumLiteral();
    }

    while (self.peek() != '\'' and self.peek() != '\x00') {
        try string.append(self.peek());
        self.advance(1);
    }

    string = try self.handleEscapeCharacters(
        try string.toOwnedSlice(),
        self.allocator
    );

    if (string.items.len > 1) {
        try self.createError("too many characters in character literal");
    } else if (string.items.len < 1) {
        try self.createError("character literal is empty");
    }

    self.advance(2);
    return self.createToken(.{ .character = string });
}

fn readEnumLiteral(self: *Scanner) !Token {
    var string = ArrayList(u8).init(self.allocator);
    errdefer string.deinit();

    self.advance(1);
    var byte = self.read();
    while (ruka.isAlphanumerical(byte)) {
        try string.append(byte);
        self.advance(1);
        byte = self.read();
    }

    return self.createToken(.{ .@"enum" = string });
}

const Match = std.meta.Tuple(&.{usize, []const u8, Token.Kind});
// Tries to create a token.Kind based on the passed in tuple of tuples
fn tryCompoundOperator(self: *Scanner, comptime matches: anytype) !?Token.Kind {
    var string = ArrayList(u8).init(self.allocator);
    defer string.deinit();

    try string.append(self.read());
    try string.append(self.peek());

    // Iterate through each passed in sub-tuple, checking if the second
    // element matches the following chars in the file, if it does
    // return the third element of the sub-tuple
    inline for (matches) |match| {
        if (match[0] == 3) {
            try string.append(self.peep());
        }

        if (eql(u8, string.items[0..match[1].len], match[1])) {
            self.advance(match[0]);
            return match[2];
        }
    }

    return null;
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
fn handleEscapeCharacters(
    self: *Scanner,
    slice: [] const u8,
    allocator: Allocator
) !std.ArrayList(u8) {
    defer self.allocator.free(slice);
    var string = ArrayList(u8).init(allocator);
    errdefer string.deinit();

    var i: usize = 0;
    while (i < slice.len) {
        switch (slice[i]) {
            '\\' => {
                // Adjust to check for hex and unicode escape characters
                const esc_ch = tryEscapeChar(slice[i..i+2]);

                if (esc_ch) |esc| {
                    i = i + 2;
                    try string.append(esc);
                } else {
                    try self.createEscapeError(i, slice);

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

fn readIdentifierKeywordMode(self: *Scanner) !Token {
    var string = ArrayList(u8).init(self.allocator);
    errdefer string.deinit();

    var byte = self.read();
    while (ruka.isAlphanumerical(byte)) {
        try string.append(byte);
        self.advance(1);
        byte = self.read();
    }

    var kind = Token.Kind.tryMode(string.items);
    if (kind) |k| {
        string.deinit();
        return self.createToken(k);
    }

    kind = Token.Kind.tryKeyword(string.items);
    if (kind) |k| {
        string.deinit();
        return self.createToken(k);
    }

    kind = .{ .identifier = string };

    return self.createToken(kind.?);
}

fn readIntegerFloat(self: *Scanner) !Token {
    var string = ArrayList(u8).init(self.allocator);
    errdefer string.deinit();

    // Iterate while self.read() is numeric, if self.read() is a '.',
    // read only integer values afterwards
    var float = false;
    var byte = self.read();
    while (ruka.isNumeric(byte)) {
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

    return self.createToken(kind);
}

fn readMantissa(self: *Scanner, string: *ArrayList(u8)) !void {
    self.advance(1);

    var byte = self.read();

    if (!ruka.isIntegral(byte)) {
        try string.append('0');
        return;
    }

    while (ruka.isIntegral(byte)) {
        try string.append(byte);
        self.advance(1);
        byte = self.read();
    }
}

fn readSingleString(self: *Scanner) !Token {
    var string = ArrayList(u8).init(self.allocator);
    errdefer string.deinit();

    while (self.peek() != '"' and self.peek() != '\x00') {
        try string.append(self.peek());
        self.advance(1);
    }

    self.advance(2);

    if (self.prev() != '"') {
        try self.createError("unterminated string literal");
    }

    string = try self.handleEscapeCharacters(
        try string.toOwnedSlice(),
        self.allocator
    );
    return self.createToken(.{ .string = string });
}

fn readMultiString(self: *Scanner) !Token {
    var string = ArrayList(u8).init(self.allocator);
    errdefer string.deinit();

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

    if (self.prev() != '"') {
        try self.createError("unterminated string literal");
    }

    string = try self.handleEscapeCharacters(
        try string.toOwnedSlice(),
        self.allocator
    );
    return self.createToken(.{ .string = string });
}

test "Scanner modules" {
    _ = tests;
    _ = Token;
}

const tests = struct {
    const testing = std.testing;
    const expectEqualStrings = testing.expectEqualStrings;
    const expectEqual = testing.expectEqual;

    fn compareTokens(expected_token: *const Token, actual_token: *const Token) !void {
        switch (expected_token.kind) {
            .identifier => |e_identifier| switch (actual_token.kind) {
                .identifier => |a_identifier| try expectEqualStrings(e_identifier.items, a_identifier.items),
                else => try expectEqual(expected_token.kind, actual_token.kind)
            },
            .@"enum" => |e_enum_literal| switch (actual_token.kind) {
                .@"enum" => |a_enum_literal| try expectEqualStrings(e_enum_literal.items, a_enum_literal.items),
                else => try expectEqual(expected_token.kind, actual_token.kind)
            },
            .string => |e_string| switch (actual_token.kind) {
                .string => |a_string| try expectEqualStrings(e_string.items, a_string.items),
                else => try expectEqual(expected_token.kind, actual_token.kind)
            },
            .character => |e_character| switch (actual_token.kind) {
                .character => |a_character| try expectEqualStrings(e_character.items, a_character.items),
                else => try expectEqual(expected_token.kind, actual_token.kind)
            },
            .integer => |e_integer| switch (actual_token.kind) {
                .integer => |a_integer| try expectEqualStrings(e_integer.items, a_integer.items),
                else => try expectEqual(expected_token.kind, actual_token.kind)
            },
            .float => |e_float| switch (actual_token.kind) {
                .float => |a_float| try expectEqualStrings(e_float.items, a_float.items),
                else => try expectEqual(expected_token.kind, actual_token.kind)
            },
            .keyword => |e_keyword| switch (actual_token.kind) {
                .keyword => |a_keyword| try expectEqual(e_keyword, a_keyword),
                else => try expectEqual(expected_token.kind, actual_token.kind)
            },
            .mode => |e_mode| switch (actual_token.kind) {
                .mode => |a_mode| try expectEqual(e_mode, a_mode),
                else => try expectEqual(expected_token.kind, actual_token.kind)
            },
            else => {
                try expectEqual(expected_token.kind, actual_token.kind);
            }
        }

        try expectEqualStrings(expected_token.file, actual_token.file);
        try expectEqual(expected_token.pos, actual_token.pos);
    }

    fn checkResults(scanner: *Scanner, e: []const Token) !void {
        var i: usize = 0;

        var token = try scanner.nextToken();
        while (token.kind != .eof): (token = try scanner.nextToken()) {
            try compareTokens(&e[i], &token);
            i = i + 1;
            token.deinit();
        }

        try compareTokens(&e[i], &token);
        try expectEqual(e.len, i + 1);
    }

    test "next token" {
        const source = "let x = 12_000 12_000.50 '\\n'";
        var input = std.io.fixedBufferStream(source);

        var buf: [10]u8 = undefined;
        var output = std.io.fixedBufferStream(&buf);

        var arena = std.heap.ArenaAllocator.init(testing.allocator);
        defer arena.deinit();
        const allocator = arena.allocator();

        var mutex = Mutex{};

        const transport = try Transport.init(testing.allocator, input.reader().any(), output.writer().any());
        defer transport.deinit();

        var scanner = try Scanner.init(testing.allocator, &arena, &mutex, transport, "test source");
        defer scanner.deinit();

        const expected = [_]Token{
            .init(.{ .keyword = .let }, "test source", .init(1, 1)),
            .init(try .initIdentifier("x", allocator), "test source", .init(1, 5)),
            .init(.assign, "test source", .init(1, 7)),
            .init(try .initInteger("12_000", allocator), "test source", .init(1, 9)),
            .init(try .initFloat("12_000.50", allocator), "test source", .init(1, 16)),
            .init(try .initCharacter("\n", allocator), "test source", .init(1, 26)),
            .init(.eof, "test source", .init(1, 30)),
        };

        try checkResults(scanner, &expected);
    }

    test "compound operators" {
        const source = "== != >= <= |> <| << <> >> ++ -- ** -> => .. ..= :=";
        var input = std.io.fixedBufferStream(source);

        var buf: [10]u8 = undefined;
        var output = std.io.fixedBufferStream(&buf);

        var arena = std.heap.ArenaAllocator.init(testing.allocator);
        defer arena.deinit();

        var mutex = Mutex{};

        const transport = try Transport.init(testing.allocator, input.reader().any(), output.writer().any());
        defer transport.deinit();

        var scanner = try Scanner.init(testing.allocator, &arena, &mutex, transport, "test source");
        defer scanner.deinit();

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

        try checkResults(scanner, &expected);
    }

    test "string reading" {
        const source = "let x = \"Hello, world!\"";
        var input = std.io.fixedBufferStream(source);

        var buf: [10]u8 = undefined;
        var output = std.io.fixedBufferStream(&buf);

        var arena = std.heap.ArenaAllocator.init(testing.allocator);
        defer arena.deinit();

        const allocator = arena.allocator();

        var mutex = Mutex{};

        const transport = try Transport.init(testing.allocator, input.reader().any(), output.writer().any());
        defer transport.deinit();

        var scanner = try Scanner.init(testing.allocator, &arena, &mutex, transport, "test source");
        defer scanner.deinit();

        const expected = [_]Token{
            .init(.{ .keyword = .let }, "test source", .init(1, 1)),
            .init(try .initIdentifier("x", allocator), "test source", .init(1, 5)),
            .init(.assign, "test source", .init(1, 7)),
            .init(try .initString("Hello, world!", allocator), "test source", .init(1, 9)),
            .init(.eof, "test source", .init(1, 24)),
        };

        try checkResults(scanner, &expected);
    }

    test "multi string reading" {
        const source = \\let x = "|
                       \\         | Hello, world!
                       \\         |"
                       ;
        var input = std.io.fixedBufferStream(source);

        var buf: [10]u8 = undefined;
        var output = std.io.fixedBufferStream(&buf);

        var arena = std.heap.ArenaAllocator.init(testing.allocator);
        defer arena.deinit();

        const allocator = arena.allocator();

        var mutex = Mutex{};

        const transport = try Transport.init(testing.allocator, input.reader().any(), output.writer().any());
        defer transport.deinit();

        var scanner = try Scanner.init(testing.allocator, &arena, &mutex, transport, "test source");
        defer scanner.deinit();

        const expected = [_]Token{
            .init(.{ .keyword = .let }, "test source", .init(1, 1)),
            .init(try .initIdentifier("x", allocator), "test source", .init(1, 5)),
            .init(.assign, "test source", .init(1, 7)),
            .init(try .initString("\n Hello, world!\n", allocator), "test source", .init(1, 9)),
            .init(.eof, "test source", .init(3, 12)),
        };

        try checkResults(scanner, &expected);
    }

    test "escape charaters" {
        const source = "let x = \"Hello, \\n\\sworld!\"";
        var input = std.io.fixedBufferStream(source);

        var buf: [10]u8 = undefined;
        var output = std.io.fixedBufferStream(&buf);

        var arena = std.heap.ArenaAllocator.init(testing.allocator);
        defer arena.deinit();

        const allocator = arena.allocator();

        var mutex = Mutex{};

        const transport = try Transport.init(testing.allocator, input.reader().any(), output.writer().any());
        defer transport.deinit();

        var scanner = try Scanner.init(testing.allocator, &arena, &mutex, transport, "test source");
        defer scanner.deinit();

        const expected = [_]Token{
            .init(.{ .keyword = .let }, "test source", .init(1, 1)),
            .init(try .initIdentifier("x", allocator), "test source", .init(1, 5)),
            .init(.assign, "test source", .init(1, 7)),
            .init(try .initString("Hello, \n\\sworld!", allocator), "test source", .init(1, 9)),
            .init(.eof, "test source", .init(1, 28)),
        };

        try checkResults(scanner, &expected);
    }

    test "charater literals" {
        const source = "let x = '\\n'";
        var input = std.io.fixedBufferStream(source);

        var buf: [10]u8 = undefined;
        var output = std.io.fixedBufferStream(&buf);

        var arena = std.heap.ArenaAllocator.init(testing.allocator);
        defer arena.deinit();

        const allocator = arena.allocator();

        var mutex = Mutex{};

        const transport = try Transport.init(testing.allocator, input.reader().any(), output.writer().any());
        defer transport.deinit();

        var scanner = try Scanner.init(testing.allocator, &arena, &mutex, transport, "test source");
        defer scanner.deinit();

        const expected = [_]Token{
            .init(.{ .keyword = .let }, "test source", .init(1, 1)),
            .init(try .initIdentifier("x", allocator), "test source", .init(1, 5)),
            .init(.assign, "test source", .init(1, 7)),
            .init(try .initCharacter("\n", allocator), "test source", .init(1, 9)),
            .init(.eof, "test source", .init(1, 13)),
        };

        try checkResults(scanner, &expected);
    }

    test "enum literals" {
        const source = "let x = {'b', 'a, 'hello}";
        var input = std.io.fixedBufferStream(source);

        var buf: [10]u8 = undefined;
        var output = std.io.fixedBufferStream(&buf);

        var arena = std.heap.ArenaAllocator.init(testing.allocator);
        defer arena.deinit();

        const allocator = arena.allocator();

        var mutex = Mutex{};

        const transport = try Transport.init(testing.allocator, input.reader().any(), output.writer().any());
        defer transport.deinit();

        var scanner = try Scanner.init(testing.allocator, &arena, &mutex, transport, "test source");
        defer scanner.deinit();

        const expected = [_]Token{
            .init(.{ .keyword = .let }, "test source", .init(1, 1)),
            .init(try .initIdentifier("x", allocator), "test source", .init(1, 5)),
            .init(.assign, "test source", .init(1, 7)),
            .init(.lsquirly, "test source", .init(1, 9)),
            .init(try .initCharacter("b", allocator), "test source", .init(1, 10)),
            .init(.comma, "test source", .init(1, 13)),
            .init(try .initEnum("a", allocator), "test source", .init(1, 15)),
            .init(.comma, "test source", .init(1, 17)),
            .init(try .initEnum("hello", allocator), "test source", .init(1, 19)),
            .init(.rsquirly, "test source", .init(1, 25)),
            .init(.eof, "test source", .init(1, 26)),
        };

        try checkResults(scanner, &expected);
    }

    test "read function identifier" {
        const source = "let x = hello()";
        var input = std.io.fixedBufferStream(source);

        var buf: [10]u8 = undefined;
        var output = std.io.fixedBufferStream(&buf);

        var arena = std.heap.ArenaAllocator.init(testing.allocator);
        defer arena.deinit();

        const allocator = arena.allocator();

        var mutex = Mutex{};

        const transport = try Transport.init(testing.allocator, input.reader().any(), output.writer().any());
        defer transport.deinit();

        var scanner = try Scanner.init(testing.allocator, &arena, &mutex, transport, "test source");
        defer scanner.deinit();

        const expected = [_]Token{
            .init(.{ .keyword = .let}, "test source", .init(1, 1)),
            .init(try .initIdentifier("x", allocator), "test source", .init(1, 5)),
            .init(.assign, "test source", .init(1, 7)),
            .init(try .initIdentifier("hello", allocator), "test source", .init(1, 9)),
            .init(.lparen, "test source", .init(1, 14)),
            .init(.rparen, "test source", .init(1, 15)),
            .init(.eof, "test source", .init(1, 16))
        };

        try checkResults(scanner, &expected);
    }

    test "skip single comment" {
        const source = "let x = //12_000 12_000.50";
        var input = std.io.fixedBufferStream(source);

        var buf: [10]u8 = undefined;
        var output = std.io.fixedBufferStream(&buf);

        var arena = std.heap.ArenaAllocator.init(testing.allocator);
        defer arena.deinit();

        const allocator = arena.allocator();

        var mutex = Mutex{};

        const transport = try Transport.init(testing.allocator, input.reader().any(), output.writer().any());
        defer transport.deinit();

        var scanner = try Scanner.init(testing.allocator, &arena, &mutex, transport, "test source");
        defer scanner.deinit();

        const expected = [_]Token{
            .init(.{ .keyword = .let }, "test source", .init(1, 1)),
            .init(try .initIdentifier("x", allocator), "test source", .init(1, 5)),
            .init(.assign, "test source", .init(1, 7)),
            .init(.eof, "test source", .init(1, 27))
        };

        try checkResults(scanner, &expected);
    }

    test "skip multi comment" {
        const source = \\let x = /*
                       \\12_000 12_000.50
                       \\*/
                       ;
        var input = std.io.fixedBufferStream(source);

        var buf: [10]u8 = undefined;
        var output = std.io.fixedBufferStream(&buf);

        var arena = std.heap.ArenaAllocator.init(testing.allocator);
        defer arena.deinit();

        const allocator = arena.allocator();

        var mutex = Mutex{};

        const transport = try Transport.init(testing.allocator, input.reader().any(), output.writer().any());
        defer transport.deinit();

        var scanner = try Scanner.init(testing.allocator, &arena, &mutex, transport, "test source");
        defer scanner.deinit();

        const expected = [_]Token{
            .init(.{ .keyword = .let}, "test source", .init(1, 1)),
            .init(try .initIdentifier("x", allocator), "test source", .init(1, 5)),
            .init(.assign, "test source", .init(1, 7 )),
            .init(.eof, "test source", .init(3, 3))
        };

        try checkResults(scanner, &expected);
    }
};
