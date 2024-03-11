// @author: ruka-lang
// @created: 2024-03-04

const rukac = @import("root.zig");
const cli = rukac.cli;

const std = @import("std");
const clap = @import("clap");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer switch (gpa.deinit()) {
        .leak => std.debug.print("memory leak\n", .{}),
        else => {}
    };

    // Parse command line args
    var res = try clap.parse(
        clap.Help, &cli.params,
        clap.parsers.default, .{.allocator = gpa.allocator()}
        );

    defer res.deinit();

    const stderr_file = std.io.getStdErr().writer();
    var err_bw = std.io.bufferedWriter(stderr_file);
    const stderr = err_bw.writer();

    // Handle command line args and subcommands
    if (res.args.help != 0) {
        return cli.help();
    } else if (res.args.version != 0) {
        return cli.version();
    } else { // Handle subcommands
        if (res.positionals.len < 1) return cli.help();

        const subcommand = cli.subcommands.get(res.positionals[0]) orelse .invalid;
        switch (subcommand) {
            .compile => {
                if (res.positionals.len < 2) return std.debug.print(
                    "Compile expects a file arg\nusage: rukac compile <file> [options]\n", .{});

                const file = res.positionals[1];

                if (!cli.check_file_extension(file)) {
                    var path_iter = std.mem.splitBackwardsSequence(u8, file, ".");
                    try stderr.print(
                        "Invalid file extension, expected .ruka or .rk, got: .{s}\n", 
                        .{path_iter.first()}
                        );
                
                    try err_bw.flush();
                    return;
                }

                try cli.compile_file(file, res.args.output);
            },
            .invalid => {
                try stderr.print("Invalid subcommand: {s}\n\n{s}\n{s}\n", .{
                    res.positionals[0], 
                    cli.constants.usage, 
                    cli.constants.subcommands
                    });

                try err_bw.flush();
                return;
            }
        }
    }
    
    try err_bw.flush();
}
