// @author: ruka-lang
// @created: 2024-09-12

//

const rukac = @import("rukac").prelude;
const chrono = rukac.Chrono;

const std = @import("std");

///
pub const options: std.Options = .{
    .log_level = switch (@import("builtin").mode) {
        .Debug => .debug,
        else => .info
    },
    .logFn = log
};

var log_path: []const u8 = undefined;

///
pub fn get_date_time(allocator: std.mem.Allocator) !struct {
    chrono.date.YearMonthDay,
    chrono.Time
} {
    var tzdb = try chrono.tz.DataBase.init(allocator);
    defer tzdb.deinit();

    const timezone = try tzdb.getLocalTimeZone();

    const timestamp_utc = std.time.timestamp();
    const local_offset = timezone.offsetAtTimestamp(timestamp_utc) orelse {
        std.debug.print("Could not convert current time to local time", .{});
        return error.ConversionFailed;
    };
    const timestamp_local = timestamp_utc + local_offset;

    const date = chrono.date.YearMonthDay.fromDaysSinceUnixEpoch(@intCast(@divFloor(timestamp_local, std.time.s_per_day)));
    const time = chrono.Time{ .secs = @intCast(@mod(timestamp_local, std.time.s_per_day)), .frac = 0 };

    return .{date, time};
}

///
pub fn init(allocator: std.mem.Allocator) !void {
    const home = std.posix.getenv("HOME") orelse {
        std.debug.print("Failed to read $HOME.\n", .{});
        return error.ReadingEnviromentFailed;
    };

    const logs_path = ".local/state/ruka/logs";

    var homedir = try std.fs.openDirAbsolute(home, .{});
    defer homedir.close();

    try homedir.makePath(logs_path);

    var logs = try homedir.openDir(logs_path, .{});
    defer logs.close();

    const created_date, const created_time = try get_date_time(allocator);

    const log_file = try std.fmt.allocPrint(allocator, "rukac-{d:4}{d:02}{d:02}-{d:02}{d:02}{d:02}.log", .{
        @as(u13, @intCast(created_date.year)),
        created_date.month.number(),
        created_date.day,
        chrono.Time.hour(created_time),
        chrono.Time.minute(created_time),
        chrono.Time.second(created_time)
    });
    defer allocator.free(log_file);

    const file = try logs.createFile(log_file, .{});
    file.close();

    log_path = try std.fmt.allocPrint(allocator, "{s}/.local/state/ruka/logs/{s}", .{home, log_file});
}

///
pub fn deinit(allocator: std.mem.Allocator) void {
    allocator.free(log_path);
}

///
pub fn log(
    comptime level: std.log.Level,
    comptime scope: @TypeOf(.EnumLiteral),
    comptime format: []const u8,
    args: anytype
) void {
    var buffer: [4096]u8 = undefined;
    var fba = std.heap.FixedBufferAllocator.init(&buffer);

    const file = std.fs.openFileAbsolute(log_path, .{ .mode = .read_write }) catch |err| {
        std.debug.print("Failed to open log file: {}\n", .{err});
        return;
    };
    defer file.close();

    const stat = file.stat() catch |err| {
        std.debug.print("Failed to get stat of log file: {}\n", .{err});
        return;
    };

    file.seekTo(stat.size) catch |err| {
        std.debug.print("Failed to seek log file: {}\n", .{err});
        return;
    };

    _, const current_time = get_date_time(fba.allocator()) catch |err| {
        std.debug.print("Failed to get current date and time: {}\n", .{err});
        return;
    };

    const prefix = "[" ++ comptime level.asText() ++ "] " ++ "(" ++ @tagName(scope) ++ ")";

    const message = std.fmt.bufPrint(buffer[0..], format ++ "\n", args) catch |err| {
        std.debug.print("Failed to format log message with args: {}\n", .{err});
        return;
    };

    const entry = std.fmt.bufPrint(buffer[message.len..], "{} {s}: {s}",
        .{current_time, prefix, message}
    ) catch |err| {
        std.debug.print("Failed to format log entry: {}\n", .{err});
        return;
    };

    file.writeAll(entry) catch |err| {
        std.debug.print("Failed to write to log file: {}\n", .{err});
    };
}
