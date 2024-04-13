// @author: ruka-lang
// @created: 2024-04-13

const rukac = @import("../root.zig");
const Keyword = rukac.Scanner.Token.Keyword;
const Kind = rukac.Scanner.Token.Kind;

const std = @import("std");

nodes: std.ArrayList(Node),
allocator: std.mem.Allocator,

const Ast = @This();

const Expression = union(enum) {
    unit,
    @"tag": []const u8,
    integer: []const u8,
    float: []const u8,
    boolean: bool,
    block: std.ArrayList(Node),
    @"if": struct {
        condition: Expression,
        consequence: Expression,
        alternative: Expression
    },
    match: struct {
        value: Expression,
        cases: std.ArrayList(struct{
            condition: Expression,
            consequence: Expression
        })
    },
    @"fn": struct {
        name: []const u8,
        params: std.ArrayList([]const u8),
        block: Expression,
        arity: usize
    },
    closure: struct {
        name: []const u8,
        params: std.ArrayList([]const u8),
        block: Expression,
        context: std.ArrayList([]const u8),
        arity: usize
    },
    fnCall: struct {
        func: Expression,
        args: std.ArrayList(Expression)
    },
    prefix: struct {
        operator: Kind,
        value: Expression
    },
    infix: struct {
        operator: Kind,
        lhs: Expression,
        rhs: Expression
    },
    postfix: struct {
        operator: Kind,
        value: Expression
    }
};

const Node = union(enum) {
    binding: struct {
        kind: Keyword,
        name: []const u8,
        value: Expression
    },
    @"return": Expression,
    expression: Expression
};
