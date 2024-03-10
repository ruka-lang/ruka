use std::{env, fs::File, io::prelude::*, fs};
use anyhow::Result;
use clap::{Parser, Subcommand};

use ruka::templates::*;

#[derive(Parser)]
#[command(name="ruka", author="ruka-lang", version, about, arg_required_else_help = true)]
/// Package Manager for Ruka
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>
}

#[derive(Subcommand)]
enum Commands {
    Init{
        name: String
    },
    Build,
    Test,
    Run
}

fn create_project(name: &String) -> Result<()> {
    let path = env::current_dir()?;
    let dir = path.join(name);

    if !dir.exists() {
        // Create project directory and subdirectories
        fs::create_dir(&dir)?;
        fs::create_dir(dir.join("src"))?;
        fs::create_dir(dir.join(".build"))?;

        // Create gitignore
        let mut ignore = File::create(dir.join(".gitignore"))?;
        write!(ignore, "{}", IGNORE_TEMPLATE.trim_start())?;

        // Create project configuration
        let mut config = File::create(dir.join(name.to_owned() + ".ruka"))?;
        write!(config, "{}",
            CONFIG_TEMPLATE.trim_start().replace("NAME", name)
            )?;

        // Create project metadata file
        let metadata = File::create(dir.join(name.to_owned() + ".ruka"))?;

        // Create program entry file
        let mut entry = File::create(dir.join("src/main.ruka"))?;
        write!(entry, "{}", ENTRY_TEMPLATE.trim_start())?;
    } else {
        println!("Directory: ./{} already exists", name);
    }

    Ok(())
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match &cli.command {
        Some(Commands::Init {name}) => {
            create_project(name)?;
        },
        _ => {}
    }

    Ok(())
}
