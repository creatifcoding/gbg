//! GTK Layer Shell integration for TMNL Bar.
//!
//! This module configures a Tauri WebviewWindow as a wlr-layer-shell surface
//! on Wayland compositors. The approach:
//!
//! 1. Create the window with `visible(false)` — window exists but isn't realized
//! 2. Access the GTK window via `webview_window.gtk_window()`
//! 3. Call `gtk_layer_shell::init_for_window()` BEFORE the window is shown
//! 4. Configure anchoring, exclusive zone, layer, keyboard interactivity
//! 5. Show the window — now it's a proper layer shell surface

use tmnl_shared::state::{BarConfig, BarEdge, BarLayer, KeyboardMode};

/// Configure a Tauri WebviewWindow as a layer shell surface.
///
/// MUST be called BEFORE `window.show()` — the window must be created with `visible(false)`.
#[cfg(target_os = "linux")]
pub fn init_layer_shell(
    webview_window: &tauri::WebviewWindow,
    config: &BarConfig,
) -> Result<(), String> {
    use gtk::prelude::*;
    use gtk_layer_shell::LayerShell;

    let gtk_window: gtk::ApplicationWindow = webview_window
        .gtk_window()
        .map_err(|e| format!("Failed to get GTK window: {}", e))?;

    // Initialize layer shell BEFORE the window is realized/shown
    gtk_window.init_layer_shell();

    // Set the layer
    let layer = match config.layer {
        BarLayer::Background => gtk_layer_shell::Layer::Background,
        BarLayer::Bottom => gtk_layer_shell::Layer::Bottom,
        BarLayer::Top => gtk_layer_shell::Layer::Top,
        BarLayer::Overlay => gtk_layer_shell::Layer::Overlay,
    };
    gtk_window.set_layer(layer);

    // Set namespace for identification (shows in `niri msg layers`)
    gtk_window.set_namespace("tmnl-bar");

    // Configure anchoring based on edge
    match config.edge {
        BarEdge::Left => {
            gtk_window.set_anchor(gtk_layer_shell::Edge::Left, true);
            gtk_window.set_anchor(gtk_layer_shell::Edge::Top, true);
            gtk_window.set_anchor(gtk_layer_shell::Edge::Bottom, true);
            gtk_window.set_anchor(gtk_layer_shell::Edge::Right, false);
            gtk_window.set_size_request(config.size as i32, -1);
        }
        BarEdge::Right => {
            gtk_window.set_anchor(gtk_layer_shell::Edge::Right, true);
            gtk_window.set_anchor(gtk_layer_shell::Edge::Top, true);
            gtk_window.set_anchor(gtk_layer_shell::Edge::Bottom, true);
            gtk_window.set_anchor(gtk_layer_shell::Edge::Left, false);
            gtk_window.set_size_request(config.size as i32, -1);
        }
        BarEdge::Top => {
            gtk_window.set_anchor(gtk_layer_shell::Edge::Top, true);
            gtk_window.set_anchor(gtk_layer_shell::Edge::Left, true);
            gtk_window.set_anchor(gtk_layer_shell::Edge::Right, true);
            gtk_window.set_anchor(gtk_layer_shell::Edge::Bottom, false);
            gtk_window.set_size_request(-1, config.size as i32);
        }
        BarEdge::Bottom => {
            gtk_window.set_anchor(gtk_layer_shell::Edge::Bottom, true);
            gtk_window.set_anchor(gtk_layer_shell::Edge::Left, true);
            gtk_window.set_anchor(gtk_layer_shell::Edge::Right, true);
            gtk_window.set_anchor(gtk_layer_shell::Edge::Top, false);
            gtk_window.set_size_request(-1, config.size as i32);
        }
    }

    // Set exclusive zone — positive value reserves space, pushing other windows
    if config.exclusive {
        gtk_window.set_exclusive_zone(config.size as i32);
    } else {
        gtk_window.set_exclusive_zone(0);
    }

    // Note: set_keyboard_mode() requires gtk-layer-shell >= 0.6 protocol support.
    // The Rust crate v0.8.2 may not expose it. Keyboard interactivity defaults to None,
    // which is correct for a status bar. OnDemand can be set via set_keyboard_interactivity()
    // if available in the installed version.
    // 
    // For future: upgrade to gtk4-layer-shell when Tauri moves to GTK4.
    match config.keyboard {
        KeyboardMode::None => {
            // Default — no keyboard focus for the bar
        }
        KeyboardMode::Exclusive | KeyboardMode::OnDemand => {
            // Try to set keyboard interactivity if the API is available
            // gtk_window.set_keyboard_interactivity(true) for v0.6+ C API
            log::info!("Keyboard interactivity requested but may not be available in current bindings");
        }
    }

    log::info!(
        "Layer shell initialized: edge={:?}, size={}px, layer={:?}, exclusive={}, keyboard={:?}",
        config.edge, config.size, config.layer, config.exclusive, config.keyboard
    );

    Ok(())
}

/// No-op on non-Linux platforms.
#[cfg(not(target_os = "linux"))]
pub fn init_layer_shell(
    _webview_window: &tauri::WebviewWindow,
    _config: &BarConfig,
) -> Result<(), String> {
    log::warn!("Layer shell not available on this platform — bar will use normal window mode");
    Ok(())
}
