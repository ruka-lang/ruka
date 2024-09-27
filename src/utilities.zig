// @author: ruka-lang
// @created: 2024-03-04

//

const std = @import("std");
const clap = @import("clap");

pub const chrono = @import("chrono");

/// Represents a 2d position in a file
pub const Position = struct {
    line: usize = 0, 
    col: usize = 0,

    pub fn init(line: usize, col: usize) Position {
        return Position {
            .line = line,
            .col = col
        };
    }
};

/// Checks if a byte is a alphabetical character
pub fn isAlphabetical(byte: u8) bool {
    return switch(byte) {
        inline 'a'...'z', 'A'...'Z' => true,
        else => false
    };
}

/// Checks if a byte is a integral character or a underscore
pub fn isIntegral(byte: u8) bool {
    return switch(byte) {
        inline '0'...'9', '_' => true,
        else => false
    };
}

/// Checks if a byte is a integral character or an underscore or a period
pub fn isNumeric(byte: u8) bool {
    return isIntegral(byte) or byte == '.';
}

/// Checks if a byte is a alphabetical or numerical
pub fn isAlphanumerical(byte: u8) bool {
    return isAlphabetical(byte) or isIntegral(byte);
}
