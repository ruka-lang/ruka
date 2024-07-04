// @author: ruka-lang
// @created: 2024-04-13

const rukac = @import("../root.zig");
const Scanner = rukac.Scanner;

const std = @import("std");

const Parser = @This();

pub const Ast = @import("ast.zig");

test "idk" {
    var ast = Ast.init(std.testing.allocator);
    try ast.nodes.append(.{ 
        .Binding = .{
            .kind = .Let,
            .name = "x",
            .value = .{ .Integer = "12" }
        }
    });

    var t = std.StringHashMap(Ast).init(std.testing.allocator);
    defer t.deinit();

    try t.put("let x = 12", ast);

    var iter = t.iterator();
    while (iter.next()) |e| {
        defer e.value_ptr.deinit();
    }
}
