const std = @import("std");
const builtin = @import("builtin");
const Allocator = std.mem.Allocator;
const Writer = std.io.Writer;

const BORDER = "=" ** 80;

const Status = enum {
    ok,
    fail,
    skip,
    text,
};

const Results = struct {
    ok: usize,
    fail: usize,
    skip: usize,
    leak: usize,
    count: usize
};

pub fn main() !void {
    var allocator = std.heap.GeneralPurposeAllocator(.{ .stack_trace_frames = 12 }){};
    const gpa = allocator.allocator();

    var stdout_buffer: [1024]u8 = undefined;
    var stdout_file = std.fs.File.stdout().writer(&stdout_buffer);
    const stdout = &stdout_file.interface;

    fmt(stdout, "\r\x1b[0K", .{});
    fmt(stdout, "Testing `Ruka`.\n\n", .{});

    var results = Results {
        .ok = 0,
        .fail = 0,
        .skip = 0,
        .leak = 0,
        .count = 0
    };

    const start = std.time.milliTimestamp();

    for (builtin.test_functions) |t| {
        std.testing.allocator_instance = .{};
        try run_test(gpa, t, &results, stdout);
    }

    const time_passed = std.time.milliTimestamp() - start;
    const seconds = @divTrunc(time_passed, 1000);
    const milliseconds = time_passed - (seconds * 1000);

    const status: Status = if (results.fail == 0) .ok else .fail;

    wstatus(stdout, status, "\nTest{s} finished ", .{ if (results.count != 1) "s" else "" });
    fmt(stdout, "in {d}.{d:03}s. ", .{ seconds, @as(u64, @intCast(milliseconds)) });
    fmt(stdout, "{d} of {d} passed\n", .{ results.ok, results.count});

    if (results.skip > 0) {
        wstatus(stdout, .skip, "{d} test{s} skipped\n", .{ results.skip, if (results.skip != 1) "s" else "" });
    }
    if (results.leak > 0) {
        wstatus(stdout, .fail, "{d} test{s} leaked\n", .{ results.leak, if (results.leak != 1) "s" else "" });
    }

    try stdout.flush();

    std.posix.exit(if (results.fail == 0) 0 else 1);
}

fn run_test(gpa: Allocator, t: anytype, results: *Results, stdout: *Writer) !void {
    var status = Status.ok;

    const test_name = t.name[0..];

    const result = t.func();

    if (std.testing.allocator_instance.deinit() == .leak) {
        results.leak += 1;
        wstatus(stdout, .fail, "\n{s}\n\"{s}\" - Memory Leak\n{s}\n", .{ BORDER, test_name, BORDER });
    }

    if (result) |_| {
        results.ok += 1;
    } else |err| {
        switch (err) {
            error.SkipZigTest => {
                results.skip += 1;
                status = .skip;
            },
            else => {
                status = .fail;
                results.fail += 1;
                wstatus(stdout, .fail, "\n{s}\n\"{s}\" - {s}\n{s}\n", .{ BORDER, test_name, @errorName(err), BORDER });
                if (@errorReturnTrace()) |trace| {
                    std.debug.dumpStackTrace(trace.*);
                }
            },
        }
    }

    wstatus(stdout, status, "[{s}]", .{@tagName(status)});

    const pass_one = try std.mem.replaceOwned(u8, gpa, test_name, ".tests", "");
    defer gpa.free(pass_one);
    const pass_two = try std.mem.replaceOwned(u8, gpa, pass_one, ".test", "");
    defer gpa.free(pass_two);

    var name_iter = std.mem.splitAny(u8, pass_two, ".");
    var module: []const u8 = undefined;
    var module_test: []const u8 = undefined;

    while (name_iter.next()) |name| {
        module = module_test;
        module_test = name;
    }

    fmt(stdout, "\t  ", .{});
    wstatus(stdout, .skip, "{s:<15} ", .{module});
    fmt(stdout, "{d:^5} {s}.\n", .{results.count, module_test});

    results.count += 1;

}

fn fmt(self: *Writer, comptime format: []const u8, args: anytype) void {
    self.print(format, args) catch unreachable;
}

fn wstatus(self: *Writer, s: Status, comptime format: []const u8, args: anytype) void {
    const color = switch (s) {
        .ok => "\x1b[32m",
        .fail => "\x1b[31m",
        .skip => "\x1b[33m",
        else => "",
    };
    self.writeAll(color) catch @panic("writeAll failed?!");
    self.print(format, args) catch @panic("std.fmt.format failed?!");
    fmt(self, "\x1b[0m", .{});
}
