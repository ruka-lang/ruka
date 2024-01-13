/*
 * @author: dwclake
 */

/// Represents a position in a file
#[derive(Clone, Debug, PartialEq)]
pub struct Position {
    pub line: usize,
    pub column: usize
}

impl Position {
    /// Creates a new position
    ///
    /// # Arguments
    ///
    /// * `line`   - 
    /// * `column` -
    ///
    /// # Returns
    ///
    /// # Examples
    ///
    /// ```
    ///
    /// ```
    pub fn new(line: usize, column: usize) -> Self {
        return Self{
            line,
            column
        };
    }
}
