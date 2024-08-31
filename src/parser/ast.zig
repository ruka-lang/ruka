// @author: ruka-lang
// @created: 2024-04-13

const rukac = @import("../root.zig");
const Token = rukac.Scanner.Token;

const std = @import("std");

nodes: std.ArrayList(Node2EB),
allocator: std.mem.Allocator,

const Ast = @This();

pub const Node2EB = struct {
    tag: enum {
        Unit,
        Tag,
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
    },
    main_token: *Token,
    data: struct {
        lhs: *Node2EB,
        rhs: *Node2EB
    },

    pub fn init() Node2EB {
        return Node2EB {
            .tag = undefined,
            .main_token = undefined,
            .data = undefined
        };
    }

    pub fn deinit(self: Node2EB, allocator: std.mem.Allocator) void {
        _ = self;
        _ = allocator;
    }
};

pub fn init(allocator: std.mem.Allocator) Ast {
    return Ast {
        .nodes = std.ArrayList(Node2EB).init(allocator),
        .allocator = allocator
    };
}

pub fn deinit(self: Ast) void {
    for (self.nodes.items) |*node| node.deinit(self.allocator);
    self.nodes.deinit();
}
