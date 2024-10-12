// @author: ruka-lang
// @created: 2024-04-13

const libruka = @import("root.zig").prelude;
const Scanner = libruka.Scanner;

const std = @import("std");
const Allocator = std.mem.Allocator;

scanner: *Scanner,
ast: *Ast,

allocator: std.mem.Allocator,

const Parser = @This();

pub const Ast = @import("parser/Ast.zig");

pub fn init(allocator: Allocator, scanner: *Scanner) !*Parser {
    const parser = try allocator.create(Parser);
    errdefer parser.deinit();

    parser.* = .{
        .scanner = scanner,
        .ast = try .init(allocator),
        .allocator = allocator
    };

    return parser;
}

pub fn parse(self: *Parser) !*Ast {
    return self.ast;
}

pub fn deinit(self: *Parser) void {
    self.allocator.destroy(self);
}

test "test all parsing modules" {
    _ = tests;
    _ = Ast;
}

const tests = struct {

};
