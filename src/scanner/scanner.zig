// @author: ruka-lang
// @created: 2024-03-04

const rukac = @import("../root.zig");
const util = rukac.util;

const std = @import("std");

pub const token = @import("token.zig");

/// Scans the file it's compiler is responsible for, only scans one token at a time
pub const Scanner = struct {
    const Self = @This();

    cur_pos: util.Position,
    tok_pos: util.Position,
    compiler: *rukac.Compiler,
    idx: usize,

    /// Creates a new scanner instance
    pub fn init(comp: *rukac.Compiler) Self {
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
                    .{2, "==", token.Kind.Equal},
                });

                if (kind == null) {
                    self.advance(1);
                    kind = token.Kind.Assign;
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

    // 
    fn read_identifier_keyword_mode(self: *Self) token.Token {
        self.advance(1);
        return self.new_token(.{.Identifier = ""});
    }

    // 
    fn read_integer_float(self: *Self) token.Token {
        self.advance(1);
        return self.new_token(.{.Integer = ""});
    }

    const Match = std.meta.Tuple(&.{usize, []const u8, token.Kind});
    // Tries to create a token.Kind based on the passed in tuple of tuples
    fn try_compound_operator(self: *Self, comptime matches: anytype) ?token.Kind {
        const contents = self.compiler.contents;
        var start: usize = undefined;
        var end: usize = undefined;
        var match: Match = undefined;

        // Iterate through each passed in sub-tuple, checking if the second
        // element matches the following chars in the file, if it does
        // return the third element of the sub-tuple
        inline for (0..matches.len) |i| {
            match = matches[i];
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
