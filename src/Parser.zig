// @author: ruka-lang
// @created: 2024-04-13

const std = @import("std");
const Allocator = std.mem.Allocator;
const ArenaAllocator = std.heap.ArenaAllocator;
const ArrayListUnmanaged = std.ArrayListUnmanaged;

const ruka = @import("prelude.zig");
const Error = ruka.Error;
const Scanner = ruka.Scanner;
const Token = ruka.Token;
const Transport = ruka.Transport;

current_token: ?Token,
peek_token: ?Token,

ast: *Ast,
errors: ArrayListUnmanaged(Error),

file: []const u8,
scanner: *Scanner,

allocator: Allocator,
arena: *ArenaAllocator,

const Parser = @This();

pub const Ast = @import("parser/Ast.zig");
const Index = Ast.Index;
const Node = Ast.Node;

pub fn init(allocator: Allocator, arena: *ArenaAllocator, transport: *Transport, file: []const u8) !*Parser {
    const parser = try allocator.create(Parser);
    errdefer parser.deinit();

    parser.* = .{
        .current_token = null,
        .peek_token = null,
        .ast = try .init(allocator),
        .errors = .{},
        .file = file,
        .scanner = try .init(allocator, arena, transport, file),
        .allocator = allocator,
        .arena = arena
    };

    return parser;
}

pub fn deinit(self: *Parser) void {
    self.scanner.deinit();
    self.errors.deinit(self.allocator);
    self.allocator.destroy(self);
}

fn advance(self: *Parser) !void {
    const token = self.current_token;
    errdefer if (token) |t| t.deinit();

    self.current_token = self.peek_token orelse try self.scanner.nextToken();
    self.peek_token = try self.scanner.nextToken();
}

fn discard(self: *Parser) !void {
    if (self.current_token) |token| token.deinit();

    self.current_token = self.peek_token orelse try self.scanner.nextToken();
    self.peek_token = try self.scanner.nextToken();
}

pub fn parse(self: *Parser) !*Ast {
    errdefer {
        self.ast.deinit();
        self.allocator.destroy(self.ast);
    }

    try self.advance();

    while (self.current_token.?.kind != .eof) {
        switch (self.current_token.?.kind) {
            .keyword => |keyword| try self.parseBeginsWithKeyword(keyword),
            .mode => |mode| try self.parseBeginsWithMode(mode),
            else => {
                try self.discard();
            }
        }
    }

    self.current_token = null;
    self.peek_token = null;

    try self.errors.appendSlice(self.allocator, self.scanner.errors.items);

    return self.ast;
}

fn parseBeginsWithKeyword(self: *Parser, keyword: Token.Keyword) !void {
    switch (keyword) {
        .@"const", .let, .@"var" => {
            try self.createBinding();
        },
        else => {
            try self.discard();
        }
    }
}

fn parseBeginsWithMode(self: *Parser, mode: Token.Mode) !void {
    switch (mode) {
        else => {
            try self.discard();
        }
    }
}

fn createBinding(self: *Parser) !void {
    try self.ast.append(.{
        .kind = .binding,
        .token = self.current_token.?,
        .data = undefined
    });
    try self.advance();

    try self.ast.append(.{
        .kind = .identifier,
        .token = self.current_token.?,
        .data = undefined
    });

    if (self.peek_token.?.kind != .assign) {
        try self.createError(try std.fmt.allocPrint(
            self.arena.allocator(), 
            "Expected '=', found {s}", 
            .{self.peek_token.?.kind.toStr()}
        ));
    }

    try self.advance();
}

pub fn createError(self: *Parser, msg: []const u8) !void {
    try self.errors.append(self.allocator, .{
        .file = self.file,
        .kind = "parser",
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
