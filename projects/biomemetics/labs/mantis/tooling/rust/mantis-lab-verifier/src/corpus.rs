//! Draft 2020-12 corpus runner.
//!
//! Uses the same catalog fixtures as Python and TypeScript. Validation is
//! delegated to the Python Draft 2020-12 engine so all three languages report
//! identical pass/fail outcomes for schema conformance. Rust additionally
//! enforces manifest lifecycle certification rules natively.

use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{anyhow, Context, Result};
use serde_json::Value;

pub fn workspace_root_from(start: &Path) -> Result<PathBuf> {
    let mut cur = start.to_path_buf();
    for _ in 0..8 {
        if cur.join("contracts/interfaces.json").is_file()
            && cur.join("evidence/fixtures/corpus/catalog.json").is_file()
        {
            return Ok(cur);
        }
        if !cur.pop() {
            break;
        }
    }
    Err(anyhow!(
        "cannot locate mantis workspace from {}",
        start.display()
    ))
}

pub fn run_draft202012_corpus(workspace: &Path) -> Result<Value> {
    let status = Command::new("python3")
        .args([
            "-m",
            "mantis_lab.cli",
            "--workspace",
            workspace.to_str().ok_or_else(|| anyhow!("non-utf8 workspace"))?,
            "run-corpus",
        ])
        .env(
            "PYTHONPATH",
            workspace.join("tooling/python/mantis-lab/src"),
        )
        .output()
        .context("failed to invoke python corpus runner")?;

    let stdout = String::from_utf8_lossy(&status.stdout).to_string();
    let stderr = String::from_utf8_lossy(&status.stderr).to_string();
    if !status.status.success() {
        return Err(anyhow!(
            "corpus failed (exit {:?}): {}\n{}",
            status.status.code(),
            stdout,
            stderr
        ));
    }
    serde_json::from_str(&stdout).context("corpus stdout was not JSON")
}

pub fn certify_manifest_lifecycle(manifest: &Value) -> Result<()> {
    let lifecycle = manifest
        .get("lifecycle")
        .and_then(Value::as_str)
        .unwrap_or("generated");
    match lifecycle {
        "reviewed" | "immutable-baseline" => {
            if !manifest.get("review").map(Value::is_object).unwrap_or(false) {
                return Err(anyhow!(
                    "reviewed/immutable-baseline manifests require review metadata"
                ));
            }
            Ok(())
        }
        "generated" => Err(anyhow!(
            "lifecycle generated cannot certify a baseline; review first (ADR-003)"
        )),
        other => Err(anyhow!("unsupported manifest lifecycle: {other}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn rejects_generated_for_certification() {
        let manifest = json!({"lifecycle": "generated", "artifacts": []});
        assert!(certify_manifest_lifecycle(&manifest).is_err());
    }

    #[test]
    fn accepts_reviewed_with_metadata() {
        let manifest = json!({
            "lifecycle": "reviewed",
            "review": {
                "reviewer": "r",
                "reviewedAt": "2026-08-20T12:10:00Z",
                "notes": "ok"
            }
        });
        assert!(certify_manifest_lifecycle(&manifest).is_ok());
    }
}
