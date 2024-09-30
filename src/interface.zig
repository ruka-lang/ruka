// @author: ruka-lang
// @created: 2024-03-04

//

const rukac = @import("rukac").prelude;
const Transport = rukac.Transport;

const std = @import("std");
const clap = @import("clap");

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

/// Parse and handles command line args
pub fn begin(self: *Interface) !void {
    var res = try clap.parse(
        clap.Help, &constants.params,
        clap.parsers.default, .{.allocator = self.gpa.allocator()}
    );
    defer res.deinit();

    if (res.args.help != 0) return self.displayHelp();
    if (res.args.version != 0) return self.displayVersion();
    if (res.positionals.len < 1) return self.displayHelp();

    const subcommand = constants.subcommands.get(res.positionals[0]) orelse .invalid;
    switch (subcommand) {
        .new => unreachable, 
        .build => {
            //if (res.positionals.len < 2) {
            //    try stderr.print(
            //        \\Compile expects a file arg
            //        \\usage: rukac compile <file> [options]
            //        \\
            //        , .{}
            //    );

            //    try err_bw.flush();
            //    std.posix.exit(1);
            //}

            const filepath = "examples/basics/src/main.ruka";
            //const file = res.positionals[1];

            if (!isProperExtension(filepath)) {
                var path_iter = std.mem.splitBackwardsSequence(u8, filepath, ".");
                try self.transport.print(
                    "Invalid file extension, expected .ruka or .rk, got: .{s}\n",
                    .{path_iter.first()}
                );

                std.posix.exit(1);
            }

            try self.compileFile(filepath, null);
            //try compileFile(file, res.args.output, allocator);
        },
        .@"test", 
        .run => unreachable,
        .invalid => {
            try self.transport.print("Invalid subcommand: {s}\n\n{s}\n{s}\n", .{
                res.positionals[0],
                constants.usage,
                constants.commands
            });

            std.posix.exit(1);
        }
    }
}

/// Displays the help to stdout
fn displayHelp(self: *Interface) !void {
    try self.transport.write(constants.help);
}

/// Displays the help to stdout
fn displayVersion(self: *Interface) !void {
    try self.transport.print("rukac {s} (released {s})\n", .{
        constants.version_str,
        constants.project_options.version_date
    });
}

fn newProject(self: *Interface) void {
    _ = self;
}

/// Checks if the file path ends in the one of the proper file extensions
fn isProperExtension(file: []const u8) bool {
    var path_iter = std.mem.splitBackwardsSequence(u8, file, ".");
    const extension = path_iter.first();

    return std.mem.eql(u8, constants.ext, extension);
}

fn isProperProject(self: Interface) void {
    _ = self;
}

fn buildProject(self: *Interface) void {
    _ = self;
}

/// Creates the compilation unit and begins compilation
fn compileFile(
    self: *Interface,
    in: []const u8,
    out: ?[]const u8
) !void {
    // check if file exists
    const input = try self.cwd.openFile(in, .{});
    defer input.close();

    var buf: [10]u8 = undefined;
    var output = std.io.fixedBufferStream(&buf);

    var compiler = try rukac.Compiler.init(.{
        .input = in,
        .output = out orelse "no output",
        .reader = input.reader().any(),
        .writer = output.writer().any(),
        .allocator = self.gpa.allocator()
    });
    defer compiler.deinit();

    try compiler.compile();
}

fn testProject(self: *Interface) void {
    _ = self;
}
