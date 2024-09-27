// @author: ruka-lang
// @created: 2024-03-04

pub const prelude = @import("lib/prelude.zig");
pub const utilities = @import("lib/utilities.zig");
pub const Chrono = @import("lib/chrono.zig");
pub const Compiler = @import("lib/compiler.zig");
pub const Scanner = @import("lib/scanner.zig");
pub const Parser = @import("lib/parser.zig");

test "Test all rukac library modules" {
    _ = utilities;
    _ = Chrono;
    _ = Compiler;
    _ = Scanner;
    _ = Parser;
}
