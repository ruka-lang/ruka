// @author: ruka-lang
// @created: 2024-03-04

const Ruka = @import("Ruka.zig");

const std = @import("std");

pub const std_options = Ruka.logging.options;

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}).init;
    defer _ = gpa.deinit();

    try Ruka.logging.init();

    var interface = try Ruka.init(gpa.allocator());
    defer interface.deinit();

    std.log.scoped(.bin).info("starting ruka", .{});

    try interface.start();
}

test "test all rukac executable modules" {
    _ = Ruka;
}
