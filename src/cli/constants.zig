// @author: ruka-lang
// @created: 2024-03-04

const std = @import("std");

///
pub const version = "0.0.0";
const description = "Compiler for the Ruka Programming Language";
const usage = 
    \\usage: rukac command [options]
    \\  commands:
    \\      * compile <input_file>
    \\  options:
    ;
pub const header = std.fmt.comptimePrint("rukac {s}\n{s}\n\n{s}", .{version, description, usage});
/// File extensions supported by rukac
pub const exts = [2][]const u8{
    "ruka",
    "rk"
};