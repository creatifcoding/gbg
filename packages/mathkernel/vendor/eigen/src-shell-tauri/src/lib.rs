mod layer_shell;
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
                entry.timestamp, fiber, source, entry.message, 
                if annotations.is_empty() { String::new() } else { format!(" {}", annotations) }
            )
        } else {
            format!(
                "[{}]{}{} [{}] {}{}",
                entry.timestamp, fiber, source, spans, entry.message,
                if annotations.is_empty() { String::new() } else { format!(" {}", annotations) }
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

// ─── Niri Commands ──────────────────────────────────────────────────────────

#[tauri::command]
fn get_workspaces() -> Result<serde_json::Value, String> {
    use tmnl_shared::niri::NiriClient;
    let mut client = NiriClient::connect()
        .map_err(|e| format!("niri connect: {}", e))?;
    let ws = client.workspaces().map_err(|e| format!("workspaces: {}", e))?;
    serde_json::to_value(&ws).map_err(|e| format!("serialize: {}", e))
}

#[tauri::command]
fn get_windows() -> Result<serde_json::Value, String> {
    use tmnl_shared::niri::NiriClient;
    let mut client = NiriClient::connect()
        .map_err(|e| format!("niri connect: {}", e))?;
    let wins = client.windows().map_err(|e| format!("windows: {}", e))?;
    serde_json::to_value(&wins).map_err(|e| format!("serialize: {}", e))
}

#[tauri::command]
fn focus_workspace(idx: u8) -> Result<(), String> {
    use tmnl_shared::niri::NiriClient;
    use niri_ipc::{Request, Action};
    let mut client = NiriClient::connect()
        .map_err(|e| format!("niri connect: {}", e))?;
    client.send(Request::Action(Action::FocusWorkspace {
        reference: niri_ipc::WorkspaceReferenceArg::Index(idx),
    })).map_err(|e| format!("focus: {}", e))?;
    Ok(())
}

// ─── Command Palette (Layer-Shell Overlay) ───────────────────────────────────

/// Visibility flag — read from command threads, written from GTK thread.
static PALETTE_VISIBLE: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

// ─── Chronicle (Layer-Shell Overlay) ─────────────────────────────────────────

/// Visibility flag — read from command threads, written from GTK thread.
static CHRONICLE_VISIBLE: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

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
            log::debug!("Command palette toggle debounced ({}ms since last)", now - prev);
            return Ok(());
        }
    }

    let state = app.state::<Mutex<BarSurfaceState>>();
    let state = state.lock().map_err(|e| format!("lock: {}", e))?;

    if let Some(ref tx) = state.palette_toggle_tx {
        let visible = PALETTE_VISIBLE.load(std::sync::atomic::Ordering::SeqCst);
        tx.send(!visible).map_err(|e| format!("send: {}", e))?;
        log::info!("Command palette: {} → {}",
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

/// Spawn the Chronicle fullscreen calendar window.
/// Positioned relative to bar geometry — fills usable area right of bar.
#[tauri::command]
fn open_chronicle(app: tauri::AppHandle) -> Result<BarGeometry, String> {
    use tauri::Manager;

    let geom = {
        let state = app.state::<Mutex<BarSurfaceState>>();
        let state = state.lock().map_err(|e| format!("lock: {}", e))?;
        state.geometry.clone()
    };

    // If already open, just focus it
    if let Some(win) = app.get_webview_window("chronicle") {
        win.set_focus().map_err(|e| format!("focus: {}", e))?;
        return Ok(geom);
    }

    // Position: fill the usable area right of the bar
    let margin = 8; // breathing room
    let x = geom.usable_x + margin;
    let y = geom.usable_y + margin;
    let w = geom.usable_width - (margin * 2);
    let h = geom.usable_height - (margin * 2);

    let _win = tauri::WebviewWindowBuilder::new(
        &app,
        "chronicle",
        tauri::WebviewUrl::App("chronicle.html".into()),
    )
    .title("CHRONICLE")
    .decorations(false)
    .transparent(true)
    .resizable(true)
    .position(x as f64, y as f64)
    .inner_size(w as f64, h as f64)
    .build()
    .map_err(|e| format!("build chronicle: {}", e))?;

    log::info!(
        "Chronicle window opened: pos=({},{}), size={}x{} (bar_width={}, usable={}x{})",
        x, y, w, h, geom.bar_width, geom.usable_width, geom.usable_height
    );
    Ok(geom)
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
            log::info!("Surface resized: {}px (bar={}px, overlay={}px)",
                width, state.bar_width, width - state.bar_width);
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
            surface_width: 400,
            geometry: BarGeometry {
                bar_width: 48,
                surface_width: 400,
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
            let surface_width: i32 = 400; // bar + overlay for popovers

            let webview_window = tauri::WebviewWindowBuilder::new(
                app,
                "bar",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("TMNL Shell")
            .decorations(false)
            .transparent(true)
            .resizable(false)
            .skip_taskbar(true)
            .inner_size(surface_width as f64, 600.0)
            .build()?;

            #[cfg(target_os = "linux")]
            if use_layer_shell {
                use gtk::prelude::*;
                use gtk_layer_shell::LayerShell;

                // === Vbox transplant ===
                webview_window.hide().map_err(|e| format!("hide: {}", e))?;

                let original = webview_window.gtk_window()
                    .map_err(|e| format!("gtk_window: {}", e))?;
                let gtk_app = original.application()
                    .ok_or("No GTK application")?;

                let new_win = gtk::ApplicationWindow::new(&gtk_app);
                new_win.set_app_paintable(true);

                // RGBA visual for transparency
                if let Some(screen) = gtk::prelude::WidgetExt::screen(&new_win) {
                    if let Some(visual) = screen.rgba_visual() {
                        gtk::prelude::WidgetExt::set_visual(&new_win, Some(&visual));
                    }
                }

                // Move WebView vbox
                let vbox = webview_window.default_vbox()
                    .map_err(|e| format!("vbox: {}", e))?;
                original.remove(&vbox);
                new_win.add(&vbox);

                // Layer shell
                new_win.init_layer_shell();
                new_win.set_layer(gtk_layer_shell::Layer::Top);
                new_win.set_namespace("tmnl-shell");

                new_win.set_anchor(gtk_layer_shell::Edge::Left, true);
                new_win.set_anchor(gtk_layer_shell::Edge::Top, true);
                new_win.set_anchor(gtk_layer_shell::Edge::Bottom, true);
                new_win.set_anchor(gtk_layer_shell::Edge::Right, false);

                // Wide surface, narrow exclusive zone
                new_win.set_width_request(surface_width);
                new_win.set_exclusive_zone(bar_width);

                // On-demand keyboard — surface grabs keyboard when it has input focus.
                // Required for ESC to dismiss command palette / modals.
                new_win.set_keyboard_mode(gtk_layer_shell::KeyboardMode::OnDemand);

                // Set initial input region = bar strip only
                let bw = bar_width;
                new_win.connect_realize(move |win| {
                    if let Some(gdk_win) = win.window() {
                        let rect = cairo::RectangleInt::new(0, 0, bw, 8000);
                        let region = cairo::Region::create_rectangle(&rect);
                        gdk_win.input_shape_combine_region(&region, 0, 0);
                    }
                });

                new_win.show_all();

                // Set up input region channel for popover system.
                // Channel: Tauri command thread → GTK idle handler.
                {
                    let (tx, rx) = std::sync::mpsc::channel::<Vec<Rect>>();
                    let state = app.state::<Mutex<BarSurfaceState>>();
                    let mut state = state.lock().unwrap();
                    state.region_tx = Some(tx);
                    state.bar_width = bar_width;

                    // GTK idle handler: polls channel, updates input region
                    let bw = bar_width;
                    let win_clone = new_win.clone();
                    glib::idle_add_local(move || {
                        while let Ok(regions) = rx.try_recv() {
                            if let Some(gdk_win) = win_clone.window() {
                                let bar = cairo::RectangleInt::new(0, 0, bw, 8000);
                                let region = cairo::Region::create_rectangle(&bar);
                                for r in &regions {
                                    let rect = cairo::RectangleInt::new(r.x, r.y, r.w, r.h);
                                    let _ = region.union_rectangle(&rect);
                                }
                                gdk_win.input_shape_combine_region(&region, 0, 0);
                            }
                        }
                        glib::ControlFlow::Continue
                    });
                }

                // Set up resize channel for modal fullscreen expansion.
                // Channel: Tauri command thread → GTK idle handler.
                {
                    let (resize_tx, resize_rx) = std::sync::mpsc::channel::<i32>();
                    let state = app.state::<Mutex<BarSurfaceState>>();
                    let mut state = state.lock().unwrap();
                    state.resize_tx = Some(resize_tx);
                    drop(state);

                    let win_clone = new_win.clone();
                    glib::idle_add_local(move || {
                        while let Ok(width) = resize_rx.try_recv() {
                            win_clone.set_width_request(width);
                        }
                        glib::ControlFlow::Continue
                    });
                }

                // Populate real monitor geometry from GDK
                {
                    let display = gdk::Display::default().expect("No GDK display");
                    let monitor = display.primary_monitor()
                        .or_else(|| display.monitor(0))
                        .expect("No GDK monitor");
                    let geom = monitor.geometry();
                    let scale = monitor.scale_factor();
                    let logical_w = geom.width() / scale;
                    let logical_h = geom.height() / scale;

                    let state = app.state::<Mutex<BarSurfaceState>>();
                    let mut state = state.lock().unwrap();
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
                        "Monitor: {}x{} (scale {}), usable: {}x{} @ ({},{})",
                        logical_w, logical_h, scale,
                        state.geometry.usable_width, state.geometry.usable_height,
                        state.geometry.usable_x, state.geometry.usable_y,
                    );
                }

                log::info!(
                    "Layer shell: surface={}px, bar={}px, overlay={}px",
                    surface_width, bar_width, surface_width - bar_width
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
                    .inner_size(640.0, 480.0) // Tauri requires a size; layer-shell overrides
                    .build()?;

                    // Hide original Tauri window — we transplant to layer-shell
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
                    .inner_size(800.0, 600.0) // Tauri requires a size; layer-shell overrides
                    .build()?;

                    // Hide original Tauri window — we transplant to layer-shell
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
            // SIGUSR1 via niri keybind is the sole activation path.

            // ── SIGUSR1 handler: Wayland-safe toggle via niri keybind ────
            // On Wayland, global shortcuts don't work (no X11 grab).
            // Instead: niri keybind → `pkill -USR1 tmnl-shell` → this handler.
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    use std::sync::atomic::{AtomicBool, Ordering};
                    use std::sync::Arc;

                    let signaled = Arc::new(AtomicBool::new(false));
                    let s = signaled.clone();

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

            // Niri event bridge
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                if let Err(e) = niri_bridge::start_event_bridge(app_handle) {
                    log::error!("Niri event bridge failed: {}", e);
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
