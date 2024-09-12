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

    try rukac.logging.setup_logs(gpa.allocator());

    log.debug("compiler started", .{});

    try interface.handle_args(gpa.allocator());
}

test "Test all rukac executable modules" {
    _ = interface;
}
