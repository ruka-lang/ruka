// @author: ruka-lang
// @created: 2024-03-04

const libruka = @import("ruka").prelude;
const Compiler = libruka.Compiler;
const Transport = libruka.Transport;

const std = @import("std");
const Allocator = std.mem.Allocator;

transport: *Transport,
allocator: Allocator,

const Ruka = @This();

pub const ArgumentParser = @import("ruka/ArgumentParser.zig");
pub const constants = @import("ruka/constants.zig");
pub const logging = @import("ruka/logging.zig");
pub const Repl = @import("ruka/Repl.zig");

pub fn init(allocator: Allocator) !*Ruka {
    const interface = try allocator.create(Ruka);
    errdefer interface.deinit();

    interface.* = .{
        .transport = try .init(allocator, null, null),
        .allocator = allocator
    };

    return interface;
}

pub fn deinit(self: *Ruka) void {
    self.transport.deinit();
    self.allocator.destroy(self);
}

pub fn start(self: *Ruka) !void {
    var arg_parser = try ArgumentParser.init(self.allocator);
    defer arg_parser.deinit();

    arg_parser.parse() catch |err| {
        switch (err) {
            error.MissingSubcommand => {
                try self.transport.printStderr("{s}\n{s}\n\nExpected subcommand argument\n", .{
                    constants.usage,
                    constants.subcommands_display
                });

                return;
            },
            else => return err
        }
    };

    switch (arg_parser.getSubcommand().?) {
        .new => try self.newProject(),
        .build => try self.buildProject(arg_parser),
        .@"test" => try self.testProject(),
        .run => try self.runProject(),
        .repl => try self.startRepl(),
        .version => try self.displayVersion(),
        .help => try self.displayHelp()
    }
}

fn displayHelp(self: *Ruka) !void {
    try self.transport.writeStderr(constants.help);
}

fn displayVersion(self: *Ruka) !void {
    try self.transport.writeStderr(constants.version);
}

fn newProject(self: *Ruka) !void {
    _ = self;
}

fn isProperProject(self: Ruka) void {
    _ = self;
}

fn buildProject(self: *Ruka, arg_parser: *ArgumentParser) !void {
    var compiler = try Compiler.init(self.allocator);
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


fn testProject(self: *Ruka) !void {
    _ = self;
}

fn runProject(self: *Ruka) !void {
    _ = self;
}

fn startRepl(self: *Ruka) !void {
    var repl = try Repl.init(self, self.allocator);
    defer repl.deinit();

    try repl.run();
}

test "test all interface modules" {
    _ = tests;
    _ = ArgumentParser;
    _ = logging;
}

const tests = struct {

};
