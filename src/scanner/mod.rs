/*
 * @author: dwclake
 */

use crate::prelude::*;

use anyhow::Result;

pub mod token;
pub mod error;

/// Scanning process, responsible for scanning a single file
pub struct Scanner<'a> {
    pub current_pos: Position,
    pub token_pos: Position,
    pub tokens: Vec<Token<'a>>,
    pub compiler: &'a mut Compiler,
    pub read: usize
}

impl<'a, 'b> Scanner<'a> {
    /// Creates a new Scanner process
    /// 
    /// # Arguments 
    /// * `compiler` - 
    ///
    /// # Returns
    /// * A new Scanner process
    ///
    /// # Examples 
    ///
    /// ```
    ///
    /// ```
    pub fn new(compiler: &'a mut Compiler) -> Self {
        let current_pos = Position::new(1, 1);
        let tokens = vec![];

        return Self {
            current_pos: current_pos.clone(),
            token_pos: current_pos,
            tokens,
            compiler,
            read: 0
        }
    }

    fn advance(&mut self) -> char {
        let ch = self.read();
        self.read += 1;
        ch
    }

    fn read(&self) -> char {
        if self.read >= self.compiler.contents.len() {
            return '\0'
        }
        self.compiler.contents.as_bytes()[self.read] as char
    }

    fn peek(&self) -> char {
        if self.read >= self.compiler.contents.len() {
            return '\0'
        }

        self.compiler.contents.as_bytes()[self.read + 1] as char
    }

    ///
    fn next_token(&mut self) -> Result<Token<'b>> {

        Ok(Token::new(TokenType::Eof, "".into(), self.token_pos.clone()))
    }

    ///
    pub fn scan(&'a mut self) -> Result<()> {
        let mut tokens = vec![];
        let mut token = self.next_token()?;

        while token.ttype != TokenType::Eof {
            tokens.push(token);
            token = self.next_token()?;
        }

        self.tokens = tokens;
        
        Ok(())
    }
}
