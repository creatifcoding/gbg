//! FileBrowser Tauri Commands
//!
//! Layer 1 implementation: Direct filesystem access via Tauri IPC.
//! Provides cross-platform file operations with proper error handling.
//!
//! # Commands
//! - `fs_list_directory` - List directory contents
//! - `fs_scan_directory` - Recursive scan with ignore patterns
//! - `fs_read_file` - Read file as bytes
//! - `fs_write_file` - Write bytes to file
//! - `fs_delete_file` - Delete file or directory
//! - `fs_rename_file` - Rename/move file
//! - `fs_copy_file` - Copy file
//! - `fs_create_directory` - Create directory
//! - `fs_file_metadata` - Get file metadata
//! - `fs_compute_hash` - Compute file hash (SHA256/MD5)
//!
//! @module file_browser

use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, Metadata};
use std::io::Read;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::time::SystemTime;

// =============================================================================
// PLATFORM HELPERS
// =============================================================================

/// Get file permissions as (readable, writable, executable)
#[cfg(unix)]
fn get_permissions(meta: &Metadata) -> (bool, bool, bool) {
    let mode = meta.permissions().mode();
    (mode & 0o444 != 0, mode & 0o222 != 0, mode & 0o111 != 0)
}

#[cfg(not(unix))]
fn get_permissions(meta: &Metadata) -> (bool, bool, bool) {
    let readonly = meta.permissions().readonly();
    // On Windows: readable=true always, writable=!readonly, executable based on extension (simplified to true)
    (true, !readonly, true)
}

// =============================================================================
// TYPES
// =============================================================================

/// File entry returned by fs_list_directory
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    /// Unique identifier (full path)
    pub id: String,
    /// File name without path
    pub name: String,
    /// Full path
    pub path: String,
    /// Entry type
    #[serde(rename = "type")]
    pub entry_type: FileType,
    /// Size in bytes
    pub size: u64,
    /// File extension (without dot)
    pub extension: Option<String>,
    /// Is hidden file (starts with .)
    pub hidden: bool,
    /// Is readable
    pub readable: bool,
    /// Is writable
    pub writable: bool,
    /// Is executable
    pub executable: bool,
    /// Created timestamp (ms since epoch)
    pub created_at: u64,
    /// Modified timestamp (ms since epoch)
    pub modified_at: u64,
    /// Accessed timestamp (ms since epoch)
    pub accessed_at: u64,
}

/// File type enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FileType {
    File,
    Directory,
    Symlink,
}

/// Extended file metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadata {
    /// Size in bytes
    pub size: u64,
    /// Entry type
    #[serde(rename = "type")]
    pub entry_type: FileType,
    /// Unix permissions (e.g., 0o755)
    pub permissions: u32,
    /// Is hidden
    pub hidden: bool,
    /// Is readonly
    pub readonly: bool,
    /// Created timestamp (ms since epoch)
    pub created_at: u64,
    /// Modified timestamp (ms since epoch)
    pub modified_at: u64,
    /// Accessed timestamp (ms since epoch)
    pub accessed_at: u64,
    /// Inode number (Unix only)
    pub inode: Option<u64>,
    /// Device ID (Unix only)
    pub device: Option<u64>,
    /// Number of hard links
    pub nlink: Option<u64>,
    /// MIME type (detected from extension)
    pub mime_type: Option<String>,
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/// Convert SystemTime to milliseconds since Unix epoch
fn system_time_to_millis(time: SystemTime) -> u64 {
    time.duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Get extension from filename
fn get_extension(name: &str) -> Option<String> {
    Path::new(name)
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
}

/// Detect MIME type from extension
fn detect_mime_type(extension: Option<&str>) -> Option<String> {
    extension.map(|ext| {
        match ext.to_lowercase().as_str() {
            // Text
            "txt" => "text/plain",
            "md" => "text/markdown",
            "json" => "application/json",
            "yaml" | "yml" => "application/x-yaml",
            "toml" => "application/toml",
            "xml" => "application/xml",
            "html" | "htm" => "text/html",
            "css" => "text/css",
            "csv" => "text/csv",

            // Code
            "js" => "application/javascript",
            "ts" => "application/typescript",
            "tsx" => "application/typescript",
            "jsx" => "application/javascript",
            "rs" => "text/x-rust",
            "py" => "text/x-python",
            "go" => "text/x-go",
            "java" => "text/x-java",
            "c" => "text/x-c",
            "cpp" | "cc" => "text/x-c++",
            "h" => "text/x-c-header",
            "sh" | "bash" => "application/x-sh",

            // Images
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "svg" => "image/svg+xml",
            "webp" => "image/webp",
            "ico" => "image/x-icon",

            // Audio
            "mp3" => "audio/mpeg",
            "wav" => "audio/wav",
            "ogg" => "audio/ogg",
            "flac" => "audio/flac",

            // Video
            "mp4" => "video/mp4",
            "webm" => "video/webm",
            "avi" => "video/x-msvideo",
            "mkv" => "video/x-matroska",

            // Documents
            "pdf" => "application/pdf",
            "doc" | "docx" => "application/msword",
            "xls" | "xlsx" => "application/vnd.ms-excel",
            "ppt" | "pptx" => "application/vnd.ms-powerpoint",

            // Archives
            "zip" => "application/zip",
            "tar" => "application/x-tar",
            "gz" => "application/gzip",
            "7z" => "application/x-7z-compressed",
            "rar" => "application/vnd.rar",

            // Binary
            "exe" => "application/x-msdownload",
            "dll" => "application/x-msdownload",
            "so" => "application/x-sharedlib",
            "dylib" => "application/x-mach-binary",
            "wasm" => "application/wasm",

            _ => "application/octet-stream",
        }
        .to_string()
    })
}

/// Create FileEntry from path and metadata
fn create_file_entry(path: &Path, meta: &Metadata) -> FileEntry {
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();

    let entry_type = if meta.is_dir() {
        FileType::Directory
    } else if meta.file_type().is_symlink() {
        FileType::Symlink
    } else {
        FileType::File
    };

    let extension = if entry_type == FileType::File {
        get_extension(&name)
    } else {
        None
    };

    let (readable, writable, executable) = get_permissions(&meta);

    FileEntry {
        id: path.to_string_lossy().to_string(),
        name: name.clone(),
        path: path.to_string_lossy().to_string(),
        entry_type,
        size: meta.len(),
        extension,
        hidden: name.starts_with('.'),
        readable,
        writable,
        executable,
        created_at: meta.created().map(system_time_to_millis).unwrap_or(0),
        modified_at: meta.modified().map(system_time_to_millis).unwrap_or(0),
        accessed_at: meta.accessed().map(system_time_to_millis).unwrap_or(0),
    }
}

// =============================================================================
// TAURI COMMANDS
// =============================================================================

/// List directory contents
///
/// # Arguments
/// * `path` - Directory path to list
///
/// # Returns
/// Vector of FileEntry objects
#[tauri::command]
pub fn fs_list_directory(path: &str) -> Result<Vec<FileEntry>, String> {
    let path = Path::new(path);

    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }

    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", path.display()));
    }

    let mut entries = Vec::new();

    for entry in fs::read_dir(path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        entries.push(create_file_entry(&entry.path(), &meta));
    }

    // Sort: directories first, then by name
    entries.sort_by(|a, b| match (&a.entry_type, &b.entry_type) {
        (FileType::Directory, FileType::Directory) => a.name.cmp(&b.name),
        (FileType::Directory, _) => std::cmp::Ordering::Less,
        (_, FileType::Directory) => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });

    Ok(entries)
}

/// Recursively scan directory with ignore pattern support
///
/// # Arguments
/// * `path` - Root directory to scan
/// * `ignore_patterns` - Gitignore-style patterns from frontend IgnoreContext
/// * `max_depth` - Maximum recursion depth (None = unlimited)
///
/// # Returns
/// Vector of FileEntry objects for all non-ignored files
#[tauri::command]
pub fn fs_scan_directory(
    path: &str,
    ignore_patterns: Vec<String>,
    max_depth: Option<usize>,
) -> Result<Vec<FileEntry>, String> {
    let root = Path::new(path);

    if !root.exists() {
        return Err(format!("Path does not exist: {}", root.display()));
    }

    if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", root.display()));
    }

    // Build the walker with ignore patterns
    let mut builder = WalkBuilder::new(root);

    // Configure walker
    builder
        .hidden(false) // Don't skip hidden files (let patterns decide)
        .git_ignore(true) // Respect .gitignore
        .git_global(true) // Respect global gitignore
        .git_exclude(true) // Respect .git/info/exclude
        .ignore(true) // Respect .ignore files
        .parents(true) // Check parent directories for ignore files
        .follow_links(false); // Don't follow symlinks (avoid cycles)

    // Set max depth if provided
    if let Some(depth) = max_depth {
        builder.max_depth(Some(depth));
    }

    // Add custom ignore patterns from frontend
    // The `ignore` crate's OverrideBuilder handles gitignore-style patterns
    let mut overrides = ignore::overrides::OverrideBuilder::new(root);
    for pattern in &ignore_patterns {
        // Negate the pattern to make it an ignore (! prefix means "don't ignore")
        // But we want these TO be ignored, so we add them as-is with ! negation logic inverted
        // Actually, Override uses "include" logic, so we need to invert:
        // - Pattern "node_modules/" means "ignore node_modules"
        // - For Override, we want "!node_modules/" to exclude it
        let ignore_pattern = format!("!{}", pattern.trim_start_matches('!'));
        if overrides.add(&ignore_pattern).is_err() {
            // Skip invalid patterns, log would be nice but we're in Rust
            continue;
        }
    }

    if let Ok(built_overrides) = overrides.build() {
        builder.overrides(built_overrides);
    }

    let walker = builder.build();

    let mut entries = Vec::new();

    for result in walker {
        match result {
            Ok(entry) => {
                // Skip the root directory itself
                if entry.path() == root {
                    continue;
                }

                // Get metadata
                let meta = match entry.metadata() {
                    Ok(m) => m,
                    Err(_) => continue, // Skip entries we can't read
                };

                entries.push(create_file_entry(entry.path(), &meta));
            }
            Err(_) => continue, // Skip errors (permission denied, etc.)
        }
    }

    // Sort: directories first, then by path
    entries.sort_by(|a, b| match (&a.entry_type, &b.entry_type) {
        (FileType::Directory, FileType::Directory) => a.path.cmp(&b.path),
        (FileType::Directory, _) => std::cmp::Ordering::Less,
        (_, FileType::Directory) => std::cmp::Ordering::Greater,
        _ => a.path.cmp(&b.path),
    });

    Ok(entries)
}

/// Read file contents as bytes
///
/// # Arguments
/// * `path` - File path to read
///
/// # Returns
/// File contents as Vec<u8>
#[tauri::command]
pub fn fs_read_file(path: &str) -> Result<Vec<u8>, String> {
    let path = Path::new(path);

    if !path.exists() {
        return Err(format!("File does not exist: {}", path.display()));
    }

    if !path.is_file() {
        return Err(format!("Path is not a file: {}", path.display()));
    }

    fs::read(path).map_err(|e| e.to_string())
}

/// Write bytes to file
///
/// # Arguments
/// * `path` - File path to write
/// * `data` - Bytes to write
#[tauri::command]
pub fn fs_write_file(path: &str, data: Vec<u8>) -> Result<(), String> {
    let path = Path::new(path);

    // Create parent directories if they don't exist
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::write(path, data).map_err(|e| e.to_string())
}

/// Delete file or directory
///
/// # Arguments
/// * `path` - Path to delete
/// * `recursive` - If true, delete directories recursively
#[tauri::command]
pub fn fs_delete_file(path: &str, recursive: bool) -> Result<(), String> {
    let path = Path::new(path);

    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }

    if path.is_dir() {
        if recursive {
            fs::remove_dir_all(path).map_err(|e| e.to_string())
        } else {
            fs::remove_dir(path).map_err(|e| e.to_string())
        }
    } else {
        fs::remove_file(path).map_err(|e| e.to_string())
    }
}

/// Rename or move file
///
/// # Arguments
/// * `source` - Source path
/// * `dest` - Destination path
#[tauri::command]
pub fn fs_rename_file(source: &str, dest: &str) -> Result<(), String> {
    let source = Path::new(source);
    let dest = Path::new(dest);

    if !source.exists() {
        return Err(format!("Source does not exist: {}", source.display()));
    }

    // Create parent directories of dest if they don't exist
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::rename(source, dest).map_err(|e| e.to_string())
}

/// Copy file
///
/// # Arguments
/// * `source` - Source path
/// * `dest` - Destination path
#[tauri::command]
pub fn fs_copy_file(source: &str, dest: &str) -> Result<(), String> {
    let source = Path::new(source);
    let dest = Path::new(dest);

    if !source.exists() {
        return Err(format!("Source does not exist: {}", source.display()));
    }

    // Create parent directories of dest if they don't exist
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    if source.is_dir() {
        // Copy directory recursively
        copy_dir_recursive(source, dest)
    } else {
        fs::copy(source, dest)
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
}

/// Recursive directory copy helper
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;

    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

/// Create directory
///
/// # Arguments
/// * `path` - Directory path to create
#[tauri::command]
pub fn fs_create_directory(path: &str) -> Result<(), String> {
    let path = Path::new(path);
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

/// Get file metadata
///
/// # Arguments
/// * `path` - Path to get metadata for
///
/// # Returns
/// FileMetadata object
#[tauri::command]
pub fn fs_file_metadata(path: &str) -> Result<FileMetadata, String> {
    let path = Path::new(path);

    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }

    let meta = fs::metadata(path).map_err(|e| e.to_string())?;

    let entry_type = if meta.is_dir() {
        FileType::Directory
    } else if meta.file_type().is_symlink() {
        FileType::Symlink
    } else {
        FileType::File
    };

    let name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");

    let extension = if entry_type == FileType::File {
        get_extension(name)
    } else {
        None
    };

    // Get raw permission mode (Unix) or synthetic value (Windows)
    #[cfg(unix)]
    let perms = meta.permissions().mode();
    #[cfg(not(unix))]
    let perms: u32 = if meta.permissions().readonly() {
        0o444
    } else {
        0o644
    };

    // Unix-specific metadata
    #[cfg(unix)]
    let (inode, device, nlink) = {
        use std::os::unix::fs::MetadataExt;
        (Some(meta.ino()), Some(meta.dev()), Some(meta.nlink()))
    };

    #[cfg(not(unix))]
    let (inode, device, nlink) = (None, None, None);

    Ok(FileMetadata {
        size: meta.len(),
        entry_type,
        permissions: perms,
        hidden: name.starts_with('.'),
        readonly: meta.permissions().readonly(),
        created_at: meta.created().map(system_time_to_millis).unwrap_or(0),
        modified_at: meta.modified().map(system_time_to_millis).unwrap_or(0),
        accessed_at: meta.accessed().map(system_time_to_millis).unwrap_or(0),
        inode,
        device,
        nlink,
        mime_type: detect_mime_type(extension.as_deref()),
    })
}

/// Compute file hash
///
/// # Arguments
/// * `path` - Path to file
/// * `algorithm` - Hash algorithm ("sha256" or "md5")
///
/// # Returns
/// Hex-encoded hash string
#[tauri::command]
pub fn fs_compute_hash(path: &str, algorithm: &str) -> Result<String, String> {
    let path = Path::new(path);

    if !path.exists() {
        return Err(format!("File does not exist: {}", path.display()));
    }

    if !path.is_file() {
        return Err(format!("Path is not a file: {}", path.display()));
    }

    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;

    match algorithm.to_lowercase().as_str() {
        "sha256" => {
            let hash = Sha256::digest(&buffer);
            Ok(format!("{:x}", hash))
        }
        "md5" => {
            let hash = md5::compute(&buffer);
            Ok(format!("{:x}", hash))
        }
        _ => Err(format!(
            "Unsupported algorithm: {}. Use 'sha256' or 'md5'.",
            algorithm
        )),
    }
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_list_directory() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        File::create(&file_path).unwrap();

        let entries = fs_list_directory(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "test.txt");
        assert_eq!(entries[0].entry_type, FileType::File);
    }

    #[test]
    fn test_read_write_file() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.txt");

        let data = b"Hello, TMNL!";
        fs_write_file(file_path.to_str().unwrap(), data.to_vec()).unwrap();

        let read_data = fs_read_file(file_path.to_str().unwrap()).unwrap();
        assert_eq!(read_data, data);
    }

    #[test]
    fn test_create_delete_directory() {
        let dir = tempdir().unwrap();
        let new_dir = dir.path().join("subdir");

        fs_create_directory(new_dir.to_str().unwrap()).unwrap();
        assert!(new_dir.exists());

        fs_delete_file(new_dir.to_str().unwrap(), false).unwrap();
        assert!(!new_dir.exists());
    }

    #[test]
    fn test_compute_hash() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        let mut file = File::create(&file_path).unwrap();
        file.write_all(b"test content").unwrap();

        let hash = fs_compute_hash(file_path.to_str().unwrap(), "sha256").unwrap();
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 64); // SHA256 produces 64 hex chars
    }

    #[test]
    fn test_file_metadata() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        File::create(&file_path).unwrap();

        let meta = fs_file_metadata(file_path.to_str().unwrap()).unwrap();
        assert_eq!(meta.entry_type, FileType::File);
        assert!(!meta.hidden);
    }
}
