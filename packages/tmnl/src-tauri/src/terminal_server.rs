//! Terminal Server Process Manager
//!
//! Manages the lifecycle of the terminal WebSocket relay server as a child process.
//! The server runs as a separate Bun process, enabling PTY or SSH backends.
//!
//! # Architecture
//!
//! ```text
//! Tauri App
//!   └── TerminalServerManager (Rust)
//!         └── spawns → Bun Process (scripts/terminal-server.ts)
//!                        └── WebSocket Server (ws://localhost:7681)
//!                              └── PTY or SSH backend (via Layer.provide)
//! ```
//!
//! # Usage from Frontend
//!
//! ```typescript
//! import { invoke } from '@tauri-apps/api/core';
//!
//! // Start with PTY backend (default)
//! await invoke('terminal_server_start');
//!
//! // Start with SSH backend
//! await invoke('terminal_server_start', { backend: 'ssh' });
//!
//! // Check status
//! const status = await invoke<TerminalServerStatus>('terminal_server_status');
//!
//! // Stop server
//! await invoke('terminal_server_stop');
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

/// Backend type for the terminal server
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum TerminalBackend {
    #[default]
    Pty,
    Ssh,
}

impl TerminalBackend {
    fn as_arg(&self) -> Option<&'static str> {
        match self {
            TerminalBackend::Pty => None,
            TerminalBackend::Ssh => Some("--ssh"),
        }
    }
}

/// Status of the terminal server
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalServerStatus {
    pub running: bool,
    pub backend: Option<TerminalBackend>,
    pub pid: Option<u32>,
    pub port: u16,
}

/// Managed state for the terminal server
pub struct TerminalServerManager {
    child: Mutex<Option<Child>>,
    backend: Mutex<Option<TerminalBackend>>,
    port: u16,
}

impl Default for TerminalServerManager {
    fn default() -> Self {
        Self::new(7681)
    }
}

impl TerminalServerManager {
    pub fn new(port: u16) -> Self {
        Self {
            child: Mutex::new(None),
            backend: Mutex::new(None),
            port,
        }
    }

    /// Get the package root directory (packages/tmnl)
    ///
    /// Resolution order:
    /// 1. TMNL_PACKAGE_ROOT env var (explicit override)
    /// 2. Current working directory if it contains scripts/terminal-server.ts
    /// 3. CARGO_MANIFEST_DIR parent (during cargo build)
    /// 4. Walk up from executable location
    /// 5. Fallback to current directory
    fn get_package_root() -> PathBuf {
        // 1. Check for explicit override
        if let Ok(root) = env::var("TMNL_PACKAGE_ROOT") {
            log::debug!("Using TMNL_PACKAGE_ROOT: {}", root);
            return PathBuf::from(root);
        }

        // 2. Check if current directory is the package root
        // This is typical when running via `tauri dev` from packages/tmnl
        if let Ok(cwd) = env::current_dir() {
            let script_path = cwd.join("scripts/terminal-server.ts");
            if script_path.exists() {
                log::debug!("Using current directory as package root: {:?}", cwd);
                return cwd;
            }
        }

        // 3. During cargo build, CARGO_MANIFEST_DIR points to src-tauri
        // Parent of that is packages/tmnl
        if let Ok(manifest_dir) = env::var("CARGO_MANIFEST_DIR") {
            let manifest_path = PathBuf::from(&manifest_dir);
            if let Some(parent) = manifest_path.parent() {
                let script_path = parent.join("scripts/terminal-server.ts");
                if script_path.exists() {
                    log::debug!("Using CARGO_MANIFEST_DIR parent: {:?}", parent);
                    return parent.to_path_buf();
                }
            }
        }

        // 4. Fallback: try to find it relative to current exe
        if let Ok(exe_path) = env::current_exe() {
            // exe is in target/debug or target/release or src-tauri/target/...
            let mut path = exe_path.clone();
            for _ in 0..7 {
                if let Some(parent) = path.parent() {
                    path = parent.to_path_buf();
                    let scripts = path.join("scripts/terminal-server.ts");
                    if scripts.exists() {
                        log::debug!("Found package root via exe walk: {:?}", path);
                        return path;
                    }
                }
            }
        }

        // 5. Last resort: current directory
        let cwd = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        log::warn!(
            "Could not find package root with scripts/terminal-server.ts, using cwd: {:?}",
            cwd
        );
        cwd
    }

    /// Start the terminal server with the specified backend
    pub fn start(&self, backend: TerminalBackend) -> Result<u32, String> {
        let mut child_guard = self.child.lock().map_err(|e| e.to_string())?;

        // Check if already running
        if let Some(ref mut child) = *child_guard {
            match child.try_wait() {
                Ok(Some(_)) => {
                    // Process exited, we can start a new one
                }
                Ok(None) => {
                    return Err("Terminal server is already running".to_string());
                }
                Err(e) => {
                    return Err(format!("Failed to check process status: {}", e));
                }
            }
        }

        // Determine working directory (packages/tmnl, parent of src-tauri)
        let working_dir = Self::get_package_root();
        log::info!("Terminal server working directory: {:?}", working_dir);

        // Build command
        let mut cmd = Command::new("bun");
        cmd.arg("run")
            .arg("scripts/terminal-server.ts")
            .current_dir(&working_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // Add backend argument if SSH
        if let Some(arg) = backend.as_arg() {
            cmd.arg(arg);
        }

        // Spawn the process
        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn server: {}", e))?;

        let pid = child.id();

        // Spawn thread to log stdout
        if let Some(stdout) = child.stdout.take() {
            thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        log::info!("[terminal-server] {}", line);
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
                        log::warn!("[terminal-server] {}", line);
                    }
                }
            });
        }

        *child_guard = Some(child);
        *self.backend.lock().map_err(|e| e.to_string())? = Some(backend);

        log::info!(
            "Terminal server started: backend={:?}, pid={}, port={}",
            backend,
            pid,
            self.port
        );

        Ok(pid)
    }

    /// Stop the terminal server
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
                log::warn!("Failed to kill terminal server: {}", e);
            }

            // Wait for process to exit
            if let Err(e) = child.wait() {
                log::warn!("Failed to wait for terminal server: {}", e);
            }

            log::info!("Terminal server stopped");
        }

        *child_guard = None;
        *self.backend.lock().map_err(|e| e.to_string())? = None;

        Ok(())
    }

    /// Get the current status
    pub fn status(&self) -> TerminalServerStatus {
        let child_guard = self.child.lock().ok();
        let backend_guard = self.backend.lock().ok();

        let (running, pid) = match child_guard {
            Some(ref guard) => match guard.as_ref() {
                Some(child) => {
                    // Check if still running by attempting try_wait
                    // We can't call try_wait on &Child, so we just report as running
                    // The actual status is updated on next start attempt
                    (true, Some(child.id()))
                }
                None => (false, None),
            },
            None => (false, None),
        };

        let backend = backend_guard.and_then(|g| *g);

        TerminalServerStatus {
            running,
            backend,
            pid,
            port: self.port,
        }
    }
}

impl Drop for TerminalServerManager {
    fn drop(&mut self) {
        // Ensure server is stopped when manager is dropped
        if let Err(e) = self.stop() {
            log::error!("Failed to stop terminal server on drop: {}", e);
        }
    }
}

// =============================================================================
// TAURI COMMANDS
// =============================================================================

/// Start the terminal server
#[tauri::command]
pub fn terminal_server_start<R: Runtime>(
    app: AppHandle<R>,
    backend: Option<TerminalBackend>,
) -> Result<u32, String> {
    let manager = app.state::<Arc<TerminalServerManager>>();
    manager.start(backend.unwrap_or_default())
}

/// Stop the terminal server
#[tauri::command]
pub fn terminal_server_stop<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let manager = app.state::<Arc<TerminalServerManager>>();
    manager.stop()
}

/// Get terminal server status
#[tauri::command]
pub fn terminal_server_status<R: Runtime>(app: AppHandle<R>) -> TerminalServerStatus {
    let manager = app.state::<Arc<TerminalServerManager>>();
    manager.status()
}

/// Restart the terminal server with optionally different backend
#[tauri::command]
pub fn terminal_server_restart<R: Runtime>(
    app: AppHandle<R>,
    backend: Option<TerminalBackend>,
) -> Result<u32, String> {
    let manager = app.state::<Arc<TerminalServerManager>>();

    // Get current backend if not specified
    let target_backend = backend.unwrap_or_else(|| {
        manager
            .backend
            .lock()
            .ok()
            .and_then(|g| *g)
            .unwrap_or_default()
    });

    manager.stop()?;
    manager.start(target_backend)
}
