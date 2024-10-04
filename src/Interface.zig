// @author: ruka-lang
// @created: 2024-03-04

const ruka = @import("libruka").prelude;
const Transport = ruka.Transport;
const Compiler = ruka.Compiler;

const std = @import("std");

transport: Transport,
gpa: std.heap.GeneralPurposeAllocator(.{}),

const Interface = @This();

pub const constants = @import("interface/constants.zig");
pub const logging = @import("interface/logging.zig");
pub const ArgumentParser = @import("interface/ArgumentParser.zig");

pub fn init() !Interface {
    const stdin = std.io.getStdIn().reader();
    const stderr = std.io.getStdErr().writer();

    var gpa = std.heap.GeneralPurposeAllocator(.{}).init;
    try logging.init(gpa.allocator());

    return .{
        .transport = try Transport.init(stdin.any(), stderr.any()),
        .gpa = gpa
    };
}

pub fn deinit(self: *Interface) void {
    logging.deinit(self.gpa.allocator());
    _ = self.gpa.deinit();
}

pub fn begin(self: *Interface) !void {
    // Instead here we would instanciate a ArgumentParser and it will return us subcommands and optionals
    var args = try std.process.argsWithAllocator(self.gpa.allocator());
    defer args.deinit();

    if (!args.skip()) {
        try self.transport.print("{s}\n{s}\n\nExpected subcommand argument\n", .{
            constants.usage,
            constants.commands
        });

        std.posix.exit(1);
    }

    const subcommand_arg = args.next() orelse return self.displayHelp();
    const subcommand = constants.subcommands.get(subcommand_arg) orelse .invalid;
    switch (subcommand) {
        .new => try self.newProject(),
        .build => try self.buildProject(),
        .@"test" => try self.testProject(),
        .run => try self.runProject(),
        .version => try self.displayVersion(),
        .help => try self.displayHelp(),
        .invalid => {
            try self.transport.print("{s}\n{s}\n\nInvalid subcommand: {s}\n", .{
                constants.usage,
                constants.commands,
                subcommand_arg
            });

            std.posix.exit(1);
        }
    }
}

fn displayHelp(self: *Interface) !void {
    try self.transport.write(constants.help);
}

fn displayVersion(self: *Interface) !void {
    try self.transport.print("rukac {s} (released {s})\n", .{
        constants.version_str,
        constants.project_options.version_date
    });
}

fn newProject(self: *Interface) !void {
    _ = self;
}

fn isProperProject(self: Interface) void {
    _ = self;
}

// Create compiler here
fn buildProject(self: *Interface) !void {
    var compiler = try Compiler.init(self.gpa.allocator());
    defer compiler.deinit();

    try compiler.buildProject();
}


fn testProject(self: *Interface) !void {
    _ = self;
}

fn runProject(self: *Interface) !void {
    _ = self;
}
