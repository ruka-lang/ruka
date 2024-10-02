// @author: ruka-lang
// @created: 2024-04-13

//

const ruka = @import("../root.zig").prelude;
const Token = ruka.Token;

const std = @import("std");

root: ?*Node2EB,

allocator: std.mem.Allocator,

const Ast = @This();

///
pub const Node2EB = struct {
    tag: identifier,
    main_token: Token,
    data: Data,

    ///
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

    ///
    pub const Data = struct {
        lhs: ?*Node2EB,
        mhs: ?*Node2EB,
        rhs: ?*Node2EB,

        ///
        pub const default: Data = .{
            .lhs = null,
            .mhs = null,
            .rhs = null
        };
    };

    ///
    pub fn init(tag: identifier, token: Token, data: Data) Node2EB {
        return Node2EB {
            .tag = tag,
            .main_token = token,
            .data = data
        };
    }

    ///
    pub fn initAlloc(allocator: std.mem.Allocator, tag: identifier, token: Token, data: Data) !*Node2EB {
        var node = try allocator.create(Node2EB);

        node.tag = tag;
        node.main_token = token;
        node.data = data;

        return node;
    }

    ///
    pub fn deinit(self: Node2EB) void {
        self.main_token.deinit();
    }
};

///
pub fn init(allocator: std.mem.Allocator) Ast {
    return Ast {
        .allocator = allocator,
        .root = null
    };
}

///
pub fn deinit(self: Ast) void {
    const root = self.root;
    self.deinit_internal(root);
}

//
fn deinit_internal(self: Ast, node: ?*Node2EB) void {
    if (node) |n| {
        defer self.allocator.destroy(n);
        n.deinit();

        self.deinit_internal(n.data.lhs);
        self.deinit_internal(n.data.rhs);
    }
}

test "test all ast modules" {
    _ = tests;
}

const tests = struct {
    const testing = std.testing;

    test "ast initialization and deinitialization" {
        const alloc = std.testing.allocator;
        var ast = Ast.init(alloc);
        defer ast.deinit();

        ast.root = try Node2EB.initAlloc(ast.allocator, .binding, Token.init(.{ .keyword = .let }, "", .{}),
            .{
                .lhs = try Node2EB.initAlloc(ast.allocator, .identifier, Token.init(try .initIdentifier("x", alloc), "", .{}), .default),
                .mhs = null,
                .rhs = try Node2EB.initAlloc(ast.allocator, .integer, Token.init(try .initInteger("12", alloc), "", .{}), .default)
            }
        );

        try testing.expect(ast.root.?.data.lhs.?.main_token.kind == .identifier);
    }
};
