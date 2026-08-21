use std::path::PathBuf;
use std::process::ExitCode;

use clap::Parser;
use mantis_lab_verifier::corpus::{run_draft202012_corpus, workspace_root_from};

#[derive(Debug, Parser)]
#[command(name = "mantis-corpus", about = "Run the shared Draft 2020-12 corpus")]
struct Cli {
    #[arg(long, default_value = ".")]
    root: PathBuf,
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    let workspace = match workspace_root_from(&cli.root) {
        Ok(path) => path,
        Err(error) => {
            eprintln!("mantis-corpus: {error:#}");
            return ExitCode::from(2);
        }
    };
    match run_draft202012_corpus(&workspace) {
        Ok(value) => {
            println!("{value}");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("mantis-corpus: {error:#}");
            ExitCode::from(1)
        }
    }
}
