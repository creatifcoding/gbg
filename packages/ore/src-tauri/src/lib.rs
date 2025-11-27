mod analyzer;
mod frida;

use analyzer::{analyze_directory, extract_functions, read_file_content, AnalysisResult};
use frida::{generate_custom_script, get_frida_instructions, get_frida_scripts, FridaScript};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn analyze_obsidian_directory(path: String) -> Result<AnalysisResult, String> {
    analyze_directory(&path)
}

#[tauri::command]
fn read_file(path: String, max_size: Option<usize>) -> Result<String, String> {
    let max = max_size.unwrap_or(1024 * 1024); // Default 1MB
    read_file_content(&path, max)
}

#[tauri::command]
fn extract_functions_from_code(code: String) -> Vec<String> {
    extract_functions(&code)
}

#[tauri::command]
fn get_frida_script_templates() -> Vec<FridaScript> {
    get_frida_scripts()
}

#[tauri::command]
fn generate_frida_script(target_function: String) -> String {
    generate_custom_script(&target_function)
}

#[tauri::command]
fn get_frida_usage_instructions() -> String {
    get_frida_instructions()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            analyze_obsidian_directory,
            read_file,
            extract_functions_from_code,
            get_frida_script_templates,
            generate_frida_script,
            get_frida_usage_instructions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
