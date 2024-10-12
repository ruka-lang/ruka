// @author: ruka-lang
// @created: 2024-04-13

const libruka = @import("root.zig").prelude;
const Scanner = libruka.Scanner;

const std = @import("std");
const Allocator = std.mem.Allocator;

ast: Ast,

allocator: std.mem.Allocator,

const Parser = @This();

pub const Ast = @import("parser/Ast.zig");

pub fn init(allocator: Allocator) !*Parser {
    const parser = try allocator.create(Parser);
    errdefer parser.deinit();

    parser.* = .{
        .ast = .init(allocator),
        .allocator = allocator
    };

    return parser;
}

pub fn deinit(self: *Parser) void {
    self.ast.deinit();
    self.allocator.destroy(self);
}

test "test all parsing modules" {
    _ = tests;
    _ = Ast;
}

const tests = struct {

};
