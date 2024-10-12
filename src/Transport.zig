// @author: ruka-lang
// @created: 2024-09-25

const std = @import("std");
const Allocator = std.mem.Allocator;
const AnyReader = std.io.AnyReader;
const AnyWriter = std.io.AnyWriter;
const BufferedReader = std.io.BufferedReader;
const BufferedWriter = std.io.BufferedWriter;
const File = std.fs.File;
const Mutex = std.Thread.Mutex;

file: ?File,
br: ?BufferedReader(4096, AnyReader),
bw: ?BufferedWriter(4096, AnyWriter),

allocator: Allocator,

mutex: Mutex,

const Transport = @This();

pub fn init(allocator: Allocator, reader: ?AnyReader, writer: ?AnyWriter) !*Transport {
    const transport = try allocator.create(Transport);
    transport.* = .{
        .file = null,
        .br = if (reader) |r| std.io.bufferedReader(r) else null,
        .bw = if (writer) |w| std.io.bufferedWriter(w) else null,

        .allocator = allocator,

        .mutex = .{}
    };

    return transport;
}

pub fn initWithFile(allocator: Allocator, file: File) !*Transport {
    const transport = try allocator.create(Transport);
    transport.* = .{
        .file = file,
        .br = std.io.bufferedReader(file.reader().any()),
        .bw = std.io.bufferedWriter(file.writer().any()),

        .allocator = allocator,

        .mutex = .{}
    };

    return transport;
}

pub fn deinit(self: *Transport) void {
    self.allocator.destroy(self);
}

pub fn getHandle(self: Transport) std.fs.File.Handle {
    return self.file.?.handle;
}

pub fn flush(self: *Transport) !void {
    try self.bw.?.flush();
}

pub fn read(self: *Transport, buffer: []u8) !usize {
    self.mutex.lock();
    defer self.mutex.unlock();

    return try self.br.?.reader().read(buffer);
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

pub fn writeAll(self: *Transport, msg: []const u8) !void {
    self.mutex.lock();
    defer self.mutex.unlock();

    try self.bw.?.writer().writeAll(msg);
    try self.bw.flush();
}

pub fn writeAllNoFlush(self: *Transport, msg: []const u8) !void {
    self.mutex.lock();
    defer self.mutex.unlock();

    try self.bw.?.writer().writeAll(msg);
}

pub fn print(self: *Transport, comptime msg: []const u8, args: anytype) !void {
    self.mutex.lock();
    defer self.mutex.unlock();

    try self.bw.?.writer().print(msg, args);
    try self.bw.?.flush();
}

pub fn printNoFlush(self: *Transport, comptime msg: []const u8, args: anytype) !void {
    self.mutex.lock();
    defer self.mutex.unlock();

    try self.bw.?.writer().print(msg, args);
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
