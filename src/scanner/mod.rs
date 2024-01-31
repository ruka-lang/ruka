/*
 * @author: dwclake
 */

use std::ops::{FromResidual, Try};

use crate::prelude::*;

use anyhow::{anyhow, Result};

pub mod token;
pub mod error;

/// Scanning process, responsible for scanning a single file
pub struct Scanner<'a> {
    pub current_pos: Position,
    pub token_pos: Position,
    pub tokens: Vec<Token<'a>>,
    pub compiler: &'a mut Compiler,
    pub read: usize
}

impl<'a, 'b> Scanner<'a> {
    /// Creates a new Scanner process
    /// 
    /// # Arguments 
    /// * `compiler` - 
    ///
    /// # Returns
    /// * A new Scanner process
    ///
    /// # Examples 
    ///
    /// ```
    ///
    /// ```
    pub fn new(compiler: &'a mut Compiler) -> Self {
        let current_pos = Position::new(1, 1);
        let tokens = vec![];

        return Self {
            current_pos: current_pos.clone(),
            token_pos: current_pos,
            tokens,
            compiler,
            read: 0
        }
    }

    ///
    fn next_token(&mut self) -> Result<Token<'b>> {

        Ok(Token::new(TokenType::Illegal, "".into(), Position::new(0, 0)))
    }

    ///
    pub fn scan(&'a mut self) -> Result<()> {
        let mut tokens = vec![];
        let mut token = self.next_token()?;

        while token.ttype != TokenType::Eof {
            tokens.push(token);
            token = self.next_token()?;
        }

        self.tokens = tokens;
        
        Ok(())
    }
}

#[derive(Debug)]
pub enum ScanResult<'a> {
    Ok(Token<'a>),
    Err(ScannerError)
}

impl<'a, 'b> ScanResult<'b> {
    pub fn check_error(self, _compiler: &'a Compiler) -> Result<Token<'b>> {
        match self {
            ScanResult::Err(err) => {
                // Create scanning error and store in compiler
                Err(anyhow!(err.to_string()))
            },
            ScanResult::Ok(tok) => {
               Ok(tok)
            }
        }
    }

}

impl<'b> FromResidual for ScanResult<'b> {
    fn from_residual(residual: <Self as Try>::Residual) -> Self {
        ScanResult::Err(residual)
    }
}

impl<'b> Try for ScanResult<'b> {
    type Output = Token<'b>;

    type Residual = ScannerError;

    fn from_output(output: Self::Output) -> Self {
        ScanResult::Ok(output)
    }

    fn branch(self) -> std::ops::ControlFlow<Self::Residual, Self::Output> {
        match self {
            ScanResult::Ok(token) => {
                std::ops::ControlFlow::from_output(token)
            },
            ScanResult::Err(err) => {
                std::ops::ControlFlow::from_residual(std::ops::ControlFlow::Break(err))
            }
        }
    }
}
