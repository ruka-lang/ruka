/*
 * @author: dwclake
 */

use crate::prelude::*;

use anyhow::Result;
use std::mem::take;
use std::sync::Arc;

pub struct Scanner {
    pub current_pos: Position,
    pub token_pos: Position,
    pub file: Arc<str>,
    pub tokens: Vec<Token>,
    pub errors: Vec<Error>,
    pub contents: Arc<str>,
    pub line: usize,
    pub read: usize
}

impl<'a, 'b> Scanner {
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
    pub fn new(file: Arc<str>, line: usize, contents: Arc<str>) -> Self {
        let current_pos = Position::new(line, 1);
        let tokens = vec![];
        let errors = vec![];

        Self {
            current_pos: current_pos.clone(),
            token_pos: current_pos,
            tokens,
            contents,
            file: file.clone(),
            errors,
            line,
            read: 0
        }
    }

    //
    fn advance(&'b mut self, count: usize) {
        let count = count.clamp(0, 3);

        for _ in 0..count {
            self.read = self.read + 1;

            self.current_pos.column += 1;
        }
    }

    //
    fn read(&'b self) -> char {
        if self.read >= self.contents.len() {
            return '\0'
        }

        self.contents
            .chars()
            .nth(self.read).unwrap()
    }

    //
    fn peek(&'b self) -> char {
        if self.read >= self.contents.len() {
            return '\0'
        }

        self.contents
            .chars()
            .nth(self.read).unwrap()
    }
    
    //
    fn _peek_plus(&self, count: usize) -> char {
        if self.read + count >= self.contents.len() {
            return '\0'
        }

        self.contents
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

        let str = &self.contents[start..end];

        Token::new(
            TokenType::Tag(str.into()), 
            self.file.clone(), 
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

        let str = &self.contents[start..end];
        let ttype = match is_float {
            false => TokenType::Integer(str.into()),
            _     => TokenType::Float(str.into())
        };

        Token::new(
            ttype, 
            self.file.clone(), 
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
    fn read_string(&'b mut self) -> Token {
        self.advance(1);

        let start = self.read;
        let mut end = start;

        while self.peek() != '"' && self.peek() != '\0' {
            self.advance(1);
            end += 1;
        }
        self.advance(1);

        if self.read() != '"' {
            self.errors.push(Error::new(
                self.file.clone(),
                "Scanning error".into(),
                "Unterminated string literal".into(),
                self.current_pos.clone()
            ));
        }

        Token::new(
            TokenType::String(self.contents[start..end].into()),
            self.file.clone(),
            self.token_pos.clone()
        )
    }

    //
    fn try_compound_operator(
        &'b mut self, 
        matches: Vec<(usize, &str, TokenType)>
    ) -> Option<TokenType> {
        for (count, operator, kind) in matches.iter() {
            let start = self.read;
            let end = (self.read + count).clamp(0, self.contents.len());
            
            if &self.contents[start..end] == *operator {
                self.advance(*count);
                return Some(kind.clone());
            }
        }

        None
    }


    //
    fn skip_whitespace(&'b mut self) {
        match self.read() {
            ' ' | '\t' | '\n' => {
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
        match ch {
            ch if is_alphabetical(ch) => {
                self.read_tag_keyword_mode()
            },
            ch if is_integral(ch) => {
                self.read_number()
            },
            '"' => {
                self.read_string()
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
                            self.file.clone(),
                            self.token_pos.clone()
                        )
                    }
                }
            },
            // Operators which may be multiple characters long
            '=' => {
                let kind = self.try_compound_operator(vec![
                    (2, "=>", TokenType::WideArrow),
                    (2, "==", TokenType::Equal)
                ]);

                let kind = match kind {
                    Some(k) => k,
                    None => {
                        self.advance(1);
                        TokenType::Assign
                    }
                };

                Token::new(
                    kind,
                    self.file.clone(),
                    self.token_pos.clone()
                )
            },
            ':' => {
                let kind = self.try_compound_operator(vec![
                    (2, ":=", TokenType::AssignExp)
                ]);

                let kind = match kind {
                    Some(k) => k,
                    None => {
                        self.advance(1);
                        TokenType::Colon
                    }
                };

                Token::new(
                    kind,
                    self.file.clone(),
                    self.token_pos.clone()
                )
            },
            '>' => {
                let kind = self.try_compound_operator(vec![
                    (2, ">=", TokenType::GreaterEq),
                    (2, ">>", TokenType::RightShift)
                ]);

                let kind = match kind {
                    Some(k) => k,
                    None => {
                        self.advance(1);
                        TokenType::Greater
                    }
                };

                Token::new(
                    kind,
                    self.file.clone(),
                    self.token_pos.clone()
                )
            },
            '<' => {
                let kind = self.try_compound_operator(vec![
                    (2, "<=", TokenType::LesserEq),
                    (2, "<<", TokenType::LeftShift),
                    (2, "<|", TokenType::ForwardApp)
                ]);

                let kind = match kind {
                    Some(k) => k,
                    None => {
                        self.advance(1);
                        TokenType::Lesser
                    }
                };

                Token::new(
                    kind,
                    self.file.clone(),
                    self.token_pos.clone()
                )
            },
            '-' => {
                let kind = self.try_compound_operator(vec![
                    (2, "->", TokenType::Arrow),
                    (2, "--", TokenType::Decrement)
                ]);

                let kind = match kind {
                    Some(k) => k,
                    None => {
                        self.advance(1);
                        TokenType::Minus
                    }
                };

                Token::new(
                    kind,
                    self.file.clone(),
                    self.token_pos.clone()
                )
            },
            '+' => {
                let kind = self.try_compound_operator(vec![
                    (2, "++", TokenType::Increment)
                ]);

                let kind = match kind {
                    Some(k) => k,
                    None => {
                        self.advance(1);
                        TokenType::Plus
                    }
                };

                Token::new(
                    kind,
                    self.file.clone(),
                    self.token_pos.clone()
                )
            },
            '*' => {
                let kind = self.try_compound_operator(vec![
                    (2, "**", TokenType::Power)
                ]);

                let kind = match kind {
                    Some(k) => k,
                    None => {
                        self.advance(1);
                        TokenType::Asterisk
                    }
                };

                Token::new(
                    kind,
                    self.file.clone(),
                    self.token_pos.clone()
                )
            },
            '.' => {
                let kind = self.try_compound_operator(vec![
                    (3, "..=", TokenType::RangeInc),
                    (2, "..", TokenType::RangeExc)
                ]);

                let kind = match kind {
                    Some(k) => k,
                    None => {
                        self.advance(1);
                        TokenType::Dot
                    }
                };

                Token::new(
                    kind,
                    self.file.clone(),
                    self.token_pos.clone()
                )
            },
            '~' => {
                let kind = self.try_compound_operator(vec![
                    (2, "~=", TokenType::PatternMatch)
                ]);

                let kind = match kind {
                    Some(k) => k,
                    None => {
                        self.advance(1);
                        TokenType::Tilde
                    }
                };

                Token::new(
                    kind,
                    self.file.clone(),
                    self.token_pos.clone()
                )
            },
            '!' => {
                let kind = self.try_compound_operator(vec![
                    (2, "!=", TokenType::NotEqual),
                    (2, "!~", TokenType::PatternNotMatch)
                ]);

                let kind = match kind {
                    Some(k) => k,
                    None => {
                        self.advance(1);
                        TokenType::Bang
                    }
                };

                Token::new(
                    kind,
                    self.file.clone(),
                    self.token_pos.clone()
                )
            },
            '|' => {
                let kind = self.try_compound_operator(vec![
                    (2, "|>", TokenType::ReverseApp)
                ]);

                let kind = match kind {
                    Some(k) => k,
                    None => {
                        self.advance(1);
                        TokenType::Pipe
                    }
                };

                Token::new(
                    kind,
                    self.file.clone(),
                    self.token_pos.clone()
                )
            },
            '\0' => {
                Token::new(
                    TokenType::Eof, 
                    self.file.clone(), 
                    self.token_pos.clone()
                )
            },
            // Single character tokens
            ch => {
                self.advance(1);
                Token::new(
                    TokenType::from_char(ch), 
                    self.file.clone(), 
                    self.token_pos.clone()
                )
            }
        }
    }

    ///
    pub fn scan(&'a mut self) -> Result<Vec<Token>> {
        let mut token = self.next_token();

        while token.kind != TokenType::Eof {
            self.tokens.push(token);
            token = self.next_token();
        }
        
        self.tokens.push(token);

        Ok(take(&mut self.tokens))
    }
}

