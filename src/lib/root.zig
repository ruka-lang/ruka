// @author: ruka-lang
// @created: 2024-03-04

pub const prelude = @import("prelude.zig");
pub const utilities = @import("utilities/utilities.zig");
pub const Compiler = @import("compiler/compiler.zig");
pub const Scanner = @import("scanner/scanner.zig");
pub const Parser = @import("parser/parser.zig");

test "Test all rukac library modules" {
    _ = utilities;
    _ = Compiler;
    _ = Scanner;
    _ = Parser;
}
