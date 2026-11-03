const ruka = @import("../../prelude.zig");
const Position = ruka.Position;

file: []const u8,
kind: []const u8,
msg: []const u8,
pos: Position,

pub const Error = @This();
