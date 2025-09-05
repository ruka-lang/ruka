// @author: ruka-lang
// @created: 2024-03-04

const std = @import("std");
const builtin = @import("builtin");
pub const project_options = @import("options");

pub const usage = "usage: ruka [subcommand] [options]";
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
    \\    options:
    \\        --change_dir, -C [subpath] : Changes the directory to a subdirectory of the cwd
;

pub const version_str = std.fmt.comptimePrint("{f}", .{project_options.semver});

pub const version_and_date = std.fmt.comptimePrint("ruka {s} (released {s})\n", .{
    version_str,
    std.mem.trim(u8, project_options.build_date, "'")
});

pub const help = std.fmt.comptimePrint("{s}{s}\n\n{s}\n{s}\n{s}\n", .{
    version_and_date,
    project_options.description,
    usage,
    subcommands_display,
    options_display
});
