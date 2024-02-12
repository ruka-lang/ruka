/*
 * @author: dwclake
 */

use crate::prelude::*;
use crate::cli::constants::*;

use std::sync::Arc;
use std::{fs, env};
use anyhow::{anyhow, Result};

/// Represents a interpretation process, responsible for compiling a single file
pub struct Interpreter<'a> {
    pub input: Arc<str>,
    pub ast: Option<Box<Ast>>,
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
    pub fn new(source: Arc<str>, ast: Box<Ast>, compiler: &'a mut Compiler) -> Self {
        return Self{
            input: source, 
            ast: Some(ast),
            compiler
        };
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

        return Ok(());
    }
}
