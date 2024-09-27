// @author: ruka-lang
// @created: 2024-09-25

// The transport layer of rukac

const std = @import("std");

reader: std.io.AnyReader,
writer: std.io.AnyWriter,

mutex: std.Thread.Mutex,

const Transport = @This();

pub fn init(reader: std.io.AnyReader, writer: std.io.AnyWriter) !Transport {
    return .{
        .reader = reader,       
        .writer = writer,

        .mutex = .{}
    };
}

pub fn readByte(self: *Transport) !u8 {
    self.mutex.lock();
    defer self.mutex.unlock();

    return try self.reader.readByte();
}

pub fn write(self: *Transport, msg: []const u8) !void {
    self.mutex.lock();
    defer self.mutex.unlock();

    try self.writer.write(msg);
}
