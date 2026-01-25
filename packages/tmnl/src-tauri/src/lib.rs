use std::sync::{Arc, OnceLock};
use std::time::Instant;

use tauri::Manager;

mod file_browser;
mod terminal_server;
mod theia_server;
mod window_manager;

use file_browser::{
    fs_compute_hash, fs_copy_file, fs_create_directory, fs_delete_file, fs_file_metadata,
    fs_list_directory, fs_read_file, fs_rename_file, fs_scan_directory, fs_write_file,
};
use terminal_server::{
    terminal_server_restart, terminal_server_start, terminal_server_status, terminal_server_stop,
    TerminalServerManager,
};
use theia_server::{
    theia_server_restart, theia_server_start, theia_server_status, theia_server_stop,
    TheiaServerManager,
};
use window_manager::{
    close_window, create_testbed_window, emit_to_all_windows, emit_to_window, focus_window,
    get_or_focus_testbed_window, list_windows,
    // Window pool commands (for sub-second window opening)
    init_window_pool, get_pool_status, open_testbed_window_fast,
    // Window control commands
    minimize_window, unminimize_window, maximize_window, unmaximize_window,
    set_fullscreen, toggle_fullscreen, get_window_state,
};

// =============================================================================
// HIGH-RESOLUTION TIMING
// =============================================================================

/// Lazy-initialized epoch reference for microsecond timing.
/// First call establishes epoch; subsequent calls measure elapsed time from it.
/// Thread-safe via OnceLock (lock-free after initialization).
static EPOCH: OnceLock<Instant> = OnceLock::new();

/// Returns microseconds since an arbitrary epoch (first call).
///
/// Resolution: nanosecond-accurate Instant, returned as u64 microseconds.
/// Thread-safe via OnceLock (lock-free after initialization).
///
/// # Example (from JS)
/// ```typescript
/// const start = await invoke<number>('now_micros')
/// // ... do work ...
/// const end = await invoke<number>('now_micros')
/// const elapsedMicros = end - start
/// ```
#[tauri::command]
fn now_micros() -> u64 {
    let epoch = EPOCH.get_or_init(Instant::now);
    epoch.elapsed().as_micros() as u64
}

// =============================================================================
// TAURI APPLICATION
// =============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // CrabNebula DevTools - initialize early for full instrumentation
    #[cfg(debug_assertions)]
    let devtools = tauri_plugin_devtools::init();

    let mut builder = tauri::Builder::default();

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(devtools);
    }

    builder
        // Terminal server manager state
        .manage(Arc::new(TerminalServerManager::default()))
        // Theia IDE server manager state
        .manage(Arc::new(TheiaServerManager::default()))
        // Setup hook for initialization
        .setup(|app| {
            log::info!("TMNL app starting...");

            // Initialize window pool in background thread
            // Must be done from setup(), not from a command, to avoid WebView2 deadlock on Windows
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    // Wait for event loop to be fully running
                    std::thread::sleep(std::time::Duration::from_millis(1000));

                    log::info!("Initializing window pool...");
                    // Create 1 pool window - each WebView2 instance uses ~80MB+ memory
                    // even when hidden. Replenishment happens after each use.
                    match window_manager::create_pool_window_from_setup(&handle) {
                        Ok(label) => log::info!("Created pool window: {}", label),
                        Err(e) => log::warn!("Failed to create pool window: {:?}", e),
                    }
                    log::info!("Window pool initialization complete");
                });
            }

            // Auto-start terminal server in development
            #[cfg(debug_assertions)]
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    // Small delay to let the app initialize
                    std::thread::sleep(std::time::Duration::from_millis(500));

                    let manager = handle.state::<Arc<TerminalServerManager>>();
                    match manager.start(terminal_server::TerminalBackend::Pty) {
                        Ok(pid) => log::info!("Auto-started terminal server (PID: {})", pid),
                        Err(e) => log::warn!("Failed to auto-start terminal server: {}", e),
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Timing
            now_micros,
            // Terminal server
            terminal_server_start,
            terminal_server_stop,
            terminal_server_status,
            terminal_server_restart,
            // Theia IDE server
            theia_server_start,
            theia_server_stop,
            theia_server_status,
            theia_server_restart,
            // FileBrowser
            fs_list_directory,
            fs_scan_directory,
            fs_read_file,
            fs_write_file,
            fs_delete_file,
            fs_rename_file,
            fs_copy_file,
            fs_create_directory,
            fs_file_metadata,
            fs_compute_hash,
            // Window Manager
            create_testbed_window,
            focus_window,
            close_window,
            list_windows,
            get_or_focus_testbed_window,
            emit_to_all_windows,
            emit_to_window,
            // Window Pool (sub-second window opening)
            init_window_pool,
            get_pool_status,
            open_testbed_window_fast,
            // Window Controls
            minimize_window,
            unminimize_window,
            maximize_window,
            unmaximize_window,
            set_fullscreen,
            toggle_fullscreen,
            get_window_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread::sleep;
    use std::time::Duration;

    /// H1: now_micros returns monotonically increasing values
    #[test]
    fn test_monotonic() {
        let t1 = now_micros();
        let t2 = now_micros();
        let t3 = now_micros();

        assert!(t2 >= t1, "t2 ({}) should be >= t1 ({})", t2, t1);
        assert!(t3 >= t2, "t3 ({}) should be >= t2 ({})", t3, t2);
    }

    /// H2: Resolution is sufficient to measure 1ms sleep (~1000μs)
    #[test]
    fn test_resolution() {
        let before = now_micros();
        sleep(Duration::from_millis(1));
        let after = now_micros();

        let delta = after - before;
        // Should be at least 900μs (allowing some scheduler variance)
        assert!(
            delta >= 900,
            "Delta should be at least 900μs for 1ms sleep, got {}μs",
            delta
        );
        // Should not exceed 5000μs (5ms) for a 1ms sleep (generous for CI)
        assert!(
            delta < 5000,
            "Delta should be < 5000μs for 1ms sleep, got {}μs",
            delta
        );
    }

    /// H3: Epoch is stable across calls (same Instant instance)
    #[test]
    fn test_epoch_stability() {
        let _ = now_micros(); // Initialize epoch
        let epoch_ptr = EPOCH.get().unwrap() as *const Instant;

        let _ = now_micros();
        let epoch_ptr2 = EPOCH.get().unwrap() as *const Instant;

        assert_eq!(
            epoch_ptr, epoch_ptr2,
            "Epoch should be the same Instant instance across calls"
        );
    }

    /// H4: Rapid successive calls show sub-millisecond resolution
    #[test]
    fn test_sub_millisecond() {
        let mut deltas = Vec::with_capacity(100);

        for _ in 0..100 {
            let t1 = now_micros();
            let t2 = now_micros();
            deltas.push(t2 - t1);
        }

        // At least some deltas should be non-zero but < 1000μs
        let sub_ms_count = deltas.iter().filter(|&&d| d > 0 && d < 1000).count();
        assert!(
            sub_ms_count > 0,
            "Should have some sub-millisecond deltas, got {:?}",
            deltas
        );
    }
}
