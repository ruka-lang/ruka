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

pub const std_options = logging.std_options;

pub fn main() !void {
    var dbga = std.heap.DebugAllocator(.{.stack_trace_frames = 2}).init;
    defer _ = dbga.deinit();
    const allocator = dbga.allocator();

    const stderr = std.io.getStdErr();
    var transport = try Transport.initFile(allocator, stderr);
    defer transport.deinit();

    try logging.init();
    logging.log(.bin, "starting ruka", .{});

    var args = try ArgumentParser.init(allocator);
    defer args.deinit();

    args.parse() catch |err| {
        switch (err) {
            error.MissingSubcommand => {
                try transport.printFlush("{s}\n{s}\n\nExpected subcommand argument\n", .{
                    constants.usage,
                    constants.subcommands_display
                });

                return;
            },
            else => return err
        }
    };

    switch (args.getSubcommand().?) {
        .new => try newProject(),
        .build => try buildProject(args, allocator),
        .@"test" => try testProject(),
        .run => try runProject(),
        .repl => try startRepl(allocator),
        .version => try displayVersion(transport),
        .help => try displayHelp(transport)
    }
}

fn displayHelp(transport: *Transport) !void {
    try transport.writeAllFlush(constants.help);
}

fn displayVersion(transport: *Transport) !void {
    try transport.writeAllFlush(constants.version_and_date);
}

fn newProject() !void {

}

fn isProperProject() void {

}

fn buildProject(args: *ArgumentParser, allocator: Allocator) !void {
    var compiler = try Compiler.init(allocator);
    defer compiler.deinit();

    if (args.getOption()) |option| {
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
