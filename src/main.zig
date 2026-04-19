const std = @import("std");

pub fn main(inits: std.process.Init) !void {
	const gpa = inits.gpa;
	const io = inits.io;

	_, _ = .{ gpa, io };

	std.debug.print("Hello, World!\n", .{});
}