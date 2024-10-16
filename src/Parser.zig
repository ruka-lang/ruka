// @author: ruka-lang
// @created: 2024-04-13

const std = @import("std");
const Allocator = std.mem.Allocator;
const ArrayListUnmanaged = std.ArrayListUnmanaged;
const MultiArrayList = std.MultiArrayList;

const ruka = @import("prelude.zig");
const Error = ruka.Error;
const Scanner = ruka.Scanner;
const Token = ruka.Token;
const Unit = ruka.Unit;

current_token: Token,
peek_token: Token,

node_soa: MultiArrayList(Node),
extra_data: ArrayListUnmanaged(Index),

errors: ArrayListUnmanaged(Error),

scanner: *Scanner,
unit: *Unit,

allocator: std.mem.Allocator,

const Parser = @This();

pub const Ast = @import("parser/ast.zig");
const Index = Ast.Index;
const Node = Ast.Node;

pub fn init(unit: *Unit, scanner: *Scanner) !*Parser {
    const parser = try unit.allocator.create(Parser);
    errdefer parser.deinit();

    parser.* = .{
        .current_token = try scanner.nextToken(),
        .peek_token = try scanner.nextToken(),
        .node_soa = .{},
        .extra_data = .{},
        .errors = .{},
        .scanner = scanner,
        .unit = unit,
        .allocator = unit.allocator
    };

    return parser;
}

pub fn deinit(self: *Parser) void {
    self.current_token.deinit();
    self.peek_token.deinit();
    for (self.node_soa.items(.token)) |token| {
        if (token) |t| t.deinit();
    }
    self.node_soa.deinit(self.allocator);
    self.extra_data.deinit(self.allocator);
    self.errors.deinit(self.allocator);
    self.allocator.destroy(self);
}

fn advance(self: *Parser) !void {
    const token = self.current_token;
    defer token.deinit();

    self.current_token = self.peek_token;
    self.peek_token = try self.scanner.nextToken();
}

pub fn parse(self: *Parser) !void {
    while (self.current_token.kind != .eof) {
        switch (self.current_token.kind) {
            .keyword => |keyword| try self.parseBeginsWithKeyword(keyword),
            .mode => |mode| try self.parseBeginsWithMode(mode),
            else => {
                try self.advance();
            }
        }
    }

    //var output = ArrayList(u8).init(self.allocator);
    //defer output.deinit();

    //const writer = output.writer();

    //try writer.print("\t{s}:\n", .{self.unit.input});

    //var token = try self.scanner.nextToken();

    //while(token.kind != .eof): (token = try self.scanner.nextToken()) {
    //    try writer.print("{s}: {s}\n", .{@tagName(token.kind) , try token.kind.toStr(self.allocator)});
    //    token.deinit();
    //}

    //try writer.print("eof: \\x00\n", .{});

    //std.debug.print("{s}\n", .{output.items});
}

fn parseBeginsWithKeyword(self: *Parser, keyword: Token.Keyword) !void {
    switch (keyword) {
        .@"const", .let, .@"var" => {
            try self.createBinding();
        },
        else => {
            try self.advance();
        }
    }
}

fn parseBeginsWithMode(self: *Parser, mode: Token.Mode) !void {
    switch (mode) {
        else => {
            try self.advance();
        }
    }
}

fn createBinding(self: *Parser) !void {
    try self.node_soa.append(self.allocator, .{
        .kind = .binding,
        .token = self.current_token,
        .data = undefined
    });
    try self.advance();

    try self.node_soa.append(self.allocator, .{
        .kind = .identifier,
        .token = self.current_token,
        .data = undefined
    });

    if (self.peek_token.kind != .assign) {
    // TODO: cant do this with buffer as error message will go out of scope immediately
        const buf: [512]u8 = undefined;

        try self.errors.append(self.allocator, .{
            .kind = "parsing",
            .msg = try std.fmt.bufPrint(&buf, "Expected '=', found {s}", .{self.peek_token.kind.toStr()})
        });
    }

    try self.advance();
}

test "Parser modules" {
    _ = tests;
    _ = Ast;
}

const tests = struct {

};
