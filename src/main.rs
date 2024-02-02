/*
 * @author: dwclake
 */

use sghc::prelude::*;
use sghc::cli::*;

use clap::Parser;
use anyhow::Result;

fn main() -> Result<()> {
    let cli = Cli::parse();

    match &cli.command {
        Some(Commands::Compile{input, output}) => {
            let mut compiler = Compiler::new(input.clone(), output.clone())?;
            compiler.compile()?;

            println!("{}", compiler.contents);
        },
        _ => {}
    }

    return Ok(());
}
