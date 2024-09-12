// @author: ruka-lang
// @created: 2024-03-04

const std = @import("std");

/// Represents a 2d position in a file
pub const Position = struct {
    line: usize = 0, 
    col: usize = 0
};

/// Checks if a byte is a alphabetical character
pub fn is_alphabetical(byte: u8) bool {
    return switch(byte) {
        inline 'a'...'z', 'A'...'Z' => true,
        else => false
    };
}

/// Checks if a byte is a integral character or a underscore
pub fn is_integral(byte: u8) bool {
    return switch(byte) {
        inline '0'...'9', '_' => true,
        else => false
    };
}

/// Checks if a byte is a integral character or an underscore or a period
pub fn is_numeric(byte: u8) bool {
    return is_integral(byte) or byte == '.';
}

/// Checks if a byte is a alphabetical or numerical
pub fn is_alphanumerical(byte: u8) bool {
    return is_alphabetical(byte) or is_integral(byte);
}

/// Checks if a string represents an escape character, if it does return that character
pub fn try_escape_char(str: []const u8) ?u8 {
    // Check for \u{xxxxxx} and \x{xx}
    return escapes.get(str);
}

// Map representing escape sequences and their string representation
const escapes = std.StaticStringMap(u8).initComptime(.{
    .{"\\n", '\n'},
    .{"\\r", '\r'},
    .{"\\t", '\t'},
    .{"\\\\", '\\'},
    .{"\\|", '|'},
    .{"\\'", '\''},
    .{"\\\"", '"'},
    .{"\\0", '\x00'}
});

var time: i64 = undefined;

pub fn setup_logs(allocator: std.mem.Allocator) !void {
    const home = std.posix.getenv("HOME") orelse {
        std.debug.print("Failed to read $HOME.\n", .{});
        return;
    };
    var homedir = try std.fs.openDirAbsolute(home, .{});
    defer homedir.close();

    time = std.time.timestamp();

    const logspath = ".local/state/ruka/rukac/logs";
    try homedir.makePath(logspath);

    var logs = try homedir.openDir(logspath, .{});
    defer logs.close();

    const filename = std.fmt.allocPrint(allocator, "{d}.log", .{time})
    catch |err| {
        std.debug.print("Failed to format log filename: {}\n", .{err});
        return;
    };
    defer allocator.free(filename);

    const file = logs.createFile(filename, .{}) catch |err| {
        std.debug.print("Failed to create log file: {}\n", .{err});
        return;
    };
    file.close();
}

pub fn log(
    comptime level: std.log.Level,
    comptime scope: @TypeOf(.EnumLiteral),
    comptime format: []const u8,
    args: anytype
) void {
    const allocator = std.heap.page_allocator;
    const home = std.posix.getenv("HOME") orelse {
        std.debug.print("Failed to read $HOME.\n", .{});
        return;
    };

    var homedir = std.fs.openDirAbsolute(home, .{}) catch |err| {
        std.debug.print("Failed to create log file path: {}\n", .{err});
        return;
    };
    defer homedir.close();

    const path = std.fmt.allocPrint(allocator, "{s}/{d}.log",
        .{".local/state/ruka/rukac/logs", time})
    catch |err| {
        std.debug.print("Failed to create log file path: {}\n", .{err});
        return;
    };
    defer allocator.free(path);

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

    const prefix = "[" ++ comptime level.asText() ++ "] " ++ "(" ++ @tagName(scope) ++ ") ";

    var buffer: [4096]u8 = undefined;
    const message = std.fmt.bufPrint(buffer[0..], prefix ++ format ++ "\n", args) catch |err| {
        std.debug.print("Failed to format log message with args: {}\n", .{err});
        return;
    };
    file.writeAll(message) catch |err| {
        std.debug.print("Failed to write to log file: {}\n", .{err});
    };
}
