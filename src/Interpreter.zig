// @author: ruka-lang
// @created: 2024-10-12

const libruka = @import("ruka").prelude;

const std = @import("std");
const Allocator = std.mem.Allocator;

allocator: Allocator,

const Interpreter = @This();

pub fn init(allocator: Allocator) !*Interpreter {
    const interpreter = try allocator.create(Interpreter);
    errdefer interpreter.deinit();

    interpreter.* = .{
        .allocator = allocator
    };

    return interpreter;
}

pub fn deinit(self: *Interpreter) void {
    self.allocator.destroy(self);
}

test "test all interpreter modules" {
    _ = tests;
}

const tests = struct {

};
