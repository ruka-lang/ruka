// @author: ruka-lang
// @created: 2024-03-04

const rukac = @import("root.zig");
const logging = rukac.logging;
const cli = @import("cli/cli.zig");

const std = @import("std");

const log = std.log.scoped(.exe);

pub const std_options: std.Options = .{
    .log_level = switch (@import("builtin").mode) {
        .Debug => .debug,
        else => .info
    },
    .logFn = logging.log
};

const GPA = std.heap.GeneralPurposeAllocator(.{});

pub fn main() !void {
    var gpa: GPA = .init;
    defer _ = gpa.deinit();

    try logging.setup_logs(gpa.allocator());

    log.debug("compiler started", .{});

    try cli.handle_args(gpa.allocator());
}

test "Test all rukac executable modules" {
    _ = cli;
}
