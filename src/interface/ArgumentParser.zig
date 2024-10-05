// @author: ruka-lang
// @created: 2024-09-13

const ruka = @import("libruka").prelude;
const Transport = ruka.Transport;
const constants = @import("constants.zig");

const std = @import("std");
const ArrayList = std.ArrayList;
const Allocator = std.mem.Allocator;
const LinearFifo = std.fifo.LinearFifo;

subcommands: LinearFifo(Subcommand, .Dynamic),
options: ArrayList(Option),

transport: Transport,

allocator: Allocator,

const ArgumentParser = @This();

const Subcommand = enum {
    new,
    build,
    @"test",
    run,
    version,
    help
};

pub const subcommandsMap = std.StaticStringMap(Subcommand).initComptime(.{
    .{"new", .new},
    .{"build", .build},
    .{"test", .@"test"},
    .{"run", .run},
    .{"version", .version},
    .{"help", .help}
});

const Option = enum {

};

pub fn init(allocator: Allocator) ArgumentParser {
    return ArgumentParser {
        .subcommands = .init(allocator),
        .options = .init(allocator),
    
        .transport = .init(null, null),

        .allocator = allocator
    };
}

pub fn deinit(self: ArgumentParser) void {
    self.subcommands.deinit();
    self.options.deinit();
}

pub fn parse(self: *ArgumentParser) !void {
    var args = try std.process.argsWithAllocator(self.allocator);
    defer args.deinit();

    _ = args.skip();

    const subcommand_arg = args.next();
    if (subcommand_arg == null) {
        try self.transport.printStderr("{s}\n{s}\n\nExpected subcommand argument\n", .{
            constants.usage,
            constants.commands
        });

        std.posix.exit(1);
    }

    if (subcommandsMap.get(subcommand_arg.?)) |subcommand| {
        try self.subcommands.writeItem(subcommand); 
    } else {
        try self.transport.printStderr("{s}\n{s}\n\nInvalid subcommand: {s}\n", .{
            constants.usage,
            constants.commands,
            subcommand_arg.?
        });

        std.posix.exit(1);
    }
}

pub fn getSubcommand(self: *ArgumentParser) ?Subcommand {
    return self.subcommands.readItem();
}

test "test all argumentParser modules" {
    _ = tests;
}

const tests = struct {

};
