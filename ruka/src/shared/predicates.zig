pub fn isAlphabetical(byte: u8) bool {
    return switch (byte) {
        inline 'a'...'z', 'A'...'Z' => true,
        else => false,
    };
}

pub fn isAlphanumerical(byte: u8) bool {
    return isAlphabetical(byte) or isIntegral(byte);
}

pub fn isIntegral(byte: u8) bool {
    return switch (byte) {
        inline '0'...'9', '_' => true,
        else => false,
    };
}

pub fn isNumeric(byte: u8) bool {
    return isIntegral(byte) or byte == '.';
}
