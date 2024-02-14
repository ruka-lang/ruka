/*
 * @author: dwclake
 */

use crate::prelude::*;

use anyhow::{anyhow, Result};
use std::mem::take;

pub mod token;

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
    fn advance(&'b mut self, count: usize) {
        let count = count.clamp(0, 3);

        for _ in 0..count {
            self.read = self.read + 1;

            self.current_pos.column += 1;
            if self.read() == '\n' {
                self.current_pos.line += 1;
                self.current_pos.column = 1;
            }
        }
    }

    //
    fn read(&'b self) -> char {
        if self.read >= self.compiler.contents.as_ref().unwrap().len() {
            return '\0'
        }

        self.compiler.contents.as_ref().unwrap()
            .chars()
            .nth(self.read).unwrap()
    }

    //
    fn peek(&'b self) -> char {
        if self.read >= self.compiler.contents.as_ref().unwrap().len() {
            return '\0'
        }

        self.compiler.contents.as_ref().unwrap()
            .chars()
            .nth(self.read).unwrap()
    }
    
    //
    fn peek_plus(&self, count: usize) -> char {
        if self.read + count >= self.compiler.contents.as_ref().unwrap().len() {
            return '\0'
        }

        self.compiler.contents.as_ref().unwrap()
            .chars()
            .nth(self.read + count).unwrap()
    }

    //
    fn read_tag_keyword_mode(&'b mut self) -> Token {
        let start = self.read;
        let mut end = start;
        
        let mut char = self.read();
        while is_alphanumeric(char) {
            end += 1; 
            self.advance(1);
            char = self.read();
        } 

        let str = &self.compiler.contents.as_ref().unwrap()[start..end];

        Token::new(
            TokenType::Tag(str.into()), 
            self.compiler.input.clone(), 
            self.token_pos.clone()
        )
    }

    //
    fn read_number(&'b mut self) -> Token {
        let start = self.read;
        let mut end = start;
        let mut is_float = false;
        
        let mut char = self.read();
        while is_numeric(char) {
            end += 1; 
            
            if self.read() == '.' {
                self.read_integer(&mut end);
                is_float = true;
                break;
            }

            self.advance(1);
            char = self.read();
        } 

        let str = &self.compiler.contents.as_ref().unwrap()[start..end];
        let ttype = match is_float {
            false => TokenType::Integer(str.into()),
            _     => TokenType::Float(str.into())
        };

        Token::new(
            ttype, 
            self.compiler.input.clone(), 
            self.token_pos.clone()
        )
    }

    //
    fn read_integer(&'b mut self, end: &mut usize) {
        self.advance(1);

        let mut char = self.read();
        while is_integral(char) {
            *end += 1; 
            self.advance(1);
            char = self.read();
        } 
    }

    //
    fn try_compound_operator(
        &'b mut self, 
        mut matches: Vec<(usize, &str, TokenType)>
    ) -> Option<TokenType> {
        matches.sort_by(|(c1, _, _), (c2, _, _)| {
            c1 < c2
        });

        for (count, operator, kind) in matches.iter() {
            let contents = self.compiler.contents.as_ref().unwrap();
            if contents[self.read..self.read+count] == operator {
                return Some(kind);
            }
        }

        None
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
    fn skip_single_comment(&'b mut self) {
        match self.read() {
            '\n' | '\0' => (),
            _ => {
                self.advance(1);
                self.skip_single_comment()
            }
        }
    }

    //
    fn skip_multi_comment(&'b mut self) {
        let mut ch = self.read();
        let mut next = self.peek();

        while ch != '\0' {
            if ch == '*' && next == '/' {
                self.advance(2);
                break;
            } 

            self.advance(1);
            ch = self.read();
            next = self.peek();
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
                    self.read_tag_keyword_mode()
                },
                ch if is_integral(ch) => {
                    self.read_number()
                },
                '/' => {
                    match self.peek() {
                        '/' => {
                            self.skip_single_comment();
                            self.next_token()
                        },
                        '*' => {
                            self.skip_multi_comment();
                            self.next_token()
                        },
                        _ => {
                            self.advance(1);
                            Token::new(
                                TokenType::Slash,
                                self.compiler.input.clone(),
                                self.token_pos.clone()
                            )
                        }
                    }
                }
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
    pub fn scan(&'a mut self) -> Result<Vec<Token>> {
        match self.compiler.contents {
            None => {
                Err(anyhow!("Error, compiler has no scannable contents"))
            },
            _ => {
                let mut token = self.next_token();

                while token.kind != TokenType::Eof {
                    self.tokens.push(token);
                    token = self.next_token();
                }
                
                self.tokens.push(token);

                return Ok(take(&mut self.tokens));
            }
        }
    }
}

#[cfg(test)]
mod scanner_tests {
    use crate::prelude::*;
    use anyhow::Result;

    fn check_results(actual: Vec<Token>, expected: Vec<Token>) {
        assert_eq!(actual.len(), expected.len());

        let iter = actual.iter().zip(expected.iter());
        for (at, et) in iter {
            assert_eq!(et, at)
        }
    }

    #[test]
    fn test_next_token() -> Result<()> {
        let source = "let x = 12_000 12_000.50;";

        let expected = vec![
            Token::new(
                TokenType::Tag("let".into()),
                "identifier scanning test".into(),
                Position::new(1, 1)
            ),
            Token::new(
                TokenType::Tag("x".into()),
                "identifier scanning test".into(),
                Position::new(1, 5)
            ),
            Token::new(
                TokenType::Assign,
                "identifier scanning test".into(),
                Position::new(1, 7)
            ),
            Token::new(
                TokenType::Integer("12_000".into()),
                "identifier scanning test".into(),
                Position::new(1, 9)
            ),
            Token::new(
                TokenType::Float("12_000.50".into()),
                "identifier scanning test".into(),
                Position::new(1, 16)
            ),
            Token::new(
                TokenType::Semicolon,
                "identifier scanning test".into(),
                Position::new(1, 25)
            ),
            Token::new(
                TokenType::Eof,
                "identifier scanning test".into(),
                Position::new(1, 26)
            ),
        ];

        let mut compiler = Compiler::new_using_str(
            "identifier scanning test".into(), 
            source.into()
        );

        let mut scanner = Scanner::new(&mut compiler);
        let actual = scanner.scan()?;
        
        check_results(actual, expected);

        Ok(())
    }

    #[test]
    fn test_skip_single_comment() -> Result<()> {
        let source = "let x = //12_000 12_000.50;";

        let expected = vec![
            Token::new(
                TokenType::Tag("let".into()),
                "identifier scanning test".into(),
                Position::new(1, 1)
            ),
            Token::new(
                TokenType::Tag("x".into()),
                "identifier scanning test".into(),
                Position::new(1, 5)
            ),
            Token::new(
                TokenType::Assign,
                "identifier scanning test".into(),
                Position::new(1, 7)
            ),
            Token::new(
                TokenType::Eof,
                "identifier scanning test".into(),
                Position::new(1, 28)
            ),
        ];

        let mut compiler = Compiler::new_using_str(
            "identifier scanning test".into(), 
            source.into()
        );

        let mut scanner = Scanner::new(&mut compiler);
        let actual = scanner.scan()?;

        check_results(actual, expected);

        Ok(())
    }

    #[test]
    fn test_skip_multi_comment() -> Result<()> {
        let source = "let x = /*\
            12_000 12_000.50;   \
            */";

        let expected = vec![
            Token::new(
                TokenType::Tag("let".into()),
                "identifier scanning test".into(),
                Position::new(1, 1)
            ),
            Token::new(
                TokenType::Tag("x".into()),
                "identifier scanning test".into(),
                Position::new(1, 5)
            ),
            Token::new(
                TokenType::Assign,
                "identifier scanning test".into(),
                Position::new(1, 7)
            ),
            Token::new(
                TokenType::Eof,
                "identifier scanning test".into(),
                Position::new(1, 33)
            ),
        ];

        let mut compiler = Compiler::new_using_str(
            "identifier scanning test".into(), 
            source.into()
        );

        let mut scanner = Scanner::new(&mut compiler);
        let actual = scanner.scan()?;

        check_results(actual, expected);

        Ok(())
    }
}
