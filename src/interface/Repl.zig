const ruka = @import("ruka").prelude;
const Interface = @import("../Interface.zig");

const std = @import("std");
const Allocator = std.mem.Allocator;
const AnyWriter = std.io.AnyWriter;
const File = std.fs.File;
const Termios = std.posix.termios;
const builtin = @import("builtin");

original: Termios = undefined,
raw: Termios = undefined,

utf8_supported: bool,
status: enum {uninitialized, initialized, running, exiting_success, exiting_failure},

interface: *Interface,

allocator: Allocator,

const Repl = @This();

var tty: File = undefined;
var size: Size = undefined;
var position: Position = undefined;

pub fn init(interface: *Interface, allocator: Allocator) !*Repl {
    const terminal = try allocator.create(Repl);
    errdefer allocator.destroy(terminal);

    terminal.* = .{
        .original = undefined,
        .raw = undefined,
        .utf8_supported = try is_utf8_supported(),
        .status = .uninitialized,
        .interface = interface,
        .allocator = allocator,
    };

    try terminal.tty_setup();

    return terminal;
}

pub fn deinit(self: *Repl) void {
    self.allocator.destroy(self);
}

fn tty_setup(self: *Repl) !void {
    tty = std.io.getStdIn();

    self.original = try std.posix.tcgetattr(tty.handle);
    self.raw = self.original;

    self.raw.lflag.ECHO = false;
    self.raw.lflag.ICANON = false;
    self.raw.lflag.ISIG = false;
    self.raw.lflag.IEXTEN = false;

    self.raw.iflag.IXON = false;
    self.raw.iflag.ICRNL = false;
    self.raw.iflag.BRKINT = false;
    self.raw.iflag.INPCK = false;
    self.raw.iflag.ISTRIP = false;

    self.raw.oflag.OPOST = false;

    self.raw.cflag.CSIZE = .CS8;

    self.raw.cc[@intFromEnum(std.posix.system.V.TIME)] = 0;
    self.raw.cc[@intFromEnum(std.posix.system.V.MIN)] = 1;

    size = try resize();
    position = .{.row = 1, .col = 1};

    self.status = .initialized;
}

const Size = struct {
    width: usize,
    height: usize
};

const Position = struct {
    row: usize,
    col: usize,

    pub fn move_up(self: *Position) void {
        if (self.row <= 1) return;
        self.row = std.math.clamp(self.row - 1, 1, size.height - 2);
    }

    pub fn move_left(self: *Position) void {
        if (self.col <= 1) return;
        self.col = std.math.clamp(self.col - 1, 1, size.width - 1);
    }

    pub fn move_down(self: *Position) void {
        self.row = std.math.clamp(self.row + 1, 1, size.height - 2);
    }

    pub fn move_right(self: *Position) void {
        self.col = std.math.clamp(self.col + 1, 1, size.width - 1);
    }
};

const Job = union(enum) {
    input: u8,
    tick
};

pub fn run(self: *Repl) !void {
    if (self.status == .uninitialized) return error.UninitializedTTY;

    try self.uncook();
    defer self.cook() catch {};

    self.status = .running;

    var buffer: [1]u8 = undefined;

    std.posix.sigaction(std.posix.SIG.WINCH, &std.posix.Sigaction{
        .handler = .{ .handler = handle_sig_winch },
        .mask = std.posix.empty_sigset,
        .flags = 0
    }, null);

    self.status = .running;

    outer: while(true) {
        try render();
        _ = try tty.read(&buffer);

        switch (buffer[0]) {
            'q' => break,
            // Escape sequences
            '\x1B' => {
                self.raw.cc[@intFromEnum(std.posix.system.V.TIME)] = 1;
                self.raw.cc[@intFromEnum(std.posix.system.V.MIN)] = 0;
                try std.posix.tcsetattr(tty.handle, .NOW, self.raw);

                var esc_buffer: [8]u8 = undefined;
                const esc_read = try tty.read(&esc_buffer);

                self.raw.cc[@intFromEnum(std.posix.system.V.TIME)] = 0;
                self.raw.cc[@intFromEnum(std.posix.system.V.MIN)] = 1;
                try std.posix.tcsetattr(tty.handle, .FLUSH, self.raw);

                if (esc_read == 0) {
                    // Escape
                    continue;
                } else if (std.mem.eql(u8, esc_buffer[0..esc_read], "[A")) {
                    position.move_up();
                } else if (std.mem.eql(u8, esc_buffer[0..esc_read], "[D")) {
                    position.move_left();
                } else if (std.mem.eql(u8, esc_buffer[0..esc_read], "[B")) {
                    position.move_down();
                } else if (std.mem.eql(u8, esc_buffer[0..esc_read], "[C")) {
                    position.move_right();
                }
            },
            'w', 'k' => position.move_up(),
            'a', 'h' => position.move_left(),
            's', 'j' => position.move_down(),
            'd', 'l' => position.move_right(),
            else => {
                // Check for Ctrl-{ch} characters
                for ('a'..'z' + 1) |char| {
                    if (buffer[0] == char & '\x1F') {
                        // is a Ctrl-{ch}
                        continue: outer;
                    }
                }
            }
        }
    }
}

fn handle_sig_winch(_: c_int) callconv(.C) void {
    size = resize() catch return;
    render() catch return;
}

fn uncook(self: *Repl) !void {
    var bw = std.io.bufferedWriter(tty.writer());
    const writer = bw.writer();
    errdefer self.cook() catch {};

    try std.posix.tcsetattr(tty.handle, .FLUSH, self.raw);

    try enable_alt_buffer(writer.any());
    try hide_cursor(writer.any());
    try save_cursor(writer.any());
    try save_screen(writer.any());
    try clear(writer.any());

    try bw.flush();
}

fn cook(self: *Repl) !void {
    var bw = std.io.bufferedWriter(tty.writer());
    const writer = bw.writer();

    try std.posix.tcsetattr(tty.handle, .FLUSH, self.original);

    try clear(writer.any());
    try reset_attribute(writer.any());
    try restore_screen(writer.any());
    try restore_cursor(writer.any());
    try show_cursor(writer.any());
    try disable_alt_buffer(writer.any());

    try bw.flush();
}

fn render() !void {
    var bw = std.io.bufferedWriter(tty.writer());
    const writer = bw.writer();

    try clear(writer.any());
    try draw_border(writer.any());
    try draw_cursor(writer.any());
    try bw.flush();
}

fn draw_border(writer: AnyWriter) !void {
    for (0..size.height - 1) |i| {
        try move_cursor(writer, i, 0);
        try writer.writeAll("\u{2502}");

        try move_cursor(writer, i, size.width);
        try writer.writeAll("\u{2502}");
    }

    for (0..size.width) |i| {
        try move_cursor(writer, 0, i);
        try writer.writeAll("\u{2500}");

        try move_cursor(writer, size.height - 1, i);
        try writer.writeAll("\u{2500}");
    }

    try move_cursor(writer, 0, 0);
    try writer.writeAll("\u{250c}");
    try move_cursor(writer, 0, size.width);
    try writer.writeAll("\u{2510}");
    try move_cursor(writer, size.height - 1, 0);
    try writer.writeAll("\u{2514}");
    try move_cursor(writer, size.height - 1, size.width);
    try writer.writeAll("\u{2518}");

    try move_cursor(writer, size.height, 0);
    try writer.writeAll("  q: Quit");

    try move_cursor(writer, 0, 2);
    try writer.writeAll("Menu");
}

fn draw_cursor(writer: AnyWriter) !void {
    try move_cursor(writer, position.row, position.col);
    try white_background(writer);
    try writer.writeAll(" ");
    try reset_attribute(writer);
}

fn blue_background(writer: AnyWriter) !void {
    try writer.writeAll("\x1B[44m");
}

fn white_background(writer: AnyWriter) !void {
    try writer.writeAll("\x1B[47m");
}

fn move_cursor(writer: AnyWriter, row: usize, col: usize) !void {
    try writer.print("\x1B[{};{}H", .{row + 1, col + 1});
}

fn hide_cursor(writer: AnyWriter) !void {
    try writer.writeAll("\x1B[?25l"); // Hide the cursor.
}

fn show_cursor(writer: AnyWriter) !void {
    try writer.writeAll("\x1B[?25h"); // Shows the cursor.
}

fn save_cursor(writer: AnyWriter) !void {
    try writer.writeAll("\x1B[s"); // Save cursor position.
}

fn restore_cursor(writer: AnyWriter) !void {
    try writer.writeAll("\x1B[u"); // Restore cursor position.
}

fn save_screen(writer: AnyWriter) !void {
    try writer.writeAll("\x1B[?47h"); // Save screen.
}

fn restore_screen(writer: AnyWriter) !void {
    try writer.writeAll("\x1B[?47l"); // Restore screen.
}

fn enable_alt_buffer(writer: AnyWriter) !void {
    try writer.writeAll("\x1B[?1049h"); // Enable alternative buffer.
}

fn disable_alt_buffer(writer: AnyWriter) !void {
    try writer.writeAll("\x1B[?1049l"); // Disable alternative buffer.
}

fn clear(writer: AnyWriter) !void {
    try writer.writeAll("\x1B[H\x1B[J"); // Clear.
}

fn reset_attribute(writer: AnyWriter) !void {
    try writer.writeAll("\x1B[0m"); // Attribute reset.
}

fn resize() !Size {
    var win_size = std.mem.zeroes(std.posix.winsize);
    const err = std.posix.system.ioctl(tty.handle, std.posix.system.T.IOCGWINSZ, @intFromPtr(&win_size));
    if (std.posix.errno(err) != .SUCCESS) {
        return std.posix.unexpectedErrno(@enumFromInt(err));
    }

    return Size {
        .height = std.math.clamp(win_size.row - 1, 10, 1000),
        .width = std.math.clamp(win_size.col - 1, 10, 1000)
    };
}

fn is_utf8_supported() !bool {
    var lang: [15]u8 = undefined;
    _ = std.ascii.lowerString(&lang, std.posix.getenv("LANG") orelse return false);

    return std.mem.containsAtLeast(u8, &lang, 1, "utf-8");
}
