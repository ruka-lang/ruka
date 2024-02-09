/*
 * @author: dwclake
 */

use warpc::prelude::*;
use warpc::cli::*;

use clap::Parser;
use anyhow::Result;

fn main() -> Result<()> {
    let cli = Cli::parse();

    match &cli.command {
        Some(Commands::Compile{input, output}) => {
            let mut compiler = Compiler::new(input.clone(), output.clone())?;
            compiler.compile()?;

            println!("{}", compiler.contents.unwrap());
        },
        _ => {}
    }

    return Ok(());
}
