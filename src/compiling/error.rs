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
    /// Creates a new Boxed CompileError
    ///
    /// # Arguments
    /// * `file` - 
    /// * `msg`  - 
    /// * `pos`  - 
    ///
    /// # Returns
    /// * A new Boxed CompileError 
    ///
    /// # Examples
    ///
    /// ```
    /// 
    /// ```
    pub fn new(file: Rc<str>, msg: Box<str>, pos: Position) -> Box<Self> {
        return Box::new(Self{
            file,
            msg,
            pos
        });
    }
}

impl Error for CompileError {
    fn to_string(&self) -> String {
        return format!("Compilation Error in {} at {}, {}: \n\t{}", 
                       self.file, 
                       self.pos.line, 
                       self.pos.column, 
                       self.msg
                       );
    }

    fn message(&self) -> &Box<str> {
        return &self.msg;
    }

    fn position(&self) -> &Position {
        return &self.pos;
    }

    fn kind(&self) -> String {
        return "Compilation Error".to_string();
    }
}
