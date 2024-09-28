// @author: ruka-lang
// @created: 2024-03-04

const interface = @import("interface.zig");

const std = @import("std");

pub const std_options = interface.logging.options;

pub fn main() !void {
    var gpa: std.heap.GeneralPurposeAllocator(.{}) = .init;
    defer _ = gpa.deinit();

    try interface.logging.init(gpa.allocator());
    defer interface.logging.deinit(gpa.allocator());

    try interface.start(gpa.allocator());
}

test "Test all rukac executable modules" {
    _ = interface;
}
