// @author: ruka-lang
// @created: 2024-03-04

const rukac = @import("root.zig");

const std = @import("std");
const clap = @import("clap");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();

    // Parse command line args
    var res = try clap.parse(
        clap.Help, &rukac.cli.params, 
        clap.parsers.default, .{.allocator = gpa.allocator()}
    );
    defer res.deinit();

    if (res.args.help != 0) {
        return rukac.cli.help();
    } else if (res.args.version != 0) {
        return std.debug.print("rukac {s}\n", .{rukac.cli.constants.version});
    } else {
        return rukac.cli.parse_positionals(&res, gpa.allocator());
    }
}
