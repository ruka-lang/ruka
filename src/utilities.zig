// @author: ruka-lang
// @created: 2024-03-04

const std = @import("std");

pub const Error = struct { 
    file: []const u8,
    kind: []const u8,
    msg: []const u8,
    pos: Position,
};

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

pub fn isAlphabetical(byte: u8) bool {
    return switch(byte) {
        inline 'a'...'z', 'A'...'Z' => true,
        else => false
    };
}

pub fn isAlphanumerical(byte: u8) bool {
    return isAlphabetical(byte) or isIntegral(byte);
}

pub fn isIntegral(byte: u8) bool {
    return switch(byte) {
        inline '0'...'9', '_' => true,
        else => false
    };
}

pub fn isNumeric(byte: u8) bool {
    return isIntegral(byte) or byte == '.';
}
