/*
 * @author: dwclake
 */

use crate::prelude::*;
use crate::constants::*;

use std::sync::Arc;
use std::{fs, env};
use anyhow::{anyhow, Result};

pub mod error;

/// Represents a compilation process, responsible for compiling a single file
pub struct Compiler {
    pub input: Arc<str>,
    pub output: Option<Arc<str>>,
    pub contents: Box<str>,
    pub errors: Vec<Box<dyn Error>>
}

impl Compiler {
    /// Creates a new Compiler process
    ///
    /// # Arguments
    /// * `input`  -
    /// * `output` -
    ///
    /// * Returns 
    /// * An anyhow::Result, containing the Compiler proces if successful
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

        return Ok(Self{
            input, 
            output,
            contents,
            errors
        });
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
    pub fn compile(&mut self) -> Result<()> {
        let _scanner = Scanner::new(self);

        return Ok(());
    }
}
