// @author: ruka-lang
// @created: 2024-03-04

const std = @import("std");
const builtin = @import("builtin");
pub const project_options = @import("options");

pub const usage = "usage: ruka [options_display] [subcommand]";
pub const subcommands_display =
    \\    subcommands:
    \\        new     : Creates a new project in the current directory
    \\        build   : Builds the project in the current directory
    \\        test    : Tests the project in the current directory
    \\        run     : Runs the project in the current directory
    \\        version : Displays the current ruka version installed
    \\        help    : Displays the help menu
;

const options_display =
    \\    options_display:
    \\        --cwd   : Changes the directory to a subdirectory of the cwd
    \\
;

pub const version_str = std.fmt.comptimePrint("{}", .{project_options.version});

pub const help = std.fmt.comptimePrint("ruka {s} (released {s})\n{s}\n\n{s}\n{s}\n{s}", .{
    version_str,
    project_options.version_date,
    project_options.description,
    usage,
    subcommands_display,
    options_display
});
