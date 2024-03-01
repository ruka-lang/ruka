/*
 * @author: ruka-lang
 * @created: 2024-02-28
 */

use std::sync::Arc;

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

    fn parse_tag(&'b mut self) -> Result<Arc<str>> {
        use TokenType::Tag;

        match &self.peek.kind {
            Tag(name) => {
                Ok(name.clone())
            },
            tt => {
                Err(anyhow!("Expected tag, got: {:?}", tt))
            }
        }
    }

    fn parse_expression(&'b mut self, prec: Precedence) -> Result<Expression> {
       Err(anyhow!("Unimplemented")) 
    }

    fn parse_binding_statement(&'b mut self) -> Result<Statement> {
        use TokenType::*;

        let name = self.parse_tag()?;
        self.next_token(1);

        let value: Expression;

        match &self.read.kind {
            Assign => {
                self.next_token(2);
                value = self.parse_expression(Precedence::Lowest)?; 
            },
            tt => {
                return Err(anyhow!("Expected '=', got: {:?}", tt));
            }
        }

        Ok(Statement::Binding(Binding{
            kind: self.read.kind.clone(),
            name,
            expl_type: None,
            value,
        }))
    }

    fn parse_statement(&'b mut self) -> Result<Statement> {
        use TokenType::Keyword;
        use crate::prelude::Keyword::{Let, Const};

        match self.read.kind {
            Keyword(Let) | Keyword(Const) => self.parse_binding_statement(),
            _ => {
                Err(anyhow!("Unsupported statement")) 
            }
        }
    }

    pub fn parse_program(&'a mut self) -> Result<Program> {
        let mut statements = vec![];

        while self.read.kind != TokenType::Eof {
            let stmt = self.parse_statement()?;
            statements.push(stmt);
        }

        Ok(Program{statements})
    }
}

mod test {
    use crate::prelude::*;

    fn check_results() {}

    #[test]
    fn test_assignment() {

    }

}
