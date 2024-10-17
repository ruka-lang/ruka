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

ast: *Ast,

errors: ArrayListUnmanaged(Error),

scanner: *Scanner,
unit: *Unit,

allocator: std.mem.Allocator,

const Parser = @This();

pub const Ast = @import("parser/Ast.zig");
const Index = Ast.Index;
const Node = Ast.Node;

pub fn init(unit: *Unit, scanner: *Scanner, allocator: Allocator) !*Parser {
    const parser = try allocator.create(Parser);
    errdefer parser.deinit();

    parser.* = .{
        .current_token = try scanner.nextToken(),
        .peek_token = try scanner.nextToken(),
        .ast = undefined,
        .errors = .{},
        .scanner = scanner,
        .unit = unit,
        .allocator = allocator
    };

    return parser;
}

pub fn deinit(self: *Parser) void {
    self.current_token.deinit();
    self.peek_token.deinit();
    self.errors.deinit(self.allocator);
    self.allocator.destroy(self);
}

fn advance(self: *Parser) !void {
    const token = self.current_token;
    defer token.deinit();

    self.current_token = self.peek_token;
    self.peek_token = try self.scanner.nextToken();
}

pub fn parse(self: *Parser) !*Ast {
    self.ast = try .init(self.allocator);
    errdefer {
        self.ast.deinit();
        self.allocator.destroy(self.ast);
    }

    while (self.current_token.kind != .eof) {
        switch (self.current_token.kind) {
            .keyword => |keyword| try self.parseBeginsWithKeyword(keyword),
            .mode => |mode| try self.parseBeginsWithMode(mode),
            else => {
                try self.advance();
            }
        }
    }

    return self.ast;
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
    try self.ast.append(.{
        .kind = .binding,
        //.token = self.current_token,
        .token = undefined,
        .data = undefined
    });
    try self.advance();

    try self.ast.append(.{
        .kind = .identifier,
        //.token = self.current_token,
        .token = undefined,
        .data = undefined
    });

    if (self.peek_token.kind != .assign) {
        // TODO: cant do this with buffer as error message will go out of scope immediately
        var buf: [512]u8 = undefined;

        try self.createError("parsing", 
            try std.fmt.bufPrint(&buf, "Expected '=', found {s}", .{
                self.peek_token.kind.toStr()
            })
        );
    }

    try self.advance();
}

pub fn createError(self: *Parser, kind: []const u8, msg: []const u8) !void {
    try self.errors.append(self.allocator, .{
        .file = self.unit.input,
        .kind = kind,
        .msg = msg,
        .pos = self.scanner.current_pos
    });
}

test "Parser modules" {
    _ = tests;
    _ = Ast;
}

const tests = struct {

};
