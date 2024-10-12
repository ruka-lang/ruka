// @author: ruka-lang
// @created: 2024-04-13

const libruka = @import("../root.zig").prelude;
const Position = libruka.Position;
const Token = libruka.Token;

const std = @import("std");
const Allocator = std.mem.Allocator;
const ArrayList = std.ArrayList;

root: ?*Node,

allocator: Allocator,

const Ast = @This();

pub const Node = struct {
    kind: Kind,
    token: Token,
    data: Data,

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
        @"return"
    };

    pub const Data = struct {
        lhs: ?*Node,
        mhs: ?*Node,
        rhs: ?*Node,
        buf: ?ArrayList(*Node),

        pub const default: Data = .{
            .lhs = null,
            .mhs = null,
            .rhs = null,
            .buf = null
        };
    };

    pub fn init(allocator: Allocator, kind: Kind, token: Token, data: Data) !*Node {
        const node = try allocator.create(Node);

        node.* = .{
            .kind = kind,
            .token = token,
            .data = data,
            .allocator = allocator
        };

        return node;
    }

    pub fn deinit(self: ?*Node) void {
        if (self) |n| {
            defer n.allocator.destroy(n);

            n.token.deinit();

            if (n.data.buf) |buf| {
                for (buf.items) |n2| {
                    Node.deinit(n2);
                }

                buf.deinit();
            }
            Node.deinit(n.data.lhs);
            Node.deinit(n.data.mhs);
            Node.deinit(n.data.rhs);
        }
    }

    pub fn addLeft(self: *Node, kind: Kind, token: Token) !*Node {
        const node = try Node.init(self.allocator, kind, token, .default);
        
        self.data.lhs = node;

        return node;
    }

    pub fn addRight(self: *Node, kind: Kind, token: Token) !*Node {
        const node = try Node.init(self.allocator, kind, token, .default);
        
        self.data.rhs = node;

        return node;
    }

    pub fn addMiddle(self: *Node, kind: Kind, token: Token) !*Node {
        const node = try Node.init(self.allocator, kind, token, .default);
        
        self.data.mhs = node;

        return node;
    }

    pub fn createBuf(self: *Node) void {
        self.data.buf = ArrayList(*Node).init();
    }

    pub fn addToBuf(self: *Node, kind: Kind, token: Token) !*Node {
        const node = try Node.init(self.allocator, kind, token, .default);
        
        try self.data.buf.?.append(node);

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
    const root = self.root;
    Node.deinit(root);

    self.allocator.destroy(self);
}

pub fn initRoot(self: *Ast, node_kind: Node.Kind, token: Token) !*Node {
    const root = try Node.init(
        self.allocator,
        node_kind,
        token,
        .default
    );

    self.root = root;

    return root;
}

test "test all ast modules" {
    _ = tests;
}

const tests = struct {
    const testing = std.testing;

    test "ast initialization and deinitialization" {
        const allocator = std.testing.allocator;
        var program = try Ast.init(allocator);
        defer program.deinit();

        const keyword: Token = .init(.{ .keyword = .let }, "test", .init(0, 0));
        const identifier: Token = .init(try .initIdentifier("x", allocator), "test", .init(0, 4));
        const integer: Token = .init(try .initInteger("12", allocator), "test", .init(0, 8));

        const root = try program.initRoot(.binding, keyword);
        _ = try root.addLeft(.identifier, identifier);
        _ = try root.addRight(.integer, integer);

        try testing.expect(program.root.?.data.lhs.?.token.kind == .identifier);
    }
};
