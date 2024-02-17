/*
 * @author: dwclake
 */

use crate::prelude::*;

use std::sync::Arc;

/// Represents compiling errors
pub struct CompileError {
    pub file: Arc<str>,
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
    pub fn new(file: Arc<str>, msg: Box<str>, pos: Position) -> Box<Self> {
        Box::new(Self{
            file,
            msg,
            pos
        })
    }
}

impl Error for CompileError {
    fn to_string(&self) -> String {
        format!("Compilation Error in {} at {}, {}: \n\t{}", 
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
        "Compilation Error".to_string()
    }
}
