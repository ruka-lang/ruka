// @author: ruka-lang
// @created: 2024-03-04

const rukac = @import("../root.zig");
const compiler = rukac.compiler;
const generator = rukac.generator;

const std = @import("std");
const clap = @import("clap");

pub const params = clap.parseParamsComptime(
    \\-h, --help           Display this help and exit.
    \\-o, --output <str>   Specify the output file     
    \\<str>...
    \\
);

const version = "0.0.0";
const description = "Compiler for the Ruka Programming Language";
const usage = 
    \\usage: rukac command [options]
    \\  commands:
    \\      * compile <input_file>
    \\  options:
    ;
const header = std.fmt.comptimePrint("rukac {s}\n{s}\n\n{s}", .{version, description, usage});

///
pub fn help() !void {
    std.debug.print(header, .{});
    return clap.help(std.io.getStdErr().writer(), clap.Help, &params, .{});
}

//
const res_type = clap.Result(clap.Help, &params, clap.parsers.default);

///
pub fn parse_positionals(res: *res_type, allocator: std.mem.Allocator) !void {
    if (res.positionals.len < 1) return help();

    if (std.mem.eql(u8, res.positionals[0], "compile")) {
        if (res.positionals.len < 2) return std.debug.print(
            "Compile subcommand expects a file argument\nusage: rukac compile <file> [options]\n", 
            .{}
            );

        const file = res.positionals[1];

        try compile_file(file, res.args.output, allocator);
    }
}

//
fn compile_file(in: []const u8, out: ?[]const u8, allocator: std.mem.Allocator) !void {
        var compilation_unit = try compiler.Compiler.init(in, out, allocator);
        defer compilation_unit.deinit();

        _ = try compilation_unit.compile();

        generator.llvm_sum();
}
