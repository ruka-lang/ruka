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
    scanner: &'a mut Scanner<'a>,
    read: Token,
    peek: Token
}

impl<'a, 'b> Parser<'a> {
    pub fn new(scanner: &'a mut Scanner<'a>) -> Self {
        let read = scanner.next_token();
        let peek = scanner.next_token();

        Self {
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

    fn skip_semicolon_newline(&'b mut self) {
        match &self.peek.kind {
            TokenType::Newline | TokenType::Semicolon => self.next_token(1),
            _ => ()
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

    fn parse_expression_id(&'b mut self) -> Result<Expression> {
        Err(anyhow!("Unimplemented"))
    }

    fn parse_expression_int(&'b mut self) -> Result<Expression> {
        use TokenType::*;

        if let Integer(i) = &self.read.kind {
            Ok(Expression::Integer(i.clone()))
        } else {
            Err(anyhow!("Expected Integer, got something else"))
        }
    }

    fn parse_expression_float(&'b mut self) -> Result<Expression> {
        Err(anyhow!("Unimplemented"))
    }

    fn parse_expression_bool(&'b mut self) -> Result<Expression> {
        Err(anyhow!("Unimplemented"))
    }

    fn parse_expression_prefix(&'b mut self) -> Result<Expression> {
        Err(anyhow!("Unimplemented"))
    }

    fn parse_expression_group(&'b mut self) -> Result<Expression> {
        Err(anyhow!("Unimplemented"))
    }

    fn parse_expression_block(&'b mut self) -> Result<Expression> {
        Err(anyhow!("Unimplemented"))
    }

    fn parse_expression_if(&'b mut self) -> Result<Expression> {
        Err(anyhow!("Unimplemented"))
    }

    fn parse_expression_match(&'b mut self) -> Result<Expression> {
        Err(anyhow!("Unimplemented"))
    }

    fn parse_expression(&'b mut self, prec: Precedence) -> Result<Expression> {
        use TokenType::*;
        use crate::prelude::Keyword::*;

        match &self.read.kind {
            Tag(id) => self.parse_expression_id(),
            Integer(i) => self.parse_expression_int(),
            Float(f) => self.parse_expression_float(),
            Keyword(True) | Keyword(False) => self.parse_expression_bool(),
            Bang | Minus | Asterisk | Ampersand => self.parse_expression_prefix(),
            LeftParen => self.parse_expression_group(),
            Keyword(Do) | LeftSquirly => self.parse_expression_block(),
            Keyword(If) => self.parse_expression_if(),
            Keyword(Match) => self.parse_expression_match(),
            tt => Err(anyhow!("No prefix function for {:?}", tt))
        }
    }

    fn parse_binding_statement(&'b mut self) -> Result<Node> {
        use TokenType::*;

        let kind = self.read.kind.clone();

        let name = self.parse_tag()?;
        self.next_token(1);

        let value: Expression;

        match &self.peek.kind {
            Assign => {
                self.next_token(2);
                value = self.parse_expression(Precedence::Lowest)?; 
            },
            tt => {
                return Err(anyhow!("Expected '=', got: {:?}", tt));
            }
        }

        self.skip_semicolon_newline();

        Ok(Node::Binding(Binding{
            kind,
            name,
            expl_type: None,
            value,
        }))
    }

    fn parse_statement(&'b mut self) -> Result<Node> {
        use TokenType::Keyword;
        use crate::prelude::Keyword::{Let, Const};

        match self.read.kind {
            Keyword(Let) | Keyword(Const) => self.parse_binding_statement(),
            _ => {
                Err(anyhow!("Unsupported statement")) 
            }
        }
    }

    pub fn parse_program(&'a mut self) -> Result<Ast> {
        let mut nodes = vec![];

        while self.peek.kind != TokenType::Eof {
            let stmt = self.parse_statement()?;
            nodes.push(stmt);
        }

        Ok(Ast{nodes})
    }
}

mod test {
    use anyhow::Result;

    use crate::prelude::*;

    fn check_results() {}

    #[test]
    fn test_assignment_parsing() -> Result<()> {
        let source = "let x = 12";

        let mut compiler = Compiler::new_using_str(
            "assignment parsing test".into(),
            source.into()
        );

        let mut scanner = Scanner::new(&mut compiler);
        let mut parser = Parser::new(&mut scanner);

        let ast = parser.parse_program();

        dbg!(ast);

        Ok(())
    }

}
