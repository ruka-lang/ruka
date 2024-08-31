// @author: ruka-lang
// @created: 2024-03-04

const std = @import("std");

/// Represents a 2d position in a file
pub const Position = struct {
    line: usize,
    col: usize
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
