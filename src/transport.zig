// @author: ruka-lang
// @created: 2024-09-25

// The transport layer of rukac

const std = @import("std");

input: ?std.fs.File,
reader: ?std.io.AnyReader,
output: ?std.fs.File,
writer: ?std.io.AnyWriter,

mutex: std.Thread.Mutex,

const Transport = @This();

pub fn init(input: []const u8, reader: ?std.io.AnyReader, output: ?[]const u8, writer: ?std.io.AnyWriter) !Transport {
    var input_file: ?std.fs.File = null;
    if (reader) |_| {} else input_file = try std.fs.cwd().openFile(input, .{});
    const output_file = if (output) |o| try std.fs.cwd().createFile(o, .{}) else null;

    return .{
        .input = input_file,
        .reader = reader orelse input_file.?.reader().any(),
        .output = output_file,
        .writer = writer,
        .mutex = .{}
    };
}

pub fn deinit(self: Transport) void {
    if (self.input) |i| {
        i.close();
    }

    if (self.output) |o| {
        o.close();
    }
}

pub fn readByte(self: *Transport) !u8 {
    self.mutex.lock();
    defer self.mutex.unlock();

    return try self.reader.?.readByte();
}

pub fn write(self: *Transport, msg: []const u8) !void {
    self.mutex.lock();
    defer self.mutex.unlock();

    try self.writer.?.write(msg);
}
