use std::fs;
use std::path::Path;

use mantis_lab_verifier::{report_json, verify, ArtifactKind, CheckResult, VerifyOptions};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tempfile::TempDir;

fn write_json(path: &Path, value: &Value) {
    fs::write(path, serde_json::to_vec_pretty(value).unwrap()).unwrap();
}

fn digest(value: &[u8]) -> String {
    format!("{:x}", Sha256::digest(value))
}

fn valid_lab() -> Value {
    // This is schema-shaped enough for the operational verifier. Full Draft
    // 2020-12 validation is a separate, required gate.
    json!({
        "workspaceId": "biomemetics.mantis",
        "kind": "BiomemeticsLabWorkspace",
        "status": "active",
        "projects": {
            "terrarium": { "path": "terrarium", "status": "concept-validation" },
            "observations": { "path": "observations", "status": "planned" }
        }
    })
}

fn options(root: &TempDir) -> VerifyOptions {
    VerifyOptions {
        root: root.path().to_path_buf(),
        lab: "workspace.json".into(),
        manifests: vec!["artifact-manifest.json".into()],
    }
}

#[test]
fn verifies_file_hash_and_emits_stable_json() {
    let root = TempDir::new().unwrap();
    write_json(&root.path().join("workspace.json"), &valid_lab());
    fs::create_dir(root.path().join("data")).unwrap();
    fs::write(root.path().join("data/observation.txt"), b"mantis\n").unwrap();
    write_json(
        &root.path().join("artifact-manifest.json"),
        &json!({
            "id": "observations",
            "kind": "artifact-manifest",
            "status": "verified",
            "artifacts": [{
                "id": "observation-1",
                "path": "data/observation.txt",
                "status": "verified",
                "sha256": digest(b"mantis\n")
            }]
        }),
    );

    let first = verify(&options(&root)).unwrap();
    let second = verify(&options(&root)).unwrap();
    assert!(first.ok);
    assert_eq!(first, second);
    assert_eq!(
        report_json(&first, false).unwrap(),
        report_json(&second, false).unwrap()
    );
    assert_eq!(first.artifacts[0].result, CheckResult::Pass);
    assert_eq!(first.artifacts[0].kind, ArtifactKind::File);
    assert_eq!(first.summary.hashed_file_count, 1);
}

#[test]
fn rejects_parent_traversal_even_when_target_exists() {
    let outer = TempDir::new().unwrap();
    let root_path = outer.path().join("lab");
    fs::create_dir(&root_path).unwrap();
    fs::write(outer.path().join("secret.txt"), b"outside").unwrap();
    write_json(&root_path.join("workspace.json"), &valid_lab());
    write_json(
        &root_path.join("artifact-manifest.json"),
        &json!({
            "id": "unsafe",
            "kind": "artifact-manifest",
            "status": "draft",
            "artifacts": [{ "id": "escape", "path": "../secret.txt" }]
        }),
    );
    let options = VerifyOptions {
        root: root_path,
        lab: "workspace.json".into(),
        manifests: vec!["artifact-manifest.json".into()],
    };

    let evidence = verify(&options).unwrap();
    assert!(!evidence.ok);
    assert!(evidence.artifacts[0]
        .issue
        .as_deref()
        .unwrap()
        .contains("parent traversal"));
}

#[cfg(unix)]
#[test]
fn rejects_symlink_that_resolves_outside_root() {
    use std::os::unix::fs::symlink;

    let outer = TempDir::new().unwrap();
    let root_path = outer.path().join("lab");
    fs::create_dir(&root_path).unwrap();
    fs::write(outer.path().join("secret.txt"), b"outside").unwrap();
    symlink(outer.path().join("secret.txt"), root_path.join("link.txt")).unwrap();
    write_json(&root_path.join("workspace.json"), &valid_lab());
    write_json(
        &root_path.join("artifact-manifest.json"),
        &json!({
            "id": "unsafe-link",
            "kind": "artifact-manifest",
            "status": "draft",
            "artifacts": ["link.txt"]
        }),
    );

    let evidence = verify(&VerifyOptions {
        root: root_path,
        lab: "workspace.json".into(),
        manifests: vec!["artifact-manifest.json".into()],
    })
    .unwrap();
    assert!(!evidence.ok);
    assert!(evidence.artifacts[0]
        .issue
        .as_deref()
        .unwrap()
        .contains("outside the lab root"));
}

#[test]
fn detects_missing_file_and_hash_mismatch() {
    let root = TempDir::new().unwrap();
    write_json(&root.path().join("workspace.json"), &valid_lab());
    fs::write(root.path().join("present.txt"), b"actual").unwrap();
    write_json(
        &root.path().join("artifact-manifest.json"),
        &json!({
            "id": "bad-artifacts",
            "kind": "artifact-manifest",
            "status": "active",
            "artifacts": [
                { "id": "missing", "path": "missing.txt" },
                {
                    "id": "mismatch",
                    "path": "present.txt",
                    "sha256": digest(b"expected")
                }
            ]
        }),
    );

    let evidence = verify(&options(&root)).unwrap();
    assert!(!evidence.ok);
    assert_eq!(evidence.summary.failed_artifacts, 2);
    assert_eq!(evidence.artifacts[0].kind, ArtifactKind::Missing);
    assert_eq!(
        evidence.artifacts[1].issue.as_deref(),
        Some("SHA-256 mismatch")
    );
}

#[test]
fn recursively_hashes_directories_in_path_order() {
    let root = TempDir::new().unwrap();
    write_json(&root.path().join("workspace.json"), &valid_lab());
    fs::create_dir_all(root.path().join("dataset/nested")).unwrap();
    fs::write(root.path().join("dataset/z.txt"), b"z").unwrap();
    fs::write(root.path().join("dataset/nested/a.txt"), b"a").unwrap();
    write_json(
        &root.path().join("artifact-manifest.json"),
        &json!({
            "id": "dataset",
            "kind": "artifact-manifest",
            "status": "active",
            "artifacts": [{ "id": "dataset-tree", "path": "dataset" }]
        }),
    );

    let evidence = verify(&options(&root)).unwrap();
    assert!(evidence.ok);
    assert_eq!(evidence.artifacts[0].kind, ArtifactKind::Directory);
    assert_eq!(evidence.artifacts[0].files.len(), 2);
    assert_eq!(
        evidence.artifacts[0]
            .files
            .iter()
            .map(|file| file.path.as_str())
            .collect::<Vec<_>>(),
        vec!["dataset/nested/a.txt", "dataset/z.txt"]
    );
    assert_eq!(
        evidence.artifacts[0]
            .actual_sha256
            .as_ref()
            .unwrap()
            .len(),
        64
    );
}

#[test]
fn accepts_deterministic_python_digest_manifest_dialect() {
    let root = TempDir::new().unwrap();
    write_json(&root.path().join("workspace.json"), &valid_lab());
    fs::write(root.path().join("artifact.txt"), b"artifact").unwrap();
    write_json(
        &root.path().join("artifact-manifest.json"),
        &json!({
            "schemaVersion": 1,
            "algorithm": "sha256",
            "artifacts": [{
                "id": "artifact.txt",
                "path": "artifact.txt",
                "sha256": digest(b"artifact"),
                "bytes": 8,
                "role": "artifact",
                "status": "unverified"
            }]
        }),
    );

    let evidence = verify(&options(&root)).unwrap();
    assert!(evidence.ok);
    assert!(evidence
        .checks
        .iter()
        .any(|check| check.code == "manifest.algorithm" && check.result == CheckResult::Pass));
}

#[test]
fn flags_missing_fields_and_unknown_status_without_schema_claims() {
    let root = TempDir::new().unwrap();
    write_json(
        &root.path().join("workspace.json"),
        &json!({ "kind": "biomimetics-lab", "status": "doing stuff", "projects": [] }),
    );
    write_json(
        &root.path().join("artifact-manifest.json"),
        &json!({
            "id": "empty",
            "kind": "artifact-manifest",
            "status": "active",
            "artifacts": []
        }),
    );

    let evidence = verify(&options(&root)).unwrap();
    assert!(!evidence.ok);
    assert!(evidence.checks.iter().any(|check| {
        check.code == "document.required.workspace_identity" && check.result == CheckResult::Fail
    }));
    assert!(evidence.checks.iter().any(|check| {
        check.code == "document.status.allowed"
            && check.result == CheckResult::Fail
            && check.message.contains("doing_stuff")
    }));
}
