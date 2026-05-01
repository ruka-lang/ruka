const std = @import("std");
const Allocator = std.mem.Allocator;

pub fn LinearFifo(t: type) type {
    return struct {
        buf: []t,
        head: usize,
        tail: usize,
        cap: usize,
        len: usize,

        const Fifo = @This();
        const INITITAL_CAPACITY = 8;

        pub const empty = Fifo {
            .buf = &[_]t{},
            .head = 0,
            .tail = 0,
            .cap = 0,
            .len = 0
        };

        pub fn init(self: *Fifo, gpa: Allocator) !void {
            self.buf = try gpa.alloc(t, INITITAL_CAPACITY);
            self.cap = INITITAL_CAPACITY;
        }

        pub fn deinit(self: *Fifo, gpa: Allocator) void {
            gpa.free(self.buf);
            self.* = empty;
        }

        pub fn writeItem(self: *Fifo, gpa: Allocator, item: t) !void {
            if (self.len == self.cap) {
                const new_cap = self.cap * 2;
                const new_buf = try gpa.alloc(t, new_cap);

                if (self.head < self.tail) {
                    @memcpy(new_buf[0..self.len], self.buf[self.head..self.tail]);
                } else {
                    const right_len = self.cap - self.head;
                    @memcpy(new_buf[0..right_len], self.buf[self.head..self.cap]);
                    @memcpy(new_buf[right_len..self.len], self.buf[0..self.tail]);
                }

                gpa.free(self.buf);
                self.buf = new_buf;
                self.cap = new_cap;
                self.head = 0;
                self.tail = self.len;
            }
            self.buf[self.tail] = item;
            self.tail = (self.tail + 1) % self.cap;
            self.len += 1;
        }

        pub fn readItem(self: *Fifo) ?t {
            if (self.len == 0) {
                return null;
            }
            const item = self.buf[self.head];
            self.head = (self.head + 1) % self.cap;
            self.len -= 1;
            return item;
        }

        pub fn ensureUnusedCapacity(self: *Fifo, gpa: Allocator, additional: usize) !void {
            if (self.len + additional > self.cap) {
                const new_cap = @max(self.cap * 2, self.len + additional);
                const new_buf = try gpa.alloc(t, new_cap);

                if (self.head < self.tail) {
                    @memcpy(new_buf[0..self.len], self.buf[self.head..self.tail]);
                } else {
                    const right_len = self.cap - self.head;
                    @memcpy(new_buf[0..right_len], self.buf[self.head..self.cap]);
                    @memcpy(new_buf[right_len..self.len], self.buf[0..self.tail]);
                }

                gpa.free(self.buf);
                self.buf = new_buf;
                self.cap = new_cap;
                self.head = 0;
                self.tail = self.len;
            }
        }
    };
}
