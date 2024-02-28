/*
 * @author: ruka-lang
 * @created: 2024-02-28
 */

/// Represents a position in a file
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct Position {
    pub line: usize,
    pub column: usize
}

impl Position {
    /// Creates a new position
    ///
    /// # Arguments
    /// * `line`   - 
    /// * `column` -
    ///
    /// # Returns
    /// * A new Position
    ///
    /// # Examples
    ///
    /// ```
    ///
    /// ```
    pub fn new(line: usize, column: usize) -> Self {
        Self{
            line,
            column
        }
    }
}
