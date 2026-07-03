mod layer_webview;
mod niri_bridge;

use std::sync::Mutex;
use tauri::Manager;

// ─── Logging Bridge (Effect Logger → journald) ─────────────────────────────

/// A structured log entry from the Effect Logger on the frontend.
#[derive(serde::Deserialize, Debug, Clone)]
struct LogEntry {
    timestamp: String,
    level: String,
    message: String,
    #[serde(rename = "fiberId")]
    fiber_id: Option<String>,
    spans: Option<Vec<String>>,
    annotations: Option<std::collections::HashMap<String, String>>,
    source: Option<String>,
    cause: Option<String>,
}

/// Receive a batch of structured log entries from the Effect Logger.
/// Dispatches each to Rust's `log` crate which flows to journald.
#[tauri::command]
fn shell_log_batch(entries: Vec<LogEntry>) {
    for entry in entries {
        let spans = entry
            .spans
            .as_ref()
            .map(|s| s.join(" > "))
            .unwrap_or_default();
        let fiber = entry
            .fiber_id
            .as_deref()
            .map(|f| format!(" fiber={}", f))
            .unwrap_or_default();
        let annotations = entry
            .annotations
            .as_ref()
            .map(|a| {
                a.iter()
                    .map(|(k, v)| format!("{}={}", k, v))
                    .collect::<Vec<_>>()
                    .join(" ")
            })
            .unwrap_or_default();
        let source = entry
            .source
            .as_deref()
            .map(|s| format!(" src={}", s))
            .unwrap_or_default();

        let formatted = if spans.is_empty() {
            format!(
                "[{}]{}{} {}{}",
                entry.timestamp,
                fiber,
                source,
                entry.message,
                if annotations.is_empty() {
                    String::new()
                } else {
                    format!(" {}", annotations)
                }
            )
        } else {
            format!(
                "[{}]{}{} [{}] {}{}",
                entry.timestamp,
                fiber,
                source,
                spans,
                entry.message,
                if annotations.is_empty() {
                    String::new()
                } else {
                    format!(" {}", annotations)
                }
            )
        };

        match entry.level.as_str() {
            "trace" => log::trace!("{}", formatted),
            "debug" => log::debug!("{}", formatted),
            "info" => log::info!("{}", formatted),
            "warn" => log::warn!("{}", formatted),
            "error" | "fatal" => {
                if let Some(ref cause) = entry.cause {
                    log::error!("{}\n  cause: {}", formatted, cause);
                } else {
                    log::error!("{}", formatted);
                }
            }
            _ => log::debug!("{}", formatted),
        }
    }
}

// ─── Compositor Commands (DriftWM/niri active compositor selection) ──────────

fn prefer_driftwm() -> bool {
    tmnl_shared::driftwm::DriftClient::should_prefer()
}

fn drift_workspaces_json() -> Result<serde_json::Value, String> {
    use tmnl_shared::driftwm::DriftClient;

    let state = DriftClient::read_state().map_err(|e| format!("driftwm state: {}", e))?;
    let active_workspace = match (state.x, state.y) {
        (Some(x), Some(y)) => DriftClient::workspace_for_point(x, y),
        _ => 1,
    };
    let window_workspaces = state
        .windows
        .iter()
        .enumerate()
        .map(|(index, window)| {
            let workspace = DriftClient::workspace_for_point(
                window.position[0] as f64,
                window.position[1] as f64,
            );
            (index + 1, workspace)
        })
        .collect::<Vec<_>>();

    let workspaces = tmnl_shared::driftwm::DRIFT_WORKSPACE_ANCHORS
        .iter()
        .map(|(idx, name, _, _)| {
            let active_window_id =
                window_workspaces
                    .iter()
                    .find_map(|(id, workspace)| if workspace == idx { Some(*id) } else { None });
            serde_json::json!({
                "idx": idx,
                "name": name,
                "output": "driftwm",
                "is_active": *idx == active_workspace,
                "is_focused": *idx == active_workspace,
                "active_window_id": active_window_id
            })
        })
        .collect::<Vec<_>>();

    Ok(serde_json::Value::Array(workspaces))
}

fn drift_windows_json() -> Result<serde_json::Value, String> {
    use tmnl_shared::driftwm::DriftClient;

    let state = DriftClient::read_state().map_err(|e| format!("driftwm state: {}", e))?;
    let windows: Vec<serde_json::Value> = state
        .windows
        .iter()
        .enumerate()
        .map(|(index, window)| {
            serde_json::json!({
                "id": index + 1,
                "title": if window.title.is_empty() { None::<String> } else { Some(window.title.clone()) },
                "app_id": if window.app_id.is_empty() { None::<String> } else { Some(window.app_id.clone()) },
                "workspace_id": DriftClient::workspace_for_point(window.position[0] as f64, window.position[1] as f64),
                "is_focused": window.is_focused
            })
        })
        .collect();

    Ok(serde_json::Value::Array(windows))
}

#[tauri::command]
fn get_workspaces() -> Result<serde_json::Value, String> {
    use tmnl_shared::niri::NiriClient;

    if prefer_driftwm() {
        return drift_workspaces_json();
    }

    if let Ok(mut client) = NiriClient::connect() {
        match client.workspaces() {
            Ok(ws) => return serde_json::to_value(&ws).map_err(|e| format!("serialize: {}", e)),
            Err(e) => log::warn!("niri workspaces failed: {} — trying DriftWM", e),
        }
    }

    drift_workspaces_json()
}

#[tauri::command]
fn get_windows() -> Result<serde_json::Value, String> {
    use tmnl_shared::niri::NiriClient;

    if prefer_driftwm() {
        return drift_windows_json();
    }

    if let Ok(mut client) = NiriClient::connect() {
        match client.windows() {
            Ok(wins) => {
                return serde_json::to_value(&wins).map_err(|e| format!("serialize: {}", e))
            }
            Err(e) => log::warn!("niri windows failed: {} — trying DriftWM", e),
        }
    }

    drift_windows_json()
}

#[tauri::command]
fn focus_workspace(idx: u8) -> Result<(), String> {
    use tmnl_shared::{driftwm::DriftClient, niri::NiriClient};

    if prefer_driftwm() && DriftClient::is_available() {
        return DriftClient::focus_workspace(idx)
            .map_err(|e| format!("driftwm focus workspace: {e}"));
    }

    if let Ok(mut client) = NiriClient::connect() {
        use niri_ipc::{Action, Request};
        match client.send(Request::Action(Action::FocusWorkspace {
            reference: niri_ipc::WorkspaceReferenceArg::Index(idx),
        })) {
            Ok(_) => return Ok(()),
            Err(e) => log::warn!("niri focus workspace failed: {} — trying DriftWM", e),
        }
    }

    if DriftClient::is_available() {
        return DriftClient::focus_workspace(idx)
            .map_err(|e| format!("driftwm focus workspace: {e}"));
    }

    Err("no supported compositor IPC available".to_string())
}

// ─── Command Palette (Layer-Shell Overlay) ───────────────────────────────────

/// Visibility flag — read from command threads, written from GTK thread.
static PALETTE_VISIBLE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

// ─── Chronicle (Layer-Shell Overlay) ─────────────────────────────────────────

/// Visibility flag — read from command threads, written from GTK thread.
static CHRONICLE_VISIBLE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Last toggle timestamp — debounce guard against double-fire.
static LAST_TOGGLE_MS: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Toggle the command palette layer-shell overlay.
/// Sends show/hide via channel → GTK idle handler shows/hides the surface.
/// Keyboard exclusive mode arrests focus automatically.
/// Debounced: ignores calls within 250ms of the last toggle.
#[tauri::command]
fn toggle_command_palette(app: tauri::AppHandle) -> Result<(), String> {
    // Debounce: reject toggles within 250ms
    {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        let prev = LAST_TOGGLE_MS.swap(now, std::sync::atomic::Ordering::SeqCst);
        if now.saturating_sub(prev) < 250 {
            log::debug!(
                "Command palette toggle debounced ({}ms since last)",
                now - prev
            );
            return Ok(());
        }
    }

    let state = app.state::<Mutex<BarSurfaceState>>();
    let state = state.lock().map_err(|e| format!("lock: {}", e))?;

    if let Some(ref tx) = state.palette_toggle_tx {
        let visible = PALETTE_VISIBLE.load(std::sync::atomic::Ordering::SeqCst);
        tx.send(!visible).map_err(|e| format!("send: {}", e))?;
        log::info!(
            "Command palette: {} → {}",
            if visible { "visible" } else { "hidden" },
            if !visible { "visible" } else { "hidden" },
        );
    } else {
        return Err("Palette not initialized (no layer shell?)".into());
    }
    Ok(())
}

/// Close (hide) the command palette overlay.
#[tauri::command]
fn close_command_palette(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<Mutex<BarSurfaceState>>();
    let state = state.lock().map_err(|e| format!("lock: {}", e))?;

    if let Some(ref tx) = state.palette_toggle_tx {
        if PALETTE_VISIBLE.load(std::sync::atomic::Ordering::SeqCst) {
            tx.send(false).map_err(|e| format!("send: {}", e))?;
            log::info!("Command palette closed");
        }
    }
    Ok(())
}

/// Toggle the Chronicle layer-shell overlay.
/// Same pattern as command palette — sends show/hide via channel.
#[tauri::command]
fn toggle_chronicle(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<Mutex<BarSurfaceState>>();
    let state = state.lock().map_err(|e| format!("lock: {}", e))?;

    if let Some(ref tx) = state.chronicle_toggle_tx {
        let visible = CHRONICLE_VISIBLE.load(std::sync::atomic::Ordering::SeqCst);
        tx.send(!visible).map_err(|e| format!("send: {}", e))?;
        log::info!(
            "Chronicle toggle: {} → {}",
            if visible { "visible" } else { "hidden" },
            if visible { "hidden" } else { "visible" }
        );
    } else {
        return Err("Chronicle not initialized (no layer shell?)".into());
    }
    Ok(())
}

/// Close (hide) the Chronicle overlay.
#[tauri::command]
fn close_chronicle(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<Mutex<BarSurfaceState>>();
    let state = state.lock().map_err(|e| format!("lock: {}", e))?;

    if let Some(ref tx) = state.chronicle_toggle_tx {
        if CHRONICLE_VISIBLE.load(std::sync::atomic::Ordering::SeqCst) {
            tx.send(false).map_err(|e| format!("send: {}", e))?;
            log::info!("Chronicle closed");
        }
    }
    Ok(())
}

// ─── Chronicle Window ───────────────────────────────────────────────────────

/// Return bar geometry for window positioning.
/// Frontend uses this to diff child window geometry relative to the bar.
#[tauri::command]
fn get_bar_geometry(app: tauri::AppHandle) -> Result<BarGeometry, String> {
    let state = app.state::<Mutex<BarSurfaceState>>();
    let state = state.lock().map_err(|e| format!("lock: {}", e))?;
    Ok(state.geometry.clone())
}

// ─── Input Region (Popover System) ──────────────────────────────────────────

#[derive(serde::Deserialize, Debug, Clone)]
struct Rect {
    x: i32,
    y: i32,
    w: i32,
    h: i32,
}

/// Update input region: bar strip + popover rects.
/// Called from React when popovers open/close.
/// Sends rect data via channel → GTK idle handler applies it.
#[tauri::command]
fn update_input_region(app: tauri::AppHandle, regions: Vec<Rect>) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        let state = app.state::<Mutex<BarSurfaceState>>();
        let state = state.lock().map_err(|e| format!("lock: {}", e))?;
        if let Some(ref tx) = state.region_tx {
            tx.send(regions).map_err(|e| format!("send: {}", e))?;
        }
    }
    Ok(())
}

/// Dynamically resize the layer-shell surface width.
/// Used by Chronicle modal to expand to fullscreen and shrink back.
#[tauri::command]
fn set_surface_width(app: tauri::AppHandle, width: i32) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        let state = app.state::<Mutex<BarSurfaceState>>();
        let mut state = state.lock().map_err(|e| format!("lock: {}", e))?;

        if let Some(ref tx) = state.resize_tx {
            tx.send(width).map_err(|e| format!("send: {}", e))?;
            state.surface_width = width;
            state.geometry.surface_width = width;
            log::info!(
                "Surface resized: {}px (bar={}px, overlay={}px)",
                width,
                state.bar_width,
                width - state.bar_width
            );
        } else {
            return Err("No resize channel".into());
        }
    }
    Ok(())
}

// ─── State ──────────────────────────────────────────────────────────────────

/// Input region update request sent from Tauri thread → GTK main thread.
#[cfg(target_os = "linux")]
type RegionSender = std::sync::mpsc::Sender<Vec<Rect>>;

/// Bar geometry — the source of truth for window positioning.
/// All child windows (Chronicle, popovers, etc.) diff against this.
#[derive(serde::Serialize, Clone, Debug)]
struct BarGeometry {
    /// Bar exclusive zone width (the clickable strip)
    bar_width: i32,
    /// Full surface width (bar + overlay region)
    surface_width: i32,
    /// Bar edge (which screen edge the bar is on)
    edge: String,
    /// Monitor logical width
    monitor_width: i32,
    /// Monitor logical height
    monitor_height: i32,
    /// Usable area: x offset (right of bar exclusive zone)
    usable_x: i32,
    /// Usable area: y offset
    usable_y: i32,
    /// Usable area width (monitor_width - bar_width)
    usable_width: i32,
    /// Usable area height
    usable_height: i32,
}

struct BarSurfaceState {
    #[cfg(target_os = "linux")]
    region_tx: Option<RegionSender>,
    #[cfg(target_os = "linux")]
    resize_tx: Option<std::sync::mpsc::Sender<i32>>,
    /// Command palette show/hide channel → GTK idle handler.
    #[cfg(target_os = "linux")]
    palette_toggle_tx: Option<std::sync::mpsc::Sender<bool>>,
    /// Chronicle show/hide channel → GTK idle handler.
    #[cfg(target_os = "linux")]
    chronicle_toggle_tx: Option<std::sync::mpsc::Sender<bool>>,
    bar_width: i32,
    surface_width: i32,
    geometry: BarGeometry,
}

impl Default for BarSurfaceState {
    fn default() -> Self {
        Self {
            #[cfg(target_os = "linux")]
            region_tx: None,
            #[cfg(target_os = "linux")]
            resize_tx: None,
            #[cfg(target_os = "linux")]
            palette_toggle_tx: None,
            #[cfg(target_os = "linux")]
            chronicle_toggle_tx: None,
            bar_width: 48,
            surface_width: 48,
            geometry: BarGeometry {
                bar_width: 48,
                surface_width: 48,
                edge: "left".into(),
                monitor_width: 1645,
                monitor_height: 1028,
                usable_x: 48,
                usable_y: 0,
                usable_width: 1645 - 48,
                usable_height: 1028,
            },
        }
    }
}

#[cfg(target_os = "linux")]
fn wire_tauri_bar_surface(
    app: &tauri::AppHandle,
    layer_win: &gtk::ApplicationWindow,
    content_win: Option<&gtk::ApplicationWindow>,
    bar_width: i32,
    surface_width: i32,
    layer_height: i32,
) -> Result<(), String> {
    use gtk::prelude::*;

    let (region_tx, region_rx) = std::sync::mpsc::channel::<Vec<Rect>>();
    let (resize_tx, resize_rx) = std::sync::mpsc::channel::<i32>();

    {
        let state = app.state::<Mutex<BarSurfaceState>>();
        let mut state = state.lock().map_err(|e| format!("lock: {}", e))?;
        state.region_tx = Some(region_tx);
        state.resize_tx = Some(resize_tx);
        state.bar_width = bar_width;
        state.surface_width = surface_width;
    }

    let layer_captures_input = content_win.is_none();
    let bw = if layer_captures_input { bar_width } else { 0 };
    let lh = layer_height;
    layer_win.connect_realize(move |win| {
        if let Some(gdk_win) = win.window() {
            let rect = cairo::RectangleInt::new(0, 0, bw, lh);
            let region = cairo::Region::create_rectangle(&rect);
            gdk_win.input_shape_combine_region(&region, 0, 0);
            log::info!("Tauri bar layer: initial input region applied");
        }
    });

    let region_win = layer_win.clone();
    glib::idle_add_local(move || {
        while let Ok(regions) = region_rx.try_recv() {
            if let Some(gdk_win) = region_win.window() {
                let region = if layer_captures_input {
                    let bar = cairo::RectangleInt::new(0, 0, bar_width, layer_height);
                    let region = cairo::Region::create_rectangle(&bar);
                    for r in &regions {
                        let rect = cairo::RectangleInt::new(r.x, r.y, r.w, r.h);
                        let _ = region.union_rectangle(&rect);
                    }
                    region
                } else {
                    cairo::Region::create()
                };
                gdk_win.input_shape_combine_region(&region, 0, 0);
            }
        }
        glib::ControlFlow::Continue
    });

    let resize_layer_win = layer_win.clone();
    let resize_content_win = content_win.cloned();
    glib::idle_add_local(move || {
        while let Ok(width) = resize_rx.try_recv() {
            resize_layer_win.set_width_request(width);
            resize_layer_win.set_size_request(width, layer_height);
            if let Some(ref content_win) = resize_content_win {
                content_win.set_width_request(width);
                content_win.set_size_request(width, layer_height);
            }
        }
        glib::ControlFlow::Continue
    });

    let display = gdk::Display::default().ok_or_else(|| "No GDK display".to_string())?;
    let monitor = display
        .primary_monitor()
        .or_else(|| display.monitor(0))
        .ok_or_else(|| "No GDK monitor".to_string())?;
    let geom = monitor.geometry();
    let scale = monitor.scale_factor();
    let logical_w = geom.width() / scale;
    let logical_h = geom.height() / scale;

    let state = app.state::<Mutex<BarSurfaceState>>();
    let mut state = state.lock().map_err(|e| format!("lock: {}", e))?;
    state.surface_width = surface_width;
    state.geometry = BarGeometry {
        bar_width,
        surface_width,
        edge: "left".into(),
        monitor_width: logical_w,
        monitor_height: logical_h,
        usable_x: bar_width,
        usable_y: 0,
        usable_width: logical_w - bar_width,
        usable_height: logical_h,
    };

    log::info!(
        "Tauri bar layer geometry: monitor={}x{} scale={} usable={}x{} @ ({},{})",
        logical_w,
        logical_h,
        scale,
        state.geometry.usable_width,
        state.geometry.usable_height,
        state.geometry.usable_x,
        state.geometry.usable_y,
    );

    Ok(())
}

// ─── App ────────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Debug)
                .build(),
        )
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(Mutex::new(BarSurfaceState::default()))
        .setup(|app| {
            log::info!("TMNL Shell starting...");

            let use_layer_shell = std::env::var("TMNL_BAR_NO_LAYER_SHELL").is_err();
            let bar_width: i32 = 48;
            let surface_width: i32 = bar_width; // persistent sidebar only; overlays expand explicitly
            #[cfg(target_os = "linux")]
            let layer_height = {
                use gdk::prelude::MonitorExt;
                gdk::Display::default()
                    .and_then(|display| display.primary_monitor().or_else(|| display.monitor(0)))
                    .map(|monitor| monitor.geometry().height().clamp(480, 4096))
                    .unwrap_or(1080)
            };
            #[cfg(not(target_os = "linux"))]
            let layer_height = 600;

            #[cfg(target_os = "linux")]
            if use_layer_shell {
                use gtk::prelude::*;
                use gtk_layer_shell::LayerShell;

                let gtk_app = layer_webview::gtk_application()?;

                // Tauri owns the WebKit webview and IPC bridge; the runtime
                // patch below makes the *Tauri GTK toplevel itself* a
                // layer-shell surface before Wry builds WebKitGTK into its
                // default_vbox. This avoids the black-pixel failure caused by
                // reparenting an already-realized WebKit subtree.
                std::env::set_var("TMNL_TAURI_LAYER_SHELL_LABELS", "bar");
                std::env::set_var("TMNL_TAURI_LAYER_SHELL_NAMESPACE", "tmnl-shell");
                std::env::set_var("TMNL_TAURI_LAYER_SHELL_LAYER", "overlay");
                std::env::set_var("TMNL_TAURI_LAYER_SHELL_EDGE", "left");
                std::env::set_var("TMNL_TAURI_LAYER_SHELL_SIZE", bar_width.to_string());
                std::env::set_var("TMNL_TAURI_LAYER_SHELL_HEIGHT", layer_height.to_string());
                std::env::set_var("TMNL_TAURI_LAYER_SHELL_EXCLUSIVE_ZONE", bar_width.to_string());
                std::env::set_var("TMNL_TAURI_LAYER_SHELL_KEYBOARD", "none");

                let bar_webview = tauri::WebviewWindowBuilder::new(
                    app,
                    "bar",
                    tauri::WebviewUrl::App("index.html".into()),
                )
                .title("TMNL Bar")
                .decorations(false)
                .transparent(true)
                .resizable(false)
                .skip_taskbar(true)
                .visible(false)
                .zoom_hotkeys_enabled(false)
                .inner_size(bar_width as f64, layer_height as f64)
                .build()?;

                let bar_surface = bar_webview
                    .gtk_window()
                    .map_err(|e| format!("bar gtk_window: {}", e))?;
                bar_surface.set_width_request(surface_width);
                bar_surface.set_size_request(surface_width, layer_height);

                wire_tauri_bar_surface(
                    &app.handle().clone(),
                    &bar_surface,
                    None,
                    bar_width,
                    surface_width,
                    layer_height,
                )?;
                bar_webview.show().map_err(|e| format!("show bar: {}", e))?;

                log::info!(
                    "Layer shell: tauri runtime prebuild namespace=tmnl-shell layer=overlay exclusive={}px surface={}px",
                    bar_width, surface_width
                );

                // ── Command Palette: Layer-shell overlay surface ─────────
                // Separate surface on the Overlay layer (above bar's Top layer).
                // Full-screen transparent overlay — CSS centers the palette content.
                // KeyboardMode::Exclusive arrests all keyboard input when visible.
                {
                    let palette_webview = tauri::WebviewWindowBuilder::new(
                        app,
                        "command-palette",
                        tauri::WebviewUrl::App("command.html".into()),
                    )
                    .title("TMNL Command Palette")
                    .decorations(false)
                    .transparent(true)
                    .resizable(false)
                    .skip_taskbar(true)
                    .zoom_hotkeys_enabled(false)
                    .inner_size(640.0, 480.0) // Tauri requires a size; layer-shell overrides
                    .build()?;

                    // Hide original Tauri toplevel; palette content is rehosted in a dedicated overlay layer-shell surface.
                    palette_webview.hide().map_err(|e| format!("hide palette: {}", e))?;

                    let palette_original = palette_webview.gtk_window()
                        .map_err(|e| format!("palette gtk_window: {}", e))?;
                    let palette_vbox = palette_webview.default_vbox()
                        .map_err(|e| format!("palette vbox: {}", e))?;
                    palette_original.remove(&palette_vbox);

                    let palette_surface = gtk::ApplicationWindow::new(&gtk_app);
                    palette_surface.set_app_paintable(true);

                    if let Some(screen) = gtk::prelude::WidgetExt::screen(&palette_surface) {
                        if let Some(visual) = screen.rgba_visual() {
                            gtk::prelude::WidgetExt::set_visual(&palette_surface, Some(&visual));
                        }
                    }

                    palette_surface.add(&palette_vbox);

                    // Layer shell: Overlay layer, fullscreen, keyboard exclusive
                    palette_surface.init_layer_shell();
                    palette_surface.set_layer(gtk_layer_shell::Layer::Overlay);
                    palette_surface.set_namespace("tmnl-command-palette");

                    // Anchor all four edges = fullscreen surface
                    palette_surface.set_anchor(gtk_layer_shell::Edge::Left, true);
                    palette_surface.set_anchor(gtk_layer_shell::Edge::Right, true);
                    palette_surface.set_anchor(gtk_layer_shell::Edge::Top, true);
                    palette_surface.set_anchor(gtk_layer_shell::Edge::Bottom, true);

                    // Exclusive keyboard: arrests ALL keyboard input to this surface
                    palette_surface.set_keyboard_mode(gtk_layer_shell::KeyboardMode::Exclusive);

                    // No exclusive zone — doesn't push other windows
                    palette_surface.set_exclusive_zone(-1);

                    // Starts hidden — toggle channel controls visibility
                    // (Don't show_all here)

                    // Toggle channel: command thread → GTK idle handler
                    let (palette_tx, palette_rx) = std::sync::mpsc::channel::<bool>();

                    let ps = palette_surface.clone();
                    let palette_app_handle = app.handle().clone();
                    glib::idle_add_local(move || {
                        use tauri::Emitter;
                        while let Ok(show) = palette_rx.try_recv() {
                            if show {
                                ps.show_all();
                                PALETTE_VISIBLE.store(true, std::sync::atomic::Ordering::SeqCst);
                                let _ = palette_app_handle.emit("tmnl:palette-state", true);
                                log::info!("Palette surface: shown (Overlay, keyboard exclusive)");
                            } else {
                                ps.hide();
                                PALETTE_VISIBLE.store(false, std::sync::atomic::Ordering::SeqCst);
                                let _ = palette_app_handle.emit("tmnl:palette-state", false);
                                log::info!("Palette surface: hidden");
                            }
                        }
                        glib::ControlFlow::Continue
                    });

                    {
                        let state = app.state::<Mutex<BarSurfaceState>>();
                        let mut state = state.lock().unwrap();
                        state.palette_toggle_tx = Some(palette_tx);
                    }

                    log::info!("Command palette layer-shell surface created (Overlay, keyboard exclusive, starts hidden)");
                }

                // ── Chronicle: Layer-shell overlay surface ───────────────
                // Similar to command palette — separate surface on Overlay layer.
                // Full-screen transparent overlay for Chronicle calendar.
                {
                    let chronicle_webview = tauri::WebviewWindowBuilder::new(
                        app,
                        "chronicle-overlay",
                        tauri::WebviewUrl::App("chronicle.html".into()),
                    )
                    .title("TMNL Chronicle")
                    .decorations(false)
                    .transparent(true)
                    .resizable(false)
                    .skip_taskbar(true)
                    .zoom_hotkeys_enabled(false)
                    .inner_size(800.0, 600.0) // Tauri requires a size; layer-shell overrides
                    .build()?;

                    // Hide original Tauri toplevel; Chronicle content is rehosted in a dedicated overlay layer-shell surface.
                    chronicle_webview.hide().map_err(|e| format!("hide chronicle: {}", e))?;

                    let chronicle_original = chronicle_webview.gtk_window()
                        .map_err(|e| format!("chronicle gtk_window: {}", e))?;
                    let chronicle_vbox = chronicle_webview.default_vbox()
                        .map_err(|e| format!("chronicle vbox: {}", e))?;
                    chronicle_original.remove(&chronicle_vbox);

                    let chronicle_surface = gtk::ApplicationWindow::new(&gtk_app);
                    chronicle_surface.set_app_paintable(true);

                    if let Some(screen) = gtk::prelude::WidgetExt::screen(&chronicle_surface) {
                        if let Some(visual) = screen.rgba_visual() {
                            gtk::prelude::WidgetExt::set_visual(&chronicle_surface, Some(&visual));
                        }
                    }

                    chronicle_surface.add(&chronicle_vbox);

                    // Layer shell: Overlay layer, fullscreen, keyboard exclusive
                    chronicle_surface.init_layer_shell();
                    chronicle_surface.set_layer(gtk_layer_shell::Layer::Overlay);
                    chronicle_surface.set_namespace("tmnl-chronicle");

                    // Anchor all four edges = fullscreen surface
                    chronicle_surface.set_anchor(gtk_layer_shell::Edge::Left, true);
                    chronicle_surface.set_anchor(gtk_layer_shell::Edge::Right, true);
                    chronicle_surface.set_anchor(gtk_layer_shell::Edge::Top, true);
                    chronicle_surface.set_anchor(gtk_layer_shell::Edge::Bottom, true);

                    // Exclusive keyboard: arrests ALL keyboard input to this surface
                    chronicle_surface.set_keyboard_mode(gtk_layer_shell::KeyboardMode::Exclusive);

                    // No exclusive zone — doesn't push other windows
                    chronicle_surface.set_exclusive_zone(-1);

                    // Starts hidden — toggle channel controls visibility

                    // Toggle channel: command thread → GTK idle handler
                    let (chronicle_tx, chronicle_rx) = std::sync::mpsc::channel::<bool>();

                    let cs = chronicle_surface.clone();
                    let chronicle_app_handle = app.handle().clone();
                    glib::idle_add_local(move || {
                        use tauri::Emitter;
                        while let Ok(show) = chronicle_rx.try_recv() {
                            if show {
                                cs.show_all();
                                CHRONICLE_VISIBLE.store(true, std::sync::atomic::Ordering::SeqCst);
                                let _ = chronicle_app_handle.emit("tmnl:chronicle-state", true);
                                log::info!("Chronicle surface: shown (Overlay, keyboard exclusive)");
                            } else {
                                cs.hide();
                                CHRONICLE_VISIBLE.store(false, std::sync::atomic::Ordering::SeqCst);
                                let _ = chronicle_app_handle.emit("tmnl:chronicle-state", false);
                                log::info!("Chronicle surface: hidden");
                            }
                        }
                        glib::ControlFlow::Continue
                    });

                    {
                        let state = app.state::<Mutex<BarSurfaceState>>();
                        let mut state = state.lock().unwrap();
                        state.chronicle_toggle_tx = Some(chronicle_tx);
                    }

                    log::info!("Chronicle layer-shell surface created (Overlay, keyboard exclusive, starts hidden)");
                }
            } else {
                log::info!("Layer shell DISABLED via TMNL_BAR_NO_LAYER_SHELL");
            }

            // ── Global Shortcut DISABLED ──────────────────────────────
            // Tauri global shortcut uses X11 grabs — partially works on
            // Wayland via XWayland, causing double-fire with SIGUSR1.
            // SIGUSR1 via compositor keybind is the sole activation path.

            // ── SIGUSR1 handler: Wayland-safe toggle via compositor keybind ────
            // On Wayland, global shortcuts don't work (no X11 grab).
            // Instead: niri/DriftWM keybind → `pkill -USR1 tmnl-shell` → this handler.
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    // Register SIGUSR1 handler
                    unsafe {
                        libc::signal(libc::SIGUSR1, {
                            // We use a static atomic to communicate between signal handler and thread
                            static SIGUSR1_FLAG: std::sync::atomic::AtomicBool =
                                std::sync::atomic::AtomicBool::new(false);

                            extern "C" fn handler(_: libc::c_int) {
                                SIGUSR1_FLAG.store(true, std::sync::atomic::Ordering::SeqCst);
                            }

                            // Poll loop checks the flag
                            let h = handle.clone();
                            std::thread::spawn(move || {
                                loop {
                                    std::thread::sleep(std::time::Duration::from_millis(100));
                                    if SIGUSR1_FLAG.swap(false, std::sync::atomic::Ordering::SeqCst) {
                                        log::info!("SIGUSR1 received → toggling command palette");
                                        if let Err(e) = toggle_command_palette(h.clone()) {
                                            log::error!("Command palette toggle (SIGUSR1) failed: {}", e);
                                        }
                                    }
                                }
                            });

                            handler as *const () as libc::sighandler_t
                        });
                    }

                    log::info!("SIGUSR1 handler registered for Wayland command palette toggle");
                });
            }

            // Compositor event bridge: niri EventStream or DriftWM state polling.
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                if let Err(e) = niri_bridge::start_event_bridge(app_handle) {
                    log::error!("Compositor event bridge failed: {}", e);
                }
            });

            log::info!("TMNL Shell started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_workspaces,
            get_windows,
            focus_workspace,
            update_input_region,
            set_surface_width,
            get_bar_geometry,
            toggle_chronicle,
            close_chronicle,
            toggle_command_palette,
            close_command_palette,
            shell_log_batch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TMNL Shell");
}
