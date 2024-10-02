// @author: ruka-lang
// @created: 2024-03-04

const Interface = @import("interface.zig");

const std = @import("std");

pub const std_options = Interface.logging.options;

pub fn main() !void {
    var interface = try Interface.init();
    defer interface.deinit();

    std.log.scoped(.bin).info("starting ruka", .{});

    try interface.begin();
}

test "Test all rukac executable modules" {
    _ = Interface;
}
