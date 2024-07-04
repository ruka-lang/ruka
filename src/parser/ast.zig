// @author: ruka-lang
// @created: 2024-04-13

const rukac = @import("../root.zig");
const Keyword = rukac.Scanner.Token.Keyword;
const Kind = rukac.Scanner.Token.Kind;

const std = @import("std");

nodes: std.ArrayList(Node),
allocator: std.mem.Allocator,

const Ast = @This();

pub const Expression = union(enum) {
    Unit,
    Tag: []const u8,
    Integer: []const u8,
    Float: []const u8,
    Boolean: bool,
    Block: std.ArrayList(Node),
    If: struct {
        condition: *Expression,
        consequence: *Expression,
        alternative: *Expression
    },
    Match: struct {
        value: *Expression,
        cases: std.ArrayList(struct{
            condition: *Expression,
            consequence: *Expression
        })
    },
    FnDef: struct {
        name: []const u8,
        params: std.ArrayList([]const u8),
        block: *Expression,
        arity: usize
    },
    Closure: struct {
        name: []const u8,
        params: std.ArrayList([]const u8),
        block: *Expression,
        context: std.ArrayList([]const u8),
        arity: usize
    },
    FnCall: struct {
        func: *Expression,
        args: std.ArrayList(Expression)
    },
    Prefix: struct {
        operator: Kind,
        value: *Expression
    },
    Infix: struct {
        operator: Kind,
        lhs: *Expression,
        rhs: *Expression
    },
    Postfix: struct {
        operator: Kind,
        value: *Expression
    },

    pub fn deinit(self: Expression, allocator: std.mem.Allocator) void {
        switch (self) {
            .Block => |block| {
                for (block.items) |s| s.deinit(allocator);
                block.deinit();
            },
            .If => |i| {
                i.condition.deinit(allocator);
                i.consequence.deinit(allocator);
                i.alternative.deinit(allocator);

                allocator.destroy(i.condition);
                allocator.destroy(i.consequence);
                allocator.destroy(i.alternative);
            },
            .Match => |match| {
                for (match.cases.items) |c| {
                    c.consequence.deinit(allocator);
                    c.condition.deinit(allocator);

                    allocator.destroy(c.consequence);
                    allocator.destroy(c.condition);
                }
            },
            else => {}
        }
    }
};

const Node = union(enum) {
    Binding: struct {
        kind: Keyword,
        name: []const u8,
        value: Expression
    },
    Return: Expression,
    Expression: Expression,

    pub fn deinit(self: Node, allocator: std.mem.Allocator) void {
        switch (self) {
            .Binding => |binding| binding.value.deinit(allocator),
            .Return => |ret| ret.deinit(allocator),
            .Expression => |expression| expression.deinit(allocator)
        }
    }
};

pub fn init(allocator: std.mem.Allocator) Ast {
    return Ast {
        .nodes = std.ArrayList(Node).init(allocator),
        .allocator = allocator
    };
}

pub fn deinit(self: Ast) void {
    for (self.nodes.items) |node| node.deinit(self.allocator);
    self.nodes.deinit();
}
