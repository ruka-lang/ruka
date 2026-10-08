// @author: ruka-lang
// @created: 2024-10-12

const std = @import("std");
const Allocator = std.mem.Allocator;

const ruka = @import("prelude.zig");

gpa: Allocator,

const Interpreter = @This();

pub fn init(gpa: Allocator) !*Interpreter {
    const interpreter = try gpa.create(Interpreter);
    errdefer interpreter.deinit();

    interpreter.* = .{
        .gpa = gpa
    };

    return interpreter;
}

pub fn deinit(self: *Interpreter) void {
    self.gpa.destroy(self);
}

test "interpreter modules" {
    _ = tests;
}

const tests = struct {

};
