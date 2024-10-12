// @author: ruka-lang
// @created: 2024-03-04

const libruka = @import("root.zig").prelude;
const Ast = libruka.Ast;
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

root: *Ast,
unprocessed_asts: ArrayList(*Ast),

allocator: Allocator,
arena: ArenaAllocator,

mutex: Mutex,
thread_pool: Pool,
wait_group: WaitGroup,
job_queue: LinearFifo(Job, .Dynamic),

const Compiler = @This();

const log = std.log.scoped(.compiler);

pub const Unit = @import("compiler/Unit.zig");

const Status = enum {

};

pub const Job = union(enum) {
    parse_file: []const u8,
    combine_asts,
    check_ast_semantics,

    const SynchronizationMode = enum {
        exclusive,
        shared,
        atomic
    };

    pub fn deinit(self: Job, allocator: Allocator) void {
        switch (self) {
            .parse_file => |file| allocator.free(file),
            else => {}
        }
    }

    fn syncMode(self: Job) SynchronizationMode {
        return switch (self) {
            .parse_file => |_| .shared,
            .combine_asts => .exclusive,
            .check_ast_semantics => .exclusive,
        };
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

        .root = undefined,
        .unprocessed_asts = .init(allocator),

        .allocator = allocator,
        .arena = .init(allocator),

        .mutex = .{},
        .thread_pool = undefined,
        .wait_group = .{},
        .job_queue = .init(allocator)
    };

    try compiler.thread_pool.init(.{
        .allocator = allocator,
        .n_jobs = 4
    });

    return compiler;
}

pub fn deinit(self: *Compiler) void {
    self.wait_group.wait();
    self.thread_pool.deinit();
    while (self.job_queue.readItem()) |job| job.deinit(self.allocator);
    self.job_queue.deinit();
    self.errors.deinit();
    self.arena.deinit();
    self.transport.deinit();
    for (self.unprocessed_asts.items) |ast| {
        ast.deinit();
    }
    self.unprocessed_asts.deinit();
    self.allocator.destroy(self);
}

pub fn buildProject(self: *Compiler) !void {
    try self.verifyProject(self.cwd);
    try self.sendProject(self.cwd);

    try self.job_queue.ensureUnusedCapacity(2);
    try self.job_queue.writeItem(.combine_asts);
    try self.job_queue.writeItem(.check_ast_semantics);

    while (self.job_queue.readItem()) |job| {
        switch (job.syncMode()) {
            .exclusive => {
                self.waitAndWork();
                self.processJob(job, null);
            },
            .shared => {
                self.wait_group.start();
                errdefer job.deinit(self.allocator);
                try self.thread_pool.spawn(processJob, .{self, job, &self.wait_group});
            },
            .atomic => {
                errdefer job.deinit(self.allocator);
                try self.thread_pool.spawn(processJob, .{self, job, null});
            }
        }
    }
}

fn waitAndWork(self: *Compiler) void {
    self.thread_pool.waitAndWork(&self.wait_group);
    self.wait_group.reset();
}

fn sendFile(self: *Compiler, file: []const u8) !void {
    errdefer self.allocator.free(file);

    try self.job_queue.ensureUnusedCapacity(1);
    try self.job_queue.writeItem(.{ .parse_file = file });
}

fn verifyProject(self: *Compiler, dir: Dir) !void {
    _ = self;
    _ = dir;
}

fn isProperExtension(file: []const u8) bool {
    var path_iter = std.mem.splitBackwardsSequence(u8, file, ".");
    const extension = path_iter.first();

    return std.mem.eql(u8, "ruka", extension);
}

fn sendProject(self: *Compiler, dir: Dir) !void {
    const src = try dir.openDir("src", .{.iterate = true});
    var iter = try src.walk(self.allocator);
    defer iter.deinit();

    while (try iter.next()) |item| {
        switch (item.kind) {
            .file => {
                if (!isProperExtension(item.path)) {
                    var path_iter = std.mem.splitBackwardsSequence(u8, item.path, ".");
                    log.err(
                        "Invalid file extension, expected .ruka, got: .{s}\n",
                        .{path_iter.first()}
                    );

                    continue;
                }

                const path = try self.allocator.dupe(u8, item.path);
                errdefer self.allocator.free(path);

                try self.sendFile(path);
            },
            else => continue
        }
    }
}

fn processJob(self: *Compiler, job: Job, wait_group: ?*WaitGroup) void {
    defer if (wait_group != null) wait_group.?.finish();
    defer job.deinit(self.allocator);

    switch (job) {
        .parse_file => |file| {
            self.parseFile(file, null) catch |err| {
                log.err("Failed to compile file: {}", .{err});
            };
        },
        .combine_asts => {
            self.combineAsts() catch |err| {
                log.err("Failed to combine asts: {}", .{err});
            };
        },
        .check_ast_semantics => {
            self.checkAstSemantics() catch |err| {
                log.err("Failed to check ast semantics: {}", .{err});
            };
        }
    }
}

fn parseFile(
    self: *Compiler,
    in: []const u8,
    out: ?[]const u8
) !void {
    const src = try self.cwd.openDir("src", .{});
    const input = try src.openFile(in, .{});
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

    const ast = try unit.compile();
    errdefer ast.deinit();

    self.mutex.lock();
    defer self.mutex.unlock();

    try self.unprocessed_asts.append(ast);
    try self.errors.appendSlice(unit.errors.items);
}

fn combineAsts(_: *Compiler) !void {
    std.debug.print("\ncombining asts\n", .{});
}

fn checkAstSemantics(_: *Compiler) !void {
    std.debug.print("\nverifying ast\n", .{});
}

test "test all compiler modules" {
    _ = tests;
    _ = Unit;
}

const tests = struct {

};
