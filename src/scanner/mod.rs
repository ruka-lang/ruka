/*
 * @author: ruka-lang
 * @created: 2024-02-28
 */

use crate::prelude::*;

pub mod token;

/// Scanning process, responsible for scanning a single file
pub struct Scanner<'a> {
    current_pos: Position,
    token_pos: Position,
    compiler: &'a mut Compiler,
    read: usize
}

impl<'a, 'b, 'c> Scanner<'a> {
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

        Self {
            current_pos: current_pos.clone(),
            token_pos: current_pos,
            compiler,
            read: 0
        }
    }

    // Advances the scanner by count, keeping track of line and column position
    fn advance(&'b mut self, count: usize) {
        let count = count.clamp(0, 3);

        for _ in 0..count {
            self.read = self.read + 1;

            self.current_pos.column += 1;
            if self.prev() == '\n' {
                self.current_pos.line += 1;
                self.current_pos.column = 1;
            }
        }
    }

    // Reads the char at the current read position
    fn read(&'b self) -> char {
        if self.read >= self.compiler.contents.len() {
            return '\0'
        }

        self.compiler.contents
            .chars()
            .nth(self.read).unwrap()
    }

    // Reads the char after the current read position
    fn peek(&'b self) -> char {
        if self.read + 1 >= self.compiler.contents.len() {
            return '\0'
        }

        self.compiler.contents
            .chars()
            .nth(self.read + 1).unwrap()
    }

    // Reads the char before the current read position
    fn prev(&self) -> char {
        if self.read - 1 >= self.compiler.contents.len() {
            return '\0'
        }

        self.compiler.contents
            .chars()
            .nth(self.read - 1).unwrap()
    }

    // Reads a tag, keyword, or mode from the source
    fn read_tag_keyword_mode(&'b mut self) -> Token {
        let start = self.read;

        let mut char = self.read();
        while is_alphanumeric(char) {
            self.advance(1);
            char = self.read();
        }

        let str = &self.compiler.contents[start..self.read];

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

    // Reads a number, either float or integer from the source
    fn read_number(&'b mut self) -> Token {
        let start = self.read;
        let mut is_float = false;

        let mut char = self.read();
        while is_numeric(char) {
            if self.read() == '.' {
                self.read_integer();
                is_float = true;
                break;
            }

            self.advance(1);
            char = self.read();
        }

        let str = &self.compiler.contents[start..self.read];
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

    // Reads a number, without allowing decimal points from the source
    fn read_integer(&'b mut self) {
        self.advance(1);

        let mut char = self.read();
        while is_integral(char) {
            self.advance(1);
            char = self.read();
        }
    }

    //
    fn create_escape_error(
        &'b mut self, 
        i: &usize, 
        str: &String
    ) {
        match str.chars().nth(*i + 1) {
            Some(ch) => {
                self.compiler.errors.push(Error::new(
                    self.compiler.input.clone(),
                    "Scanning error".into(),
                    format!("Unrecognized escape character: \\{}", ch).into(),
                    self.current_pos.clone()
                ));
            },
            _ => {
                self.compiler.errors.push(Error::new(
                    self.compiler.input.clone(),
                    "Scanning error".into(),
                    "Unterminated escape character".into(),
                    self.current_pos.clone()
                ));
            }
        }
    }

    //
    fn handle_escape_characters(&'b mut self, str: &String) -> String {
        let mut new_str = String::new();
        let mut i = 0;

        while i < str.len() {
            match str.chars().nth(i) {
                Some('\\') => {
                    match try_escape_char(str.get(i..i+2)) {
                        Some(ch) => {
                            i = i + 2;
                            new_str.push(ch);
                        },
                        _ => {
                            self.create_escape_error(&i, &str);

                            i = i + 1;
                            new_str.push('\\');
                        },
                    }
                },
                Some(ch) => {
                    i = i + 1;
                    new_str.push(ch);
                },
                _ => {}
            }
        }

        new_str
    }

    // Reads a single line string currently w/o escape character support from the source
    fn read_string(&'b mut self) -> Token {
        let mut str = String::new();

        while self.peek() != '"' && self.peek() != '\0' {
            str.push(self.peek());
            self.advance(1);
        }
        self.advance(2);

        if self.prev() != '"' {
            self.compiler.errors.push(Error::new(
                self.compiler.input.clone(),
                "Scanning error".into(),
                "Unterminated string literal".into(),
                self.current_pos.clone()
            ));
        }

        let str = self.handle_escape_characters(&str);

        Token::new(
            TokenType::String(str.into()),
            self.compiler.input.clone(),
            self.token_pos.clone()
        )
    }

    //
    fn read_multiline_string(&'b mut self) -> Token {
        let mut str = String::new();

        self.advance(1);
        while self.peek() != '"' && self.peek() != '\0' {
            match self.peek() {
                '\\' => {
                    self.advance(1);

                    match self.peek() {
                        '|' => str.push('|'),
                        '"' => break,
                        ch => {
                            str.push('\\');
                            str.push(ch);
                        }
                    }
                },
                '\n' => {
                    str.push('\n');
                    self.advance(2);
                    self.skip_whitespace();

                    match self.read() {
                        '|' => {
                            match self.peek() {
                                '"' => break,
                                ch => str.push(ch)
                            }
                        },
                        '"' => break,
                        _ => {
                            self.compiler.errors.push(Error::new(
                                self.compiler.input.clone(),
                                "Scanning error".into(),
                                "Missing start of line delimiter '|'".into(),
                                self.current_pos.clone()
                            ));
                        }
                    }
                    
                }
                ch => {
                    str.push(ch);
                }
            }
            self.advance(1);
        }
        self.advance(2);

        if self.prev() != '"' {
            self.compiler.errors.push(Error::new(
                self.compiler.input.clone(),
                "Scanning error".into(),
                "Unterminated string literal".into(),
                self.current_pos.clone()
            ));
        }

        let str = self.handle_escape_characters(&str);

        Token::new(
            TokenType::String(str.into()),
            self.compiler.input.clone(),
            self.token_pos.clone()
        )
    }

    // Trys to read a operator composed of two or more characters from the source
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


    // Skips whitespace, spaces and tabs
    fn skip_whitespace(&'b mut self) {
        match self.read() {
            ' ' | '\t' => {
                self.advance(1);
                self.skip_whitespace();
            },
            _ => {}
        }
    }

    // Skips a comment until the end of the line or file
    fn skip_single_comment(&'b mut self) {
        match self.read() {
            '\n' | '\0' => (),
            _ => {
                self.advance(1);
                self.skip_single_comment()
            }
        }
    }

    // Skips a comment until the closing delimiter is reached
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

        if next != '/' {
            self.compiler.errors.push(Error::new(
                self.compiler.input.clone(),
                "Scanning error".into(),
                "Unterminated multiline string".into(),
                self.current_pos.clone()
            ));
        }
    }

    // Reads the next token from the source
    pub fn next_token(&'b mut self) -> Token {
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
                match self.peek() {
                    '|' => self.read_multiline_string(),
                    _ => self.read_string()
                }
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
                self.advance(1);
                Token::new(
                    TokenType::Tilde,
                    self.compiler.input.clone(),
                    self.token_pos.clone()
                )
            },
            '!' => {
                let kind = self.try_compound_operator(vec![
                    (2, "!=", TokenType::NotEqual)
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

    /*
    /// Scans the source file within the compiler process this scanner was created in.
    /// 
    /// # Arguments
    ///
    /// # Returns
    /// * A vector of Tokens, representing the tokens in the source
    ///
    /// # Examples
    ///
    /// ```
    ///
    /// ```
    */
    /*fn scan(&'a mut self) -> Vec<Token> {
        let mut token = self.next_token();

        while token.kind != TokenType::Eof {
            self.tokens.push(token);
            token = self.next_token();
        }

        self.tokens.push(token);

        take(&mut self.tokens)
    }*/
}

#[cfg(test)]
mod scanner_tests {
    use crate::prelude::*;

    fn check_results(scanner: &mut Scanner, expected: Vec<Token>) {
        let mut i = 0;

        let mut token = scanner.next_token();
        while token.kind != TokenType::Eof {
            assert_eq!(token, expected[i]);
            i = i + 1;

            token = scanner.next_token();
        }
        assert_eq!(token, expected[i]);

        assert_eq!(i+1, expected.len());
    }

    #[test]
    fn test_next_token() {
        let source = "let x = 12_000 12_000.50";

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
                TokenType::Eof,
                "next token scanning test".into(),
                Position::new(1, 25)
            )
        ];

        let mut compiler = Compiler::new_using_str(
            "next token scanning test".into(),
            source.into()
        );

        let mut scanner = Scanner::new(&mut compiler);

        check_results(&mut scanner, expected);
    }

    #[test]
    fn test_compound_op() {
        let source = "== != >= <= |> <| << >> ++ -- ** -> => .. ..= :=";

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
                TokenType::ReverseApp,
                "compound operator scanning test".into(),
                Position::new(1, 13)
            ),
            Token::new(
                TokenType::ForwardApp,
                "compound operator scanning test".into(),
                Position::new(1, 16)
            ),
            Token::new(
                TokenType::LeftShift,
                "compound operator scanning test".into(),
                Position::new(1, 19)
            ),
            Token::new(
                TokenType::RightShift,
                "compound operator scanning test".into(),
                Position::new(1, 22)
            ),
            Token::new(
                TokenType::Increment,
                "compound operator scanning test".into(),
                Position::new(1, 25)
            ),
            Token::new(
                TokenType::Decrement,
                "compound operator scanning test".into(),
                Position::new(1, 28)
            ),
            Token::new(
                TokenType::Power,
                "compound operator scanning test".into(),
                Position::new(1, 31)
            ),
            Token::new(
                TokenType::Arrow,
                "compound operator scanning test".into(),
                Position::new(1, 34)
            ),
            Token::new(
                TokenType::WideArrow,
                "compound operator scanning test".into(),
                Position::new(1, 37)
            ),
            Token::new(
                TokenType::RangeExc,
                "compound operator scanning test".into(),
                Position::new(1, 40)
            ),
            Token::new(
                TokenType::RangeInc,
                "compound operator scanning test".into(),
                Position::new(1, 43)
            ),
            Token::new(
                TokenType::AssignExp,
                "compound operator scanning test".into(),
                Position::new(1, 47)
            ),
            Token::new(
                TokenType::Eof,
                "compound operator scanning test".into(),
                Position::new(1, 49)
            )
        ];

        let mut compiler = Compiler::new_using_str(
            "compound operator scanning test".into(),
            source.into()
        );

        let mut scanner = Scanner::new(&mut compiler);

        check_results(&mut scanner, expected);
    }

    #[test]
    fn test_string_reading() {
        let source = "let x = \"Hello, world!\"";

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
                TokenType::Eof,
                "string reading scanning test".into(),
                Position::new(1, 24)
            )
        ];

        let mut compiler = Compiler::new_using_str(
            "string reading scanning test".into(),
            source.into()
        );

        let mut scanner = Scanner::new(&mut compiler);

        check_results(&mut scanner, expected);
    }

    #[test]
    fn test_multiline_string_reading() {
        let source = "let x = \"|\n\
            | Hello, world!\n\
            |\"";

        let expected = vec![
            Token::new(
                TokenType::Keyword(Keyword::Let),
                "multiline string scanning test".into(),
                Position::new(1, 1)
            ),
            Token::new(
                TokenType::Tag("x".into()),
                "multiline string scanning test".into(),
                Position::new(1, 5)
            ),
            Token::new(
                TokenType::Assign,
                "multiline string scanning test".into(),
                Position::new(1, 7)
            ),
            Token::new(
                TokenType::String("\n Hello, world!\n".into()),
                "multiline string scanning test".into(),
                Position::new(1, 9)
            ),
            Token::new(
                TokenType::Eof,
                "multiline string scanning test".into(),
                Position::new(3, 3)
            )
        ];

        let mut compiler = Compiler::new_using_str(
            "multiline string scanning test".into(),
            source.into()
        );

        let mut scanner = Scanner::new(&mut compiler);

        check_results(&mut scanner, expected);
    }

    #[test]
    fn test_escape_characters() {
        let source = "let x = \"Hello, \\n\\sworld!\"";

        let expected = vec![
            Token::new(
                TokenType::Keyword(Keyword::Let),
                "escape character scanning test".into(),
                Position::new(1, 1)
            ),
            Token::new(
                TokenType::Tag("x".into()),
                "escape character scanning test".into(),
                Position::new(1, 5)
            ),
            Token::new(
                TokenType::Assign,
                "escape character scanning test".into(),
                Position::new(1, 7)
            ),
            Token::new(
                TokenType::String("Hello, \n\\sworld!".into()),
                "escape character scanning test".into(),
                Position::new(1, 9)
            ),
            Token::new(
                TokenType::Eof,
                "escape character scanning test".into(),
                Position::new(1, 28)
            )
        ];

        let mut compiler = Compiler::new_using_str(
            "escape character scanning test".into(),
            source.into()
        );

        let mut scanner = Scanner::new(&mut compiler);

        check_results(&mut scanner, expected);

        assert!(compiler.errors.len() == 1);
        let message: Box<str> = "Unrecognized escape character: \\s".into();
        assert!(compiler.errors[0].message() == &message);
    }

    #[test]
    fn test_skip_single_comment() {
        let source = "let x = //12_000 12_000.50";

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
                Position::new(1, 27)
            )
        ];

        let mut compiler = Compiler::new_using_str(
            "single comment skip scanning test".into(),
            source.into()
        );

        let mut scanner = Scanner::new(&mut compiler);

        check_results(&mut scanner, expected);
    }

    #[test]
    fn test_skip_multi_comment() {
        let source = "let x = /*\n\
                          12_000 12_000.50\n\
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
                Position::new(3, 3)
            )
        ];

        let mut compiler = Compiler::new_using_str(
            "multi comment skip scanning test".into(),
            source.into()
        );

        let mut scanner = Scanner::new(&mut compiler);

        check_results(&mut scanner, expected);
    }
}
