// @author: ruka-lang
// @created: 2024-09-13

const libruka = @import("ruka").prelude;
const Transport = libruka.Transport;
const constants = @import("constants.zig");

const std = @import("std");
const Allocator = std.mem.Allocator;
const ArrayList = std.ArrayList;
const LinearFifo = std.fifo.LinearFifo;

subcommands: LinearFifo(Subcommand, .Dynamic),
options: LinearFifo(Option, .Dynamic),

transport: *Transport,

allocator: Allocator,

const ArgumentParser = @This();

const Subcommand = enum {
    new,
    build,
    @"test",
    run,
    repl,
    version,
    help
};

const subcommandsMap = std.StaticStringMap(Subcommand).initComptime(.{
    .{"new", .new},
    .{"build", .build},
    .{"test", .@"test"},
    .{"run", .run},
    .{"repl", .repl},
    .{"version", .version},
    .{"help", .help}
});

const Option = union(enum) {
    cwd: []const u8,

    pub fn init(option: []const u8) ?Option {
        var iter = std.mem.splitAny(u8, option, "=");

        // need to make sure option are following the --opt=value or --opt or -o syntax
        const opt = iter.next() orelse return null;
        const value = iter.next() orelse {
            std.debug.print("Option missing it's value\n", .{});
            return null;
        };

        if (std.mem.eql(u8, opt, "--cwd")) {
            return .{ .cwd = value };
        }

        return null;
    }
};

pub fn init(allocator: Allocator) !*ArgumentParser {
    const argument_parser = try allocator.create(ArgumentParser);
    errdefer argument_parser.deinit();

    argument_parser.* = .{
        .subcommands = .init(allocator),
        .options = .init(allocator),

        .transport = try .init(allocator, null, null),

        .allocator = allocator
    };

    return argument_parser;
}

pub fn deinit(self: *ArgumentParser) void {
    self.subcommands.deinit();
    self.options.deinit();
    self.transport.deinit();
    self.allocator.destroy(self);
}

pub fn parse(self: *ArgumentParser) !void {
    var args = try std.process.argsWithAllocator(self.allocator);
    defer args.deinit();

    std.debug.assert(args.skip());

    const subcommand_arg = args.next();
    if (subcommand_arg == null) {
        try self.transport.printStderr("{s}\n{s}\n\nExpected subcommand argument\n", .{
            constants.usage,
            constants.subcommands_display
        });

        std.posix.exit(1);
    }

    if (subcommandsMap.get(subcommand_arg.?)) |subcommand| {
        try self.subcommands.writeItem(subcommand);
    } else {
        try self.transport.printStderr("{s}\n{s}\n\nInvalid subcommand: {s}\n", .{
            constants.usage,
            constants.subcommands_display,
            subcommand_arg.?
        });

        std.posix.exit(1);
    }

    while (args.next()) |arg| {
        if (Option.init(arg)) |option| {
            try self.options.writeItem(option);
        } else {
            try self.transport.printStderr("{s}\n{s}\n\nInvalid option: {s}\n", .{
                constants.usage,
                constants.subcommands_display,
                arg
            });
        }
    }
}

pub fn getSubcommand(self: *ArgumentParser) ?Subcommand {
    return self.subcommands.readItem();
}

pub fn getOption(self: *ArgumentParser) ?Option {
    return self.options.readItem();
}

test "test all argumentParser modules" {
    _ = tests;
}

const tests = struct {

};
