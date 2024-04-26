// @author: ruka-lang
// @created: 2024-03-04

const std = @import("std");
const builtin = @import("builtin");
pub const project_options = @import("options");

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

pub const version_str = std.fmt.comptimePrint("{d}.{d}.{d}", .{
    project_options.version.major,
    project_options.version.minor,
    project_options.version.patch
});

///
pub const help = std.fmt.comptimePrint("rukac {s} (released {s})\n{s}\n\n{s}\n{s}\n{s}", .{
    version_str,
    project_options.version_date,
    project_options.description,
    usage,
    subcommands,
    options
});

/// File extensions supported by rukac
pub const exts = [2][]const u8{
    "ruka",
    "rk"
};
