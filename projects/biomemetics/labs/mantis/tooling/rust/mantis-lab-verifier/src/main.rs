use std::path::{Path, PathBuf};
use std::process::ExitCode;

use clap::Parser;
use mantis_lab_verifier::{report_json, verify, VerifyOptions};

#[derive(Debug, Parser)]
#[command(
    name = "mantis-lab-verifier",
    version,
    about = "Emit a deterministic verification report for a mantis lab workspace"
)]
struct Cli {
    /// Durable mantis lab root.
    #[arg(long, default_value = ".")]
    root: PathBuf,

    /// Lab/workspace JSON. Defaults to lab.json, or workspace.json when present.
    #[arg(long)]
    lab: Option<PathBuf>,

    /// Artifact/project manifest JSON. Repeat for multiple manifests.
    #[arg(long = "manifest")]
    manifests: Vec<PathBuf>,

    /// Emit compact JSON rather than pretty-printed JSON.
    #[arg(long)]
    compact: bool,
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    let lab = cli.lab.unwrap_or_else(|| default_lab_path(&cli.root));
    let manifests = if cli.manifests.is_empty() {
        vec![default_manifest_path(&cli.root)]
    } else {
        cli.manifests
    };
    let options = VerifyOptions {
        root: cli.root,
        lab,
        manifests,
    };

    match verify(&options) {
        Ok(report) => match report_json(&report, !cli.compact) {
            Ok(json) => {
                println!("{json}");
                if report.ok {
                    ExitCode::SUCCESS
                } else {
                    ExitCode::from(1)
                }
            }
            Err(error) => {
                eprintln!("mantis-lab-verifier: {error:#}");
                ExitCode::from(2)
            }
        },
        Err(error) => {
            eprintln!("mantis-lab-verifier: {error:#}");
            ExitCode::from(2)
        }
    }
}

fn default_lab_path(root: &Path) -> PathBuf {
    if root.join("lab.json").is_file() {
        PathBuf::from("lab.json")
    } else {
        PathBuf::from("workspace.json")
    }
}

fn default_manifest_path(root: &Path) -> PathBuf {
    for candidate in [
        "artifact-manifest.json",
        "artifacts/manifest.json",
        "manifests/artifacts.json",
    ] {
        if root.join(candidate).is_file() {
            return PathBuf::from(candidate);
        }
    }
    PathBuf::from("artifact-manifest.json")
}
