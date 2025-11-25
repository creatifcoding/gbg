use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetInfo {
    pub path: String,
    pub file_name: String,
    pub extension: Option<String>,
    pub size: u64,
    pub file_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub assets: Vec<AssetInfo>,
    pub total_files: usize,
    pub total_size: u64,
    pub directory: String,
}

/// Analyze a directory and collect information about all files
pub fn analyze_directory(path: &str) -> Result<AnalysisResult, String> {
    let path = Path::new(path);
    
    if !path.exists() {
        return Err(format!("Directory does not exist: {}", path.display()));
    }
    
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", path.display()));
    }
    
    let mut assets = Vec::new();
    let mut total_size = 0u64;
    
    for entry in WalkDir::new(path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        
        if path.is_file() {
            if let Ok(metadata) = fs::metadata(path) {
                let size = metadata.len();
                total_size += size;
                
                let extension = path
                    .extension()
                    .and_then(|s| s.to_str())
                    .map(|s| s.to_string());
                
                let file_type = determine_file_type(&extension);
                
                assets.push(AssetInfo {
                    path: path.display().to_string(),
                    file_name: path
                        .file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or("unknown")
                        .to_string(),
                    extension: extension.clone(),
                    size,
                    file_type,
                });
            }
        }
    }
    
    Ok(AnalysisResult {
        total_files: assets.len(),
        total_size,
        directory: path.display().to_string(),
        assets,
    })
}

/// Determine file type based on extension
fn determine_file_type(extension: &Option<String>) -> String {
    match extension.as_ref().map(|s| s.as_str()) {
        Some("js") => "JavaScript".to_string(),
        Some("ts") => "TypeScript".to_string(),
        Some("jsx") => "JavaScript JSX".to_string(),
        Some("tsx") => "TypeScript TSX".to_string(),
        Some("json") => "JSON".to_string(),
        Some("css") => "CSS".to_string(),
        Some("html") => "HTML".to_string(),
        Some("md") => "Markdown".to_string(),
        Some("wasm") => "WebAssembly".to_string(),
        Some("png") | Some("jpg") | Some("jpeg") | Some("gif") | Some("svg") | Some("ico") => {
            "Image".to_string()
        }
        Some("woff") | Some("woff2") | Some("ttf") | Some("eot") => "Font".to_string(),
        Some("map") => "Source Map".to_string(),
        _ => "Other".to_string(),
    }
}

/// Read file content (with size limit for safety)
pub fn read_file_content(path: &str, max_size: usize) -> Result<String, String> {
    let path = Path::new(path);
    
    if !path.exists() {
        return Err(format!("File does not exist: {}", path.display()));
    }
    
    if !path.is_file() {
        return Err(format!("Path is not a file: {}", path.display()));
    }
    
    let metadata = fs::metadata(path)
        .map_err(|e| format!("Failed to read metadata: {}", e))?;
    
    if metadata.len() > max_size as u64 {
        return Err(format!(
            "File too large: {} bytes (max: {} bytes)",
            metadata.len(),
            max_size
        ));
    }
    
    fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

/// Extract JavaScript/TypeScript function names from code
pub fn extract_functions(code: &str) -> Vec<String> {
    use regex::Regex;
    
    let mut functions = Vec::new();
    
    // Common JavaScript/TypeScript keywords to exclude
    let keywords = [
        "if", "else", "for", "while", "do", "switch", "case", "break", "continue",
        "return", "try", "catch", "finally", "throw", "new", "delete", "typeof",
        "instanceof", "void", "this", "super", "class", "extends", "implements",
        "interface", "enum", "type", "declare", "namespace", "module", "import",
        "export", "default", "async", "await", "yield", "get", "set", "static",
        "public", "private", "protected", "readonly", "abstract",
    ];
    
    // Match function declarations: function name()
    let fn_regex = Regex::new(r"\bfunction\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(").unwrap();
    for cap in fn_regex.captures_iter(code) {
        if let Some(name) = cap.get(1) {
            let name_str = name.as_str();
            if !keywords.contains(&name_str) {
                functions.push(name_str.to_string());
            }
        }
    }
    
    // Match arrow functions assigned to variables: const name = () =>
    let arrow_regex = Regex::new(r"(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>").unwrap();
    for cap in arrow_regex.captures_iter(code) {
        if let Some(name) = cap.get(1) {
            let name_str = name.as_str();
            if !keywords.contains(&name_str) {
                functions.push(name_str.to_string());
            }
        }
    }
    
    // Match class methods: methodName() or async methodName()
    // More specific pattern to avoid false positives
    let method_regex = Regex::new(r"(?:^|\n|\{)\s*(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{").unwrap();
    for cap in method_regex.captures_iter(code) {
        if let Some(name) = cap.get(1) {
            let name_str = name.as_str();
            if !keywords.contains(&name_str) {
                functions.push(name_str.to_string());
            }
        }
    }
    
    functions.sort();
    functions.dedup();
    functions
}
