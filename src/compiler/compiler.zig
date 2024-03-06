// @author: ruka-lang
// @created: 2024-03-04

const rukac = @import("../root.zig");
const util = rukac.util;

const std = @import("std");

/// Represents an error during compilation
pub const CompileError = struct {
    file: []const u8,
    kind: []const u8,
    msg: []u8,
    pos: util.Position
};

/// Responsible for compiling a given file
pub const Compiler = struct {
    input: []const u8,
    output: ?[]const u8,
    contents: []const u8,
    // ast: ?Ast,
    // context: std.ArrayList(...),
    errors: std.ArrayList(CompileError),
    arena: std.heap.ArenaAllocator,

    /// Creates a new compiler instance, initializing it's arena with the passed in 
    /// allocator
    pub fn init(input: []const u8, output: ?[]u8, allocator: std.mem.Allocator) !Compiler {
        var file = try std.fs.cwd().openFile(input, .{});
        defer file.close();

        var arena = std.heap.ArenaAllocator.init(allocator);

        const buffer_size = 5000;
        const contents = try file.readToEndAlloc(arena.allocator(), buffer_size);

        return Compiler{
            .input = input,
            .output = output,
            .contents = contents,
            .errors = std.ArrayList(CompileError).init(arena.allocator()),
            .arena = arena
        };
    }

    /// Deinitialize the compiler, freeing it's arena
    pub fn deinit(self: *Compiler) void {
        self.arena.deinit();
    }

    /// Begins the compilation process for the compilation unit
    pub fn compile(self: *Compiler) !void {
        var s = rukac.Scanner.init(self);
        var t = s.next_token();

        while(t.kind != .Eof) {
            std.debug.print("{s}\n", .{@tagName(t.kind)});
            t = s.next_token();
        }

        std.debug.print("{s}\n", .{self.contents});
    }
};
