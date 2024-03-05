//
// @author: ruka-lang
// @created: 2024-03-04
//

const std = @import("std");

pub const cli = @import("cli/cli.zig");
pub const compiler = @import("compiler/compiler.zig");
pub const scanner = @import("scanner/scanner.zig");
pub const util = @import("util.zig");

test "Test all rukac modules" {
    _ = cli;
    _ = compiler;
    _ = scanner;
    _ = util;
}
