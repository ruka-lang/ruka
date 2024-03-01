/*
 * @author: ruka-lang
 * @created: 2024-02-28
 */

use crate::prelude::*;

use std::sync::Arc;
use anyhow::Result;

/// Represents a interpretation process, responsible for compiling a single file
pub struct Interpreter<'a> {
    pub input: Arc<str>,
    pub ast: Option<Ast>,
    pub compiler: &'a mut Compiler

}

impl<'a> Interpreter<'a> {
    /// Creates a new Interpreter process for compiling an AST
    ///
    /// # Arguments
    /// * `source`  -
    /// * `contents` -
    ///
    /// * Returns 
    /// * A Interpreter process
    ///
    /// # Examples
    ///
    /// ```
    ///
    /// ```
    pub fn new(source: Arc<str>, ast: Ast, compiler: &'a mut Compiler) -> Self {
        Self{
            input: source, 
            ast: Some(ast),
            compiler
        }
    }

    /// Starts the interpretation process
    ///
    /// # Arguments
    /// * `self` - 
    ///
    /// # Returns 
    /// * An anyhow::Result containing unit if successful
    ///
    /// # Examples
    ///
    /// ```
    ///
    /// ```
    pub fn interpret(&mut self) -> Result<()> {

        Ok(())
    }
}
