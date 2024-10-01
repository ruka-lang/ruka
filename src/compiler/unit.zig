// @author: ruka-lang
// @created: 2024-09-25

// Responsible for compiling a given file

const ruka = @import("../root.zig").prelude;
const Compiler = ruka.Compiler;
const Scanner = ruka.Scanner;
const utilities = ruka.utilities;

const std = @import("std");

const Unit = @This();

input: []const u8,
output: ?[]const u8,
contents: []const u8,
// ast: ?Ast,
// context: std.ArrayList(...),
errors: std.ArrayList(Compiler.Error),

allocator: std.mem.Allocator,
arena: std.heap.ArenaAllocator,

/// Creates a new unit instance, initializing it's arena with the passed in
/// allocator
pub fn init(
    input: []const u8,
    reader: ?std.io.AnyReader,
    output: ?[]const u8,
    allocator: std.mem.Allocator
) !*Unit {
    const buffer_size = 5000;
    const unit = try allocator.create(Unit);

    var contents: []const u8 = undefined;
    if (reader != null) {
        contents = try reader.?.readAllAlloc(allocator, buffer_size);
    } else {
        var file = try std.fs.cwd().openFile(input, .{});
        defer file.close();

        contents = try file.readToEndAlloc(allocator, buffer_size);
    }

    unit.* = .{
        .input = input,
        .output = output,
        .contents = contents,
        .errors = std.ArrayList(Compiler.Error).init(allocator),

        .allocator = allocator,
        .arena = std.heap.ArenaAllocator.init(allocator)
    };

    return unit;
}

/// Deinitialize the unit
pub fn deinit(self: *Unit) void {
    self.arena.deinit();
    self.errors.deinit();
    self.allocator.free(self.contents);
    self.allocator.destroy(self);
}

/// Begins the compilation process for the compilation unit
pub fn compile(self: *Unit) !void {
    var s = Scanner.init(self);
    var t = try s.next_token();

    while(t.kind != .eof) {
        std.debug.print("{s}: {s}\n", .{@tagName(t.kind) , try t.kind.to_str(self.arena.allocator())});
        t = try s.next_token();
    }

    std.debug.print("{s}\n", .{self.contents});
}
