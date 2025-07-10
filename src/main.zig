// @author: ruka-lang
// @created: 2024-03-04

const std = @import("std");
const Allocator = std.mem.Allocator;

const ruka = @import("prelude.zig");
const ArgumentParser = ruka.ArgumentParser;
const Compiler = ruka.Compiler;

const constants = @import("constants.zig");

var debug_allocator = std.heap.DebugAllocator(.{.stack_trace_frames = 2}).init;

pub fn main() !void {
    const allocator, const is_debug = gpa: {
        break :gpa switch (@import("builtin").mode) {
            .Debug, .ReleaseSafe => .{debug_allocator.allocator(), true},
            .ReleaseFast, .ReleaseSmall => .{std.heap.smp_allocator, false}
        };
    };
    defer if (is_debug) {
        _ = debug_allocator.deinit();
    };

    var args = try ArgumentParser.init(allocator);
    defer args.deinit();

    args.parse() catch |err| {
        switch (err) {
            error.MissingSubcommand => {
                std.debug.print("{s}\n{s}\n\nExpected subcommand argument\n", .{
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
        .version => displayVersion(),
        .help => displayHelp()
    }
}

fn displayHelp() void {
    std.debug.print(constants.help, .{});
}

fn displayVersion() void {
    std.debug.print(constants.version_and_date, .{});
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
                var new_dir = try std.fs.cwd().openDir(path, .{});
                defer new_dir.close();

                try std.posix.fchdir(new_dir.fd);
            }
        }
    }

    try compiler.buildProject();
}


fn testProject() !void {

}

fn runProject() !void {

}
