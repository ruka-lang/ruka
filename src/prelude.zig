const std = @import("std");
const testing = std.testing;

const tests = struct {
	test "this does stuff" {
		try testing.expect(12 == 12);
	}
};

test "ruka modules" {
	_ = tests;
}
