// @author: ruka-lang
// @created: 2024-09-25

const ruka = @import("../root.zig").prelude;
const Compiler = ruka.Compiler;
const Error = ruka.Error;
const Scanner = ruka.Scanner;
const Transport = ruka.Transport;

const std = @import("std");
const Allocator = std.mem.Allocator;
const AnyReader = std.io.AnyReader;
const AnyWriter = std.io.AnyWriter;
const ArenaAllocator = std.heap.ArenaAllocator;
const ArrayList = std.ArrayList;
const Mutex = std.Thread.Mutex;

input: []const u8,
output: []const u8,
transport: Transport,
errors: ArrayList(Error),

allocator: Allocator,
arena: ArenaAllocator,

mutex: Mutex,

const Unit = @This();

pub const UnitOptions = struct {
    input: []const u8,
    output: []const u8,
    reader: AnyReader,
    writer: AnyWriter,
    allocator: Allocator,

    pub fn testing(reader: AnyReader, writer: AnyWriter) UnitOptions {
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
        .transport = .init(opts.reader, opts.writer),
        .errors = .init(opts.allocator),

        .allocator = opts.allocator,
        .arena = .init(opts.allocator),

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

test "test all unit modules" {
    _ = tests;
}

const tests = struct {

};
