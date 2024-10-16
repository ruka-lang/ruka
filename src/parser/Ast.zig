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

test "ast" {
    _ = tests;
}

const tests = struct {
    //const testing = std.testing;

    //test "ast initialization and deinitialization" {
    //    const allocator = std.testing.allocator;

    //    const keyword: Token = .init(.{ .keyword = .@"if" }, "test", .init(0, 0));
    //    const condition: Token = .init(try .initIdentifier("x", allocator), "test", .init(0, 0));
    //    const consequence: Token = .init(try .initInteger("12", allocator), "test", .init(0, 0));
    //    const alternative: Token = .init(try .initInteger("13", allocator), "test", .init(0, 0));

    //    const root = try allocator.create(Node);
    //    root.* = .{
    //        .kind = .@"if",
    //        .token = keyword,
    //        .rhs = null,
    //        .lhs = null,
    //        .allocator = allocator
    //    };

    //    _ = try root.addLeft(.identifier, condition);
    //    const c = try root.addRight(.integer, consequence);
    //    _ = try c.addRight(.integer, alternative);

    //    var buf: [4096]u8 = undefined;
    //    var stream = std.io.fixedBufferStream(&buf);
    //    try program.write(stream.writer().any());

    //    std.debug.print("{s}\n", .{buf[0..stream.pos]});
    //}
};
