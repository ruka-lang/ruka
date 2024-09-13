// @author: ruka-lang
// @created: 2024-03-04

const rukac = @import("rukac");
const cli = @import("cli/cli.zig");
const logging = cli.logging;

const std = @import("std");

pub const std_options = logging.options;
const log = std.log.scoped(.exe);

pub fn main() !void {
    var gpa: std.heap.GeneralPurposeAllocator(.{}) = .init;
    defer _ = gpa.deinit();

    try logging.init(gpa.allocator());
    defer logging.deinit(gpa.allocator());

    log.debug("starting compiler", .{});

    try cli.run(gpa.allocator());

    log.debug("shutting down compiler", .{});
}

test "Test all rukac executable modules" {
    _ = cli;
}
