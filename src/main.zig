// @author: ruka-lang
// @created: 2024-03-04

const rukac = @import("rukac");
const interface = @import("interface/interface.zig");

const std = @import("std");

pub const std_options = rukac.logging.options;
const log = std.log.scoped(.exe);

pub fn main() !void {
    var gpa: std.heap.GeneralPurposeAllocator(.{}) = .init;
    defer _ = gpa.deinit();

    try rukac.logging.init(gpa.allocator());
    defer rukac.logging.deinit(gpa.allocator());

    log.debug("starting compiler", .{});

    try interface.handle_args(gpa.allocator());

    log.debug("shutting down compiler", .{});
}

test "Test all rukac executable modules" {
    _ = interface;
}
