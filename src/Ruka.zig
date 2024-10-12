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
    self.allocator.destroy(self);
}

pub fn begin(self: *Ruka) !void {
    var arg_parser = try ArgumentParser.init(self.allocator);
    defer arg_parser.deinit();

    try arg_parser.parse();

    switch (arg_parser.getSubcommand().?) {
        .new => try self.newProject(),
        .build => try self.buildProject(),
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
    try self.transport.printStderr("rukac {s} (released {s})\n", .{
        constants.version_str,
        constants.project_options.version_date
    });
}

fn newProject(self: *Ruka) !void {
    _ = self;
}

fn isProperProject(self: Ruka) void {
    _ = self;
}

// Create compiler here
fn buildProject(self: *Ruka) !void {
    var compiler = try Compiler.init(self.allocator);
    defer compiler.deinit();

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
