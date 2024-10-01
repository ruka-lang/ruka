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
output: []const u8,
transport: ruka.Transport,
// ast: ?Ast,
// context: std.ArrayList(...),
errors: std.ArrayList(Compiler.Error),

allocator: std.mem.Allocator,
arena: std.heap.ArenaAllocator,

mutex: std.Thread.Mutex,

pub const UnitOptions = struct {
    input: []const u8,
    output: []const u8,
    reader: std.io.AnyReader,
    writer: std.io.AnyWriter,
    allocator: std.mem.Allocator,

    pub fn testing(reader: std.io.AnyReader, writer: std.io.AnyWriter) UnitOptions {
        return UnitOptions {
            .input = "test source",
            .output = "test buffer",
            .reader = reader,
            .writer = writer,
            .allocator = std.testing.allocator
        };
    }
};

pub fn init(opts: UnitOptions) !*Unit {
    const unit = try opts.allocator.create(Unit);

    unit.* = .{
        .input = opts.input,
        .output = opts.output,
        .transport = try ruka.Transport.init(opts.reader, opts.writer),
        .errors = std.ArrayList(Compiler.Error).init(opts.allocator),

        .allocator = opts.allocator,
        .arena = std.heap.ArenaAllocator.init(opts.allocator),

        .mutex = .{}
    };

    return unit;
}

pub fn deinit(self: *Unit) void {
    self.errors.deinit();
    self.arena.deinit();
    self.allocator.destroy(self);
}

pub fn createError(self: *Unit, scanner: *Scanner, kind: []const u8, msg: []const u8) !void {
    self.mutex.lock();
    defer self.mutex.unlock();

    try self.errors.append(.{
        .file = self.input,
        .kind = kind,
        .msg = msg,
        .pos = scanner.current_pos
    });
}

pub fn compile(self: *Unit) !void {
    var scanner = Scanner.init(self);
    var token = try scanner.nextToken();

    while(token.kind != .eof): (token = try scanner.nextToken()) {
        std.debug.print("{s}: {s}\n", .{@tagName(token.kind) , try token.kind.toStr(self.arena.allocator())});
        token.deinit();
    }

    std.debug.print("eof: \\x00\n", .{});
}