// @author: ruka-lang
// @created: 2024-09-12

pub const ArgumentParser = @import("ArgumentParser.zig");

pub const constants = @import("constants.zig");

pub const utilities = @import("utilities.zig");
pub const Error = utilities.Error;
pub const Position = utilities.Position;
pub const isAlphabetical = utilities.isAlphabetical;
pub const isAlphanumerical = utilities.isAlphanumerical;
pub const isIntegral = utilities.isIntegral;
pub const isNumeric = utilities.isNumeric;

pub const Compiler = @import("Compiler.zig");
pub const Job = Compiler.Job;

pub const Scanner = @import("Scanner.zig");
pub const Token = Scanner.Token;
pub const Keyword = Token.Keyword;
pub const Mode = Token.Mode;

pub const Parser = @import("Parser.zig");
pub const Ast = Parser.Ast;
pub const Index = Ast.Index;
pub const Node = Ast.Node;

pub const Interpreter = @import("Interpreter.zig");

test "ruka modules" {
    _ = Compiler;
    _ = Scanner;
    _ = Parser;
    _ = Interpreter;
}
