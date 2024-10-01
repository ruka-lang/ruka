// @author: ruka-lang
// @created: 2024-03-04

//

const std = @import("std");
const builtin = @import("builtin");
pub const project_options = @import("options");

pub const usage = "usage: rukac [options] [command]";
pub const commands =
    \\    commands:
    \\        new     : Creates a new project in the current directory
    \\        build   : Builds the project in the current directory
    \\        test    : Tests the project in the current directory
    \\        run     : Runs the project in the current directory
    \\        version : Displays the current rukac version installed
    \\        help    : Displays the help menu
;

const options =
    \\    options:
    \\
;

const Subcommand = enum {
    new,
    build,
    @"test",
    run,
    version,
    help,
    invalid
};

/// Subcommand supported by rukac
pub const subcommands = std.StaticStringMap(Subcommand).initComptime(.{
    .{"new", .new},
    .{"build", .build},
    .{"test", .@"test"},
    .{"run", .run},
    .{"version", .version},
    .{"help", .help}
});

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
    commands,
    options
});

/// File extension used by ruka files
pub const ext = "ruka";
