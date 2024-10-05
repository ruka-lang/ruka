// @author: ruka-lang
// @created: 2024-09-25

// The transport layer of rukac

const std = @import("std");

br: ?std.io.BufferedReader(4096, std.io.AnyReader),
bw: ?std.io.BufferedWriter(4096, std.io.AnyWriter),

mutex: std.Thread.Mutex,

const Transport = @This();

pub fn init(reader: ?std.io.AnyReader, writer: ?std.io.AnyWriter) Transport {
    return .{
        .br = if (reader) |r| std.io.bufferedReader(r) else null,
        .bw = if (writer) |w| std.io.bufferedWriter(w) else null,

        .mutex = .{}
    };
}

pub fn readByte(self: *Transport) !u8 {
    self.mutex.lock();
    defer self.mutex.unlock();

    return try self.br.?.reader().readByte();
}

pub fn write(self: *Transport, msg: []const u8) !void {
    self.mutex.lock();
    defer self.mutex.unlock();

    _ = try self.bw.?.writer().write(msg);
    try self.bw.flush();
}

pub fn print(self: *Transport, comptime msg: []const u8, args: anytype) !void {
    self.mutex.lock();
    defer self.mutex.unlock();

    try self.bw.?.writer().print(msg, args);
    try self.bw.?.flush();
}


pub fn writeStderr(_: Transport, msg: []const u8) !void {
    const stderr = std.io.getStdErr();
    _ = try stderr.writer().write(msg);
}

pub fn printStderr(_: Transport, comptime msg: []const u8, args: anytype) !void {
    const stderr = std.io.getStdErr();
    try stderr.writer().print(msg, args);
}

test "test all transport modules" {
    _ = tests;
}

const tests = struct {

};
