/*
 * @author: dwclake
 */

use rukac::cli::*;
use rukac::prelude::*;

use anyhow::Result;
use clap::Parser;

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Some(Commands::Compile { input, output }) => {
            let mut compiler = Compiler::new(input, output)?;
            compiler.compile()?;

            println!("{}", compiler.contents);
        }
        _ => {}
    }

    Ok(())
}
