/*
 * @author: ruka-lang
 * @created: 2024-02-28
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
            println!("{}", compiler.contents);

            compiler.compile()?;
        }
        _ => {}
    }

    Ok(())
}
