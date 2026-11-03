const std = @import("std");
const Allocator = std.mem.Allocator;
const ArenaAllocator = std.heap.ArenaAllocator;
const ArrayList = std.ArrayList;
const Reader = std.io.Reader;

const ruka = @import("../prelude.zig");
const Error = ruka.Error;
const Position = ruka.Position;
const Predicates = ruka.Predicates;

prev_byte: u8,
read_byte: u8,
peek_byte: u8,
peep_byte: u8,

file: []const u8,
current_position: Position,
token_position: Position,
index: usize,

reader: *Reader,
errors: ArrayList(Error),

gpa: Allocator,
arean: *ArenaAllocator,

pub const Token = @import("Scanner/Token.zig");

const Scanner = @This();

pub fn init(
    gpa: Allocator,
    arena: *ArenaAllocator,
    reader: *Reader,
    file: []const u8
) !*Scanner {
    _ = gpa;
    _ = arena;
    _ = reader;
    _ = file;
}
