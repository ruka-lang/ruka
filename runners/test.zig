const std = @import("std");
const builtin = @import("builtin");

const BORDER = "=" ** 80;

const Status = enum {
    ok,
    fail,
    skip,
    text,
};

fn getenvOwned(allocator: std.mem.Allocator, key: []const u8) ?[]u8 {
    const v = std.process.getEnvVarOwned(allocator, key) catch |err| {
        if (err == error.EnvironmentVariableNotFound) {
            return null;
        }
        std.log.warn("failed to get env var {s} due to err {}", .{ key, err });
        return null;
    };
    return v;
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{ .stack_trace_frames = 12 }){};
    const allocator = gpa.allocator();
    const fail_first = blk: {
        if (getenvOwned(allocator, "TEST_FAIL_FIRST")) |e| {
            defer allocator.free(e);
            break :blk std.mem.eql(u8, e, "true");
        }
        break :blk false;
    };
    const filter = getenvOwned(allocator, "TEST_FILTER");
    defer if (filter) |f| allocator.free(f);

    const stdout_file = std.io.getStdOut().writer();
    var bw = std.io.bufferedWriter(stdout_file);
    const out = bw.writer();

    fmt(out.any(), "\r\x1b[0K", .{}); // beginning of line and clear to end of line

    fmt(out.any(), "Testing `Ruka`.\n\n", .{});

    var ok: usize = 0;
    var fail: usize = 0;
    var skip: usize = 0;
    var leak: usize = 0;
    var test_count: usize = 0;

    const start = std.time.milliTimestamp();

    for (builtin.test_functions) |t| {
        std.testing.allocator_instance = .{};
        var status = Status.ok;

        if (filter) |f| {
            if (std.mem.indexOf(u8, t.name, f) == null) {
                continue;
            }
        }

        const test_name = t.name[0..];

        const result = t.func();

        if (std.testing.allocator_instance.deinit() == .leak) {
            leak += 1;
            wstatus(out.any(), .fail, "\n{s}\n\"{s}\" - Memory Leak\n{s}\n", .{ BORDER, test_name, BORDER });
        }

        if (result) |_| {
            ok += 1;
        } else |err| {
            switch (err) {
                error.SkipZigTest => {
                    skip += 1;
                    status = .skip;
                },
                else => {
                    status = .fail;
                    fail += 1;
                    wstatus(out.any(), .fail, "\n{s}\n\"{s}\" - {s}\n{s}\n", .{ BORDER, test_name, @errorName(err), BORDER });
                    if (@errorReturnTrace()) |trace| {
                        std.debug.dumpStackTrace(trace.*);
                    }
                    if (fail_first) {
                        break;
                    }
                },
            }
        }

        wstatus(out.any(), status, "[{s}]", .{@tagName(status)});

        const pass_one = try std.mem.replaceOwned(u8, allocator, test_name, ".tests", "");
        defer allocator.free(pass_one);
        const pass_two = try std.mem.replaceOwned(u8, allocator, pass_one, ".test", "");
        defer allocator.free(pass_two);

        var name_iter = std.mem.splitAny(u8, pass_two, ".");
        var module: []const u8 = undefined;
        var module_test: []const u8 = undefined;

        while (name_iter.next()) |name| {
            module = module_test;
            module_test = name;
        }

        fmt(out.any(), "\t  ", .{});
        wstatus(out.any(), .skip, "{s:<15} ", .{module});
        fmt(out.any(), "{d:^5} {s}.\n", .{test_count, module_test});

        test_count += 1;
    }

    const total_tests = ok + fail;
    const status: Status = if (fail == 0) .ok else .fail;

    const time_passed = std.time.milliTimestamp() - start;
    const seconds = @divTrunc(time_passed, 1000); 
    const milliseconds = time_passed - (seconds * 1000);

    wstatus(out.any(), status, "\nTest{s} finished ", .{ if (total_tests != 1) "s" else "" });
    fmt(out.any(), "in {d}.{d:04}s. ", .{ seconds, @as(u64, @intCast(milliseconds)) });
    fmt(out.any(), "{d} of {d} passed\n", .{ ok, total_tests});

    if (skip > 0) {
        wstatus(out.any(), .skip, "{d} test{s} skipped\n", .{ skip, if (skip != 1) "s" else "" });
    }
    if (leak > 0) {
        wstatus(out.any(), .fail, "{d} test{s} leaked\n", .{ leak, if (leak != 1) "s" else "" });
    }

    try bw.flush();

    std.posix.exit(if (fail == 0) 0 else 1);
}

fn fmt(self: std.io.AnyWriter, comptime format: []const u8, args: anytype) void {
    self.print(format, args) catch unreachable;
}

fn wstatus(self: std.io.AnyWriter, s: Status, comptime format: []const u8, args: anytype) void {
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
