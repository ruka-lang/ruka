// @author: ruka-lang
// @created: 2024-04-13

///

const rukac = @import("../../root.zig");
const Scanner = rukac.Scanner;

const std = @import("std");

ast: Ast,
allocator: std.mem.Allocator,

const Parser = @This();

pub const Ast = @import("ast.zig");

///
pub fn init(allocator: std.mem.Allocator) Parser {
    return Parser {
        .allocator = allocator,
        .ast = Ast.init(allocator)
    };
}

///
pub fn deinit(self: Parser) void {
    self.ast.deinit();
}

test "idk" {
    var parser = Parser.init(std.testing.allocator);
    defer parser.deinit();
}
