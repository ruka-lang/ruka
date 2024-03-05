//
// @author: ruka-lang
// @created: 2024-03-04
//

const rukac = @import("../root.zig");
const compiler = rukac.compiler;
const util = rukac.util;

const std = @import("std");

pub const token = @import("token.zig");

///
pub const Scanner = struct {
    const Self = @This();

    cur_pos: util.Position,
    tok_pos: util.Position,
    compiler: *compiler.Compiler,
    idx: usize,

    ///
    pub fn init(comp: *compiler.Compiler) Self {
        return Self{
            .cur_pos = .{.line = 1, .col = 1},
            .tok_pos = .{.line = 1, .col = 1},
            .compiler = comp,
            .idx = 0
        };
    }

    ///
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
            // Single characters, identifiers, numbers
            else => blk: {
                if (util.is_alphabetical(byte)) {
                    self.advance(1);
                    break :blk self.new_token(token.Kind.from_byte(byte));
                } else if (util.is_integral(byte)) {
                    self.advance(1);
                    break :blk self.new_token(token.Kind.from_byte(byte));
                }

                // Single character
                self.advance(1);
                break :blk self.new_token(token.Kind.from_byte(byte));
            }
        };

        return tok;
    }

    //
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

    //
    fn read(self: *Self) u8 {
        if (self.idx >= self.compiler.contents.len) {
            return '\x00';
        }

        return self.compiler.contents[self.idx];
    }

    //
    fn peek(self: *Self) u8 {
        if (self.idx + 1 >= self.compiler.contents.len) {
            return '\x00';
        }

        return self.compiler.contents[self.idx + 1];
    }

    //
    fn prev(self: *Self) u8 {
        if (self.idx - 1 >= self.compiler.contents.len) {
            return '\x00';
        }

        return self.compiler.contents[self.idx - 1];
    }

    //
    fn new_token(self: *Self, kind: token.Kind) token.Token {
        return token.Token.init(
            kind,
            self.compiler.input,
            self.tok_pos
        );
    }

    //
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
    fn try_compound_operator(self: *Self, comptime matches: anytype) ?token.Kind {
        const contents = self.compiler.contents;
        var start: usize = undefined;
        var end: usize = undefined;
        var match: Match = undefined;

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

//
const Match = std.meta.Tuple(&.{usize, []const u8, token.Kind});

test "test all scanner submodules" {
    _ = token;
}
