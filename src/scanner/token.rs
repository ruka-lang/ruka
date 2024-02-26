/*
 * @author: dwclake
 */

use crate::prelude::*;

use std::sync::Arc;

/// Contains a token's type and position, and file it belongs to
#[derive(Clone, Debug, PartialEq)]
pub struct Token {
    pub kind: TokenType,
    pub file: Arc<str>,
    pub pos: Position
}

impl Token {
    /// Creates a new Token
    /// 
    /// # Arguments
    /// * `kind` -
    /// * `file` -
    /// * `pos` -
    ///
    /// # Returns
    /// * A token, of type kind, belonging to file, at pos
    ///
    /// # Examples
    ///
    /// ```
    ///
    /// ```
    pub fn new(kind: TokenType, file: Arc<str>, pos: Position) -> Self {
        Self {
            kind,
            file,
            pos
        }
    }
}

/// Represents the type of a token
#[derive(Clone, Debug, PartialEq)]
pub enum TokenType {
    Tag(Box<str>),
    Keyword(Keyword),
    Mode(Mode),
    String(Box<str>),
    Regex(Box<str>),
    Integer(Box<str>),
    Float(Box<str>),
    // Assignment
    Assign,               // =
    AssignExp,            // :=
    // Punctuation
    Dot,                  // .
    Comma,                // ,
    LeftParen,            // (
    RightParen,           // )
    LeftBracket,          // [
    RightBracket,         // ]
    LeftSquirly,          // {
    RightSquirly,         // }
    SingleQuote,          // '
    DoubleQuote,          // "
    Backtick,             // `
    Backslash,            // \
    Colon,                // :
    Semicolon,            // ;
    Arrow,                // ->
    WideArrow,            // =>
    // Operators
    Address,              // @
    Cash,                 // $
    Pound,                // #
    Bang,                 // !
    Question,             // ?
    RangeExc,             // ..
    RangeInc,             // ..=
    ForwardApp,           // |>
    ReverseApp,           // <|
    // Arithmetic
    Plus,                 // +
    Minus,                // -
    Asterisk,             // *
    Slash,                // /
    Percent,              // %
    Increment,            // ++
    Decrement,            // --
    Power,                // **
    // Bitwise
    Ampersand,            // &
    Pipe,                 // |
    Caret,                // ^
    Tilde,                // ~
    LeftShift,            // <<
    RightShift,           // >>
    // Comparators
    Lesser,               // <
    LesserEq,             // <=
    Greater,              // >
    GreaterEq,            // >=
    Equal,                // ==
    NotEqual,             // !=
    // Others
    Newline,              // '\n'
    Illegal,
    Eof
}

impl TokenType {
    /// Converts a char into it's corresponding TokenType
    /// 
    /// # Arguments
    /// * `ch` -
    ///
    /// # Returns
    /// * A TokenType, whose value will be Illegal if the char is not supported
    ///
    /// # Examples
    ///
    /// ```
    ///
    /// ```
    pub fn from_char(ch: char) -> TokenType {
        match ch {
            '=' => TokenType::Assign,

            '.'  => TokenType::Dot,
            ','  => TokenType::Comma,
            '('  => TokenType::LeftParen,
            ')'  => TokenType::RightParen,
            '['  => TokenType::LeftBracket,
            ']'  => TokenType::RightBracket,
            '{'  => TokenType::LeftSquirly,
            '}'  => TokenType::RightSquirly,
            '\'' => TokenType::SingleQuote,
            '"'  => TokenType::DoubleQuote,
            '`'  => TokenType::Backtick,
            '\\' => TokenType::Backslash,
            ':'  => TokenType::Colon,
            ';'  => TokenType::Semicolon,

            '@'  => TokenType::Address,
            '$'  => TokenType::Cash,
            '#'  => TokenType::Pound,
            '!'  => TokenType::Bang,
            '?'  => TokenType::Question,

            '+'  => TokenType::Plus,
            '-'  => TokenType::Minus,
            '*'  => TokenType::Asterisk,
            '/'  => TokenType::Slash,
            '%'  => TokenType::Percent,

            '&'  => TokenType::Ampersand,
            '|'  => TokenType::Pipe,
            '^'  => TokenType::Caret,
            '~'  => TokenType::Tilde,
            
            '<'  => TokenType::Lesser,
            '>'  => TokenType::Greater,

            '\n' => TokenType::Newline,
            '\0' => TokenType::Eof,
            _    => TokenType::Illegal
        }
    }

    /// Tries to create a TokenType from a string representing a compound operator
    /// 
    /// # Arguments
    /// * `str` -
    ///
    /// # Returns
    /// * An optional TokenType
    ///
    /// # Examples
    ///
    /// ```
    ///
    /// ```
    pub fn try_from_str(str: &str) -> Option<TokenType> {
        match str {
            ":="  => Some(TokenType::AssignExp),

            "->"  => Some(TokenType::Arrow),
            "=>"  => Some(TokenType::WideArrow),

            ".."  => Some(TokenType::RangeExc),
            "..=" => Some(TokenType::RangeInc),
            "|>"  => Some(TokenType::ReverseApp),
            "<|"  => Some(TokenType::ForwardApp),

            "++"  => Some(TokenType::Increment),
            "--"  => Some(TokenType::Decrement),
            "**"  => Some(TokenType::Power),

            "<<"  => Some(TokenType::LeftShift),
            ">>"  => Some(TokenType::RightShift),  

            "<="  => Some(TokenType::LesserEq), 
            ">="  => Some(TokenType::GreaterEq), 
            "=="  => Some(TokenType::NotEqual), 
            "!="  => Some(TokenType::Equal), 

            _     => None
        }

    }

    /// Tries to create a TokenType from a string representing a keyword
    /// 
    /// # Arguments
    /// * `str` -
    ///
    /// # Returns
    /// * An optional TokenType
    ///
    /// # Examples
    ///
    /// ```
    ///
    /// ```
    pub fn try_keyword(str: &str) -> Option<TokenType> {
        use Keyword::*;
        match str {
            "const"  => Some(TokenType::Keyword(Const)),
            "let"  => Some(TokenType::Keyword(Let)),
            "pub"  => Some(TokenType::Keyword(Pub)),
            "return" => Some(TokenType::Keyword(Return)),
            "do"  => Some(TokenType::Keyword(Do)),
            "end"  => Some(TokenType::Keyword(End)),
            "record"  => Some(TokenType::Keyword(Record)),
            "enum"  => Some(TokenType::Keyword(Enum)),
            "use"  => Some(TokenType::Keyword(Use)),
            "interface"  => Some(TokenType::Keyword(Interface)),  
            "module"  => Some(TokenType::Keyword(Module)), 
            "defer"  => Some(TokenType::Keyword(Defer)), 
            "when"  => Some(TokenType::Keyword(When)), 
            "true"  => Some(TokenType::Keyword(True)), 
            "false"  => Some(TokenType::Keyword(False)), 
            "for"  => Some(TokenType::Keyword(For)), 
            "while"  => Some(TokenType::Keyword(While)), 
            "break"  => Some(TokenType::Keyword(Break)), 
            "continue"  => Some(TokenType::Keyword(Continue)), 
            "match"  => Some(TokenType::Keyword(Match)), 
            "if"  => Some(TokenType::Keyword(If)), 
            "else"  => Some(TokenType::Keyword(Else)), 
            "and"  => Some(TokenType::Keyword(And)), 
            "or"  => Some(TokenType::Keyword(Or)), 
            "not"  => Some(TokenType::Keyword(Not)), 
            "comptime"  => Some(TokenType::Keyword(Comptime)), 
            "inline"  => Some(TokenType::Keyword(Inline)), 
            "test"  => Some(TokenType::Keyword(Test)), 
            "as"  => Some(TokenType::Keyword(As)), 
            // Reserved
            "private"  => Some(TokenType::Keyword(Private)), 
            "derive"  => Some(TokenType::Keyword(Derive)),  
            "static"  => Some(TokenType::Keyword(Static)),
            "error"  => Some(TokenType::Keyword(Error)),
            "macro"  => Some(TokenType::Keyword(Macro)),
            "from"  => Some(TokenType::Keyword(From)), 
            "impl"  => Some(TokenType::Keyword(Impl)),  
            "any"  => Some(TokenType::Keyword(Any)), 
            "mod"  => Some(TokenType::Keyword(Mod)), 
            "in"  => Some(TokenType::Keyword(In)), 
            "fn"  => Some(TokenType::Keyword(Fn)),

            _     => None
        }
    }

    /// Tries to create a TokenType from a string representing a mode
    /// 
    /// # Arguments
    /// * `str` -
    ///
    /// # Returns
    /// * An optional TokenType
    ///
    /// # Examples
    ///
    /// ```
    ///
    /// ```
    pub fn try_mode(str: &str) -> Option<TokenType> {
        use Mode::*;
        match str {
            "comptime"  => Some(TokenType::Mode(Comptime)),
            "mut"  => Some(TokenType::Mode(Mut)),
            "mov"  => Some(TokenType::Mode(Mov)),
            "loc"  => Some(TokenType::Mode(Loc)),

            _     => None
        }
    }

    /// Converts a TokenType to a string slice
    /// 
    /// # Arguments
    ///
    /// # Returns
    /// * A string slice
    ///
    /// # Examples
    ///
    /// ```
    ///
    /// ```
    pub fn to_str(&self) -> &str {
        todo!()
    }
}

/// Enumeration of the keywords supported
#[derive(Clone, Debug, PartialEq)]
pub enum Keyword {
    Const,
    Let,
    Pub,
    Return,
    Do,
    Begin,
    End,
    Record,
    Enum,
    Use,
    Interface,
    Module,
    Defer,
    When,
    True,
    False,
    For,
    While,
    Break,
    Continue,
    Match,
    If,
    Else,
    And,
    Or,
    Not,
    Comptime,
    Inline,
    Test,
    As,
    // Reserved
    Private,
    Derive,
    Static,
    Error,
    Macro,
    From,
    Impl,
    Any,
    Mod,
    Fn,
    In
}

impl Keyword {
    /// Converts a Keyword to a string slice
    /// 
    /// # Arguments
    ///
    /// # Returns
    /// * A string slice
    ///
    /// # Examples
    ///
    /// ```
    ///
    /// ```
    pub fn to_str(&self) -> &str {
        todo!()
    }
}

///
#[derive(Clone, Debug, PartialEq)]
pub enum Mode {
    Comptime,
    Mut,
    Mov,
    Loc
}

impl Mode {
    /// Converts a Mode to a string slice
    /// 
    /// # Arguments
    ///
    /// # Returns
    /// * A string slice
    ///
    /// # Examples
    ///
    /// ```
    ///
    /// ```
    pub fn to_str(&self) -> &str {
        todo!()
    }
}
