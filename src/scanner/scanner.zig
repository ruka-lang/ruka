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
    pub fn next_token(self: *Self) token.Token {
        self.skip_whitespace();
        self.tok_pos = self.cur_pos;

        const byte = self.read();
        const tok = switch(byte) {
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

        // Iterate until self.read() is not alphanumeric
        var byte = self.read();
        while (util.is_alphanumerical(byte)) {
            self.advance(1);
            byte = self.read();
        }

        const str = self.compiler.contents[start..self.idx];

        var kind = token.Kind.try_keyword(str);
        if (kind == null) {
            kind = token.Kind.try_mode(str);

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

        var byte = self.read();
        while (util.is_numeric(byte)) {
            if (self.read() == '.') {
                self.read_integer();
                float = true;
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
};

test "test all scanner submodules" {
    _ = token;
}
