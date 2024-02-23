/*
 * @author: dwclake
 */

use crate::prelude::*;

use std::mem::take;

pub mod asyncs;
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

        Self {
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
        if self.read >= self.compiler.contents.len() {
            return '\0'
        }

        self.compiler.contents
            .chars()
            .nth(self.read).unwrap()
    }

    //
    fn peek(&'b self) -> char {
        if self.read >= self.compiler.contents.len() {
            return '\0'
        }

        self.compiler.contents
            .chars()
            .nth(self.read).unwrap()
    }

    //
    fn _peek_plus(&self, count: usize) -> char {
        if self.read + count >= self.compiler.contents.len() {
            return '\0'
        }

        self.compiler.contents
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

        let str = &self.compiler.contents[start..end];

        let token_type = match TokenType::try_keyword(str) {
            Some(keyword) => keyword,
            None => {
                match TokenType::try_mode(str) {
                    Some(mode) => mode,
                    None => TokenType::Tag(str.into())
                }
            }
        };

        Token::new(
            token_type,
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

        let str = &self.compiler.contents[start..end];
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
            self.compiler.errors.push(Error::new(
                self.compiler.input.clone(),
                "Scanning error".into(),
                "Unterminated string literal".into(),
                self.current_pos.clone()
            ));
        }

        let contents = &self.compiler.contents;
        Token::new(
            TokenType::String(contents[start..end].into()),
            self.compiler.input.clone(),
            self.token_pos.clone()
        )
    }

    //
    fn try_compound_operator(
        &'b mut self,
        matches: Vec<(usize, &str, TokenType)>
    ) -> Option<TokenType> {
        for (count, operator, kind) in matches.iter() {
            let contents = &self.compiler.contents;
            let start = self.read;
            let end = (self.read + count).clamp(0, contents.len());

            if &contents[start..end] == *operator {
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
                            self.compiler.input.clone(),
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
                    self.compiler.input.clone(),
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
                    self.compiler.input.clone(),
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
                    self.compiler.input.clone(),
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
                    self.compiler.input.clone(),
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
                    self.compiler.input.clone(),
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
                    self.compiler.input.clone(),
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
                    self.compiler.input.clone(),
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
                    self.compiler.input.clone(),
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
                    self.compiler.input.clone(),
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
                    self.compiler.input.clone(),
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
                    self.compiler.input.clone(),
                    self.token_pos.clone()
                )
            },
            '\0' => {
                Token::new(
                    TokenType::Eof,
                    self.compiler.input.clone(),
                    self.token_pos.clone()
                )
            },
            // Single character tokens
            ch => {
                self.advance(1);
                Token::new(
                    TokenType::from_char(ch),
                    self.compiler.input.clone(),
                    self.token_pos.clone()
                )
            }
        }
    }

    ///
    pub fn scan(&'a mut self) -> Vec<Token> {
        let mut token = self.next_token();

        while token.kind != TokenType::Eof {
            self.tokens.push(token);
            token = self.next_token();
        }

        self.tokens.push(token);

        take(&mut self.tokens)
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
    fn test_next_token() {
        let source = "let x = 12_000 12_000.50;";

        let expected = vec![
            Token::new(
                TokenType::Keyword(Keyword::Let),
                "next token scanning test".into(),
                Position::new(1, 1)
            ),
            Token::new(
                TokenType::Tag("x".into()),
                "next token scanning test".into(),
                Position::new(1, 5)
            ),
            Token::new(
                TokenType::Assign,
                "next token scanning test".into(),
                Position::new(1, 7)
            ),
            Token::new(
                TokenType::Integer("12_000".into()),
                "next token scanning test".into(),
                Position::new(1, 9)
            ),
            Token::new(
                TokenType::Float("12_000.50".into()),
                "next token scanning test".into(),
                Position::new(1, 16)
            ),
            Token::new(
                TokenType::Semicolon,
                "next token scanning test".into(),
                Position::new(1, 25)
            ),
            Token::new(
                TokenType::Eof,
                "next token scanning test".into(),
                Position::new(1, 26)
            )
        ];

        let mut compiler = Compiler::new_using_str(
            "next token scanning test".into(),
            source.into()
        );

        let mut scanner = Scanner::new(&mut compiler);
        let actual = scanner.scan();

        check_results(actual, expected);
    }

    #[test]
    fn test_compound_op() {
        let source = "== != >= <= ~= !~ |> <| << >> ++ -- ** -> => .. ..= :=";

        let expected = vec![
            Token::new(
                TokenType::Equal,
                "compound operator scanning test".into(),
                Position::new(1, 1)
            ),
            Token::new(
                TokenType::NotEqual,
                "compound operator scanning test".into(),
                Position::new(1, 4)
            ),
            Token::new(
                TokenType::GreaterEq,
                "compound operator scanning test".into(),
                Position::new(1, 7)
            ),
            Token::new(
                TokenType::LesserEq,
                "compound operator scanning test".into(),
                Position::new(1, 10)
            ),
            Token::new(
                TokenType::PatternMatch,
                "compound operator scanning test".into(),
                Position::new(1, 13)
            ),
            Token::new(
                TokenType::PatternNotMatch,
                "compound operator scanning test".into(),
                Position::new(1, 16)
            ),
            Token::new(
                TokenType::ReverseApp,
                "compound operator scanning test".into(),
                Position::new(1, 19)
            ),
            Token::new(
                TokenType::ForwardApp,
                "compound operator scanning test".into(),
                Position::new(1, 22)
            ),
            Token::new(
                TokenType::LeftShift,
                "compound operator scanning test".into(),
                Position::new(1, 25)
            ),
            Token::new(
                TokenType::RightShift,
                "compound operator scanning test".into(),
                Position::new(1, 28)
            ),
            Token::new(
                TokenType::Increment,
                "compound operator scanning test".into(),
                Position::new(1, 31)
            ),
            Token::new(
                TokenType::Decrement,
                "compound operator scanning test".into(),
                Position::new(1, 34)
            ),
            Token::new(
                TokenType::Power,
                "compound operator scanning test".into(),
                Position::new(1, 37)
            ),
            Token::new(
                TokenType::Arrow,
                "compound operator scanning test".into(),
                Position::new(1, 40)
            ),
            Token::new(
                TokenType::WideArrow,
                "compound operator scanning test".into(),
                Position::new(1, 43)
            ),
            Token::new(
                TokenType::RangeExc,
                "compound operator scanning test".into(),
                Position::new(1, 46)
            ),
            Token::new(
                TokenType::RangeInc,
                "compound operator scanning test".into(),
                Position::new(1, 49)
            ),
            Token::new(
                TokenType::AssignExp,
                "compound operator scanning test".into(),
                Position::new(1, 53)
            ),
            Token::new(
                TokenType::Eof,
                "compound operator scanning test".into(),
                Position::new(1, 55)
            )
        ];

        let mut compiler = Compiler::new_using_str(
            "compound operator scanning test".into(),
            source.into()
        );

        let mut scanner = Scanner::new(&mut compiler);
        let actual = scanner.scan();

        check_results(actual, expected);
    }

    #[test]
    fn test_string_reading() {
        let source = "let x = \"Hello, world!\";";

        let expected = vec![
            Token::new(
                TokenType::Keyword(Keyword::Let),
                "string reading scanning test".into(),
                Position::new(1, 1)
            ),
            Token::new(
                TokenType::Tag("x".into()),
                "string reading scanning test".into(),
                Position::new(1, 5)
            ),
            Token::new(
                TokenType::Assign,
                "string reading scanning test".into(),
                Position::new(1, 7)
            ),
            Token::new(
                TokenType::String("Hello, world!".into()),
                "string reading scanning test".into(),
                Position::new(1, 9)
            ),
            Token::new(
                TokenType::Semicolon,
                "string reading scanning test".into(),
                Position::new(1, 24)
            ),
            Token::new(
                TokenType::Eof,
                "string reading scanning test".into(),
                Position::new(1, 25)
            )
        ];

        let mut compiler = Compiler::new_using_str(
            "string reading scanning test".into(),
            source.into()
        );

        let mut scanner = Scanner::new(&mut compiler);
        let actual = scanner.scan();

        check_results(actual, expected);
    }

    #[test]
    fn test_skip_single_comment() {
        let source = "let x = //12_000 12_000.50;";

        let expected = vec![
            Token::new(
                TokenType::Keyword(Keyword::Let),
                "single comment skip scanning test".into(),
                Position::new(1, 1)
            ),
            Token::new(
                TokenType::Tag("x".into()),
                "single comment skip scanning test".into(),
                Position::new(1, 5)
            ),
            Token::new(
                TokenType::Assign,
                "single comment skip scanning test".into(),
                Position::new(1, 7)
            ),
            Token::new(
                TokenType::Eof,
                "single comment skip scanning test".into(),
                Position::new(1, 28)
            )
        ];

        let mut compiler = Compiler::new_using_str(
            "single comment skip scanning test".into(),
            source.into()
        );

        let mut scanner = Scanner::new(&mut compiler);
        let actual = scanner.scan();

        check_results(actual, expected);
    }

    #[test]
    fn test_skip_multi_comment() {
        let source = "let x = /*\
            12_000 12_000.50;   \
            */";

        let expected = vec![
            Token::new(
                TokenType::Keyword(Keyword::Let),
                "multi comment skip scanning test".into(),
                Position::new(1, 1)
            ),
            Token::new(
                TokenType::Tag("x".into()),
                "multi comment skip scanning test".into(),
                Position::new(1, 5)
            ),
            Token::new(
                TokenType::Assign,
                "multi comment skip scanning test".into(),
                Position::new(1, 7)
            ),
            Token::new(
                TokenType::Eof,
                "multi comment skip scanning test".into(),
                Position::new(1, 33)
            )
        ];

        let mut compiler = Compiler::new_using_str(
            "multi comment skip scanning test".into(),
            source.into()
        );

        let mut scanner = Scanner::new(&mut compiler);
        let actual = scanner.scan();

        check_results(actual, expected);
    }
}
