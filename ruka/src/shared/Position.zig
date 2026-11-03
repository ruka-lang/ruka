pub const Position = @This();

line: usize = 0,
col: usize = 0,

pub fn init(line: usize, col: usize) Position {
    return Position{ .line = line, .col = col };
}
