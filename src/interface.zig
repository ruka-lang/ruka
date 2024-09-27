// @author: ruka-lang
// @created: 2024-03-04

//

const rukac = @import("rukac").prelude;

const std = @import("std");
const clap = @import("clap");

pub const constants = @import("interface/constants.zig");
pub const logging = @import("interface/logging.zig");
const CommandParser = @import("interface/commandParser.zig");

pub const params = clap.parseParamsComptime(
    \\-h, --help           Display the help and usage
    \\-v, --version        Display the compile version
    \\-o, --output <str>   Specify the output file
    \\<str>                Subcommand
    \\
);

const Subcommand = enum { compile, invalid };
/// Subcommand supported by rukac
pub const commands = std.StaticStringMap(Subcommand).initComptime(.{
    .{"compile", .compile}
});

/// Displays the help to stdout
pub fn help() !void {
    const stdout_file = std.io.getStdOut().writer();
    var bw = std.io.bufferedWriter(stdout_file);
    const stdout = bw.writer();

    try stdout.print(constants.help, .{});
    try bw.flush();
}

/// Displays the help to stdout
pub fn version() !void {
    const stdout_file = std.io.getStdOut().writer();
    var bw = std.io.bufferedWriter(stdout_file);
    const stdout = bw.writer();

    try stdout.print("rukac {s} (released {s})\n", .{
        constants.version_str,
        constants.project_options.version_date
    });
    try bw.flush();
}

/// Checks if the file path ends in the one of the proper file extensions
pub fn check_file_extension(file: []const u8) bool {
    var path_iter = std.mem.splitBackwardsSequence(u8, file, ".");
    const extension = path_iter.first();

    for (constants.exts) |ext| {
        if (std.mem.eql(u8, ext, extension)) return true;
    }

    return false;
}

/// Creates the compilation unit and begins compilation
pub fn compile_file(in: []const u8, out: ?[]const u8, allocator: std.mem.Allocator) !void {
    var compilation_unit = try rukac.Compiler.init(in, null, out, allocator);
    defer compilation_unit.deinit();

    _ = try compilation_unit.compile();
}

/// Parse and handles command line args
pub fn start(allocator: std.mem.Allocator) !void {
    var res = try clap.parse(
        clap.Help, &params,
        clap.parsers.default, .{.allocator = allocator}
    );
    defer res.deinit();

    const stderr_file = std.io.getStdErr().writer();
    var err_bw = std.io.bufferedWriter(stderr_file);
    const stderr = err_bw.writer();

    if (res.args.help != 0) return help();
    if (res.args.version != 0) return version();
    if (res.positionals.len < 1) return help();

    const subcommand = commands.get(res.positionals[0]) orelse .invalid;
    switch (subcommand) {
        .compile => {
            if (res.positionals.len < 2) {
                try stderr.print(
                    \\Compile expects a file arg
                    \\usage: rukac compile <file> [options]
                    \\
                    , .{}
                );

                try err_bw.flush();
                std.posix.exit(1);
            }

            const file = res.positionals[1];

            if (!check_file_extension(file)) {
                var path_iter = std.mem.splitBackwardsSequence(u8, file, ".");
                try stderr.print(
                    "Invalid file extension, expected .ruka or .rk, got: .{s}\n",
                    .{path_iter.first()}
                );

                try err_bw.flush();
                std.posix.exit(1);
            }

            try compile_file(file, res.args.output, allocator);
        },
        .invalid => {
            try stderr.print("Invalid subcommand: {s}\n\n{s}\n{s}\n", .{
                res.positionals[0],
                constants.usage,
                constants.commands
            });

            try err_bw.flush();
            std.posix.exit(1);
        }
    }
}
