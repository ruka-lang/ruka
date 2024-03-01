/*
 * @author: ruka-lang
 * @created: 2024-02-28
 */

use crate::prelude::*;

use anyhow::{anyhow, Result};

pub mod ast;

#[derive(Debug, PartialEq, PartialOrd)]
enum Precedence {
    Lowest,
    Equals,
    LtGt,
    Sum,
    Product,
    Prefix,
    Call,
    Index
}

impl Precedence {
    pub fn from_token_type(kind: &TokenType) -> Precedence {
        use TokenType::*;
        use Precedence::*;

        match kind {
            Equal | NotEqual => Equals,
            Lesser | LesserEq | Greater | GreaterEq => LtGt,
            Plus | Minus => Sum,
            Slash | Asterisk => Product,
            LeftParen => Call,
            LeftBracket => Index,
            _ => Lowest
        }
    }
}

///
pub struct Parser<'a> {
    compiler: &'a mut Compiler,
    scanner: &'a mut Scanner<'a>,
    read: Token,
    peek: Token
}

impl<'a, 'b> Parser<'a> {
    pub fn new(compiler: &'a mut Compiler, scanner: &'a mut Scanner<'a>) -> Self {
        let read = scanner.next_token();
        let peek = scanner.next_token();

        Self {
            compiler,
            scanner,
            read,
            peek
        }
    }

    fn next_token(&'b mut self, mut count: usize) {
        while count > 0 {
            self.read = self.peek.clone();
            self.peek = self.scanner.next_token();
            count = count - 1;
        }
    }

    fn parse_statement(&'b mut self) -> Statement {
        self.next_token(1);
        
        Statement::Return(
            Expression::Unit
        )   
    }

    pub fn parse_program(&'a mut self) -> Program {
        let mut statements = vec![];

        while self.read.kind != TokenType::Eof {
            let stmt = self.parse_statement();
            statements.push(stmt);
        }

        Program{statements}
    }
}

mod test {
    use crate::prelude::*;

    fn check_results() {}

    #[test]
    fn test_assignment() {

    }

}
