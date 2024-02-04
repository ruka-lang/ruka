/*
 * @author: dwclake
 */

use crate::prelude::*;

use std::mem::take;

/// Scanning process, responsible for scanning a single file
pub struct Scanner<'a> {
    pub current_pos: Position,
    pub token_pos: Position,
    pub tokens: Vec<Token>,
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

    //
    fn advance(&mut self, count: usize) {
        let count = count.clamp(0, 3);

        for _ in 0..count {
            self.read = self.read.clamp(self.read + 1, self.compiler.contents.len());

            self.current_pos.column += 1;
            if self.read() == '\n' {
                self.current_pos.line += 1;
                self.current_pos.column = 0;
            }
            self.token_pos = self.current_pos.clone();
        }
    }

    //
    fn read(&self) -> char {
        if self.read >= self.compiler.contents.len() {
            return '\0'
        }
        self.compiler.contents.chars().nth(self.read).unwrap()
    }

    //
    fn peek(&self) -> char {
        if self.read >= self.compiler.contents.len() {
            return '\0'
        }

        self.compiler.contents.chars().nth(self.read).unwrap()
    }
    
    //
    fn peek_plus(&self, count: usize) -> char {
        if self.read + count >= self.compiler.contents.len() {
            return '\0'
        }

        self.compiler.contents.chars().nth(self.read + count).unwrap()
    }

    //
    fn read_tag(&'b mut self) -> Token {
        let start = self.read;
        let mut end = start;
        
        let mut char = self.read();
        while is_alphanumeric(char) {
            end += 1; 
            self.advance(1);
            char = self.read();
        } 

        let str = &self.compiler.contents[start..end];

        Token::new(
            TokenType::Identifier(str.into()), 
            self.compiler.input.clone(), 
            self.token_pos.clone()
        )
    }

    //
    fn read_number(&'b mut self) -> Token {
        let start = self.read;
        let mut end = start;
        
        let mut char = self.read();
        while is_numeric(char) {
            end += 1; 
            self.advance(1);
            char = self.read();
        } 

        let str = &self.compiler.contents[start..end];

        Token::new(
            TokenType::Integer(str.into()), 
            self.compiler.input.clone(), 
            self.token_pos.clone()
        )
    }

    //
    fn skip_whitespace(&'b mut self) {
        match self.read() {
            ' ' | '\t' => {
                self.advance(1);
                self.skip_whitespace();
            },
            _ => {}
        }
    }

    //
    fn next_token(&'b mut self) -> Token {
        self.skip_whitespace();
        self.token_pos = self.current_pos.clone();

        let ch = self.read();
        if ch != '\0' {
            match ch {
                ch if is_alphabetical(ch) => {
                    self.read_tag()
                },
                ch if is_integral(ch) => {
                    self.read_number()
                },
                ch => {
                    self.advance(1);
                    Token::new(
                        TokenType::from_char(ch), 
                        self.compiler.input.clone(), 
                        self.token_pos.clone()
                    )
                }
            }
        } else {
            Token::new(
                TokenType::Eof, 
                self.compiler.input.clone(), 
                self.token_pos.clone()
            )
        }
    }

    ///
    pub fn scan(&'a mut self) -> Vec<Token> {
        let mut token = self.next_token();

        while token.ttype != TokenType::Eof {
            self.tokens.push(token);
            token = self.next_token();
        }
        
        self.tokens.push(token);

        return take(&mut self.tokens);
    }
}

#[cfg(test)]
mod scanner_tests {
    use crate::prelude::*;

    #[test]
    fn test_identifier() {
        let source = "let x = 12;";
        let mut compiler = Compiler::new_using_str("identifier scanning test".into(), source.into());
        let mut scanner = Scanner::new(&mut compiler);
        let tokens = scanner.scan();

        assert!(tokens[0].ttype == TokenType::Identifier("let".into()));
        assert!(tokens[1].ttype == TokenType::Identifier("x".into()));
    }
}
