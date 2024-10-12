// @author: ruka-lang
// @created: 2024-03-04

const libruka = @import("root.zig").prelude;
const Error = libruka.Error;
const Scanner = libruka.Scanner;
const Transport = libruka.Transport;

const std = @import("std");
const Allocator = std.mem.Allocator;
const ArenaAllocator = std.heap.ArenaAllocator;
const ArrayList = std.ArrayList;
const Dir = std.fs.Dir;
const LinearFifo = std.fifo.LinearFifo;
const Mutex = std.Thread.Mutex;
const Pool = std.Thread.Pool;
const WaitGroup = std.Thread.WaitGroup;

cwd: Dir,
errors: ArrayList(Error),
transport: *Transport,

allocator: Allocator,
arena: ArenaAllocator,

mutex: Mutex,
pool: Pool,
wait_group: WaitGroup,
job_queue: LinearFifo(Job, .Dynamic),

const Compiler = @This();

pub const Unit = @import("compiler/Unit.zig");

pub const Job = union(enum) {
    pub fn deinit(self: Job) void {
        _ = self;
    }
};

pub fn init(allocator: Allocator) !*Compiler {
    const compiler = try allocator.create(Compiler);
    errdefer compiler.deinit();

    const stdin = std.io.getStdIn().reader();
    const stderr = std.io.getStdErr().writer();

    compiler.* = .{
        .cwd = std.fs.cwd(),
        .errors = .init(allocator),
        .transport = try .init(allocator, stdin.any(), stderr.any()),

        .allocator = allocator,
        .arena = .init(allocator),

        .mutex = .{},
        .pool = undefined,
        .wait_group = .{},
        .job_queue = .init(allocator)
    };

    try compiler.pool.init(.{
        .allocator = allocator,
        .n_jobs = 4
    });

    return compiler;
}

pub fn deinit(self: *Compiler) void {
    self.wait_group.wait();
    self.pool.deinit();
    while (self.job_queue.readItem()) |job| job.deinit();
    self.job_queue.deinit();
    self.errors.deinit();
    self.arena.deinit();
    self.transport.deinit();
    self.allocator.destroy(self);
}

pub fn buildProject(self: *Compiler) !void {
    const filepath = "examples/basics/src/main.ruka";

    if (!isProperExtension(filepath)) {
        var path_iter = std.mem.splitBackwardsSequence(u8, filepath, ".");
        try self.transport.print(
            "Invalid file extension, expected .ruka or .rk, got: .{s}\n",
            .{path_iter.first()}
        );

        std.posix.exit(1);
    }

    try self.compileFile(filepath, null);
}

fn isProperExtension(file: []const u8) bool {
    var path_iter = std.mem.splitBackwardsSequence(u8, file, ".");
    const extension = path_iter.first();

    return std.mem.eql(u8, "ruka", extension);
}

fn compileFile(
    self: *Compiler,
    in: []const u8,
    out: ?[]const u8
) !void {
    const input = try self.cwd.openFile(in, .{});
    defer input.close();

    var buf: [10]u8 = undefined;
    var output = std.io.fixedBufferStream(&buf);

    var unit = try Unit.init(.{
        .input = in,
        .output = out orelse "no output",
        .reader = input.reader().any(),
        .writer = output.writer().any(),
        .allocator = self.allocator
    });
    defer unit.deinit();

    try unit.compile();

    try self.errors.appendSlice(unit.errors.items);
}

test "test all compiler modules" {
    _ = tests;
    _ = Unit;
}

const tests = struct {

};
