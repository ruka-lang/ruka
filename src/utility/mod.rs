/*
 * @author: dwclake
 */

pub mod position;
pub mod error;

///
pub fn is_alphabetical(ch: char) -> bool {
    match ch {
        'a'..='z' | 'A'..='Z' => true,
        _ => false
    }
}

///
pub fn is_integral(ch: char) -> bool {
    match ch {
        '0'..='9' | '_' => true,
        _ => false
    }
}

///
pub fn is_numeric(ch: char) -> bool {
    is_integral(ch) || ch == '.'
}

///
pub fn is_alphanumeric(ch: char) -> bool {
    is_alphabetical(ch) || is_integral(ch)
}

///
pub fn try_escape_char(str: Option<&str>) -> Option<char> {
    match str {
        Some("\\n") => Some('\n'),
        Some("\\r") => Some('\r'),
        Some("\\t") => Some('\t'),
        Some("\\\\") => Some('\\'),
        Some("\\'") => Some('\''),
        Some("\\\"") => Some('\"'),
        Some("\\0") => Some('\0'),
        _     => None
    }
}
