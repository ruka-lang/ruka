/*
 * @author: dwclake
 */

use crate::prelude::*;

use std::sync::Arc;

/// Represents compiling errors
pub struct ScanError {
    pub file: Arc<str>,
    pub msg: Box<str>,
    pub pos: Position
}

impl ScanError {
    /// Creates a new Boxed ScanError
    ///
    /// # Arguments
    /// * `file` - 
    /// * `msg`  - 
    /// * `pos`  - 
    ///
    /// # Returns
    /// * A new Boxed ScanError 
    ///
    /// # Examples
    ///
    /// ```
    /// 
    /// ```
    pub fn new(file: Arc<str>, msg: Box<str>, pos: Position) -> Box<Self> {
        Box::new(Self{
            file,
            msg,
            pos
        })
    }
}

impl Error for ScanError {
    fn to_string(&self) -> String {
        format!("Scanning Error in {} at {}, {}: \n\t{}", 
            self.file, 
            self.pos.line, 
            self.pos.column, 
            self.msg
        )
    }

    fn message(&self) -> &Box<str> {
        &self.msg
    }

    fn position(&self) -> &Position {
        &self.pos
    }

    fn kind(&self) -> String {
        "Scanning Error".to_string()
    }
}
