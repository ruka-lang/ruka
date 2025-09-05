// @author: ruka-lang
// @created: 2024-04-13

const std = @import("std");
const Allocator = std.mem.Allocator;
const ArenaAllocator = std.heap.ArenaAllocator;
const MultiArrayList = std.MultiArrayList;
const ArrayListUnmanaged = std.ArrayListUnmanaged;
const Reader = std.fs.File.Reader;

const ruka = @import("prelude.zig");
const Error = ruka.Error;
const Scanner = ruka.Scanner;
const Token = ruka.Token;

handle: std.fs.File,
buf: [1024]u8 = undefined,
reader: Reader,

current_token: ?Token,
peek_token: ?Token,
ast: *Ast,
errors: ArrayListUnmanaged(Error),

file: []const u8,
scanner: *Scanner,

gpa: Allocator,
arena: *ArenaAllocator,

const Parser = @This();

pub const Ast = struct {
    nodes: MultiArrayList(Node) = .{},
    extra_data: ArrayListUnmanaged(Index) = .{},
    gpa: Allocator,

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

        pub fn deinit(self: Node, gpa: Allocator) void {
            self.token.deinit(gpa);
        }
    };


    pub fn init(gpa: Allocator) !*Ast {
        const ast = try gpa.create(Ast);

        ast.* = .{
            .nodes = .{},
            .extra_data = .{},
            .gpa = gpa
        };

        return ast;
    }

    pub fn deinit(self: *Ast) void {
        for (self.nodes.items(.token)) |*token| {
            token.deinit(self.gpa);
        }
        self.nodes.deinit(self.gpa);
        self.extra_data.deinit(self.gpa);

        self.gpa.destroy(self);
    }

    pub fn append(self: *Ast, node: Node) !void {
        try self.nodes.append(self.gpa, node);
    }
};

pub fn init(
    gpa: Allocator,
    arena: *ArenaAllocator,
    file: []const u8
) !*Parser {
    const parser = try gpa.create(Parser);
    errdefer parser.deinit();

    var src = try std.fs.cwd().openDir("src", .{});
    defer src.close();
    const input = try src.openFile(file, .{});
    errdefer input.close();

    parser.* = .{
        .current_token = null,
        .peek_token = null,
        .ast = try .init(gpa),
        .errors = .{},
        .file = file,
        .handle = input,
        .reader = input.reader(&parser.buf),
        .scanner = try .init(gpa, arena, &parser.reader.interface, file),
        .gpa = gpa,
        .arena = arena
    };

    return parser;
}

pub fn deinit(self: *Parser) void {
    self.scanner.deinit();
    self.handle.close();
    self.errors.deinit(self.gpa);
    self.gpa.destroy(self);
}

fn advance(self: *Parser) !void {
    errdefer if (self.current_token) |*token| token.deinit(self.gpa);

    self.current_token = self.peek_token orelse try self.scanner.nextToken();
    self.peek_token = try self.scanner.nextToken();
}

fn discard(self: *Parser) !void {
    if (self.current_token) |*token| token.deinit(self.gpa);

    self.current_token = self.peek_token orelse try self.scanner.nextToken();
    self.peek_token = try self.scanner.nextToken();
}

// Caller owns returned memory
pub fn parse(self: *Parser) !*Ast {
    errdefer self.ast.deinit();

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

    try self.errors.appendSlice(self.gpa, self.scanner.errors.items);

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
    try self.errors.append(self.gpa, .{
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
