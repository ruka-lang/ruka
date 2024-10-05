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
    try logging.init();

    return .{
        .transport = .init(null, null),
        .gpa = .init
    };
}

pub fn deinit(self: *Interface) void {
    _ = self.gpa.deinit();
}

pub fn begin(self: *Interface) !void {
    var arg_parser = ArgumentParser.init(self.gpa.allocator());
    defer arg_parser.deinit();

    try arg_parser.parse();

    switch (arg_parser.getSubcommand().?) {
        .new => try self.newProject(),
        .build => try self.buildProject(),
        .@"test" => try self.testProject(),
        .run => try self.runProject(),
        .version => try self.displayVersion(),
        .help => try self.displayHelp()
    }
}

fn displayHelp(self: *Interface) !void {
    try self.transport.writeStderr(constants.help);
}

fn displayVersion(self: *Interface) !void {
    try self.transport.printStderr("rukac {s} (released {s})\n", .{
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

test "test all interface modules" {
    _ = tests;
    _ = ArgumentParser;
    _ = logging;
}

const tests = struct {

};
