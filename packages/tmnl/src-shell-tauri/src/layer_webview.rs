//! GTK application helper for GetByShell layer-shell overlays.
//!
//! The bar itself is now hosted by the patched `tauri-runtime-wry` path: the
//! Tauri GTK toplevel is initialized as layer-shell before Wry builds WebKitGTK
//! into it. This module intentionally does **not** create a raw WebKitGTK
//! layer-shell host; that path produced live DOM/IPC but black pixels under
//! DriftWM.

use gio::prelude::*;

pub(crate) fn gtk_application() -> Result<gtk::Application, String> {
    gio::Application::default()
        .and_then(|app| app.downcast::<gtk::Application>().ok())
        .ok_or_else(|| "No default GTK application from Tauri runtime".to_string())
}
