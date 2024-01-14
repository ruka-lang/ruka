/*
 * @author: dwclake
 */

use crate::prelude::*;

use std::rc::Rc;

/// Represents scanning errors
pub struct ScannerError {
    pub file: Rc<str>,
    pub msg: Box<str>,
    pub pos: Position
}

impl ScannerError {
    /// Creates a new ScannerError
    ///
    /// # Arguments
    /// * `file` -
    /// * `msg`  -
    /// * `pos`  -
    ///
    /// # Returns
    /// * A new ScannerError
    ///
    /// # Examples
    ///
    /// ```
    ///
    /// ```
    pub fn new(file: Rc<str>, msg: Box<str>, pos: Position) -> Self {
        return Self{
            file, 
            msg, 
            pos
        };
    }
}

impl Error for ScannerError {
    fn to_string(&self) -> String {
        todo!()
    }

    fn message(&self) -> &Box<str> {
        return &self.msg;
    }

    fn position(&self) -> &Position {
        return &self.pos;
    }

    fn kind(&self) -> String {
        return "Scan Error".to_string();
    }
}
