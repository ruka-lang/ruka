// @author: ruka-lang
// @created: 2024-03-04

// Responsible for compiling an entire project

const rukac = @import("root.zig").prelude;
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
output: []const u8,
transport: rukac.Transport,
// ast: ?Ast,
// context: std.ArrayList(...),
errors: std.ArrayList(Error),

allocator: std.mem.Allocator,
arena: std.heap.ArenaAllocator,

pool: std.Thread.Pool,
wait_group: std.Thread.WaitGroup,

mutex: std.Thread.Mutex,
job_queue: std.fifo.LinearFifo(Job, .Dynamic),

pub const CompilerOptions = struct {
    input: []const u8,
    output: []const u8,
    reader: std.io.AnyReader,
    writer: std.io.AnyWriter,
    allocator: std.mem.Allocator,

    pub fn testing(reader: std.io.AnyReader, writer: std.io.AnyWriter) CompilerOptions {
        return CompilerOptions {
            .input = "test source",
            .output = "test buffer",
            .reader = reader,
            .writer = writer,
            .allocator = std.testing.allocator
        };
    }
};

/// Creates a new compiler instance, initializing it's arena with the passed in
/// allocator
pub fn init(opts: CompilerOptions) !*Compiler {
    const compiler = try opts.allocator.create(Compiler);

    compiler.* = .{
        .input = opts.input,
        .output = opts.output,
        .transport = try rukac.Transport.init(opts.reader, opts.writer),
        .errors = std.ArrayList(Error).init(opts.allocator),

        .allocator = opts.allocator,
        .arena = std.heap.ArenaAllocator.init(opts.allocator),

        .pool = undefined,
        .wait_group = .{},

        .mutex = .{},
        .job_queue = std.fifo.LinearFifo(Job, .Dynamic).init(opts.allocator)
    };

    try compiler.pool.init(.{
        .allocator = opts.allocator,
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
    self.errors.deinit();
    self.arena.deinit();
    self.allocator.destroy(self);
}

///
pub fn createError(self: *Compiler, scanner: *Scanner, kind: []const u8, msg: []const u8) !void {
    self.mutex.lock();
    defer self.mutex.unlock();

    try self.errors.append(.{
        .file = self.input,
        .kind = kind,
        .msg = msg,
        .pos = scanner.current_pos
    });
}

/// Begins the compilation process for the compilation unit
pub fn compile(self: *Compiler) !void {
    var s = Scanner.init(self);
    var t = try s.nextToken();

    while(t.kind != .eof) {
        std.debug.print("{s}: {s}\n", .{@tagName(t.kind) , try t.kind.toStr(self.arena.allocator())});
        t = try s.nextToken();
    }
}

pub const Job = union(enum) {
    pub fn deinit(self: Job) void {
        _ = self;
    }  
};
