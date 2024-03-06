// @author: ruka-lang
// @created: 2024-03-04

// Cli module imports
pub const cli = @import("cli/cli.zig");
// Compiler module imports
pub const compiler = @import("compiler/compiler.zig");
pub const Compiler = compiler.Compiler;
// Scanner module imports
pub const scanner = @import("scanner/scanner.zig");
pub const Scanner = scanner.Scanner;
// Parser module imports
// Generator module imports
pub const generator = @import("generator/generator.zig");
pub const util = @import("util.zig");

test "Test all rukac modules" {
    _ = cli;
    _ = compiler;
    _ = scanner;
    _ = util;
}
