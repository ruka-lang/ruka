// @author: ruka-lang
// @created: 2024-03-04

const std = @import("std");

///
pub const version = "0.0.0";
const description = "Compiler for the Ruka Programming Language";
const usage =
    \\usage: rukac [options] subcommand [command_options]
    \\    subcommands:
    \\        compile <input_file> : Compiles the file given
    \\            options:
    \\                -o, --output         : Path of the output file
    \\    options:
    \\        -h, --help           : Displays help and usage
    \\        -v, --version        : Displays the compiler version
    \\
;
pub const help = std.fmt.comptimePrint("rukac {s}\n{s}\n\n{s}", .{version, description, usage});
/// File extensions supported by rukac
pub const exts = [2][]const u8{
    "ruka",
    "rk"
};