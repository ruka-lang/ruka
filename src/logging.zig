// @author: ruka-lang
// @created: 2024-09-12

const std = @import("std");
const chrono = @import("chrono");

///
pub const options: std.Options = .{
    .log_level = switch (@import("builtin").mode) {
        .Debug => .debug,
        else => .info
    },
    .logFn = log
};

var log_file: []const u8 = undefined;

///
pub fn get_date_time_des(allocator: std.mem.Allocator) !struct {
    chrono.date.YearMonthDay, 
    chrono.Time, 
    ?[]const u8
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

    const designation = timezone.designationAtTimestamp(timestamp_utc);

    const date = chrono.date.YearMonthDay.fromDaysSinceUnixEpoch(@intCast(@divFloor(timestamp_local, std.time.s_per_day)));
    const time = chrono.Time{ .secs = @intCast(@mod(timestamp_local, std.time.s_per_day)), .frac = 0 };

    return .{date, time, designation};
}

///
pub fn init(allocator: std.mem.Allocator) !void {
    const home = std.posix.getenv("HOME") orelse {
        std.debug.print("Failed to read $HOME.\n", .{});
        return error.ReadingEnviromentFailed;
    };
    var homedir = try std.fs.openDirAbsolute(home, .{});
    defer homedir.close();

    const logspath = ".local/state/ruka/logs";
    try homedir.makePath(logspath);

    var logs = try homedir.openDir(logspath, .{});
    defer logs.close();

    const created_date, const created_time, _ = try get_date_time_des(allocator);

    log_file = std.fmt.allocPrint(allocator, "rukac-{d:4}{d:02}{d:02}-{d:02}{d:02}{d:02}.log", .{
        @as(u13, @intCast(created_date.year)), 
        created_date.month.number(), 
        created_date.day, 
        chrono.Time.hour(created_time), 
        chrono.Time.minute(created_time), 
        chrono.Time.second(created_time)
    }) catch |err| {
        std.debug.print("Failed to format log filename: {}\n", .{err});
        return error.FormatFailed;
    };

    const file = logs.createFile(log_file, .{}) catch |err| {
        std.debug.print("Failed to create log file: {}\n", .{err});
        return error.FileCreationFailed;
    };
    file.close();
}

///
pub fn deinit(allocator: std.mem.Allocator) void {
    allocator.free(log_file);
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

    const home = std.posix.getenv("HOME") orelse {
        std.debug.print("Failed to read $HOME.\n", .{});
        return;
    };

    var homedir = std.fs.openDirAbsolute(home, .{}) catch |err| {
        std.debug.print("Failed to open log file path: {}\n", .{err});
        return;
    };
    defer homedir.close();

    const path = std.fmt.bufPrint(buffer[0..], "{s}/{s}",
        .{".local/state/ruka/logs", log_file}
    ) catch |err| {
        std.debug.print("Failed to format log file path: {}\n", .{err});
        return;
    };

    const file = homedir.openFile(path, .{ .mode = .read_write }) catch |err| {
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

    _, const current_time, _ = get_date_time_des(fba.allocator()) catch |err| {
        std.debug.print("Failed to get current date and time: {}\n", .{err});
        return;
    };

    const timestamp = std.fmt.bufPrint(buffer[4088..], "{}", .{current_time}) catch |err| {
        std.debug.print("Failed to format timestamp: {}\n", .{err});
        return;
    };

    const prefix = "[" ++ comptime level.asText() ++ "] " ++ "(" ++ @tagName(scope) ++ ")";

    const header = std.fmt.bufPrint(buffer[0..], "{s} {s}:", 
        .{timestamp, prefix}
    ) catch |err| {
        std.debug.print("Failed to format timestamp: {}\n", .{err});
        return;
    };

    const message = std.fmt.bufPrint(buffer[header.len..], " " ++ format ++ "\n", args) catch |err| {
        std.debug.print("Failed to format log message with args: {}\n", .{err});
        return;
    };

    const entry = std.fmt.bufPrint(buffer[header.len + message.len..], "{s}{s}", .{header, message}) catch |err| {
        std.debug.print("Failed to format log message with args: {}\n", .{err});
        return;
    };

    file.writeAll(entry) catch |err| {
        std.debug.print("Failed to write to log file: {}\n", .{err});
    };
}
