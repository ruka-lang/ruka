const ruka = @import("root.zig").prelude;

const std = @import("std");

file: []const u8,
kind: []const u8,
msg: []const u8,
pos: ruka.Position,

const Error = @This();