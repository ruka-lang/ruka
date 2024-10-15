// @author: ruka-lang
// @created: 2024-04-13

const std = @import("std");
const Allocator = std.mem.Allocator;
const ArrayList = std.ArrayList;

const ruka = @import("prelude.zig");
const Scanner = ruka.Scanner;
const Unit = ruka.Unit;

scanner: *Scanner,
unit: *Unit,

allocator: std.mem.Allocator,

const Parser = @This();

pub const Ast = @import("parser/Ast.zig");

pub fn init(unit: *Unit, scanner: *Scanner) !*Parser {
    const parser = try unit.allocator.create(Parser);
    errdefer parser.deinit();

    parser.* = .{
        .unit = unit,
        .scanner = scanner,
        .allocator = unit.allocator
    };

    return parser;
}

pub fn deinit(self: *Parser) void {
    self.allocator.destroy(self);
}


pub fn parse(self: *Parser) !*Ast {
    const ast = try Ast.init(self.allocator);
    errdefer ast.deinit();

    var output = ArrayList(u8).init(self.allocator);
    defer output.deinit();

    const writer = output.writer();

    try writer.print("\t{s}:\n", .{self.unit.input});

    var token = try self.scanner.nextToken();

    while(token.kind != .eof): (token = try self.scanner.nextToken()) {
        try writer.print("{s}: {s}\n", .{@tagName(token.kind) , try token.kind.toStr(self.allocator)});
        token.deinit();
    }

    try writer.print("eof: \\x00\n", .{});

    std.debug.print("{s}\n", .{output.items});

    return ast;
}

test "parser modules" {
    _ = tests;
    _ = Ast;
}

const tests = struct {

};
