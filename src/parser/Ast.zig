// @author: ruka-lang
// @created: 2024-04-13

const std = @import("std");
const Allocator = std.mem.Allocator;
const ArrayList = std.ArrayList;

const ruka = @import("../prelude.zig");
const Position = ruka.Position;
const Token = ruka.Token;

root: ?*Node,

allocator: Allocator,

const Ast = @This();

pub const Node = struct {
    kind: Kind,
    token: Token,
    lhs: ?*Node,
    rhs: ?*Node,

    allocator: Allocator,

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
        interpet,
        @"return"
    };

    pub fn init(allocator: Allocator, kind: Kind, token: Token) !*Node {
        const node = try allocator.create(Node);

        node.* = .{
            .kind = kind,
            .token = token,
            .lhs = null,
            .rhs = null,
            .allocator = allocator
        };

        return node;
    }

    pub fn deinit(self: ?*Node) void {
        if (self) |node| {
            defer node.allocator.destroy(node);

            node.token.deinit();

            Node.deinit(node.lhs);
            Node.deinit(node.rhs);
        }
    }

    pub fn addLeft(self: *Node, kind: Kind, token: Token) !*Node {
        const node = try Node.init(self.allocator, kind, token);

        self.lhs = node;

        return node;
    }

    pub fn addRight(self: *Node, kind: Kind, token: Token) !*Node {
        const node = try Node.init(self.allocator, kind, token);

        self.rhs = node;

        return node;
    }
};

pub fn init(allocator: Allocator) !*Ast {
    const ast = try allocator.create(Ast);
    ast.* = .{
        .allocator = allocator,
        .root = null
    };

    return ast;
}

pub fn deinit(self: *Ast) void {
    Node.deinit(self.root);

    self.allocator.destroy(self);
}

pub fn initRoot(self: *Ast, node_kind: Node.Kind, token: Token) !*Node {
    const root = try Node.init(
        self.allocator,
        node_kind,
        token
    );

    self.root = root;

    return root;
}

pub fn write(self: *Ast, writer: std.io.AnyWriter) !void {
    const node = self.root orelse return error.UninitializeAst;
    try self.writeInternal(writer, node);
}

fn writeInternal(self: *Ast, writer: std.io.AnyWriter, node: *Node) !void {
    switch (node.kind) {
        .@"if" => {
            try writer.writeAll("if (");
            try self.writeInternal(writer, node.lhs.?);
            try writer.writeAll(") {\n    ");
            try self.writeInternal(writer, node.rhs.?);
            try writer.writeAll("\n}");

            if (node.rhs.?.rhs) |consequence| {
                try writer.writeAll(" else {\n    ");
                try self.writeInternal(writer, consequence);
                try writer.writeAll("\n}");
            }
        },
        .integer => {
            switch (node.token.kind) {
                .integer => |integer| {
                    try writer.writeAll(integer.items);
                },
                else => unreachable
            }
        },
        .identifier => {
            switch (node.token.kind) {
                .identifier => |identifier| {
                    try writer.writeAll(identifier.items);
                },
                else => unreachable
            }
        },
        else => return
    }
}

test "ast" {
    _ = tests;
}

const tests = struct {
    const testing = std.testing;

    test "ast initialization and deinitialization" {
        const allocator = std.testing.allocator;
        var program = try Ast.init(allocator);
        defer program.deinit();

        const keyword: Token = .init(.{ .keyword = .@"if" }, "test", .init(0, 0));
        const condition: Token = .init(try .initIdentifier("x", allocator), "test", .init(0, 0));
        const consequence: Token = .init(try .initInteger("12", allocator), "test", .init(0, 0));
        const alternative: Token = .init(try .initInteger("13", allocator), "test", .init(0, 0));

        const root = try program.initRoot(.@"if", keyword);
        _ = try root.addLeft(.identifier, condition);
        const c = try root.addRight(.integer, consequence);
        _ = try c.addRight(.integer, alternative);

        var buf: [4096]u8 = undefined;
        var stream = std.io.fixedBufferStream(&buf);
        try program.write(stream.writer().any());

        std.debug.print("{s}\n", .{buf[0..stream.pos]});
    }
};
