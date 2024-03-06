// @author: ruka-lang
// @created: 2024-03-04

const rukac = @import("root.zig");
const generator = rukac.generator;

const std = @import("std");

pub fn main() !void {
    var file = "ideas/examples/hello_world/main.ruka";

    var compiler = try rukac.Compiler.init(file[0..], null, std.heap.page_allocator);
    defer compiler.deinit();

    _ = try compiler.compile();

    generator.llvm_sum();
}