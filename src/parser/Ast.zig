// @author: ruka-lang
// @created: 2024-04-13

const libruka = @import("../root.zig").prelude;
const Token = libruka.Token;

const std = @import("std");
const Allocator = std.mem.Allocator;
const ArrayList = std.ArrayList;

root: ?*Node,

allocator: Allocator,

const Ast = @This();

pub const Node = struct {
    tag: Identifier,
    main_token: Token,
    data: Data,

    allocator: Allocator,

    pub const Identifier = enum {
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

    pub fn init(
        allocator: Allocator,
        tag: Identifier,
        kind: Token.Kind,
        data: Data
    ) !*Node {
        const node = try allocator.create(Node);

        node.* = .{
            .tag = tag,
            .main_token = Token.init(kind, "", .{}),
            .data = data,
            .allocator = allocator
        };

        return node;
    }

    pub fn deinit(self: ?*Node) void {
        if (self) |n| {
            defer n.allocator.destroy(n);

            n.main_token.deinit();

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

    pub fn addLeft(
        self: *Node,
        tag: Identifier,
        kind: Token.Kind
    ) !*Node {
        const node = try Node.init(self.allocator, tag, kind, .default);
        
        self.data.lhs = node;

        return node;
    }

    pub fn addRight(
        self: *Node,
        tag: Identifier,
        kind: Token.Kind
    ) !*Node {
        const node = try Node.init(self.allocator, tag, kind, .default);
        
        self.data.rhs = node;

        return node;
    }

    pub fn addMiddle(
        self: *Node,
        tag: Identifier,
        kind: Token.Kind
    ) !*Node {
        const node = try Node.init(self.allocator, tag, kind, .default);
        
        self.data.mhs = node;

        return node;
    }

    pub fn createBuf(self: *Node) void {
        self.data.buf = ArrayList(*Node).init();
    }

    pub fn addToBuf(
        self: *Node,
        tag: Identifier,
        kind: Token.Kind
    ) !*Node {
        const node = try Node.init(self.allocator, tag, kind, .default);
        
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

pub fn initRoot(
    self: *Ast, 
    tag: Node.Identifier,
    kind: Token.Kind
) !*Node {
    const root = try Node.init(
        self.allocator,
        tag,
        kind,
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

        const root = try program.initRoot(.binding, .{ .keyword = .let });
        _ = try root.addLeft(.identifier, try .initIdentifier("x", allocator));
        _ = try root.addRight(.integer, try .initInteger("12", allocator));

        try testing.expect(program.root.?.data.lhs.?.main_token.kind == .identifier);
    }
};
