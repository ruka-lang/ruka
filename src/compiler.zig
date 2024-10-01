// @author: ruka-lang
// @created: 2024-03-04

const ruka = @import("root.zig").prelude;
const Transport = ruka.Transport;

const std = @import("std");

cwd: std.fs.Dir,
errors: std.ArrayList(Error),

transport: Transport,

allocator: std.mem.Allocator,
arena: std.heap.ArenaAllocator,

pool: std.Thread.Pool,
wait_group: std.Thread.WaitGroup,

mutex: std.Thread.Mutex,
job_queue: std.fifo.LinearFifo(Job, .Dynamic),

const Compiler = @This();

pub const Unit = @import("compiler/unit.zig");

pub const Error = struct {
    file: []const u8,
    kind: []const u8,
    msg: []const u8,
    pos: ruka.Position
};

pub const Job = union(enum) {
    pub fn deinit(self: Job) void {
        _ = self;
    }
};

pub fn init(allocator: std.mem.Allocator) !*Compiler {
    const compiler = try allocator.create(Compiler);

    const stdin = std.io.getStdIn().reader();
    const stderr = std.io.getStdErr().writer();

    compiler.* = .{
        .cwd = std.fs.cwd(),
        .errors = std.ArrayList(Error).init(allocator),
        .transport = try Transport.init(stdin.any(), stderr.any()),

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

pub fn deinit(self: *Compiler) void {
    self.wait_group.wait();
    self.pool.deinit();
    while (self.job_queue.readItem()) |job| job.deinit();
    self.job_queue.deinit();
    self.errors.deinit();
    self.arena.deinit();
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
