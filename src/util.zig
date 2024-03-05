//
// @author: ruka-lang
// @created: 2024-03-04
//

const std = @import("std");

///
pub const Position = struct {
    line: usize,
    col: usize
};

///
pub fn is_alphabetical(byte: u8) bool {
    return switch(byte) {
        inline 'a'...'z', 'A'...'Z' => true,
        else => false
    };
}

///
pub fn is_integral(byte: u8) bool {
    return switch(byte) {
        inline '0'...'9', '_' => true,
        else => false
    };
}

///
pub fn is_numeric(byte: u8) bool {
    return is_integral(byte) or byte == '.';
}

///
pub fn is_alphanumberical(byte: u8) bool {
    return is_alphabetical(byte) or is_integral(byte);
}

///
pub fn try_escape_char(str: []const u8) ?u8 {
    return escapes.get(str);
}

// Map representing escape sequences and their string representation
const escapes = std.ComptimeStringMap(u8, .{
    .{"\\n", '\n'},
    .{"\\r", '\r'},
    .{"\\t", '\t'},
    .{"\\\\", '\\'},
    .{"\\|", '|'},
    .{"\\'", '\''},
    .{"\\\"", '"'},
    .{"\\0", '\x00'}
});