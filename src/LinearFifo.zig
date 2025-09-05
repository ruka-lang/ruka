const std = @import("std");
const Allocator = std.mem.Allocator;

pub fn LinearFifo(t: type) type {
    const Node = struct {
        item: t,
        next: ?*@This(),
    };

    return struct {
        head: ?*Node,
        tail: ?*Node,
        len: usize,

        const Fifo = @This();

        pub const empty = Fifo {
            .head = null,
            .tail = null,
            .len = 0,
        };

        pub fn deinit(self: *Fifo, gpa: Allocator) void {
            var current = self.head;
            while (current) |node| {
                const next = node.next;
                gpa.destroy(node);
                current = next;
            }
            self.head = null;
            self.tail = null;
            self.len = 0;
        }

        pub fn writeItem(self: *Fifo, gpa: Allocator, item: t) !void {
            const new_node = try gpa.create(Node);
            new_node.* = .{
                .item = item,
                .next = null,
            };

            if (self.tail) |old_tail| {
                old_tail.next = new_node;
            } else {
                self.head = new_node;
            }
            self.tail = new_node;
            self.len += 1;
        }

        pub fn readItem(self: *Fifo) ?t {
            if (self.head) |old_head| {
                const item = old_head.item;
                self.head = old_head.next;
                if (self.head == null) {
                    self.tail = null;
                }
                self.len -= 1;
                return item;
            } else {
                return null;
            }
        }
    };
}