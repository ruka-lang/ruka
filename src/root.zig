// @author: ruka-lang
// @created: 2024-03-04

pub const prelude = @import("prelude.zig");
pub const utilities = @import("utilities.zig");

pub const Chrono = @import("Chrono.zig");
pub const Compiler = @import("Compiler.zig");
pub const Scanner = @import("Scanner.zig");
pub const Parser = @import("Parser.zig");
pub const Transport = @import("Transport.zig");

test "test all rukac library modules" {
    _ = Chrono;
    _ = Compiler;
    _ = Scanner;
    _ = Parser;
    _ = Transport;
}
