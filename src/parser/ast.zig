// @author: ruka-lang
// @created: 2024-04-13

const rukac = @import("../root.zig");
const Token = rukac.Scanner.Token;

const std = @import("std");

nodes: std.ArrayList(Node2EB),
allocator: std.mem.Allocator,

const Ast = @This();

pub const Node2EB = struct {
    tag: Identifier,
    main_token: Token,
    data: Data,

    pub const Identifier = enum {
        Unit,
        Identifier,
        Integer,
        Float,
        Boolean,
        String,
        Block,
        If,
        Match,
        FnDef,
        Closure,
        FnCall,
        MethCall,
        Prefix,
        Infix,
        Postfix,
        Binding,
        Return
    };

    pub const Data = struct {
        lhs: ?*Node2EB = null,
        rhs: ?*Node2EB = null
    };

    pub fn init(tag: Identifier, token: Token, data: Data) Node2EB {
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

pub fn new_node(self: *Ast, tag: Node2EB.Identifier, token: Token, data: Node2EB.Data) !*Node2EB {
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

        const node = try ast.new_node(.Binding, Token.init(.{ .Keyword = .Let }, "", .{}),
            .{
                .lhs = try ast.new_node(.Identifier, Token.init(.{ .Identifier = "x"}, "", .{}), .{}),
                .rhs = try ast.new_node(.Integer, Token.init(.{ .Integer = "12" }, "", .{}), .{})
            }
        );

        try testing.expect(node.data.lhs.?.main_token.kind == .Identifier);
    }
};
