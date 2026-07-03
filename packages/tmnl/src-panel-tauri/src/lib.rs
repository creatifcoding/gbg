//! TMNL Panel — Wayland Layer Shell floating panel workspace.
//!
//! Architecture:
//!   - GTK ApplicationWindow on Layer::Overlay
//!   - KeyboardMode::OnDemand (grabs keyboard when focused, not exclusive)
//!   - All 4 edges anchored (fullscreen), CSS positions content
//!   - Toggle via compositor keybind → pkill -USR1 → this handler
//!   - Toggle via bar IPC (future: Tauri deep link)
//!   - Starts hidden, channel controls visibility

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering::SeqCst};
use std::sync::Mutex;
use tauri::Manager;

#[cfg(target_os = "linux")]
use gtk::prelude::*;
#[cfg(target_os = "linux")]
use gtk_layer_shell::LayerShell;

// ─── Panel Visibility State ─────────────────────────────────────────────────

static PANEL_VISIBLE: AtomicBool = AtomicBool::new(false);
static LAST_TOGGLE_MS: AtomicU64 = AtomicU64::new(0);

// ─── Panel Surface State ────────────────────────────────────────────────────

struct PanelSurfaceState {
    #[cfg(target_os = "linux")]
    toggle_tx: Option<std::sync::mpsc::Sender<bool>>,
}

impl Default for PanelSurfaceState {
    fn default() -> Self {
        Self {
            #[cfg(target_os = "linux")]
            toggle_tx: None,
        }
    }
}

// ─── Commands ───────────────────────────────────────────────────────────────

/// Toggle the panel layer-shell overlay.
/// Debounced: ignores calls within 250ms.
#[tauri::command]
fn toggle_panel(app: tauri::AppHandle) -> Result<(), String> {
    // Debounce
    {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        let prev = LAST_TOGGLE_MS.swap(now, SeqCst);
        if now.saturating_sub(prev) < 250 {
            log::debug!("Panel toggle debounced ({}ms since last)", now - prev);
            return Ok(());
        }
    }

    let state: tauri::State<'_, Mutex<PanelSurfaceState>> = app.state();
    let state = state.lock().map_err(|e| format!("lock: {}", e))?;

    if let Some(ref tx) = state.toggle_tx {
        let visible = PANEL_VISIBLE.load(SeqCst);
        let _ = tx.send(!visible);
        log::info!(
            "Panel toggle: {} → {}",
            if visible { "visible" } else { "hidden" },
            if visible { "hidden" } else { "visible" }
        );
    } else {
        return Err("Panel not initialized (no layer shell?)".into());
    }
    Ok(())
}

/// Close (hide) the panel overlay.
#[tauri::command]
fn close_panel(app: tauri::AppHandle) -> Result<(), String> {
    let state: tauri::State<'_, Mutex<PanelSurfaceState>> = app.state();
    let state = state.lock().map_err(|e| format!("lock: {}", e))?;

    if let Some(ref tx) = state.toggle_tx {
        if PANEL_VISIBLE.load(SeqCst) {
            let _ = tx.send(false);
            log::info!("Panel closed");
        }
    }
    Ok(())
}

/// Log batch from frontend.
#[tauri::command]
fn panel_log_batch(entries: Vec<serde_json::Value>) {
    for entry in &entries {
        if let Some(msg) = entry.get("msg").and_then(|v| v.as_str()) {
            log::info!("[panel-fe] {}", msg);
        }
    }
}

// ─── App Entry ──────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .manage(Mutex::new(PanelSurfaceState::default()));

    #[cfg(target_os = "linux")]
    let builder = builder.setup(|app| {
        use tauri::Manager;

        let use_layer_shell = std::env::var("TMNL_PANEL_NO_LAYER_SHELL").is_err();

        if use_layer_shell {
            // ── Panel: Layer-shell Overlay surface ──────────────────
            // Fullscreen transparent overlay — CSS positions panel content.
            // KeyboardMode::OnDemand — grabs keyboard when focused, coexists with bar.
            {
                let panel_webview = tauri::WebviewWindowBuilder::new(
                    app,
                    "panel",
                    tauri::WebviewUrl::App("panel.html".into()),
                )
                .title("TMNL Panel")
                .decorations(false)
                .transparent(true)
                .resizable(false)
                .skip_taskbar(true)
                .zoom_hotkeys_enabled(false)
                .inner_size(800.0, 600.0) // Tauri requires a size; layer-shell overrides
                .build()?;

                // Hide original Tauri window — we transplant to layer-shell
                panel_webview.hide().map_err(|e| format!("hide panel: {}", e))?;

                let panel_original = panel_webview.gtk_window()
                    .map_err(|e| format!("panel gtk_window: {}", e))?;
                let gtk_app = panel_original.application()
                    .ok_or("no GTK app on panel window")?;
                let panel_vbox = panel_webview.default_vbox()
                    .map_err(|e| format!("panel vbox: {}", e))?;
                panel_original.remove(&panel_vbox);

                let panel_surface = gtk::ApplicationWindow::new(&gtk_app);
                panel_surface.set_app_paintable(true);

                if let Some(screen) = gtk::prelude::WidgetExt::screen(&panel_surface) {
                    if let Some(visual) = screen.rgba_visual() {
                        gtk::prelude::WidgetExt::set_visual(&panel_surface, Some(&visual));
                    }
                }

                panel_surface.add(&panel_vbox);

                // Layer shell: Overlay layer, fullscreen, keyboard on-demand
                panel_surface.init_layer_shell();
                panel_surface.set_layer(gtk_layer_shell::Layer::Overlay);
                panel_surface.set_namespace("tmnl-panel");

                // Anchor all four edges = fullscreen surface
                panel_surface.set_anchor(gtk_layer_shell::Edge::Left, true);
                panel_surface.set_anchor(gtk_layer_shell::Edge::Right, true);
                panel_surface.set_anchor(gtk_layer_shell::Edge::Top, true);
                panel_surface.set_anchor(gtk_layer_shell::Edge::Bottom, true);

                // OnDemand keyboard: only grabs when focused (coexists with bar)
                panel_surface.set_keyboard_mode(gtk_layer_shell::KeyboardMode::OnDemand);

                // No exclusive zone
                panel_surface.set_exclusive_zone(-1);

                // Starts hidden
                // Toggle channel: command thread → GTK idle handler
                let (panel_tx, panel_rx) = std::sync::mpsc::channel::<bool>();

                let ps = panel_surface.clone();
                let panel_app_handle = app.handle().clone();
                glib::idle_add_local(move || {
                    use tauri::Emitter;
                    while let Ok(show) = panel_rx.try_recv() {
                        if show {
                            ps.show_all();
                            PANEL_VISIBLE.store(true, SeqCst);
                            let _ = panel_app_handle.emit("tmnl:panel-state", true);
                            log::info!("Panel surface: shown (Overlay, keyboard on-demand)");
                        } else {
                            ps.hide();
                            PANEL_VISIBLE.store(false, SeqCst);
                            let _ = panel_app_handle.emit("tmnl:panel-state", false);
                            log::info!("Panel surface: hidden");
                        }
                    }
                    glib::ControlFlow::Continue
                });

                {
                    let state = app.state::<Mutex<PanelSurfaceState>>();
                    let mut state = state.lock().unwrap();
                    state.toggle_tx = Some(panel_tx);
                }

                log::info!("Panel layer-shell surface created (Overlay, keyboard on-demand, starts hidden)");
            }
        } else {
            log::info!("Layer shell DISABLED via TMNL_PANEL_NO_LAYER_SHELL");
        }

        // ── SIGUSR1 handler: compositor keybind toggles the panel ────────
        {
            static SIGUSR1_FLAG: AtomicBool = AtomicBool::new(false);

            unsafe {
                libc::signal(libc::SIGUSR1, {
                    extern "C" fn handler(_: libc::c_int) {
                        SIGUSR1_FLAG.store(true, SeqCst);
                    }
                    handler as *const () as libc::sighandler_t
                });
            }

            let handle = app.handle().clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                    if SIGUSR1_FLAG.swap(false, SeqCst) {
                        if let Err(e) = toggle_panel(handle.clone()) {
                            log::error!("Panel toggle failed: {}", e);
                        }
                    }
                }
            });

            log::info!("SIGUSR1 handler registered for panel toggle");
        }

        Ok(())
    });

    #[cfg(not(target_os = "linux"))]
    let builder = builder.setup(|_app| {
        log::info!("TMNL Panel: non-Linux platform — layer shell disabled");
        Ok(())
    });

    builder
        .invoke_handler(tauri::generate_handler![
            toggle_panel,
            close_panel,
            panel_log_batch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TMNL Panel");
}
