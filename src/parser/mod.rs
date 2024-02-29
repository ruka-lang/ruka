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

    pub fn parse_program(&'a mut self) -> Program {
        let statements = vec![];

        Program{statements}
    }
}
