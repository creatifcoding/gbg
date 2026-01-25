//! Window Manager - Multi-Window System for Testbeds
//!
//! Provides Tauri commands to create, focus, close, and list testbed windows.
//! Implements singleton behavior: if a window for a testbed already exists, focus it.
//!
//! # Architecture
//!
//! Each testbed window has a deterministic label: `testbed-{testbed_id}`
//! This allows singleton lookup and IPC targeting.
//!
//! # Window Pooling (for sub-second window opening)
//!
//! The pool pre-creates hidden windows at app start. When a testbed window is requested:
//! 1. Take a window from the pool (already created, just hidden)
//! 2. Navigate it to the testbed URL via JS
//! 3. Show it (instant)
//! 4. Replenish the pool in the background
//!
//! # IPC Events
//!
//! - `window:created` - Emitted when a new window is created
//! - `window:focused` - Emitted when a window is focused
//! - `window:closed` - Emitted when a window is closed
//! - `window:list-changed` - Emitted when window list changes
//! - `window:navigate` - Emitted to tell a pooled window to navigate

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{LazyLock, Mutex};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

// =============================================================================
// Window Pool State
// =============================================================================

/// Pool size - how many hidden windows to pre-create
/// IMPORTANT: Each WebView2 instance consumes ~80MB+ memory even when hidden.
/// Keep this low (1-2) to avoid OOM. The minimal /pool-placeholder route helps
/// but WebView2 process overhead is unavoidable.
const POOL_SIZE: usize = 1;

/// Counter for generating unique pool window labels
static POOL_COUNTER: AtomicUsize = AtomicUsize::new(0);

/// Global pool of available window labels (thread-safe)
static WINDOW_POOL: Mutex<Vec<String>> = Mutex::new(Vec::new());

/// Maps testbed_id → window_label for singleton lookup
/// This is needed because pool windows keep their pool-N labels even after navigation
static TESTBED_WINDOWS: LazyLock<Mutex<HashMap<String, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// Generate a unique pool window label
fn next_pool_label() -> String {
    let id = POOL_COUNTER.fetch_add(1, Ordering::SeqCst);
    format!("pool-{}", id)
}

// =============================================================================
// Types
// =============================================================================

/// Information about an open window
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    /// Unique window label (e.g., "testbed-fermion")
    pub label: String,
    /// Testbed ID if this is a testbed window
    pub testbed_id: Option<String>,
    /// Window title
    pub title: String,
    /// Whether this is the main window
    pub is_main: bool,
    /// Whether this window is currently focused
    pub is_focused: bool,
}

/// Configuration for creating a testbed window
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestbedWindowConfig {
    /// Minimum width in pixels
    pub min_width: Option<f64>,
    /// Minimum height in pixels
    pub min_height: Option<f64>,
    /// Initial width in pixels
    pub width: Option<f64>,
    /// Initial height in pixels
    pub height: Option<f64>,
    /// Window title (defaults to testbed name)
    pub title: Option<String>,
}

impl Default for TestbedWindowConfig {
    fn default() -> Self {
        Self {
            min_width: Some(400.0),
            min_height: Some(300.0),
            width: Some(1200.0),
            height: Some(800.0),
            title: None,
        }
    }
}

/// Error response for window operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowError {
    pub code: String,
    pub message: String,
}

// =============================================================================
// Helper Functions
// =============================================================================

/// Generate the window label for a testbed
fn testbed_window_label(testbed_id: &str) -> String {
    format!("testbed-{}", testbed_id)
}

/// Get all windows and their info
fn get_all_windows(app: &AppHandle) -> Vec<WindowInfo> {
    app.webview_windows()
        .iter()
        .map(|(label, window)| {
            let testbed_id = if label.starts_with("testbed-") {
                Some(label.strip_prefix("testbed-").unwrap().to_string())
            } else {
                None
            };

            WindowInfo {
                label: label.clone(),
                testbed_id,
                title: window.title().unwrap_or_else(|_| label.clone()),
                is_main: label == "main",
                is_focused: window.is_focused().unwrap_or(false),
            }
        })
        .collect()
}

// =============================================================================
// Commands
// =============================================================================

/// Create a new testbed window or focus existing one (singleton behavior)
///
/// Returns the window label of the created/focused window.
#[tauri::command]
pub async fn create_testbed_window(
    app: AppHandle,
    testbed_id: String,
    config: Option<TestbedWindowConfig>,
) -> Result<String, WindowError> {
    let label = testbed_window_label(&testbed_id);
    let config = config.unwrap_or_default();

    // Check if window already exists
    if let Some(existing) = app.get_webview_window(&label) {
        // Focus the existing window
        existing.set_focus().map_err(|e| WindowError {
            code: "FOCUS_FAILED".to_string(),
            message: format!("Failed to focus existing window: {}", e),
        })?;

        // Emit focus event
        app.emit("window:focused", &label).ok();

        log::info!("Focused existing testbed window: {}", label);
        return Ok(label);
    }

    // Build the URL for the testbed window route
    let url = format!("/window?testbed={}", testbed_id);
    let title = config
        .title
        .unwrap_or_else(|| format!("TMNL - {}", testbed_id));

    // Create new window - match main window settings (borderless, transparent on macOS only)
    let mut builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title(&title)
        .inner_size(config.width.unwrap_or(1200.0), config.height.unwrap_or(800.0))
        .min_inner_size(config.min_width.unwrap_or(400.0), config.min_height.unwrap_or(300.0))
        .decorations(false) // Borderless like main window
        .resizable(true)
        .visible(true);

    // Transparent windows only work reliably on macOS
    #[cfg(target_os = "macos")]
    {
        builder = builder.transparent(true);
    }

    let window = builder.build()
        .map_err(|e| WindowError {
            code: "CREATE_FAILED".to_string(),
            message: format!("Failed to create window: {}", e),
        })?;

    // Focus the new window
    window.set_focus().ok();

    // Track this testbed → window mapping for singleton behavior
    if let Ok(mut map) = TESTBED_WINDOWS.lock() {
        map.insert(testbed_id.clone(), label.clone());
    }

    // Emit events
    app.emit("window:created", &label).ok();
    app.emit("window:list-changed", get_all_windows(&app)).ok();

    log::info!("Created new testbed window: {} for {}", label, testbed_id);
    Ok(label)
}

/// Focus an existing window by label
#[tauri::command]
pub async fn focus_window(app: AppHandle, label: String) -> Result<(), WindowError> {
    let window = app.get_webview_window(&label).ok_or_else(|| WindowError {
        code: "NOT_FOUND".to_string(),
        message: format!("Window not found: {}", label),
    })?;

    window.set_focus().map_err(|e| WindowError {
        code: "FOCUS_FAILED".to_string(),
        message: format!("Failed to focus window: {}", e),
    })?;

    // Unminimize if minimized
    if window.is_minimized().unwrap_or(false) {
        window.unminimize().ok();
    }

    app.emit("window:focused", &label).ok();
    log::info!("Focused window: {}", label);
    Ok(())
}

/// Close a window by label
#[tauri::command]
pub async fn close_window(app: AppHandle, label: String) -> Result<(), WindowError> {
    // Prevent closing the main window via this command
    if label == "main" {
        return Err(WindowError {
            code: "CANNOT_CLOSE_MAIN".to_string(),
            message: "Cannot close the main window via this command".to_string(),
        });
    }

    let window = app.get_webview_window(&label).ok_or_else(|| WindowError {
        code: "NOT_FOUND".to_string(),
        message: format!("Window not found: {}", label),
    })?;

    window.close().map_err(|e| WindowError {
        code: "CLOSE_FAILED".to_string(),
        message: format!("Failed to close window: {}", e),
    })?;

    // Remove from testbed windows map (find by window label value)
    if let Ok(mut map) = TESTBED_WINDOWS.lock() {
        // Find the testbed_id that maps to this label and remove it
        let testbed_id = map.iter()
            .find(|(_, win_label)| *win_label == &label)
            .map(|(tid, _)| tid.clone());
        if let Some(tid) = testbed_id {
            map.remove(&tid);
            log::debug!("Removed testbed {} from window map (closed {})", tid, label);
        }
    }

    app.emit("window:closed", &label).ok();
    app.emit("window:list-changed", get_all_windows(&app)).ok();

    log::info!("Closed window: {}", label);
    Ok(())
}

/// Minimize a window by label
#[tauri::command]
pub async fn minimize_window(app: AppHandle, label: String) -> Result<(), WindowError> {
    let window = app.get_webview_window(&label).ok_or_else(|| WindowError {
        code: "NOT_FOUND".to_string(),
        message: format!("Window not found: {}", label),
    })?;

    window.minimize().map_err(|e| WindowError {
        code: "MINIMIZE_FAILED".to_string(),
        message: format!("Failed to minimize window: {}", e),
    })?;

    log::debug!("Minimized window: {}", label);
    Ok(())
}

/// Unminimize (restore) a window by label
#[tauri::command]
pub async fn unminimize_window(app: AppHandle, label: String) -> Result<(), WindowError> {
    let window = app.get_webview_window(&label).ok_or_else(|| WindowError {
        code: "NOT_FOUND".to_string(),
        message: format!("Window not found: {}", label),
    })?;

    window.unminimize().map_err(|e| WindowError {
        code: "UNMINIMIZE_FAILED".to_string(),
        message: format!("Failed to unminimize window: {}", e),
    })?;

    log::debug!("Unminimized window: {}", label);
    Ok(())
}

/// Maximize a window by label
#[tauri::command]
pub async fn maximize_window(app: AppHandle, label: String) -> Result<(), WindowError> {
    let window = app.get_webview_window(&label).ok_or_else(|| WindowError {
        code: "NOT_FOUND".to_string(),
        message: format!("Window not found: {}", label),
    })?;

    window.maximize().map_err(|e| WindowError {
        code: "MAXIMIZE_FAILED".to_string(),
        message: format!("Failed to maximize window: {}", e),
    })?;

    log::debug!("Maximized window: {}", label);
    Ok(())
}

/// Unmaximize (restore) a window by label
#[tauri::command]
pub async fn unmaximize_window(app: AppHandle, label: String) -> Result<(), WindowError> {
    let window = app.get_webview_window(&label).ok_or_else(|| WindowError {
        code: "NOT_FOUND".to_string(),
        message: format!("Window not found: {}", label),
    })?;

    window.unmaximize().map_err(|e| WindowError {
        code: "UNMAXIMIZE_FAILED".to_string(),
        message: format!("Failed to unmaximize window: {}", e),
    })?;

    log::debug!("Unmaximized window: {}", label);
    Ok(())
}

/// Set fullscreen state of a window
#[tauri::command]
pub async fn set_fullscreen(app: AppHandle, label: String, fullscreen: bool) -> Result<(), WindowError> {
    let window = app.get_webview_window(&label).ok_or_else(|| WindowError {
        code: "NOT_FOUND".to_string(),
        message: format!("Window not found: {}", label),
    })?;

    window.set_fullscreen(fullscreen).map_err(|e| WindowError {
        code: "FULLSCREEN_FAILED".to_string(),
        message: format!("Failed to set fullscreen: {}", e),
    })?;

    log::debug!("Set fullscreen={} for window: {}", fullscreen, label);
    Ok(())
}

/// Toggle fullscreen state of a window
#[tauri::command]
pub async fn toggle_fullscreen(app: AppHandle, label: String) -> Result<bool, WindowError> {
    let window = app.get_webview_window(&label).ok_or_else(|| WindowError {
        code: "NOT_FOUND".to_string(),
        message: format!("Window not found: {}", label),
    })?;

    let is_fullscreen = window.is_fullscreen().unwrap_or(false);
    let new_state = !is_fullscreen;

    window.set_fullscreen(new_state).map_err(|e| WindowError {
        code: "FULLSCREEN_FAILED".to_string(),
        message: format!("Failed to toggle fullscreen: {}", e),
    })?;

    log::debug!("Toggled fullscreen to {} for window: {}", new_state, label);
    Ok(new_state)
}

/// Get window state (minimized, maximized, fullscreen)
#[tauri::command]
pub async fn get_window_state(app: AppHandle, label: String) -> Result<WindowState, WindowError> {
    let window = app.get_webview_window(&label).ok_or_else(|| WindowError {
        code: "NOT_FOUND".to_string(),
        message: format!("Window not found: {}", label),
    })?;

    Ok(WindowState {
        is_minimized: window.is_minimized().unwrap_or(false),
        is_maximized: window.is_maximized().unwrap_or(false),
        is_fullscreen: window.is_fullscreen().unwrap_or(false),
        is_focused: window.is_focused().unwrap_or(false),
    })
}

/// Window state information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub is_minimized: bool,
    pub is_maximized: bool,
    pub is_fullscreen: bool,
    pub is_focused: bool,
}

/// List all open windows
#[tauri::command]
pub async fn list_windows(app: AppHandle) -> Vec<WindowInfo> {
    get_all_windows(&app)
}

/// Get or create a testbed window (convenience command)
///
/// If the window exists, focuses it. Otherwise creates it.
/// This is the primary command for the quick-switcher.
#[tauri::command]
pub async fn get_or_focus_testbed_window(
    app: AppHandle,
    testbed_id: String,
    config: Option<TestbedWindowConfig>,
) -> Result<String, WindowError> {
    // This is just an alias for create_testbed_window since it already
    // implements singleton behavior
    create_testbed_window(app, testbed_id, config).await
}

/// Emit an event to all windows
#[tauri::command]
pub async fn emit_to_all_windows(
    app: AppHandle,
    event: String,
    payload: serde_json::Value,
) -> Result<(), WindowError> {
    app.emit(&event, payload).map_err(|e| WindowError {
        code: "EMIT_FAILED".to_string(),
        message: format!("Failed to emit event: {}", e),
    })?;

    log::debug!("Emitted {} to all windows", event);
    Ok(())
}

/// Emit an event to a specific window
#[tauri::command]
pub async fn emit_to_window(
    app: AppHandle,
    label: String,
    event: String,
    payload: serde_json::Value,
) -> Result<(), WindowError> {
    let window = app.get_webview_window(&label).ok_or_else(|| WindowError {
        code: "NOT_FOUND".to_string(),
        message: format!("Window not found: {}", label),
    })?;

    window.emit(&event, payload).map_err(|e| WindowError {
        code: "EMIT_FAILED".to_string(),
        message: format!("Failed to emit event to {}: {}", label, e),
    })?;

    log::debug!("Emitted {} to window {}", event, label);
    Ok(())
}

// =============================================================================
// Window Pool Commands (for sub-second window opening)
// =============================================================================

/// Create a single hidden pool window and add it to the pool
/// Safe to call from async command context
fn create_pool_window(app: &AppHandle) -> Result<String, WindowError> {
    let label = next_pool_label();

    // Create hidden window with minimal blank page to save memory
    // We'll navigate to the actual testbed URL when the window is claimed
    let mut builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("/pool-placeholder".into()))
        .title("TMNL")
        .inner_size(1200.0, 800.0)
        .min_inner_size(400.0, 300.0)
        .decorations(false)
        .resizable(true)
        .visible(false); // Hidden until needed

    // Transparent windows only work reliably on macOS
    #[cfg(target_os = "macos")]
    {
        builder = builder.transparent(true);
    }

    let _window = builder.build()
        .map_err(|e| WindowError {
            code: "POOL_CREATE_FAILED".to_string(),
            message: format!("Failed to create pool window: {}", e),
        })?;

    log::debug!("Created pool window: {}", label);
    Ok(label)
}

/// Create a pool window and add it to the pool - called from setup() in lib.rs
/// This is the Windows-safe way to initialize the pool (from setup, not from a command)
pub fn create_pool_window_from_setup(app: &AppHandle) -> Result<String, WindowError> {
    let label = create_pool_window(app)?;

    if let Ok(mut pool) = WINDOW_POOL.lock() {
        pool.push(label.clone());
    }

    Ok(label)
}

/// Initialize the window pool - call this at app startup
/// Spawns window creation in a separate thread to avoid WebView2 deadlock on Windows
#[tauri::command]
pub async fn init_window_pool(app: AppHandle) -> Result<usize, WindowError> {
    log::info!("Scheduling window pool initialization...");

    // Spawn pool creation in a separate thread to completely avoid blocking
    // the command handler and the event loop
    std::thread::spawn(move || {
        // Delay to let the app event loop settle
        std::thread::sleep(std::time::Duration::from_millis(200));

        for i in 0..POOL_SIZE {
            match create_pool_window(&app) {
                Ok(label) => {
                    if let Ok(mut pool) = WINDOW_POOL.lock() {
                        pool.push(label.clone());
                        log::debug!("Created pool window {}/{}: {}", i + 1, POOL_SIZE, label);
                    }
                }
                Err(e) => {
                    log::warn!("Failed to create pool window {}/{}: {:?}", i + 1, POOL_SIZE, e);
                }
            }
            // Delay between window creations to avoid overwhelming WebView2
            std::thread::sleep(std::time::Duration::from_millis(100));
        }

        log::info!("Window pool initialization complete");
    });

    // Return immediately - pool creation happens in background thread
    Ok(0)
}

/// Get pool status
#[tauri::command]
pub async fn get_pool_status() -> Result<PoolStatus, WindowError> {
    let pool = WINDOW_POOL.lock().map_err(|e| WindowError {
        code: "POOL_LOCK_FAILED".to_string(),
        message: format!("Failed to lock pool: {}", e),
    })?;

    Ok(PoolStatus {
        available: pool.len(),
        target_size: POOL_SIZE,
    })
}

/// Pool status info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolStatus {
    pub available: usize,
    pub target_size: usize,
}

/// Take a window from pool, navigate it, show it, and replenish pool
/// This is the FAST path for window opening (<50ms vs 200-400ms)
#[tauri::command]
pub async fn open_testbed_window_fast(
    app: AppHandle,
    testbed_id: String,
    config: Option<TestbedWindowConfig>,
) -> Result<String, WindowError> {
    let config = config.unwrap_or_default();

    // Check if this testbed already has a window open (singleton behavior)
    // We use TESTBED_WINDOWS map because pool windows keep their pool-N labels
    let existing_label = {
        let map = TESTBED_WINDOWS.lock().map_err(|e| WindowError {
            code: "MAP_LOCK_FAILED".to_string(),
            message: format!("Failed to lock testbed windows map: {}", e),
        })?;
        map.get(&testbed_id).cloned()
    };

    if let Some(label) = existing_label {
        // Window exists in our map, try to focus it
        if let Some(existing) = app.get_webview_window(&label) {
            existing.set_focus().map_err(|e| WindowError {
                code: "FOCUS_FAILED".to_string(),
                message: format!("Failed to focus existing window: {}", e),
            })?;
            app.emit("window:focused", &label).ok();
            log::info!("Focused existing testbed window: {} (label: {})", testbed_id, label);
            return Ok(label);
        } else {
            // Window was in map but no longer exists, remove stale entry
            if let Ok(mut map) = TESTBED_WINDOWS.lock() {
                map.remove(&testbed_id);
            }
            log::debug!("Removed stale testbed window entry: {}", testbed_id);
        }
    }

    // Try to get a window from the pool
    let pool_label = {
        let mut pool = WINDOW_POOL.lock().map_err(|e| WindowError {
            code: "POOL_LOCK_FAILED".to_string(),
            message: format!("Failed to lock pool: {}", e),
        })?;
        pool.pop()
    };

    match pool_label {
        Some(label) => {
            // Fast path: use pooled window
            let window = app.get_webview_window(&label).ok_or_else(|| WindowError {
                code: "POOL_WINDOW_MISSING".to_string(),
                message: format!("Pool window {} no longer exists", label),
            })?;

            // Set title
            let title = config.title.unwrap_or_else(|| format!("TMNL - {}", testbed_id));
            window.set_title(&title).ok();

            // Navigate to the testbed URL - this is the key simplification!
            // React's useSearch() will read the testbed param directly from the URL
            let url = format!("/window?testbed={}", testbed_id);
            window.navigate(url.parse().unwrap()).map_err(|e| WindowError {
                code: "NAVIGATE_FAILED".to_string(),
                message: format!("Failed to navigate pool window: {}", e),
            })?;

            // Show and focus the window
            window.show().ok();
            window.set_focus().ok();

            // Track this testbed → window mapping for singleton behavior
            if let Ok(mut map) = TESTBED_WINDOWS.lock() {
                map.insert(testbed_id.clone(), label.clone());
            }

            // Emit events (use the actual window label, not a fake one)
            app.emit("window:created", &label).ok();
            app.emit("window:list-changed", get_all_windows(&app)).ok();

            log::info!("Opened testbed {} using pooled window {} (fast path)", testbed_id, label);

            // Replenish pool in background (don't await)
            let app_clone = app.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = replenish_pool(app_clone).await {
                    log::warn!("Failed to replenish pool: {:?}", e);
                }
            });

            Ok(label)
        }
        None => {
            // Slow path: pool empty, create new window
            log::warn!("Window pool empty, falling back to slow path");
            create_testbed_window(app, testbed_id, Some(config)).await
        }
    }
}

/// Replenish the window pool back to target size
/// Spawns window creation in a separate thread to avoid WebView2 deadlock on Windows
async fn replenish_pool(app: AppHandle) -> Result<(), WindowError> {
    let current_size = {
        let pool = WINDOW_POOL.lock().map_err(|e| WindowError {
            code: "POOL_LOCK_FAILED".to_string(),
            message: format!("Failed to lock pool: {}", e),
        })?;
        pool.len()
    };

    let needed = POOL_SIZE.saturating_sub(current_size);
    if needed == 0 {
        return Ok(());
    }

    log::debug!("Replenishing pool: {} windows needed", needed);

    // Spawn in a separate thread to avoid WebView2 deadlock
    std::thread::spawn(move || {
        // Small delay before creating windows
        std::thread::sleep(std::time::Duration::from_millis(100));

        for _ in 0..needed {
            match create_pool_window(&app) {
                Ok(label) => {
                    if let Ok(mut pool) = WINDOW_POOL.lock() {
                        pool.push(label);
                    }
                }
                Err(e) => {
                    log::warn!("Failed to replenish pool window: {:?}", e);
                }
            }
            // Small delay between creations
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    });

    Ok(())
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_testbed_window_label() {
        assert_eq!(testbed_window_label("fermion"), "testbed-fermion");
        assert_eq!(testbed_window_label("data-manager"), "testbed-data-manager");
    }

    #[test]
    fn test_default_config() {
        let config = TestbedWindowConfig::default();
        assert_eq!(config.min_width, Some(400.0));
        assert_eq!(config.min_height, Some(300.0));
        assert_eq!(config.width, Some(1200.0));
        assert_eq!(config.height, Some(800.0));
    }
}
