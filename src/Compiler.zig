// @author: ruka-lang
// @created: 2024-03-04

const std = @import("std");
const Allocator = std.mem.Allocator;
const ArenaAllocator = std.heap.ArenaAllocator;
const ArrayListUnmanaged = std.ArrayListUnmanaged;
const Dir = std.fs.Dir;
const Mutex = std.Thread.Mutex;
const Pool = std.Thread.Pool;
const WaitGroup = std.Thread.WaitGroup;

const ruka = @import("prelude.zig");
const Ast = ruka.Ast;
const Node = ruka.Node;
const Index = ruka.Index;
const Parser = ruka.Parser;
const Error = ruka.Error;
const LinearFifo = ruka.LinearFifo;

errors: ArrayListUnmanaged(Error),
unprocessed: ArrayListUnmanaged(*Ast),

gpa: Allocator,
arena: ArenaAllocator,

job_queue: LinearFifo(Job),

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

pub fn init(gpa: Allocator) !*Compiler {
    const compiler = try gpa.create(Compiler);
    errdefer compiler.deinit();

    compiler.* = .{
        .errors = .{},
        .unprocessed = .{},
        .gpa = gpa,
        .arena = .init(gpa),
        .job_queue = .empty
    };

    return compiler;
}

pub fn deinit(self: *Compiler) void {
    while (self.job_queue.readItem(self.gpa)) |job| job.deinit(self.gpa);
    self.job_queue.deinit(self.gpa);
    self.errors.deinit(self.gpa);
    self.arena.deinit();
    for (self.unprocessed.items) |parsed| {
        parsed.deinit();
    }
    self.unprocessed.deinit(self.gpa);
    self.gpa.destroy(self);
}

pub fn buildProject(self: *Compiler) !void {
    try self.verifyProject();
    try self.sendProject();

    //try self.job_queue.ensureUnusedCapacity(2);
    try self.job_queue.writeItem(self.gpa, .combine_asts);
    try self.job_queue.writeItem(self.gpa, .check_ast_semantics);

    while (self.job_queue.readItem(self.gpa)) |job| {
        self.processJob(job);
    }
}

fn sendFile(self: *Compiler, file: []const u8) !void {
    errdefer self.gpa.free(file);

    //try self.job_queue.ensureUnusedCapacity(1);
    try self.job_queue.writeItem(self.gpa, .{ .parse_file = file });
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
    var src = std.fs.cwd().openDir("src", .{.iterate = true}) catch {
        std.debug.print("Failed to open src directory\n", .{});
        return error.FailedToOpenSrcDir;
    };
    defer src.close();

    var iter = try src.walk(self.gpa);
    defer iter.deinit();

    while (try iter.next()) |item| {
        switch (item.kind) {
            .file => {
                if (!isProperExtension(item.path)) {
                    var path_iter = std.mem.splitBackwardsSequence(u8, item.path, ".");
                    std.debug.print("Invalid file extension, expected .ruka, got: {s}, {s}\n", .{path_iter.first(), item.path});

                    continue;
                }

                const path = try self.gpa.dupe(u8, item.path);
                errdefer self.gpa.free(path);

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

fn parseFile(self: *Compiler, in: []const u8) !void {
    defer self.gpa.free(in);

    var parser = try Parser.init(
        self.gpa,
        &self.arena,
        in
    );
    defer parser.deinit();

    var parsed = try parser.parse();
    errdefer parsed.deinit();

    std.debug.print("Parsed: {s}\n", .{in});
    for (parsed.nodes.items(.kind)) |kind| {
        std.debug.print("\t{}\n", .{kind});
    }
    const errors = parser.errors.items.len;
    std.debug.print("Errors: {}\n", .{errors});

    if (errors > 0) {
        // Print errors
        for (parser.errors.items) |err| {
            std.debug.print("\t{s}:{}:{}: {s}\n", .{err.file, err.pos.line, err.pos.col, err.msg});
        }
        std.debug.print("\n", .{});
    }


    try self.unprocessed.append(self.gpa, parsed);
    try self.errors.appendSlice(self.gpa, parser.errors.items);
}

fn combineAsts(self: *Compiler) !void {
    _ = self;
    std.debug.print("combining asts\n", .{});
}

fn checkAstSemantics(self: *Compiler) !void {
    _ = self;
    std.debug.print("verifying ast\n", .{});
}

test "compiler modules" {
    _ = tests;
}

const tests = struct {

};
