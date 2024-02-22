/*
 * @author: dwclake
 */

use warpc::cli::*;
use warpc::prelude::*;

use anyhow::Result;
use clap::Parser;

fn main() -> Result<()> {
    let cli = Cli::parse();

    match &cli.command {
        Some(Commands::Compile { input, output }) => {
            let mut compiler = Compiler::new(input.clone(), output.clone())?;
            compiler.compile_async()?;

            println!("{}", compiler.contents);
        }
        _ => {}
    }

    Ok(())
}
