/*
 * @author: ruka-lang
 * @created: 2024-02-28
 */

use crate::prelude::*;

use std::sync::Arc;

/// Represents compiling errors
#[derive(Debug)]
pub struct Error {
    pub file: Arc<str>,
    pub kind: Box<str>,
    pub msg: Box<str>,
    pub pos: Position
}

impl Error {
    /// Creates a new Boxed CompileError
    ///
    /// # Arguments
    /// * `file` - 
    /// * `kind` -
    /// * `msg`  - 
    /// * `pos`  - 
    ///
    /// # Returns
    /// * A new Error 
    ///
    /// # Examples
    ///
    /// ```
    /// 
    /// ```
    pub fn new(file: Arc<str>, kind: Box<str>, msg: Box<str>, pos: Position) -> Self {
        Self{
            file,
            kind,
            msg,
            pos
        }
    }

    pub fn to_string(&self) -> String {
        format!("{} in {} at {}, {}: \n\t{}", 
            self.kind,
            self.file, 
            self.pos.line, 
            self.pos.column, 
            self.msg
        )
    }

    pub fn message(&self) -> &Box<str> {
        &self.msg
    }

    pub fn position(&self) -> &Position {
        &self.pos
    }

    pub fn kind(&self) -> &Box<str> {
        &self.kind
    }
}
