use crate::constants::*;

use std::sync::Arc;
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name="ghoose-c", author="ghoose-lang", version=VERSION, about=ABOUT, arg_required_else_help=true)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Commands>
}

#[derive(Subcommand)]
pub enum Commands {
    /// Compiles the file at input and stores the result at output
    Compile{
        /// The file to be compiled
        input: Arc<str>, 
        /// The location for the result to be stored
        output: Option<Arc<str>>
    }
}
