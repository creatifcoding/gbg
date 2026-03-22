//! Cross-process IPC protocol between TMNL main app and bar.
//!
//! Wire format: JSON lines over Unix domain socket.
//! Socket path: $XDG_RUNTIME_DIR/tmnl-bar.sock

use serde::{Deserialize, Serialize};

/// Messages sent FROM the bar TO the main app.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "_tag")]
pub enum BarMessage {
    /// Bar is alive and connected.
    Heartbeat { timestamp_ms: u64 },
    /// Bar requests current app state.
    RequestState,
    /// Bar sends a command to the main app.
    Command { action: BarCommand },
}

/// Commands the bar can send to the main app.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "_tag")]
pub enum BarCommand {
    /// Focus a specific layer by name.
    FocusLayer { name: String },
    /// Toggle a layer's visibility.
    ToggleLayer { name: String },
    /// Open the command palette in the main app.
    OpenCommandPalette,
    /// Custom command passthrough.
    Custom { key: String, payload: serde_json::Value },
}

/// Messages sent FROM the main app TO the bar.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "_tag")]
pub enum AppMessage {
    /// Full state sync (sent on connection).
    StateSync { state: AppState },
    /// Incremental state update.
    StateUpdate { patch: StatePatch },
    /// Acknowledgment of a command.
    CommandAck { success: bool, message: Option<String> },
}

/// Snapshot of the main app's state.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AppState {
    /// Currently active layers with their visibility.
    pub layers: Vec<LayerInfo>,
    /// Current mode (e.g., "normal", "insert", "command").
    pub mode: String,
    /// Whether the app is connected to backend services.
    pub connected: bool,
}

/// Minimal layer info for the bar.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayerInfo {
    pub name: String,
    pub visible: bool,
    pub z_index: i32,
}

/// Incremental state patch.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "_tag")]
pub enum StatePatch {
    ModeChanged { mode: String },
    LayerVisibilityChanged { name: String, visible: bool },
    ConnectionChanged { connected: bool },
}

/// Default socket path.
pub fn socket_path() -> std::path::PathBuf {
    let runtime_dir = std::env::var("XDG_RUNTIME_DIR")
        .unwrap_or_else(|_| "/tmp".to_string());
    std::path::PathBuf::from(runtime_dir).join("tmnl-bar.sock")
}
