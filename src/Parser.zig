// @author: ruka-lang
// @created: 2024-04-13

const ruka = @import("root.zig").prelude;
const Scanner = ruka.Scanner;

const std = @import("std");
const Allocator = std.mem.Allocator;

ast: Ast,

allocator: std.mem.Allocator,

const Parser = @This();

pub const Ast = @import("parser/Ast.zig");

pub fn init(allocator: Allocator) Parser {
    return Parser {
        .ast = .init(allocator),
        .allocator = allocator
    };
}

pub fn deinit(self: Parser) void {
    self.ast.deinit();
}

test "test all parsing modules" {
    _ = tests;
    _ = Ast;
}

const tests = struct {

};
