//! Theia IDE Server Process Manager
//!
//! Manages the lifecycle of the Theia browser-only IDE server as a child process.
//! The server runs as an http-server process serving static frontend assets.
//!
//! # Architecture
//!
//! ```text
//! Tauri App
//!   └── TheiaServerManager (Rust)
//!         └── spawns → Bun Process (theia start)
//!                        └── http-server (http://localhost:3035)
//!                              └── Serves lib/frontend (Monaco, file tree, etc.)
//! ```
//!
//! # Usage from Frontend
//!
//! ```typescript
//! import { invoke } from '@tauri-apps/api/core';
//!
//! // Start the Theia IDE server
//! await invoke('theia_server_start');
//!
//! // Check status
//! const status = await invoke<TheiaServerStatus>('theia_server_status');
//! console.log(status.url); // "http://127.0.0.1:3035"
//!
//! // Stop server
//! await invoke('theia_server_stop');
//! ```

use std::env;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

use std::sync::Arc;

// =============================================================================
// TYPES
// =============================================================================

/// Status of the Theia IDE server
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TheiaServerStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub port: u16,
    pub url: String,
}

/// Managed state for the Theia IDE server
pub struct TheiaServerManager {
    child: Mutex<Option<Child>>,
    port: u16,
}

impl Default for TheiaServerManager {
    fn default() -> Self {
        Self::new(3035)
    }
}

impl TheiaServerManager {
    pub fn new(port: u16) -> Self {
        Self {
            child: Mutex::new(None),
            port,
        }
    }

    /// Get the theia-ide package directory
    ///
    /// Resolution order:
    /// 1. THEIA_PACKAGE_ROOT env var (explicit override)
    /// 2. Sibling to TMNL_PACKAGE_ROOT if set
    /// 3. Current working directory sibling (../theia-ide)
    /// 4. CARGO_MANIFEST_DIR grandparent sibling (packages/theia-ide)
    /// 5. Walk up from executable location
    fn get_package_root() -> PathBuf {
        // 1. Check for explicit override
        if let Ok(root) = env::var("THEIA_PACKAGE_ROOT") {
            log::debug!("Using THEIA_PACKAGE_ROOT: {}", root);
            return PathBuf::from(root);
        }

        // 2. Check if TMNL_PACKAGE_ROOT is set and theia-ide is a sibling
        if let Ok(tmnl_root) = env::var("TMNL_PACKAGE_ROOT") {
            let tmnl_path = PathBuf::from(&tmnl_root);
            if let Some(parent) = tmnl_path.parent() {
                let theia_path = parent.join("theia-ide");
                let package_json = theia_path.join("package.json");
                if package_json.exists() {
                    log::debug!("Using TMNL_PACKAGE_ROOT sibling: {:?}", theia_path);
                    return theia_path;
                }
            }
        }

        // 3. Check if theia-ide is a sibling of current directory
        if let Ok(cwd) = env::current_dir() {
            if let Some(parent) = cwd.parent() {
                let theia_path = parent.join("theia-ide");
                let package_json = theia_path.join("package.json");
                if package_json.exists() {
                    log::debug!("Using cwd sibling as package root: {:?}", theia_path);
                    return theia_path;
                }
            }
        }

        // 4. During cargo build, CARGO_MANIFEST_DIR points to src-tauri
        // Grandparent is packages/, sibling is theia-ide
        if let Ok(manifest_dir) = env::var("CARGO_MANIFEST_DIR") {
            let manifest_path = PathBuf::from(&manifest_dir);
            // src-tauri -> packages/tmnl -> packages -> packages/theia-ide
            if let Some(tmnl_dir) = manifest_path.parent() {
                if let Some(packages_dir) = tmnl_dir.parent() {
                    let theia_path = packages_dir.join("theia-ide");
                    let package_json = theia_path.join("package.json");
                    if package_json.exists() {
                        log::debug!(
                            "Using CARGO_MANIFEST_DIR grandparent sibling: {:?}",
                            theia_path
                        );
                        return theia_path;
                    }
                }
            }
        }

        // 5. Fallback: try to find it relative to current exe
        if let Ok(exe_path) = env::current_exe() {
            let mut path = exe_path.clone();
            for _ in 0..10 {
                if let Some(parent) = path.parent() {
                    path = parent.to_path_buf();
                    // Look for packages/theia-ide
                    let theia_path = path.join("packages/theia-ide");
                    let package_json = theia_path.join("package.json");
                    if package_json.exists() {
                        log::debug!("Found theia-ide via exe walk: {:?}", theia_path);
                        return theia_path;
                    }
                }
            }
        }

        // 6. Last resort: assume it's relative to cwd
        let fallback = PathBuf::from("../theia-ide");
        log::warn!(
            "Could not find theia-ide package, using fallback: {:?}",
            fallback
        );
        fallback
    }

    /// Start the Theia IDE server
    pub fn start(&self) -> Result<u32, String> {
        let mut child_guard = self.child.lock().map_err(|e| e.to_string())?;

        // Check if already running
        if let Some(ref mut child) = *child_guard {
            match child.try_wait() {
                Ok(Some(_)) => {
                    // Process exited, we can start a new one
                }
                Ok(None) => {
                    return Err("Theia IDE server is already running".to_string());
                }
                Err(e) => {
                    return Err(format!("Failed to check process status: {}", e));
                }
            }
        }

        // Determine working directory (packages/theia-ide)
        let working_dir = Self::get_package_root();
        log::info!("Theia IDE server working directory: {:?}", working_dir);

        // Verify package.json exists
        let package_json = working_dir.join("package.json");
        if !package_json.exists() {
            return Err(format!(
                "package.json not found in {:?}. Run 'bun install' in theia-ide package first.",
                working_dir
            ));
        }

        // Verify lib/frontend exists (build output)
        let frontend_dir = working_dir.join("lib/frontend");
        if !frontend_dir.exists() {
            return Err(format!(
                "lib/frontend not found in {:?}. Run 'bun run build' in theia-ide package first.",
                working_dir
            ));
        }

        // Build command: bun run start
        let mut cmd = Command::new("bun");
        cmd.arg("run")
            .arg("start")
            .current_dir(&working_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // Spawn the process
        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn Theia server: {}", e))?;

        let pid = child.id();

        // Spawn thread to log stdout
        if let Some(stdout) = child.stdout.take() {
            thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        log::info!("[theia-server] {}", line);
                    }
                }
            });
        }

        // Spawn thread to log stderr
        if let Some(stderr) = child.stderr.take() {
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        log::warn!("[theia-server] {}", line);
                    }
                }
            });
        }

        *child_guard = Some(child);

        log::info!(
            "Theia IDE server started: pid={}, port={}, url=http://127.0.0.1:{}",
            pid,
            self.port,
            self.port
        );

        Ok(pid)
    }

    /// Stop the Theia IDE server
    pub fn stop(&self) -> Result<(), String> {
        let mut child_guard = self.child.lock().map_err(|e| e.to_string())?;

        if let Some(ref mut child) = *child_guard {
            // Try graceful shutdown first (SIGTERM on Unix)
            #[cfg(unix)]
            {
                use std::os::unix::process::CommandExt;
                let _ = Command::new("kill")
                    .arg("-TERM")
                    .arg(child.id().to_string())
                    .exec();
            }

            // Fallback to kill
            if let Err(e) = child.kill() {
                log::warn!("Failed to kill Theia server: {}", e);
            }

            // Wait for process to exit
            if let Err(e) = child.wait() {
                log::warn!("Failed to wait for Theia server: {}", e);
            }

            log::info!("Theia IDE server stopped");
        }

        *child_guard = None;

        Ok(())
    }

    /// Get the current status
    pub fn status(&self) -> TheiaServerStatus {
        let child_guard = self.child.lock().ok();

        let (running, pid) = match child_guard {
            Some(ref guard) => match guard.as_ref() {
                Some(child) => (true, Some(child.id())),
                None => (false, None),
            },
            None => (false, None),
        };

        TheiaServerStatus {
            running,
            pid,
            port: self.port,
            url: format!("http://127.0.0.1:{}", self.port),
        }
    }
}

impl Drop for TheiaServerManager {
    fn drop(&mut self) {
        // Ensure server is stopped when manager is dropped
        if let Err(e) = self.stop() {
            log::error!("Failed to stop Theia server on drop: {}", e);
        }
    }
}

// =============================================================================
// TAURI COMMANDS
// =============================================================================

/// Start the Theia IDE server
#[tauri::command]
pub fn theia_server_start<R: Runtime>(app: AppHandle<R>) -> Result<u32, String> {
    let manager = app.state::<Arc<TheiaServerManager>>();
    manager.start()
}

/// Stop the Theia IDE server
#[tauri::command]
pub fn theia_server_stop<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let manager = app.state::<Arc<TheiaServerManager>>();
    manager.stop()
}

/// Get Theia IDE server status
#[tauri::command]
pub fn theia_server_status<R: Runtime>(app: AppHandle<R>) -> TheiaServerStatus {
    let manager = app.state::<Arc<TheiaServerManager>>();
    manager.status()
}

/// Restart the Theia IDE server
#[tauri::command]
pub fn theia_server_restart<R: Runtime>(app: AppHandle<R>) -> Result<u32, String> {
    let manager = app.state::<Arc<TheiaServerManager>>();
    manager.stop()?;
    manager.start()
}
