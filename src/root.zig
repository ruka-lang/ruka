// @author: ruka-lang
// @created: 2024-03-04

pub const util = @import("util.zig");
pub const cli = @import("cli/cli.zig");
pub const Compiler = @import("compiler/compiler.zig");
pub const Scanner = @import("scanner/scanner.zig");
pub const generator = @import("generator/generator.zig");

test "Test all rukac modules" {
    _ = util;
    _ = cli;
    _ = Compiler;
    _ = Scanner;
}
