//! DriftWM compositor state reader.
//!
//! DriftWM does not currently expose an event stream. Per upstream docs, it
//! writes a throttled read-only state file at `$XDG_RUNTIME_DIR/driftwm/state`
//! and accepts control through `driftwm msg`. GetByShell uses the state file for
//! status/window inventory and keeps control operations conservative.

use serde::{Deserialize, Serialize};
use std::{
    os::unix::{fs::FileTypeExt, net::UnixStream},
    path::{Path, PathBuf},
};

/// One window entry from DriftWM's `windows=` state-file line / IPC state.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DriftWindow {
    pub app_id: String,
    pub title: String,
    pub position: [i32; 2],
    pub size: [i32; 2],
    pub is_focused: bool,
    pub is_widget: bool,
}

/// Parsed subset of `$XDG_RUNTIME_DIR/driftwm/state` used by GetByShell.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct DriftState {
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub zoom: Option<f64>,
    pub layout: Option<String>,
    pub layout_short: Option<String>,
    pub windows: Vec<DriftWindow>,
    pub layers: Vec<String>,
}

pub struct DriftClient;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CompositorOverride {
    DriftWM,
    Niri,
}

fn parse_compositor_override(value: &str) -> Option<CompositorOverride> {
    match value.trim().to_ascii_lowercase().as_str() {
        "drift" | "driftwm" => Some(CompositorOverride::DriftWM),
        "niri" => Some(CompositorOverride::Niri),
        _ => None,
    }
}

fn path_is_socket(path: &Path) -> bool {
    path.metadata()
        .map(|metadata| metadata.file_type().is_socket())
        .unwrap_or(false)
}

fn socket_accepts_connection(path: &Path) -> bool {
    UnixStream::connect(path).is_ok()
}

/// Spatial workspace anchors used to give DriftWM's infinite canvas a niri-like
/// numbered workspace surface. Coordinates are DriftWM IPC canvas centers
/// (X right, Y up).
pub const DRIFT_WORKSPACE_ANCHORS: &[(u8, &str, f64, f64)] = &[
    (1, "DRIFT 1", 0.0, 0.0),
    (2, "DRIFT 2", 3000.0, 0.0),
    (3, "DRIFT 3", 6000.0, 0.0),
    (4, "DRIFT 4", 0.0, -3000.0),
    (5, "DRIFT 5", 3000.0, -3000.0),
    (6, "DRIFT 6", 6000.0, -3000.0),
    (7, "DRIFT 7", 0.0, -6000.0),
    (8, "DRIFT 8", 3000.0, -6000.0),
    (9, "DRIFT 9", 6000.0, -6000.0),
];

impl DriftClient {
    /// Path to DriftWM's read-only state file.
    pub fn state_file_path() -> Option<PathBuf> {
        std::env::var("XDG_RUNTIME_DIR")
            .ok()
            .map(|dir| PathBuf::from(dir).join("driftwm").join("state"))
    }

    /// Path to DriftWM's IPC socket. Prefer explicit `DRIFTWM_SOCKET`, then the
    /// socket implied by `WAYLAND_DISPLAY`, then the newest live DriftWM socket.
    pub fn socket_path() -> Option<PathBuf> {
        if let Some(path) = std::env::var_os("DRIFTWM_SOCKET").map(PathBuf::from) {
            if path_is_socket(&path) {
                return Some(path);
            }
        }

        let runtime_dir = std::env::var_os("XDG_RUNTIME_DIR").map(PathBuf::from)?;
        if let Some(display) = std::env::var_os("WAYLAND_DISPLAY") {
            let path = runtime_dir
                .join("driftwm")
                .join(format!("ipc-{}.sock", display.to_string_lossy()));
            if path_is_socket(&path) {
                return Some(path);
            }
        }

        let dir = runtime_dir.join("driftwm");
        let mut candidates = std::fs::read_dir(dir)
            .ok()?
            .filter_map(Result::ok)
            .filter_map(|entry| {
                let path = entry.path();
                let name = path.file_name()?.to_string_lossy();
                if !name.starts_with("ipc-") || !name.ends_with(".sock") {
                    return None;
                }
                let file_type = entry.file_type().ok()?;
                if !file_type.is_socket() {
                    return None;
                }
                let modified = entry.metadata().ok()?.modified().ok()?;
                Some((modified, path))
            })
            .collect::<Vec<_>>();
        candidates.sort_by(|a, b| b.0.cmp(&a.0));
        candidates.into_iter().map(|(_, path)| path).next()
    }

    /// Optional explicit compositor override for mixed/stale session envs.
    ///
    /// Supported values:
    /// - `TMNL_COMPOSITOR=driftwm` / `drift`
    /// - `TMNL_COMPOSITOR=niri`
    pub fn compositor_override() -> Option<CompositorOverride> {
        std::env::var("TMNL_COMPOSITOR")
            .ok()
            .and_then(|value| parse_compositor_override(&value))
    }

    /// True when environment variables explicitly identify the DriftWM session.
    pub fn env_prefers_driftwm() -> bool {
        std::env::var("XDG_CURRENT_DESKTOP")
            .map(|desktop| desktop.to_ascii_lowercase().contains("driftwm"))
            .unwrap_or(false)
            || std::env::var_os("_DRIFTWM_WRAPPER").is_some()
    }

    /// Path to a DriftWM IPC socket that accepts connections.
    pub fn live_socket_path() -> Option<PathBuf> {
        Self::socket_path().filter(|path| socket_accepts_connection(path))
    }

    /// True when DriftWM has a connectable IPC socket.
    pub fn has_live_socket() -> bool {
        Self::live_socket_path().is_some()
    }

    /// True when DriftWM has both a connectable IPC socket and readable state.
    pub fn has_live_state() -> bool {
        Self::has_live_socket() && Self::read_state().is_ok()
    }

    /// True when DriftWM IPC commands are available.
    pub fn is_available() -> bool {
        Self::has_live_socket()
    }

    /// True when GetByShell should choose DriftWM before niri.
    ///
    /// This deliberately tolerates mixed session environments where systemd user
    /// services inherited `XDG_CURRENT_DESKTOP=niri` / `NIRI_SOCKET`, but the
    /// actual shell surface is running under DriftWM.
    pub fn should_prefer() -> bool {
        if let Ok(value) = std::env::var("TMNL_COMPOSITOR") {
            return match parse_compositor_override(&value) {
                Some(CompositorOverride::DriftWM) => true,
                Some(CompositorOverride::Niri) | None => false,
            };
        }

        Self::env_prefers_driftwm() || Self::has_live_state()
    }

    /// Read and parse DriftWM's state file.
    pub fn read_state() -> Result<DriftState, DriftError> {
        let path = Self::state_file_path().ok_or(DriftError::NoRuntimeDir)?;
        let content = std::fs::read_to_string(&path)
            .map_err(|e| DriftError::Read(path.display().to_string(), e.to_string()))?;
        parse_state(&content)
    }

    fn command() -> Result<std::process::Command, DriftError> {
        let socket = Self::live_socket_path()
            .ok_or_else(|| DriftError::Command("no live DriftWM IPC socket".to_string()))?;
        let mut command = std::process::Command::new("driftwm");
        command.env("DRIFTWM_SOCKET", socket);
        Ok(command)
    }

    pub fn run_msg(args: &[&str]) -> Result<(), DriftError> {
        let status = Self::command()?
            .arg("msg")
            .args(args)
            .status()
            .map_err(|e| DriftError::Command(e.to_string()))?;

        if status.success() {
            Ok(())
        } else {
            Err(DriftError::Command(format!(
                "driftwm msg {} exited with status {status}",
                args.join(" ")
            )))
        }
    }

    pub fn workspace_anchor(idx: u8) -> Option<(f64, f64)> {
        DRIFT_WORKSPACE_ANCHORS
            .iter()
            .find(|(anchor_idx, _, _, _)| *anchor_idx == idx)
            .map(|(_, _, x, y)| (*x, *y))
    }

    pub fn workspace_for_point(x: f64, y: f64) -> u8 {
        DRIFT_WORKSPACE_ANCHORS
            .iter()
            .min_by(|(_, _, ax, ay), (_, _, bx, by)| {
                let ad = (x - *ax).powi(2) + (y - *ay).powi(2);
                let bd = (x - *bx).powi(2) + (y - *by).powi(2);
                ad.total_cmp(&bd)
            })
            .map(|(idx, _, _, _)| *idx)
            .unwrap_or(1)
    }

    pub fn focus_workspace(idx: u8) -> Result<(), DriftError> {
        let (x, y) = Self::workspace_anchor(idx)
            .ok_or_else(|| DriftError::Command(format!("invalid DriftWM workspace {idx}")))?;
        let x = format!("{x:.0}");
        let y = format!("{y:.0}");
        Self::run_msg(&["camera", x.as_str(), y.as_str()])?;
        Self::run_msg(&["zoom", "1.0"])
    }

    /// Focus a window by app id substring using DriftWM's built-in CLI.
    pub fn focus_app(app_id: &str) -> Result<(), DriftError> {
        Self::run_msg(&["focus", app_id])
    }
}

pub fn parse_state(content: &str) -> Result<DriftState, DriftError> {
    let mut state = DriftState::default();

    for line in content.lines() {
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };

        match key {
            "x" => state.x = value.parse::<f64>().ok(),
            "y" => state.y = value.parse::<f64>().ok(),
            "zoom" => state.zoom = value.parse::<f64>().ok(),
            "layout" => state.layout = Some(value.to_string()),
            "layout_short" => state.layout_short = Some(value.to_string()),
            "windows" => {
                state.windows = serde_json::from_str(value)
                    .map_err(|e| DriftError::Deserialize(e.to_string()))?;
            }
            "layers" => {
                state.layers = value
                    .split(',')
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .map(ToOwned::to_owned)
                    .collect();
            }
            _ => {}
        }
    }

    Ok(state)
}

#[derive(Debug, Clone)]
pub enum DriftError {
    NoRuntimeDir,
    Read(String, String),
    Deserialize(String),
    Command(String),
}

impl std::fmt::Display for DriftError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DriftError::NoRuntimeDir => write!(f, "XDG_RUNTIME_DIR not set"),
            DriftError::Read(path, e) => write!(f, "read {path}: {e}"),
            DriftError::Deserialize(e) => write!(f, "deserialize: {e}"),
            DriftError::Command(e) => write!(f, "command: {e}"),
        }
    }
}

impl std::error::Error for DriftError {}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{ffi::OsString, os::unix::net::UnixListener, sync::Mutex};

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    struct EnvRestore {
        saved: Vec<(String, Option<OsString>)>,
    }

    impl Drop for EnvRestore {
        fn drop(&mut self) {
            for (key, value) in self.saved.drain(..) {
                match value {
                    Some(value) => std::env::set_var(key, value),
                    None => std::env::remove_var(key),
                }
            }
        }
    }

    fn set_env(updates: &[(&str, Option<&str>)]) -> EnvRestore {
        let saved = updates
            .iter()
            .map(|(key, _)| ((*key).to_string(), std::env::var_os(key)))
            .collect::<Vec<_>>();

        for (key, value) in updates {
            match value {
                Some(value) => std::env::set_var(key, value),
                None => std::env::remove_var(key),
            }
        }

        EnvRestore { saved }
    }

    fn temp_runtime_dir(test_name: &str) -> PathBuf {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock after epoch")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "tmnl-driftwm-{test_name}-{}-{nonce}",
            std::process::id()
        ));
        std::fs::create_dir_all(dir.join("driftwm")).expect("create temp runtime dir");
        dir
    }

    #[test]
    fn parses_compositor_override_values() {
        assert_eq!(
            parse_compositor_override("driftwm"),
            Some(CompositorOverride::DriftWM)
        );
        assert_eq!(
            parse_compositor_override("DRIFT"),
            Some(CompositorOverride::DriftWM)
        );
        assert_eq!(
            parse_compositor_override("niri"),
            Some(CompositorOverride::Niri)
        );
        assert_eq!(parse_compositor_override("hyprland"), None);
    }

    #[test]
    fn should_prefer_respects_explicit_compositor_override() {
        let _lock = ENV_LOCK.lock().expect("env lock");
        let _restore = set_env(&[
            ("TMNL_COMPOSITOR", Some("niri")),
            ("XDG_CURRENT_DESKTOP", Some("driftwm")),
            ("_DRIFTWM_WRAPPER", Some("1")),
            ("XDG_RUNTIME_DIR", None),
            ("DRIFTWM_SOCKET", None),
            ("WAYLAND_DISPLAY", None),
        ]);

        assert!(!DriftClient::should_prefer());

        std::env::set_var("TMNL_COMPOSITOR", "driftwm");
        assert!(DriftClient::should_prefer());
    }

    #[test]
    fn should_prefer_fails_safe_on_invalid_compositor_override() {
        let _lock = ENV_LOCK.lock().expect("env lock");
        let _restore = set_env(&[
            ("TMNL_COMPOSITOR", Some("hyprland")),
            ("XDG_CURRENT_DESKTOP", Some("driftwm")),
            ("_DRIFTWM_WRAPPER", Some("1")),
        ]);

        assert!(!DriftClient::should_prefer());
    }

    #[test]
    fn should_prefer_autodetects_connectable_socket_and_state() {
        let _lock = ENV_LOCK.lock().expect("env lock");
        let runtime = temp_runtime_dir("should-prefer-live-state");
        let socket = runtime.join("driftwm").join("ipc-wayland-4.sock");
        let _listener = UnixListener::bind(&socket).expect("bind wayland socket");
        std::fs::write(
            runtime.join("driftwm").join("state"),
            "x=0\ny=0\nzoom=1.0\nlayers=tmnl-shell\nwindows=[]\n",
        )
        .expect("write state file");
        let _restore = set_env(&[
            ("TMNL_COMPOSITOR", None),
            ("XDG_CURRENT_DESKTOP", None),
            ("_DRIFTWM_WRAPPER", None),
            ("DRIFTWM_SOCKET", None),
            (
                "XDG_RUNTIME_DIR",
                Some(runtime.to_str().expect("utf8 path")),
            ),
            ("WAYLAND_DISPLAY", Some("wayland-4")),
        ]);

        assert_eq!(DriftClient::live_socket_path(), Some(socket.clone()));
        assert!(DriftClient::has_live_socket());
        assert!(DriftClient::has_live_state());
        assert!(DriftClient::is_available());
        assert!(DriftClient::should_prefer());
        let _ = std::fs::remove_dir_all(runtime);
    }

    #[test]
    fn should_prefer_rejects_stale_socket_with_state_file() {
        let _lock = ENV_LOCK.lock().expect("env lock");
        let runtime = temp_runtime_dir("stale-socket-with-state");
        let socket = runtime.join("driftwm").join("ipc-wayland-5.sock");
        {
            let _listener = UnixListener::bind(&socket).expect("bind stale socket");
        }
        std::fs::write(
            runtime.join("driftwm").join("state"),
            "x=0\ny=0\nzoom=1.0\nlayers=tmnl-shell\nwindows=[]\n",
        )
        .expect("write state file");
        let _restore = set_env(&[
            ("TMNL_COMPOSITOR", None),
            ("XDG_CURRENT_DESKTOP", None),
            ("_DRIFTWM_WRAPPER", None),
            ("DRIFTWM_SOCKET", None),
            (
                "XDG_RUNTIME_DIR",
                Some(runtime.to_str().expect("utf8 path")),
            ),
            ("WAYLAND_DISPLAY", Some("wayland-5")),
        ]);

        assert_eq!(DriftClient::socket_path(), Some(socket.clone()));
        assert_eq!(DriftClient::live_socket_path(), None);
        assert!(!DriftClient::has_live_socket());
        assert!(!DriftClient::has_live_state());
        assert!(!DriftClient::is_available());
        assert!(!DriftClient::should_prefer());
        let _ = std::fs::remove_dir_all(runtime);
    }

    #[test]
    fn socket_path_prefers_explicit_socket() {
        let _lock = ENV_LOCK.lock().expect("env lock");
        let runtime = temp_runtime_dir("explicit-socket");
        let explicit = runtime.join("explicit.sock");
        let wayland = runtime.join("driftwm").join("ipc-wayland-1.sock");
        let _explicit_listener = UnixListener::bind(&explicit).expect("bind explicit socket");
        let _wayland_listener = UnixListener::bind(&wayland).expect("bind wayland socket");
        let _restore = set_env(&[
            (
                "DRIFTWM_SOCKET",
                Some(explicit.to_str().expect("utf8 path")),
            ),
            (
                "XDG_RUNTIME_DIR",
                Some(runtime.to_str().expect("utf8 path")),
            ),
            ("WAYLAND_DISPLAY", Some("wayland-1")),
        ]);

        assert_eq!(DriftClient::socket_path(), Some(explicit.clone()));
        assert_eq!(DriftClient::live_socket_path(), Some(explicit.clone()));
        assert!(DriftClient::is_available());
        let _ = std::fs::remove_dir_all(runtime);
    }

    #[test]
    fn socket_path_uses_wayland_display_socket() {
        let _lock = ENV_LOCK.lock().expect("env lock");
        let runtime = temp_runtime_dir("wayland-socket");
        let socket = runtime.join("driftwm").join("ipc-wayland-2.sock");
        let _listener = UnixListener::bind(&socket).expect("bind wayland socket");
        let _restore = set_env(&[
            ("DRIFTWM_SOCKET", None),
            (
                "XDG_RUNTIME_DIR",
                Some(runtime.to_str().expect("utf8 path")),
            ),
            ("WAYLAND_DISPLAY", Some("wayland-2")),
        ]);

        assert_eq!(DriftClient::socket_path(), Some(socket.clone()));
        let _ = std::fs::remove_dir_all(runtime);
    }

    #[test]
    fn socket_path_ignores_regular_files() {
        let _lock = ENV_LOCK.lock().expect("env lock");
        let runtime = temp_runtime_dir("regular-socket-files");
        let explicit = runtime.join("explicit.sock");
        let wayland = runtime.join("driftwm").join("ipc-wayland-3.sock");
        let fallback = runtime.join("driftwm").join("ipc-fallback.sock");
        std::fs::write(&explicit, "not a socket").expect("write explicit regular file");
        std::fs::write(&wayland, "not a socket").expect("write wayland regular file");
        let _fallback_listener = UnixListener::bind(&fallback).expect("bind fallback socket");
        let _restore = set_env(&[
            (
                "DRIFTWM_SOCKET",
                Some(explicit.to_str().expect("utf8 path")),
            ),
            (
                "XDG_RUNTIME_DIR",
                Some(runtime.to_str().expect("utf8 path")),
            ),
            ("WAYLAND_DISPLAY", Some("wayland-3")),
        ]);

        assert_eq!(DriftClient::socket_path(), Some(fallback.clone()));
        assert_eq!(DriftClient::live_socket_path(), Some(fallback.clone()));
        let _ = std::fs::remove_dir_all(runtime);
    }

    #[test]
    fn read_state_uses_xdg_runtime_dir() {
        let _lock = ENV_LOCK.lock().expect("env lock");
        let runtime = temp_runtime_dir("read-state");
        std::fs::write(
            runtime.join("driftwm").join("state"),
            "x=42\ny=-84\nzoom=0.750\nlayers=tmnl-shell\nwindows=[]\n",
        )
        .expect("write state file");
        let _restore = set_env(&[(
            "XDG_RUNTIME_DIR",
            Some(runtime.to_str().expect("utf8 path")),
        )]);

        let state = DriftClient::read_state().expect("read drift state");
        assert_eq!(state.x, Some(42.0));
        assert_eq!(state.y, Some(-84.0));
        assert_eq!(state.zoom, Some(0.75));
        assert_eq!(state.layers, vec!["tmnl-shell"]);
        let _ = std::fs::remove_dir_all(runtime);
    }

    #[test]
    fn maps_canvas_points_to_spatial_workspaces() {
        assert_eq!(DriftClient::workspace_for_point(0.0, 0.0), 1);
        assert_eq!(DriftClient::workspace_for_point(2900.0, -100.0), 2);
        assert_eq!(DriftClient::workspace_for_point(6100.0, -3100.0), 6);
        assert_eq!(DriftClient::workspace_for_point(100.0, -5900.0), 7);
        assert_eq!(DriftClient::workspace_anchor(9), Some((6000.0, -6000.0)));
        assert_eq!(DriftClient::workspace_anchor(10), None);
    }

    #[test]
    fn parses_state_file_subset() {
        let parsed = parse_state(
            r#"x=10
y=-20
zoom=1.250
layout=English (US)
layout_short=us
windows=[{"app_id":"foot","title":"~","position":[0,0],"size":[800,480],"is_focused":true,"is_widget":false}]
layers=tmnl-shell,waybar
"#,
        )
        .expect("parse drift state");

        assert_eq!(parsed.x, Some(10.0));
        assert_eq!(parsed.y, Some(-20.0));
        assert_eq!(parsed.zoom, Some(1.25));
        assert_eq!(parsed.windows.len(), 1);
        assert_eq!(parsed.windows[0].app_id, "foot");
        assert_eq!(parsed.layers, vec!["tmnl-shell", "waybar"]);
    }
}
