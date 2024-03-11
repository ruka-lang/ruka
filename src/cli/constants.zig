// @author: ruka-lang
// @created: 2024-03-04

const std = @import("std");

pub const version = "0.0.0";
pub const version_date = "03-09-2024";
const description = "Compiler for the Ruka Programming Language";
pub const usage = "usage: rukac [options] subcommand";
pub const subcommands = 
    \\    subcommands:
    \\        compile <input_file> : Compiles the file given
;

const options = 
    \\    options:
    \\        -h, --help           : Displays help and usage
    \\        -v, --version        : Displays the compiler version
    \\        -o, --output         : Path of the output file
    \\
;

///
pub const help = std.fmt.comptimePrint("rukac {s}\n{s}\n\n{s}\n{s}\n{s}", .{
    version, 
    description, 
    usage, 
    subcommands, 
    options
    });

/// File extensions supported by rukac
pub const exts = [2][]const u8{
    "ruka",
    "rk"
};
