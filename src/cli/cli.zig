// @author: ruka-lang
// @created: 2024-03-04

const rukac = @import("../root.zig");
const Compiler = rukac.Compiler;

const std = @import("std");
const clap = @import("clap");

pub const constants = @import("constants.zig");

pub const params = clap.parseParamsComptime(
    \\-h, --help           Display the help and usage
    \\-v, --version        Display the compile version
    \\-o, --output <str>   Specify the output file
    \\<str>                Subcommand
    \\
);

const Subcommand = enum { compile, invalid };
/// Subcommand supported by rukac
pub const subcommands = std.StaticStringMap(Subcommand).initComptime(.{
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

// Creates the compilation unit and begins compilation
pub fn compile_file(in: []const u8, out: ?[]const u8, allocator: std.mem.Allocator) !void {
        var compilation_unit = try Compiler.init(in, null, out, allocator);
        defer compilation_unit.deinit();

        _ = try compilation_unit.compile();
}
