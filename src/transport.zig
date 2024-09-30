// @author: ruka-lang
// @created: 2024-09-25

// The transport layer of rukac

const std = @import("std");

reader: std.io.AnyReader,
writer: std.io.AnyWriter,

br: std.io.BufferedReader(4096, std.io.AnyReader),
bw: std.io.BufferedWriter(4096, std.io.AnyWriter),

mutex: std.Thread.Mutex,

const Transport = @This();

pub fn init(reader: std.io.AnyReader, writer: std.io.AnyWriter) !Transport {
    return .{
        .reader = reader,
        .writer = writer,

        .br = std.io.bufferedReader(reader),
        .bw = std.io.bufferedWriter(writer),

        .mutex = .{}
    };
}

pub fn readByte(self: *Transport) !u8 {
    self.mutex.lock();
    defer self.mutex.unlock();

    return try self.br.reader().readByte();
}

pub fn write(self: *Transport, msg: []const u8) !void {
    self.mutex.lock();
    defer self.mutex.unlock();

    _ = try self.bw.writer().write(msg);
    try self.bw.flush();
}

pub fn print(self: *Transport, comptime msg: []const u8, args: anytype) !void {
    self.mutex.lock();
    defer self.mutex.unlock();

    try self.bw.writer().print(msg, args);
    try self.bw.flush();
}
