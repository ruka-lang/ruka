/*
 * @author: dwclake
 */

use crate::prelude::*;
use crate::cli::constants::*;

use std::sync::Arc;
use std::{env, fs};
use anyhow::{anyhow, Result};

/// Represents a compilation process, responsible for compiling a single file
pub struct Compiler {
    pub input: Arc<str>,
    pub output: Option<Arc<str>>,
    pub contents: Box<str>,
    pub ast: Option<Box<Ast>>,
    pub context: Vec<()>,
    pub errors: Vec<Error>
}

impl<'a, 'b> Compiler {
    /// Creates a new Compiler process
    ///
    /// # Arguments
    /// * `input`  -
    /// * `output` -
    ///
    /// * Returns
    /// * An anyhow::Result, containing the Compiler process if successful
    ///
    /// # Examples
    ///
    /// ```
    ///
    /// ```
    pub fn new(input: Arc<str>, output: Option<Arc<str>>) -> Result<Self> {
        let cwd = env::current_dir()?;
        let path = cwd.join(input.to_string());
        let extension = path.extension().unwrap().to_str().unwrap();

        if extension != EXT {
            return Err(anyhow!(format!("Invalid extension: {extension}, expected: {EXT}")));
        }

        let contents = fs::read_to_string(path)?
            .trim_end()
            .into();

        let errors = vec![];

        Ok(Self{
            input,
            output,
            contents,
            ast: None,
            context: vec![],
            errors
        })
    }

    /// Creates a new Compiler process for compiling a string
    ///
    /// # Arguments
    /// * `source`  -
    /// * `contents` -
    ///
    /// * Returns
    /// * A Compiler process
    ///
    /// # Examples
    ///
    /// ```
    ///
    /// ```
    pub fn new_using_str(source: Arc<str>, contents: Box<str>) -> Self {
        let errors = vec![];

        Self{
            input: source,
            output: None,
            contents,
            ast: None,
            context: vec![],
            errors
        }
    }

    /// Creates a new Compiler process for compiling an AST
    ///
    /// # Arguments
    /// * `source`  -
    /// * `contents` -
    ///
    /// * Returns
    /// * A Compiler process
    ///
    /// # Examples
    ///
    /// ```
    ///
    /// ```
    pub fn new_using_ast(source: Arc<str>, ast: Box<Ast>) -> Self {
        let errors = vec![];

        Self{
            input: source,
            output: None,
            contents: "".into(),
            ast: Some(ast),
            context: vec![],
            errors
        }
    }

    /// Starts the compilation process
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
    pub fn compile(&'a mut self) -> Result<()> {
        let mut scanner = Scanner::new(self);
        let tokens = scanner.scan();

        dbg!(&tokens);

        match self.errors.is_empty() {
            true => Ok(()),
            _ => Err(anyhow!("Compiler with errors"))
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
        let _scanner = Scanner::new(self);

        Ok(())
    }
}
