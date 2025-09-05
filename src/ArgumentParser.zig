// @author: ruka-lang
// @created: 2024-09-13

const std = @import("std");
const Allocator = std.mem.Allocator;

const ruka = @import("prelude.zig");
const constants = ruka.constants;
const LinearFifo = ruka.LinearFifo;

subcommands: LinearFifo(Subcommand),
options: LinearFifo(Option),

gpa: Allocator,

const ArgumentParser = @This();

const Subcommand = enum {
    new,
    build,
    @"test",
    run,
    version,
    help
};

const subcommandsMap = std.StaticStringMap(Subcommand).initComptime(.{
    .{"new", .new},
    .{"build", .build},
    .{"test", .@"test"},
    .{"run", .run},
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

pub fn init(gpa: Allocator) !*ArgumentParser {
    const argument_parser = try gpa.create(ArgumentParser);
    errdefer argument_parser.deinit();

    argument_parser.* = .{
        .subcommands = .empty,
        .options = .empty,
        .gpa = gpa
    };

    return argument_parser;
}

pub fn deinit(self: *ArgumentParser) void {
    self.subcommands.deinit(self.gpa);
    self.options.deinit(self.gpa);
    self.gpa.destroy(self);
}

pub fn parse(self: *ArgumentParser) !void {
    var args = try std.process.argsWithAllocator(self.gpa);
    defer args.deinit();

    std.debug.assert(args.skip());

    const subcommand_arg = args.next();
    if (subcommand_arg == null) {
        return error.MissingSubcommand;
    }

    if (subcommandsMap.get(subcommand_arg.?)) |subcommand| {
        try self.subcommands.writeItem(self.gpa, subcommand);
    } else {
        std.debug.print("{s}\n{s}\n\nInvalid subcommand: {s}\n", .{
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
        std.debug.print("unrecognized argument: {s}\n", .{arg});
        return error.UnrecognizedArgument;
    }
}

fn addOption(self: *ArgumentParser, arg: []const u8, value: []const u8, dashCount: usize) !void {
    if (Option.init(arg[dashCount..], value)) |option| {
        try self.options.writeItem(self.gpa, option);
    } else {
        std.debug.print("{s}\n{s}\n\nInvalid option: {s}\n", .{
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
