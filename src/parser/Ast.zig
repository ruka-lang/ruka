// @author: ruka-lang
// @created: 2024-04-13

const std = @import("std");

const ruka = @import("../prelude.zig");
const Token = ruka.Token;

pub const Index = u32;
pub const Node = struct {
    kind: Kind,
    token: ?Token,

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

    pub fn deinit(self: Node) void {
        if (self.token) |token| token.deinit();
    }
};

//pub fn write(self: *Ast, writer: std.io.AnyWriter) !void {
//    const node = self.root;
//    try self.writeInternal(writer, node);
//}

//fn writeInternal(self: *Ast, writer: std.io.AnyWriter, node: *Node) !void {
//    switch (node.kind) {
//        .@"if" => {
//            try writer.writeAll("if (");
//            try self.writeInternal(writer, node.lhs.?);
//            try writer.writeAll(") {\n    ");
//            try self.writeInternal(writer, node.rhs.?);
//            try writer.writeAll("\n}");
//
//            if (node.rhs.?.rhs) |consequence| {
//                try writer.writeAll(" else {\n    ");
//                try self.writeInternal(writer, consequence);
//                try writer.writeAll("\n}");
//            }
//        },
//        .integer => {
//            switch (node.token.?.kind) {
//                .integer => |integer| {
//                    try writer.writeAll(integer.items);
//                },
//                else => unreachable
//            }
//        },
//        .identifier => {
//            switch (node.token.?.kind) {
//                .identifier => |identifier| {
//                    try writer.writeAll(identifier.items);
//                },
//                else => unreachable
//            }
//        },
//        else => return
//    }
//}
