// @author: ruka-lang
// @created: 2024-03-04

const std = @import("std");
const Allocator = std.mem.Allocator;
const ArenaAllocator = std.heap.ArenaAllocator;
const ArrayListUnmanaged = std.ArrayListUnmanaged;
const Dir = std.fs.Dir;
const LinearFifo = std.fifo.LinearFifo;
const Mutex = std.Thread.Mutex;
const Pool = std.Thread.Pool;
const WaitGroup = std.Thread.WaitGroup;

const ruka = @import("prelude.zig");
const Ast = ruka.Ast;
const Node = ruka.Node;
const Index = ruka.Index;
const Parser = ruka.Parser;
const Error = ruka.Error;

errors: ArrayListUnmanaged(Error),
unprocessed: ArrayListUnmanaged(*Ast),

allocator: Allocator,
arena: ArenaAllocator,

job_queue: LinearFifo(Job, .Dynamic),

const Compiler = @This();

const Status = enum {

};

pub const Job = union(enum) {
    parse_file: []const u8,
    combine_asts,
    check_ast_semantics,

    pub fn deinit(self: Job, allocator: Allocator) void {
        switch (self) {
            .parse_file => |file| allocator.free(file),
            else => {}
        }
    }
};

pub fn init(allocator: Allocator) !*Compiler {
    const compiler = try allocator.create(Compiler);
    errdefer compiler.deinit();

    compiler.* = .{
        .errors = .{},
        .unprocessed = .{},
        .allocator = allocator,
        .arena = .init(allocator),
        .job_queue = .init(allocator)
    };

    return compiler;
}

pub fn deinit(self: *Compiler) void {
    while (self.job_queue.readItem()) |job| job.deinit(self.allocator);
    self.job_queue.deinit();
    self.errors.deinit(self.allocator);
    self.arena.deinit();
    for (self.unprocessed.items) |parsed| {
        parsed.deinit();
    }
    self.unprocessed.deinit(self.allocator);
    self.allocator.destroy(self);
}

pub fn buildProject(self: *Compiler) !void {
    try self.verifyProject();
    try self.sendProject();

    try self.job_queue.ensureUnusedCapacity(2);
    try self.job_queue.writeItem(.combine_asts);
    try self.job_queue.writeItem(.check_ast_semantics);

    while (self.job_queue.readItem()) |job| {
        self.processJob(job);
    }
}

fn sendFile(self: *Compiler, file: []const u8) !void {
    errdefer self.allocator.free(file);

    try self.job_queue.ensureUnusedCapacity(1);
    try self.job_queue.writeItem(.{ .parse_file = file });
}

fn verifyProject(self: *Compiler) !void {
    _ = self;
}

fn isProperExtension(file: []const u8) bool {
    var path_iter = std.mem.splitBackwardsSequence(u8, file, ".");
    const extension = path_iter.first();

    return std.mem.eql(u8, "ruka", extension);
}

fn sendProject(self: *Compiler) !void {
    var src = try std.fs.cwd().openDir("src", .{.iterate = true});
    defer src.close();
    var iter = try src.walk(self.allocator);
    defer iter.deinit();

    while (try iter.next()) |item| {
        switch (item.kind) {
            .file => {
                if (!isProperExtension(item.path)) {
                    var path_iter = std.mem.splitBackwardsSequence(u8, item.path, ".");
                    std.debug.print("Invalid file extension, expected .ruka, got: {s}, {s}\n", .{path_iter.first(), item.path});

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

fn processJob(self: *Compiler, job: Job) void {
    switch (job) {
        .parse_file => |file| {
            self.parseFile(file) catch |err| {
                std.debug.print("Failed to compile file: {}", .{err});
            };
        },
        .combine_asts => {
            self.combineAsts() catch |err| {
                std.debug.print("Failed to combine asts: {}", .{err});
            };
        },
        .check_ast_semantics => {
            self.checkAstSemantics() catch |err| {
                std.debug.print("Failed to check ast semantics: {}", .{err});
            };
        }
    }
}

fn parseFile(
    self: *Compiler,
    in: []const u8
) !void {
    var parser = try Parser.init(
        self.allocator,
        &self.arena,
        in
    );

    defer parser.deinit();

    var parsed = try parser.parse();
    errdefer parsed.deinit();

    for (parsed.nodes.items(.kind)) |kind| {
        std.debug.print("{}\n", .{kind});
    }

    try self.unprocessed.append(self.allocator, parsed);
    try self.errors.appendSlice(self.allocator, parser.errors.items);
}

fn combineAsts(self: *Compiler) !void {
    _ = self;
    std.debug.print("\ncombining asts\n", .{});
}

fn checkAstSemantics(self: *Compiler) !void {
    _ = self;
    std.debug.print("\nverifying ast\n", .{});
}

test "compiler modules" {
    _ = tests;
}

const tests = struct {

};
