// @author: ruka-lang
// @created: 2024-04-13

const std = @import("std");
const Allocator = std.mem.Allocator;
const ArenaAllocator = std.heap.ArenaAllocator;
const MultiArrayList = std.MultiArrayList;
const ArrayListUnmanaged = std.ArrayListUnmanaged;

const ruka = @import("prelude.zig");
const Error = ruka.Error;
const Scanner = ruka.Scanner;
const Token = ruka.Token;
const Transport = ruka.Transport;

current_token: ?Token,
peek_token: ?Token,

nodes: MultiArrayList(Node),
extra_data: ArrayListUnmanaged(Index),
errors: ArrayListUnmanaged(Error),

file: []const u8,
scanner: *Scanner,

allocator: Allocator,
arena: *ArenaAllocator,

const Parser = @This();

pub const Index = u32;
pub const Node = struct {
    kind: Kind,
    token: Token,

    data: struct {
        lhs: Index,
        rhs: Index,
    },

    pub const Kind = enum {
        unit,
        identifier,
        integer,
        float,
        boolean,
        string,
        block,
        @"if",
        match,
        fn_def,
        closure,
        fn_call,
        meth_call,
        prefix,
        infix,
        postfix,
        binding,
        @"type",
        module,
        interpet,
        @"return"
    };

    pub fn init(kind: Kind, token: Token) Node {
        return .{
            .kind = kind,
            .token = token,
            .data = undefined
        };
    }

    pub fn deinit(self: Node, _: Allocator) void {
        self.token.deinit();
    }
};

pub const Ast = struct {
    nodes: MultiArrayList(Node).Slice,
    extra_data: []Index
};

pub fn init(allocator: Allocator, arena: *ArenaAllocator, transport: *Transport, file: []const u8) !*Parser {
    const parser = try allocator.create(Parser);
    errdefer parser.deinit();

    parser.* = .{
        .current_token = null,
        .peek_token = null,
        .nodes = .{},
        .extra_data = .{},
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
    for (self.nodes.items(.token)) |token| {
        token.deinit();
    }
    self.nodes.deinit(self.allocator);
    self.extra_data.deinit(self.allocator);
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

pub fn parse(self: *Parser) !Ast {
    errdefer {
        for (self.nodes.items(.token)) |token| {
            token.deinit();
        }
        self.nodes.deinit(self.allocator);
        self.extra_data.deinit(self.allocator);
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

    return .{
        .nodes = self.nodes.toOwnedSlice(),
        .extra_data = try self.extra_data.toOwnedSlice(self.allocator)
    };
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

fn appendAst(self: *Parser, node: Node) !void {
    try self.nodes.append(self.allocator, node);
}

fn createBinding(self: *Parser) !void {
    try self.appendAst(.{
        .kind = .binding,
        .token = self.current_token.?,
        .data = undefined
    });
    try self.advance();

    try self.appendAst(.{
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

test "parser modules" {
    _ = tests;
}

const tests = struct {

};
