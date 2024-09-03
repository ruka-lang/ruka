// @author: ruka-lang
// @created: 2024-04-13

const rukac = @import("../root.zig");
const Token = rukac.Scanner.Token;

const std = @import("std");

nodes: std.ArrayList(Node2EB),
allocator: std.mem.Allocator,

const Ast = @This();

pub const Node2EB = struct {
    tag: identifier,
    main_token: Token,
    data: Data,

    pub const identifier = enum {
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
        @"return"
    };

    pub const Data = struct {
        lhs: ?*Node2EB,
        rhs: ?*Node2EB,

        pub const default: Data = .{
            .lhs = null,
            .rhs = null
        };
    };

    pub fn init(tag: identifier, token: Token, data: Data) Node2EB {
        return Node2EB {
            .tag = tag,
            .main_token = token,
            .data = data
        };
    }

    pub fn deinit(self: Node2EB) void {
        _ = self;
    }
};

pub fn init(allocator: std.mem.Allocator) Ast {
    return Ast {
        .nodes = std.ArrayList(Node2EB).init(allocator),
        .allocator = allocator
    };
}

pub fn deinit(self: Ast) void {
    for (self.nodes.items) |*node| node.deinit();
    self.nodes.deinit();
}

pub fn new_node(self: *Ast, tag: Node2EB.identifier, token: Token, data: Node2EB.Data) !*Node2EB {
    try self.nodes.ensureUnusedCapacity(1);

    const node = Node2EB {
        .tag = tag,
        .main_token = token,
        .data = data
    };

    self.nodes.appendAssumeCapacity(node);
    return &self.nodes.items[self.nodes.items.len - 1];
}

test "test all ast modules" {
    _ = tests;
}

const tests = struct {
    const testing = std.testing;

    test "ast initialization and deinitialization" {
        var ast = Ast.init(std.testing.allocator);
        defer ast.deinit();

        const node = try ast.new_node(.binding, Token.init(.{ .keyword = .let }, "", .{}),
            .{
                .lhs = try ast.new_node(.identifier, Token.init(.{ .identifier = "x"}, "", .{}), .default),
                .rhs = try ast.new_node(.integer, Token.init(.{ .integer = "12" }, "", .{}), .default)
            }
        );

        try testing.expect(node.data.lhs.?.main_token.kind == .identifier);
    }
};
