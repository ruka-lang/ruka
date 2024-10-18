// @author: ruka-lang
// @created: 2024-03-04

const std = @import("std");
const Allocator = std.mem.Allocator;

const ruka = @import("prelude.zig");
const ArgumentParser = ruka.ArgumentParser;
const Compiler = ruka.Compiler;
const Repl = ruka.Repl;
const Transport = ruka.Transport;

const constants = @import("constants.zig");
const logging = @import("logging.zig");

pub const std_options = logging.options;

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{.stack_trace_frames = 2}).init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const stderr = std.io.getStdErr();
    var transport = try Transport.initWithFile(allocator, stderr);
    defer transport.deinit();

    try logging.init();
    std.log.scoped(.bin).info("starting ruka", .{});

    var arg_parser = try ArgumentParser.init(allocator);
    defer arg_parser.deinit();

    arg_parser.parse() catch |err| {
        switch (err) {
            error.MissingSubcommand => {
                try transport.print("{s}\n{s}\n\nExpected subcommand argument\n", .{
                    constants.usage,
                    constants.subcommands_display
                });

                return;
            },
            else => return err
        }
    };

    switch (arg_parser.getSubcommand().?) {
        .new => try newProject(),
        .build => try buildProject(arg_parser, allocator),
        .@"test" => try testProject(),
        .run => try runProject(),
        .repl => try startRepl(allocator),
        .version => try displayVersion(transport),
        .help => try displayHelp(transport)
    }
}

fn displayHelp(transport: *Transport) !void {
    try transport.write(constants.help);
}

fn displayVersion(transport: *Transport) !void {
    try transport.write(constants.version_and_date);
}

fn newProject() !void {

}

fn isProperProject() void {

}

fn buildProject(arg_parser: *ArgumentParser, allocator: Allocator) !void {
    var compiler = try Compiler.init(allocator);
    defer compiler.deinit();

    if (arg_parser.getOption()) |option| {
        switch (option) {
            .change_dir => |path| {
                compiler.cwd = try compiler.cwd.openDir(path, .{});
            }
        }
    }

    try compiler.buildProject();
}


fn testProject() !void {

}

fn runProject() !void {

}

fn startRepl(allocator: Allocator) !void {
    var repl = try Repl.init(allocator);
    defer repl.deinit();

    try repl.run();
}
