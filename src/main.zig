// @author: ruka-lang
// @created: 2024-03-04

const rukac = @import("root.zig");
const compiler = rukac.compiler;
const generator = rukac.generator;

const std = @import("std");

pub fn main() !void {
    var file = "ideas/examples/hello_world/main.ruka";

    var compilation_unit = try compiler.Compiler.init(file[0..], null, std.heap.page_allocator);
    defer compilation_unit.deinit();

    _ = try compilation_unit.compile();

    generator.llvm_sum();
}