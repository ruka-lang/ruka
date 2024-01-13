/*
 * @author: dwclake
 */

use crate::prelude::*;

use std::rc::Rc;

/// Represents compiling errors
pub struct CompileError {
    pub file: Rc<str>,
    pub msg: Box<str>,
    pub pos: Position
}

impl CompileError {
    /// Returns a new CompileError
    ///
    /// # Arguments
    ///
    /// * `file` - 
    /// * `msg`  - 
    /// * `pos`  - 
    ///
    /// # Returns
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

impl Error for CompileError {
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
        return "Compile Error".to_string();
    }
}
