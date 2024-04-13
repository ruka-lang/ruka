// @author: ruka-lang
// @created: 2024-04-13

const rukac = @import("../root.zig");
const Scanner = rukac.Scanner;

const std = @import("std");

const Parser = @This();

pub const Ast = @import("ast.zig");
