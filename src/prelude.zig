// @author: ruka-lang
// @created: 2024-09-12

pub const ArgumentParser = @import("ArgumentParser.zig");
pub const Chrono = @import("Chrono.zig");
pub const Repl = @import("Repl.zig");
pub const Transport = @import("Transport.zig");

pub const constants = @import("constants.zig");
pub const logging = @import("logging.zig");

pub const utilities = @import("utilities.zig");
pub const Error = utilities.Error;
pub const Position = utilities.Position;
pub const isAlphabetical = utilities.isAlphabetical;
pub const isAlphanumerical = utilities.isAlphanumerical;
pub const isIntegral = utilities.isIntegral;
pub const isNumeric = utilities.isNumeric;

pub const Compiler = @import("Compiler.zig");
pub const Job = Compiler.Job;
pub const Unit = Compiler.Unit;

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
    _ = Chrono;
    _ = Compiler;
    _ = Scanner;
    _ = Parser;
    _ = Interpreter;
}
