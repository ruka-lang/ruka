// @author: ruka-lang
// @created: 2024-09-13

const std = @import("std");
const Allocator = std.mem.Allocator;
const ArrayList = std.ArrayList;
const LinearFifo = std.fifo.LinearFifo;

const libruka = @import("prelude.zig");
const Transport = libruka.Transport;
const constants = @import("constants.zig");

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
    change_dir: []const u8,

    pub fn init(option: []const u8, value: []const u8) ?Option {
        if (std.mem.eql(u8, option, "change_dir")
            or std.mem.eql(u8, option, "C")
        ) {
            return .{ .change_dir = value };
        }

        return null;
    }
};

pub fn init(allocator: Allocator) !*ArgumentParser {
    const argument_parser = try allocator.create(ArgumentParser);
    errdefer argument_parser.deinit();

    const stderr = std.io.getStdErr();
    argument_parser.* = .{
        .subcommands = .init(allocator),
        .options = .init(allocator),

        .transport = try .initWithFile(allocator, stderr),

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
        return error.MissingSubcommand;
    }

    if (subcommandsMap.get(subcommand_arg.?)) |subcommand| {
        try self.subcommands.writeItem(subcommand);
    } else {
        try self.transport.print("{s}\n{s}\n\nInvalid subcommand: {s}\n", .{
            constants.usage,
            constants.subcommands_display,
            subcommand_arg.?
        });

        std.posix.exit(1);
    }

    while (args.next()) |arg| {
        if (std.mem.startsWith(u8, arg, "--")) {
            if (args.next()) |value| {
                try self.addOption(arg, value, 2);
                continue;
            }
        }

        if (std.mem.startsWith(u8, arg, "-")) {
            if (args.next()) |value| {
                try self.addOption(arg, value, 1);
                continue;
            }
        }

        // Unrecognized argument
        try self.transport.print("unrecognized argument: {s}\n", .{arg});
        return error.UnrecognizedArgument;
    }
}

fn addOption(self: *ArgumentParser, arg: []const u8, value: []const u8, dashCount: usize) !void {
    if (Option.init(arg[dashCount..], value)) |option| {
        try self.options.writeItem(option);
    } else {
        try self.transport.print("{s}\n{s}\n\nInvalid option: {s}\n", .{
            constants.usage,
            constants.subcommands_display,
            arg
        });
        return error.InvalidOption;
    }
}

pub fn getSubcommand(self: *ArgumentParser) ?Subcommand {
    return self.subcommands.readItem();
}

pub fn getOption(self: *ArgumentParser) ?Option {
    return self.options.readItem();
}
