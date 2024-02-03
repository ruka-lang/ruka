/*
 * @author: dwclake
 */

use crate::prelude::*;

use std::sync::Arc;

/// Contains a token's type and position, and file it belongs to
#[derive(Clone, Debug, PartialEq)]
pub struct Token<'a> {
    pub ttype: TokenType<'a>,
    pub file: Arc<str>,
    pub pos: Position
}

impl<'a> Token<'a> {
    pub fn new(ttype: TokenType<'a>, file: Arc<str>, pos: Position) -> Self {
        Self {
            ttype,
            file,
            pos
        }
    }
}

/// Represents the type of a token
#[derive(Clone, Debug, PartialEq)]
pub enum TokenType<'a> {
    Identifier(&'a str),
    Keyword(Keyword),
    Mode(Mode),
    String(&'a str),
    Regex(&'a str),
    Integer(&'a str),
    Float(&'a str),
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
    RangeInc,             // ...
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
    PatternMatch,         // ~=
    PatternNotMatch,      // !~
    // Others
    Newline,
    Illegal,
    Eof
}

impl<'a> TokenType<'a> {
    fn from_char(ch: char) -> TokenType<'a> {
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

    fn from_str(str: &str) -> Option<TokenType<'a>> {
        match str {
            ":="  => Some(TokenType::AssignExp),

            "->"  => Some(TokenType::Arrow),
            "=>"  => Some(TokenType::WideArrow),

            ".."  => Some(TokenType::RangeExc),
            "..." => Some(TokenType::RangeInc),
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
            "~="  => Some(TokenType::PatternMatch), 
            "!~"  => Some(TokenType::PatternNotMatch), 

            _     => None
        }

    }

    fn try_keyword(str: &str) -> Option<TokenType<'a>> {
        use Keyword::*;
        match str {
            "static"  => Some(TokenType::Keyword(Static)),
            "const"  => Some(TokenType::Keyword(Const)),
            "let"  => Some(TokenType::Keyword(Let)),
            "pub"  => Some(TokenType::Keyword(Pub)),
            "return" => Some(TokenType::Keyword(Return)),
            "fn"  => Some(TokenType::Keyword(Fn)),
            "do"  => Some(TokenType::Keyword(Do)),
            "end"  => Some(TokenType::Keyword(End)),
            "record"  => Some(TokenType::Keyword(Record)),
            "union"  => Some(TokenType::Keyword(Union)),
            "use"  => Some(TokenType::Keyword(Use)),
            "trait"  => Some(TokenType::Keyword(Trait)),  
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

            "any"  => Some(TokenType::Keyword(Any)), 
            "private"  => Some(TokenType::Keyword(Private)), 
            "inline"  => Some(TokenType::Keyword(Inline)), 
            "from"  => Some(TokenType::Keyword(From)), 
            "as"  => Some(TokenType::Keyword(As)), 
            "in"  => Some(TokenType::Keyword(In)), 

            _     => None
        }
    }

    fn try_mode(str: &str) -> Option<TokenType<'a>> {
        use Mode::*;
        match str {
            "comptime"  => Some(TokenType::Mode(Comptime)),
            "mut"  => Some(TokenType::Mode(Mut)),
            "mov"  => Some(TokenType::Mode(Mov)),
            "loc"  => Some(TokenType::Mode(Loc)),

            _     => None
        }
    }

    fn to_str(ttype: &TokenType<'a>) -> &'a str {
        todo!()
    }
}

/// Enumeration of the keywords supported
#[derive(Clone, Debug, PartialEq)]
pub enum Keyword {
    Static,
    Const,
    Let,
    Pub,
    Return,
    Fn,
    Do,
    Begin,
    End,
    Record,
    Union,
    Use,
    Trait,
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
    // Reserved
    Any,
    Private,
    Inline,
    From,
    As,
    In
}

impl Keyword {
    fn to_str(keyword: &Self) -> &'static str {
        todo!()
    }
}

#[derive(Clone, Debug, PartialEq)]
pub enum Mode {
    Comptime,
    Mut,
    Mov,
    Loc
}

impl Mode {
    fn to_str(keyword: &Self) -> &'static str {
        todo!()
    }
}
