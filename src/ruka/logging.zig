// @author: ruka-lang
// @created: 2024-09-12

const libruka = @import("ruka").prelude;
const Chrono = libruka.Chrono;

const std = @import("std");
const bufPrint = std.fmt.bufPrint;

pub const options: std.Options = .{
    .log_level = switch (@import("builtin").mode) {
        .Debug => .debug,
        else => .info
    },
    .logFn = log
};

// Make this a struct and log use synchronization

var path_buffer: [512]u8 = undefined;
var path: []u8 = undefined;

pub fn init() !void {
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

    // Update to check local timezone
    const current_time = Chrono.init(.PST);

    const log_file = try bufPrint(path_buffer[512 - 50..], "ruka-{d:4}_{d:02}_{d:02}-{d:02}_{d:02}_{d:02}.log", .{
        @as(u13, @intCast(current_time.year)),
        @intFromEnum(current_time.month) + 1,
        current_time.day,
        current_time.hour,
        current_time.minute,
        current_time.second
    });

    const file = try logs.createFile(log_file, .{});
    file.close();

    path = try bufPrint(path_buffer[0..], "{s}/{s}/{s}", .{home, logs_path, log_file});
}

pub fn log(
    comptime level: std.log.Level,
    comptime scope: @TypeOf(.EnumLiteral),
    comptime format: []const u8,
    args: anytype
) void {
    var buffer: [4096]u8 = undefined;

    const file = std.fs.openFileAbsolute(path, .{ .mode = .read_write }) catch |err| {
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

    const prefix = "[" ++ comptime level.asText() ++ "] " ++ "(" ++ @tagName(scope) ++ ")";

    const message = bufPrint(buffer[0..], format ++ "\n", args) catch |err| {
        std.debug.print("Failed to format log message with args: {}\n", .{err});
        return;
    };

    // Update to check local timezone
    const current_time = Chrono.init(.PST);

    const entry = bufPrint(buffer[message.len..], "{d:02}:{d:02}:{d:02} {s}: {s}", .{
        current_time.hour, current_time.minute, current_time.second,
        prefix, message
    }) catch |err| {
        std.debug.print("Failed to format log entry: {}\n", .{err});
        return;
    };

    file.writeAll(entry) catch |err| {
        std.debug.print("Failed to write to log file: {}\n", .{err});
    };
}

test "test all logging modules" {
    _ = tests;
}

const tests = struct {

};
