// @author: ruka-lang
// @created: 2024-03-04

const rukac = @import("../root.zig");
const compiler = rukac.compiler;
const generator = rukac.generator;

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
const subcommands = std.ComptimeStringMap(Subcommand, .{
    .{"compile", .compile}
});

///
pub fn help() void {
    std.debug.print(constants.help, .{});
}

//
const res_type = clap.Result(clap.Help, &params, clap.parsers.default);

///
pub fn parse_positionals(res: *res_type, allocator: std.mem.Allocator) !void {
    if (res.positionals.len < 1) return help();

    const subcommand = subcommands.get(res.positionals[0]) orelse .invalid;
    switch (subcommand) {
        .compile => {
            if (res.positionals.len < 2) {
                return std.debug.print(
                    "Compile expects a file arg\nusage: rukac compile <file> [options]\n", 
                    .{}
                );
            }

            const file = res.positionals[1];

            try compile_file(file, res.args.output, allocator);
        },
        .invalid => {
            std.debug.print("Invalid subcommand: {s}", .{res.positionals[0]});

            return help();
        }
    }
}

//
fn compile_file(in: []const u8, out: ?[]const u8, allocator: std.mem.Allocator) !void {
        var compilation_unit = try compiler.Compiler.init(in, out, allocator);
        defer compilation_unit.deinit();

        _ = try compilation_unit.compile();

        generator.llvm_sum();
}
