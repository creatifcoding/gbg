//! Deterministic verification primitives for the durable mantis lab.
//!
//! This crate deliberately performs a small set of operational invariants. It
//! does not replace JSON Schema validation. Schema validation should run as a
//! separate gate before or alongside this verifier.

pub mod corpus;

use std::collections::HashSet;
use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

/// Standalone verifier-report format emitted by this crate.
///
/// A report is an artifact input to a later `EvidenceRecord`; it is not itself
/// the shared `contracts/evidence.schema.json` evidence contract.
pub const REPORT_SCHEMA: &str = "specimendb.mantis.verification-report.v1";

/// Lifecycle labels accepted by the lightweight invariant checker.
///
/// This vocabulary is intentionally explicit and conservative. Repositories
/// may narrow it with JSON Schema. Adding a new status here is a compatibility
/// change, not an invitation to bypass schema review.
pub const ALLOWED_STATUSES: &[&str] = &[
    "accepted",
    "active",
    "archived",
    "blocked",
    "cancelled",
    "candidate",
    "complete",
    "completed",
    "concept-validation",
    "concept_validation",
    "current",
    "deprecated",
    "draft",
    "experimental",
    "failed",
    "in_progress",
    "paused",
    "planned",
    "proposed",
    "provisional",
    "ready",
    "rejected",
    "released",
    "retired",
    "superseded",
    "unverified",
    "validated",
    "verified",
];

/// Paths required to perform a verification run.
#[derive(Clone, Debug)]
pub struct VerifyOptions {
    /// Durable lab root. All inputs and declared artifacts must resolve inside it.
    pub root: PathBuf,
    /// Lab/workspace contract, conventionally `lab.json` or `workspace.json`.
    pub lab: PathBuf,
    /// One or more artifact/project manifests.
    pub manifests: Vec<PathBuf>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct VerificationReport {
    pub schema: String,
    pub verifier: VerifierIdentity,
    pub ok: bool,
    pub inputs: Vec<InputEvidence>,
    pub checks: Vec<CheckEvidence>,
    pub artifacts: Vec<ArtifactEvidence>,
    pub summary: EvidenceSummary,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct VerifierIdentity {
    pub name: String,
    pub version: String,
    pub hash_algorithm: String,
    pub directory_hash_algorithm: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct InputEvidence {
    pub role: String,
    pub path: String,
    pub sha256: Option<String>,
    pub result: CheckResult,
    pub issue: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct CheckEvidence {
    pub code: String,
    pub subject: String,
    pub result: CheckResult,
    pub message: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CheckResult {
    Pass,
    Fail,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ArtifactKind {
    File,
    Directory,
    Missing,
    Unknown,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ArtifactEvidence {
    pub id: String,
    pub source: String,
    pub path: String,
    pub kind: ArtifactKind,
    pub declared_status: Option<String>,
    pub expected_sha256: Option<String>,
    pub actual_sha256: Option<String>,
    pub files: Vec<FileEvidence>,
    pub result: CheckResult,
    pub issue: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct FileEvidence {
    pub path: String,
    pub sha256: String,
    pub bytes: u64,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct EvidenceSummary {
    pub input_count: usize,
    pub check_count: usize,
    pub passed_checks: usize,
    pub failed_checks: usize,
    pub artifact_count: usize,
    pub passed_artifacts: usize,
    pub failed_artifacts: usize,
    pub hashed_file_count: usize,
}

#[derive(Clone, Debug)]
struct ArtifactDeclaration {
    id: String,
    source: String,
    path: String,
    expected_sha256: Option<String>,
    status: Option<String>,
}

/// Verify lab metadata and every artifact declared by the supplied manifests.
///
/// The returned report contains failed checks. `Err` is reserved for a
/// condition that prevents the verifier from establishing a root of trust,
/// such as an inaccessible lab root.
pub fn verify(options: &VerifyOptions) -> Result<VerificationReport> {
    let root = fs::canonicalize(&options.root)
        .with_context(|| format!("cannot canonicalize lab root {}", options.root.display()))?;
    if !root.is_dir() {
        return Err(anyhow!("lab root is not a directory: {}", root.display()));
    }

    let mut inputs = Vec::new();
    let mut checks = Vec::new();
    let mut declarations = Vec::new();

    load_document(
        &root,
        &options.lab,
        "lab",
        false,
        &mut inputs,
        &mut checks,
        &mut declarations,
    );

    if options.manifests.is_empty() {
        checks.push(fail(
            "manifest.required",
            "manifests",
            "at least one artifact manifest is required",
        ));
    }

    for manifest in &options.manifests {
        load_document(
            &root,
            manifest,
            "manifest",
            true,
            &mut inputs,
            &mut checks,
            &mut declarations,
        );
    }

    declarations.sort_by(|a, b| {
        (&a.path, &a.id, &a.source).cmp(&(&b.path, &b.id, &b.source))
    });

    let mut artifacts: Vec<_> = declarations
        .iter()
        .map(|declaration| verify_artifact(&root, declaration))
        .collect();

    inputs.sort_by(|a, b| (&a.role, &a.path).cmp(&(&b.role, &b.path)));
    checks.sort_by(|a, b| {
        (&a.subject, &a.code, &a.message).cmp(&(&b.subject, &b.code, &b.message))
    });
    artifacts.sort_by(|a, b| (&a.path, &a.id, &a.source).cmp(&(&b.path, &b.id, &b.source)));

    let passed_checks = checks
        .iter()
        .filter(|check| check.result == CheckResult::Pass)
        .count();
    let passed_artifacts = artifacts
        .iter()
        .filter(|artifact| artifact.result == CheckResult::Pass)
        .count();
    let hashed_file_count = artifacts.iter().map(|artifact| artifact.files.len()).sum();
    let summary = EvidenceSummary {
        input_count: inputs.len(),
        check_count: checks.len(),
        passed_checks,
        failed_checks: checks.len() - passed_checks,
        artifact_count: artifacts.len(),
        passed_artifacts,
        failed_artifacts: artifacts.len() - passed_artifacts,
        hashed_file_count,
    };
    let ok = summary.failed_checks == 0
        && summary.failed_artifacts == 0
        && inputs
            .iter()
            .all(|input| input.result == CheckResult::Pass);

    Ok(VerificationReport {
        schema: REPORT_SCHEMA.to_owned(),
        verifier: VerifierIdentity {
            name: env!("CARGO_PKG_NAME").to_owned(),
            version: env!("CARGO_PKG_VERSION").to_owned(),
            hash_algorithm: "sha256".to_owned(),
            directory_hash_algorithm: "mantis-directory-sha256-v1".to_owned(),
        },
        ok,
        inputs,
        checks,
        artifacts,
        summary,
    })
}

/// Serialize a verification report with stable struct-field and vector ordering.
pub fn report_json(report: &VerificationReport, pretty: bool) -> Result<String> {
    if pretty {
        serde_json::to_string_pretty(report).context("cannot serialize verification report")
    } else {
        serde_json::to_string(report).context("cannot serialize verification report")
    }
}

fn load_document(
    root: &Path,
    requested_path: &Path,
    role: &str,
    require_artifacts: bool,
    inputs: &mut Vec<InputEvidence>,
    checks: &mut Vec<CheckEvidence>,
    declarations: &mut Vec<ArtifactDeclaration>,
) {
    let (logical_path, resolved_path) = match resolve_input(root, requested_path) {
        Ok(value) => value,
        Err(issue) => {
            inputs.push(InputEvidence {
                role: role.to_owned(),
                path: portable_path(requested_path),
                sha256: None,
                result: CheckResult::Fail,
                issue: Some(issue),
            });
            return;
        }
    };
    let subject = portable_path(&logical_path);

    let bytes = match fs::read(&resolved_path) {
        Ok(bytes) => bytes,
        Err(error) => {
            inputs.push(InputEvidence {
                role: role.to_owned(),
                path: subject,
                sha256: None,
                result: CheckResult::Fail,
                issue: Some(format!("cannot read input: {error}")),
            });
            return;
        }
    };

    inputs.push(InputEvidence {
        role: role.to_owned(),
        path: subject.clone(),
        sha256: Some(hex_digest(&bytes)),
        result: CheckResult::Pass,
        issue: None,
    });

    let document: Value = match serde_json::from_slice(&bytes) {
        Ok(document) => document,
        Err(error) => {
            checks.push(fail(
                "document.json",
                &subject,
                &format!("invalid JSON: {error}"),
            ));
            return;
        }
    };

    validate_document(
        &document,
        &subject,
        require_artifacts,
        checks,
        declarations,
    );
}

fn validate_document(
    document: &Value,
    subject: &str,
    require_artifacts: bool,
    checks: &mut Vec<CheckEvidence>,
    declarations: &mut Vec<ArtifactDeclaration>,
) {
    let Some(object) = document.as_object() else {
        checks.push(fail(
            "document.object",
            subject,
            "document root must be a JSON object",
        ));
        return;
    };

    if require_artifacts {
        validate_manifest_header(object, subject, checks);
    } else {
        validate_workspace_identity(object, subject, checks);
        validate_required_string(object.get("kind"), "kind", subject, checks);
        validate_status(object.get("status"), true, subject, checks);
    }

    if let Some(projects) = object.get("projects") {
        if projects.is_array() || projects.is_object() {
            checks.push(pass(
                "workspace.projects.type",
                subject,
                "projects is an array or object map",
            ));
        } else {
            checks.push(fail(
                "workspace.projects.type",
                subject,
                "projects must be an array or object map when present",
            ));
        }
    }

    match object.get("artifacts") {
        Some(Value::Array(artifacts)) => {
            checks.push(pass(
                "document.artifacts.type",
                subject,
                "artifacts is an array",
            ));
            collect_artifacts(artifacts, subject, checks, declarations);
        }
        Some(_) => checks.push(fail(
            "document.artifacts.type",
            subject,
            "artifacts must be an array when present",
        )),
        None if require_artifacts => checks.push(fail(
            "manifest.required.artifacts",
            subject,
            "artifact manifest requires an artifacts array",
        )),
        None => {}
    }

    // Workspace files may embed project descriptors. They are deliberately
    // tolerated as strings or partial objects; embedded artifact arrays are
    // still discovered recursively.
    if let Some(Value::Array(projects)) = object.get("projects") {
        for (index, project) in projects.iter().enumerate() {
            if let Value::Object(project) = project {
                let project_subject = format!("{subject}#projects/{index}");
                if let Some(status) = project.get("status") {
                    validate_status(Some(status), false, &project_subject, checks);
                }
                if let Some(Value::Array(artifacts)) = project.get("artifacts") {
                    collect_artifacts(artifacts, subject, checks, declarations);
                }
            } else if !project.is_string() {
                checks.push(fail(
                    "workspace.project.entry",
                    &format!("{subject}#projects/{index}"),
                    "project entry must be a string or object",
                ));
            }
        }
    }
    if let Some(Value::Object(projects)) = object.get("projects") {
        for (project_id, project) in projects {
            let Value::Object(project) = project else {
                checks.push(fail(
                    "workspace.project.entry",
                    &format!("{subject}#projects/{project_id}"),
                    "project map entry must be an object",
                ));
                continue;
            };
            let project_subject = format!("{subject}#projects/{project_id}");
            if let Some(status) = project.get("status") {
                validate_status(Some(status), false, &project_subject, checks);
            }
            if let Some(Value::Array(artifacts)) = project.get("artifacts") {
                collect_artifacts(artifacts, subject, checks, declarations);
            }
        }
    }
}

fn validate_manifest_header(
    object: &serde_json::Map<String, Value>,
    subject: &str,
    checks: &mut Vec<CheckEvidence>,
) {
    if let Some(lifecycle) = object.get("lifecycle").and_then(Value::as_str) {
        match lifecycle {
            "generated" => checks.push(pass(
                "manifest.lifecycle.generated_not_baseline",
                subject,
                "generated manifests may be smoke-checked but cannot certify a baseline (ADR-003)",
            )),
            "reviewed" | "immutable-baseline" => {
                if object.get("review").map(Value::is_object).unwrap_or(false) {
                    checks.push(pass(
                        "manifest.lifecycle.certifiable",
                        subject,
                        "reviewed/immutable-baseline manifest retains separate review metadata",
                    ));
                } else {
                    checks.push(fail(
                        "manifest.lifecycle.review_required",
                        subject,
                        "reviewed/immutable-baseline manifests require review metadata",
                    ));
                }
            }
            other => checks.push(fail(
                "manifest.lifecycle.unknown",
                subject,
                &format!("unsupported manifest lifecycle '{other}'"),
            )),
        }
    }

    if object.contains_key("algorithm") || object.contains_key("schemaVersion") {
        match object.get("schemaVersion") {
            Some(Value::Number(version)) if version.as_u64() == Some(1) => checks.push(pass(
                "manifest.schema_version",
                subject,
                "digest manifest schemaVersion is 1",
            )),
            Some(Value::String(version)) if version == "1" || version == "1.0.0" => {
                checks.push(pass(
                    "manifest.schema_version",
                    subject,
                    "digest manifest schemaVersion is supported",
                ));
            }
            _ => checks.push(fail(
                "manifest.schema_version",
                subject,
                "digest manifest requires schemaVersion 1 or 1.0.0",
            )),
        }
        match object.get("algorithm").and_then(Value::as_str) {
            Some(algorithm) if algorithm.eq_ignore_ascii_case("sha256") => checks.push(pass(
                "manifest.algorithm",
                subject,
                "digest manifest algorithm is sha256",
            )),
            _ => checks.push(fail(
                "manifest.algorithm",
                subject,
                "digest manifest algorithm must be sha256",
            )),
        }
    } else {
        validate_required_string(object.get("id"), "id", subject, checks);
        validate_required_string(object.get("kind"), "kind", subject, checks);
        validate_status(object.get("status"), true, subject, checks);
    }
}

fn validate_workspace_identity(
    object: &serde_json::Map<String, Value>,
    subject: &str,
    checks: &mut Vec<CheckEvidence>,
) {
    let identity = object
        .get("workspaceId")
        .or_else(|| object.get("id"))
        .and_then(Value::as_str)
        .map(str::trim);
    match identity {
        Some(value) if !value.is_empty() => checks.push(pass(
            "document.required.workspace_identity",
            subject,
            "workspaceId or id is a non-empty string",
        )),
        _ => checks.push(fail(
            "document.required.workspace_identity",
            subject,
            "workspace document requires a non-empty workspaceId or id",
        )),
    }
}

fn validate_required_string(
    value: Option<&Value>,
    field: &str,
    subject: &str,
    checks: &mut Vec<CheckEvidence>,
) {
    let code = format!("document.required.{field}");
    match value.and_then(Value::as_str).map(str::trim) {
        Some(value) if !value.is_empty() => checks.push(pass(
            &code,
            subject,
            &format!("{field} is a non-empty string"),
        )),
        _ => checks.push(fail(
            &code,
            subject,
            &format!("{field} must be a non-empty string"),
        )),
    }
}

fn validate_status(
    value: Option<&Value>,
    required: bool,
    subject: &str,
    checks: &mut Vec<CheckEvidence>,
) {
    match value.and_then(Value::as_str).map(normalize_status) {
        Some(status) if ALLOWED_STATUSES.contains(&status.as_str()) => checks.push(pass(
            "document.status.allowed",
            subject,
            &format!("status '{status}' is allowed"),
        )),
        Some(status) => checks.push(fail(
            "document.status.allowed",
            subject,
            &format!("status '{status}' is not an allowed lifecycle label"),
        )),
        None if required => checks.push(fail(
            "document.required.status",
            subject,
            "status must be a non-empty string",
        )),
        None => checks.push(fail(
            "document.status.allowed",
            subject,
            "status must be a string when present",
        )),
    }
}

fn collect_artifacts(
    artifacts: &[Value],
    source: &str,
    checks: &mut Vec<CheckEvidence>,
    declarations: &mut Vec<ArtifactDeclaration>,
) {
    for (index, artifact) in artifacts.iter().enumerate() {
        let artifact_subject = format!("{source}#artifacts/{index}");
        match artifact {
            Value::String(path) => declarations.push(ArtifactDeclaration {
                id: path.clone(),
                source: source.to_owned(),
                path: path.clone(),
                expected_sha256: None,
                status: None,
            }),
            Value::Object(object) => {
                if let Some(status) = object.get("status") {
                    validate_status(Some(status), false, &artifact_subject, checks);
                }

                if let Some(Value::Array(children)) = object.get("artifacts") {
                    collect_artifacts(children, source, checks, declarations);
                }

                let Some(path) = object.get("path").and_then(Value::as_str) else {
                    if !object.contains_key("artifacts") {
                        checks.push(fail(
                            "artifact.path.required",
                            &artifact_subject,
                            "artifact requires a non-empty path string",
                        ));
                    }
                    continue;
                };
                if path.trim().is_empty() {
                    checks.push(fail(
                        "artifact.path.required",
                        &artifact_subject,
                        "artifact requires a non-empty path string",
                    ));
                    continue;
                }

                let id = object
                    .get("id")
                    .and_then(Value::as_str)
                    .filter(|id| !id.trim().is_empty())
                    .unwrap_or(path)
                    .to_owned();
                let expected_sha256 = object
                    .get("sha256")
                    .or_else(|| object.get("expected_sha256"))
                    .and_then(Value::as_str)
                    .map(str::to_owned);
                let status = object
                    .get("status")
                    .and_then(Value::as_str)
                    .map(normalize_status);

                declarations.push(ArtifactDeclaration {
                    id,
                    source: source.to_owned(),
                    path: path.to_owned(),
                    expected_sha256,
                    status,
                });
            }
            _ => checks.push(fail(
                "artifact.entry.type",
                &artifact_subject,
                "artifact entry must be a path string or object",
            )),
        }
    }
}

fn verify_artifact(root: &Path, declaration: &ArtifactDeclaration) -> ArtifactEvidence {
    let base = ArtifactEvidence {
        id: declaration.id.clone(),
        source: declaration.source.clone(),
        path: declaration.path.clone(),
        kind: ArtifactKind::Unknown,
        declared_status: declaration.status.clone(),
        expected_sha256: declaration.expected_sha256.clone(),
        actual_sha256: None,
        files: Vec::new(),
        result: CheckResult::Fail,
        issue: None,
    };

    let expected = match declaration
        .expected_sha256
        .as_deref()
        .map(normalize_expected_hash)
        .transpose()
    {
        Ok(expected) => expected,
        Err(issue) => return ArtifactEvidence { issue: Some(issue), ..base },
    };

    let relative = match validate_declared_path(&declaration.path) {
        Ok(relative) => relative,
        Err(issue) => return ArtifactEvidence { issue: Some(issue), ..base },
    };
    let candidate = root.join(&relative);
    if !candidate.exists() {
        return ArtifactEvidence {
            kind: ArtifactKind::Missing,
            issue: Some("declared artifact does not exist".to_owned()),
            ..base
        };
    }

    let resolved = match fs::canonicalize(&candidate) {
        Ok(path) if path.starts_with(root) => path,
        Ok(_) => {
            return ArtifactEvidence {
                issue: Some("declared artifact resolves outside the lab root".to_owned()),
                ..base
            }
        }
        Err(error) => {
            return ArtifactEvidence {
                issue: Some(format!("cannot resolve declared artifact: {error}")),
                ..base
            }
        }
    };

    let metadata = match fs::metadata(&resolved) {
        Ok(metadata) => metadata,
        Err(error) => {
            return ArtifactEvidence {
                issue: Some(format!("cannot inspect declared artifact: {error}")),
                ..base
            }
        }
    };

    let (kind, actual, files) = if metadata.is_file() {
        match hash_file(&resolved, &relative) {
            Ok(file) => (ArtifactKind::File, file.sha256.clone(), vec![file]),
            Err(error) => {
                return ArtifactEvidence {
                    kind: ArtifactKind::File,
                    issue: Some(error.to_string()),
                    ..base
                }
            }
        }
    } else if metadata.is_dir() {
        match hash_directory(root, &resolved, &relative) {
            Ok((digest, files)) => (ArtifactKind::Directory, digest, files),
            Err(error) => {
                return ArtifactEvidence {
                    kind: ArtifactKind::Directory,
                    issue: Some(error.to_string()),
                    ..base
                }
            }
        }
    } else {
        return ArtifactEvidence {
            issue: Some("artifact is neither a regular file nor directory".to_owned()),
            ..base
        };
    };

    let matches = expected.as_ref().map_or(true, |expected| expected == &actual);
    ArtifactEvidence {
        kind,
        expected_sha256: expected,
        actual_sha256: Some(actual),
        files,
        result: if matches {
            CheckResult::Pass
        } else {
            CheckResult::Fail
        },
        issue: if matches {
            None
        } else {
            Some("SHA-256 mismatch".to_owned())
        },
        ..base
    }
}

fn hash_file(path: &Path, logical_path: &Path) -> Result<FileEvidence> {
    let mut file = fs::File::open(path)
        .with_context(|| format!("cannot open artifact {}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut bytes = 0_u64;
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .with_context(|| format!("cannot read artifact {}", path.display()))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
        bytes = bytes
            .checked_add(read as u64)
            .ok_or_else(|| anyhow!("artifact size overflow at {}", path.display()))?;
    }
    Ok(FileEvidence {
        path: portable_path(logical_path),
        sha256: format!("{:x}", hasher.finalize()),
        bytes,
    })
}

/// Hash a directory as a deterministic sequence of `(path, file_digest)`
/// frames. Directory metadata, mtimes, and host-specific separators are not
/// included. Empty directories hash the version header alone.
fn hash_directory(
    root: &Path,
    directory: &Path,
    logical_root: &Path,
) -> Result<(String, Vec<FileEvidence>)> {
    let mut files = Vec::new();
    let mut visited = HashSet::new();
    walk_directory(
        root,
        directory,
        logical_root,
        &mut visited,
        &mut files,
    )?;
    files.sort_by(|a, b| a.path.cmp(&b.path));

    let mut hasher = Sha256::new();
    hasher.update(b"mantis-directory-sha256-v1\0");
    for file in &files {
        let path = file.path.as_bytes();
        let digest = decode_hex_digest(&file.sha256)?;
        hasher.update((path.len() as u64).to_be_bytes());
        hasher.update(path);
        hasher.update(digest);
    }
    Ok((format!("{:x}", hasher.finalize()), files))
}

fn walk_directory(
    root: &Path,
    directory: &Path,
    logical_directory: &Path,
    visited: &mut HashSet<PathBuf>,
    files: &mut Vec<FileEvidence>,
) -> Result<()> {
    let canonical = fs::canonicalize(directory)
        .with_context(|| format!("cannot resolve directory {}", directory.display()))?;
    if !canonical.starts_with(root) {
        return Err(anyhow!("directory entry resolves outside the lab root"));
    }
    if !visited.insert(canonical.clone()) {
        return Err(anyhow!(
            "directory traversal encountered a symlink cycle at {}",
            portable_path(logical_directory)
        ));
    }

    let mut entries: Vec<_> = fs::read_dir(&canonical)
        .with_context(|| format!("cannot read directory {}", canonical.display()))?
        .collect::<std::io::Result<Vec<_>>>()?;
    entries.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

    for entry in entries {
        let name = entry.file_name();
        let name = name
            .to_str()
            .ok_or_else(|| anyhow!("artifact path is not valid UTF-8"))?;
        let logical = logical_directory.join(name);
        let resolved = fs::canonicalize(entry.path())
            .with_context(|| format!("cannot resolve artifact entry {}", logical.display()))?;
        if !resolved.starts_with(root) {
            return Err(anyhow!(
                "artifact entry {} resolves outside the lab root",
                portable_path(&logical)
            ));
        }
        let metadata = fs::metadata(&resolved)
            .with_context(|| format!("cannot inspect artifact entry {}", logical.display()))?;
        if metadata.is_dir() {
            walk_directory(root, &resolved, &logical, visited, files)?;
        } else if metadata.is_file() {
            files.push(hash_file(&resolved, &logical)?);
        } else {
            return Err(anyhow!(
                "artifact entry {} is neither a regular file nor directory",
                portable_path(&logical)
            ));
        }
    }
    Ok(())
}

fn resolve_input(root: &Path, requested: &Path) -> std::result::Result<(PathBuf, PathBuf), String> {
    if requested.is_absolute() {
        let canonical = fs::canonicalize(requested)
            .map_err(|error| format!("cannot resolve input: {error}"))?;
        let relative = canonical
            .strip_prefix(root)
            .map_err(|_| "input resolves outside the lab root".to_owned())?
            .to_path_buf();
        return Ok((relative, canonical));
    }

    let relative = validate_relative_path(requested)
        .map_err(|issue| format!("unsafe input path: {issue}"))?;
    let candidate = root.join(&relative);
    if !candidate.exists() {
        return Ok((relative, candidate));
    }
    let canonical = fs::canonicalize(&candidate)
        .map_err(|error| format!("cannot resolve input: {error}"))?;
    if !canonical.starts_with(root) {
        return Err("input resolves outside the lab root".to_owned());
    }
    Ok((relative, canonical))
}

fn validate_declared_path(path: &str) -> std::result::Result<PathBuf, String> {
    if path.contains('\\') {
        return Err("artifact paths must use portable '/' separators".to_owned());
    }
    validate_relative_path(Path::new(path))
        .map_err(|issue| format!("unsafe artifact path: {issue}"))
}

fn validate_relative_path(path: &Path) -> std::result::Result<PathBuf, String> {
    if path.as_os_str().is_empty() {
        return Err("path is empty".to_owned());
    }
    if path.is_absolute() {
        return Err("absolute paths are not allowed".to_owned());
    }

    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(value) => normalized.push(value),
            Component::CurDir => {}
            Component::ParentDir => return Err("parent traversal ('..') is not allowed".to_owned()),
            Component::RootDir | Component::Prefix(_) => {
                return Err("rooted paths are not allowed".to_owned())
            }
        }
    }
    if normalized.as_os_str().is_empty() {
        return Err("path resolves to an empty relative path".to_owned());
    }
    Ok(normalized)
}

fn normalize_expected_hash(value: &str) -> std::result::Result<String, String> {
    let value = value
        .trim()
        .strip_prefix("sha256:")
        .unwrap_or(value.trim())
        .to_ascii_lowercase();
    if value.len() != 64 || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("expected SHA-256 must be 64 hexadecimal characters".to_owned());
    }
    Ok(value)
}

fn normalize_status(value: &str) -> String {
    value
        .trim()
        .to_ascii_lowercase()
        .replace(|character: char| character == '-' || character == ' ', "_")
}

fn hex_digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn decode_hex_digest(value: &str) -> Result<[u8; 32]> {
    let mut output = [0_u8; 32];
    if value.len() != 64 {
        return Err(anyhow!("internal SHA-256 digest has invalid length"));
    }
    for (index, byte) in output.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&value[index * 2..index * 2 + 2], 16)
            .context("internal SHA-256 digest contains invalid hex")?;
    }
    Ok(output)
}

fn portable_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn pass(code: &str, subject: &str, message: &str) -> CheckEvidence {
    CheckEvidence {
        code: code.to_owned(),
        subject: subject.to_owned(),
        result: CheckResult::Pass,
        message: message.to_owned(),
    }
}

fn fail(code: &str, subject: &str, message: &str) -> CheckEvidence {
    CheckEvidence {
        code: code.to_owned(),
        subject: subject.to_owned(),
        result: CheckResult::Fail,
        message: message.to_owned(),
    }
}
