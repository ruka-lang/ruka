// @author: ruka-lang
// @created: 2024-03-04

const rukac = @import("rukac");
const interface = @import("interface.zig");
const logging = interface.logging;

const std = @import("std");

pub const std_options = logging.options;
const log = std.log.scoped(.exe);

pub fn main() !void {
    var gpa: std.heap.GeneralPurposeAllocator(.{}) = .init;
    defer _ = gpa.deinit();

    try logging.init(gpa.allocator());
    defer logging.deinit(gpa.allocator());

    log.debug("starting compiler", .{});

    try interface.handle_args(gpa.allocator());

    log.debug("shutting down compiler", .{});
}

test "Test all rukac executable modules" {
    _ = interface;
}
