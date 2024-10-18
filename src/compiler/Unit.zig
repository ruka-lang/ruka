// @author: ruka-lang
// @created: 2024-09-25

const std = @import("std");
const Allocator = std.mem.Allocator;
const AnyReader = std.io.AnyReader;
const AnyWriter = std.io.AnyWriter;
const ArenaAllocator = std.heap.ArenaAllocator;
const ArrayListUnmanaged = std.ArrayListUnmanaged;

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
errors: ArrayListUnmanaged(Error),

allocator: Allocator,
arena: *ArenaAllocator,

const Unit = @This();

pub const UnitOptions = struct {
    input: []const u8,
    output: []const u8,
    reader: AnyReader,
    writer: AnyWriter,
    allocator: Allocator,
    arena: *ArenaAllocator
};

pub fn init(opts: UnitOptions) !*Unit {
    const unit = try opts.allocator.create(Unit);
    errdefer unit.deinit();

    unit.* = .{
        .input = opts.input,
        .output = opts.output,
        .transport = try .init(opts.allocator, opts.reader, opts.writer),
        .errors = .{},
        .allocator = opts.allocator,
        .arena = opts.arena
    };

    return unit;
}

pub fn deinit(self: *Unit) void {
    self.errors.deinit(self.allocator);
    self.transport.deinit();
    self.allocator.destroy(self);
}

pub fn compile(self: *Unit) !*Ast {
    var parser = try Parser.init(
        self.allocator, 
        self.arena,
        self.transport, 
        self.input
    );

    defer parser.deinit();

    const ast = try parser.parse();
    errdefer ast.deinit();

    try self.errors.appendSlice(self.allocator, parser.errors.items);

    return ast;
}
