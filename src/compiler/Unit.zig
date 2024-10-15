// @author: ruka-lang
// @created: 2024-09-25

const std = @import("std");
const Allocator = std.mem.Allocator;
const AnyReader = std.io.AnyReader;
const AnyWriter = std.io.AnyWriter;
const ArrayList = std.ArrayList;
const Mutex = std.Thread.Mutex;

const ruka = @import("../prelude.zig");
const Ast = ruka.Ast;
const Compiler = ruka.Compiler;
const Error = ruka.Error;
const Scanner = ruka.Scanner;
const Parser = ruka.Parser;
const Transport = ruka.Transport;

input: []const u8,
output: []const u8,
transport: *Transport,
errors: ArrayList(Error),

allocator: Allocator,

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
    errdefer unit.deinit();

    unit.* = .{
        .input = opts.input,
        .output = opts.output,
        .transport = try .init(opts.allocator, opts.reader, opts.writer),
        .errors = .init(opts.allocator),

        .allocator = opts.allocator
    };

    return unit;
}

pub fn deinit(self: *Unit) void {
    self.errors.deinit();
    self.transport.deinit();
    self.allocator.destroy(self);
}

pub fn createError(self: *Unit, scanner: *Scanner, kind: []const u8, msg: []const u8) !void {
    try self.errors.append(.{
        .file = self.input,
        .kind = kind,
        .msg = msg,
        .pos = scanner.current_pos
    });
}

pub fn compile(self: *Unit) !*Ast {
    var scanner = try Scanner.init(self);
    defer scanner.deinit();

    var parser = try Parser.init(self, scanner);
    defer parser.deinit();

    const ast = try parser.parse();

    return ast;
}

test "unit modules" {
    _ = tests;
}

const tests = struct {

};
