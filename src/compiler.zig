// @author: ruka-lang
// @created: 2024-03-04

// Responsible for compiling an entire project

const rukac = @import("root.zig");
const Scanner = rukac.Scanner;
const utilities = rukac.utilities;

const std = @import("std");

const Compiler = @This();

pub const Unit = @import("compiler/unit.zig");

/// Represents an error during compilation
pub const Error = struct {
    file: []const u8,
    kind: []const u8,
    msg: []const u8,
    pos: utilities.Position
};

input: []const u8,
output: ?[]const u8,
contents: []const u8,
// ast: ?Ast,
// context: std.ArrayList(...),
errors: std.ArrayList(Error),

allocator: std.mem.Allocator,
arena: std.heap.ArenaAllocator,

pool: std.Thread.Pool,
wait_group: std.Thread.WaitGroup,

mutex: std.Thread.Mutex,
job_queue: std.fifo.LinearFifo(Job, .Dynamic),

/// Creates a new compiler instance, initializing it's arena with the passed in
/// allocator
pub fn init(
    input: []const u8,
    reader: ?std.io.AnyReader,
    output: ?[]const u8,
    allocator: std.mem.Allocator
) !*Compiler {
    const buffer_size = 5000;
    const compiler = try allocator.create(Compiler);

    var contents: []const u8 = undefined;
    if (reader != null) {
        contents = try reader.?.readAllAlloc(allocator, buffer_size);
    } else {
        var file = try std.fs.cwd().openFile(input, .{});
        defer file.close();

        contents = try file.readToEndAlloc(allocator, buffer_size);
    }

    compiler.* = .{
        .input = input,
        .output = output,
        .contents = contents,
        .errors = std.ArrayList(Error).init(allocator),

        .allocator = allocator,
        .arena = std.heap.ArenaAllocator.init(allocator),

        .pool = undefined,
        .wait_group = .{},

        .mutex = .{},
        .job_queue = std.fifo.LinearFifo(Job, .Dynamic).init(allocator)
    };

    try compiler.pool.init(.{
        .allocator = allocator,
        .n_jobs = 4
    });

    return compiler;
}

/// Deinitialize the compiler
pub fn deinit(self: *Compiler) void {
    self.wait_group.wait();
    self.pool.deinit();
    while (self.job_queue.readItem()) |job| job.deinit();
    self.job_queue.deinit();
    self.arena.deinit();
    self.errors.deinit();
    self.allocator.free(self.contents);
    self.allocator.destroy(self);
}

/// Begins the compilation process for the compilation unit
pub fn compile(self: *Compiler) !void {
    var s = Scanner.init(self);
    var t = try s.next_token();

    while(t.kind != .eof) {
        std.debug.print("{s}: {s}\n", .{@tagName(t.kind) , try t.kind.to_str(self.arena.allocator())});
        t = try s.next_token();
    }

    std.debug.print("{s}\n", .{self.contents});
}

pub const Job = union(enum) {
    pub fn deinit(self: Job) void {
        _ = self;
    }  
};
