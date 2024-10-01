// @author: ruka-lang
// @created: 2024-03-04

const ruka = @import("libruka").prelude;
const Transport = ruka.Transport;

const std = @import("std");

cwd: std.fs.Dir,
transport: Transport,
gpa: std.heap.GeneralPurposeAllocator(.{}),

const Interface = @This();

pub const constants = @import("interface/constants.zig");
pub const logging = @import("interface/logging.zig");
pub const CommandParser = @import("interface/commandParser.zig");

pub fn init() Interface {
    const stdin = std.io.getStdIn().reader();
    const stderr = std.io.getStdErr().writer();
    var transport = try Transport.init(stdin.any(), stderr.any());

    var gpa = std.heap.GeneralPurposeAllocator(.{}).init;

    logging.init(gpa.allocator()) catch |err| {
        transport.print("Error when initialize logs: {}", .{err}) catch unreachable;
    };

    return .{
        .cwd = std.fs.cwd(),
        .transport = transport,
        .gpa = gpa
    };
}

pub fn deinit(self: *Interface) void {
    logging.deinit(self.gpa.allocator());
    _ = self.gpa.deinit();
}

pub fn begin(self: *Interface) !void {
    const args = std.os.argv;
    if (args.len < 2) return self.displayHelp();

    const subcommand = constants.subcommands.get(std.mem.span(args[1])) orelse .invalid;
    switch (subcommand) {
        .new => try self.newProject(),
        .build => try self.buildProject(),
        .@"test" => try self.testProject(),
        .run => try self.runProject(),
        .version => try self.displayVersion(),
        .help => try self.displayHelp(),
        .invalid => {
            try self.transport.print("Invalid subcommand: {s}\n\n{s}\n{s}\n", .{
                args[1],
                constants.usage,
                constants.commands
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

fn isProperExtension(file: []const u8) bool {
    var path_iter = std.mem.splitBackwardsSequence(u8, file, ".");
    const extension = path_iter.first();

    return std.mem.eql(u8, constants.ext, extension);
}

fn isProperProject(self: Interface) void {
    _ = self;
}

// Create compiler here
fn buildProject(self: *Interface) !void {
    const filepath = "examples/basics/src/main.ruka";

    if (!isProperExtension(filepath)) {
        var path_iter = std.mem.splitBackwardsSequence(u8, filepath, ".");
        try self.transport.print(
            "Invalid file extension, expected .ruka or .rk, got: .{s}\n",
            .{path_iter.first()}
        );

        std.posix.exit(1);
    }

    try self.compileFile(filepath, null);
}

// This will be inside compiler, generating a unit
fn compileFile(
    self: *Interface,
    in: []const u8,
    out: ?[]const u8
) !void {
    const input = try self.cwd.openFile(in, .{});
    defer input.close();

    var buf: [10]u8 = undefined;
    var output = std.io.fixedBufferStream(&buf);

    var compiler = try ruka.Compiler.init(.{
        .input = in,
        .output = out orelse "no output",
        .reader = input.reader().any(),
        .writer = output.writer().any(),
        .allocator = self.gpa.allocator()
    });
    defer compiler.deinit();

    try compiler.compile();
}

fn testProject(self: *Interface) !void {
    _ = self;
}

fn runProject(self: *Interface) !void {
    _ = self;
}