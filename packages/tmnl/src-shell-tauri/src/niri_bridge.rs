//! Niri event bridge — subscribes to niri EventStream and forwards events
//! to the Tauri frontend via the event system.

use tauri::{AppHandle, Emitter};
use tmnl_shared::niri::NiriClient;

/// Start the niri event bridge.
///
/// This runs in a dedicated thread, subscribing to niri's EventStream
/// and forwarding events to the frontend via `tauri::AppHandle::emit()`.
pub fn start_event_bridge(app: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    log::info!("Starting niri event bridge...");

    let client = match NiriClient::connect() {
        Ok(c) => c,
        Err(e) => {
            log::warn!("Could not connect to niri: {} — workspace indicators will be static", e);
            return Ok(());
        }
    };

    let mut reader = client.subscribe_events()
        .map_err(|e| format!("Failed to subscribe to niri events: {}", e))?;

    log::info!("Subscribed to niri EventStream");

    loop {
        match reader.next_event() {
            Ok(event) => {
                // Serialize the event and emit to frontend
                if let Ok(json) = serde_json::to_value(&event) {
                    if let Err(e) = app.emit("niri-event", json) {
                        log::error!("Failed to emit niri event: {}", e);
                    }
                }
            }
            Err(e) => {
                log::error!("Niri event stream error: {} — will attempt reconnect", e);
                // Wait before reconnecting
                std::thread::sleep(std::time::Duration::from_secs(2));
                
                // Try to reconnect
                match NiriClient::connect() {
                    Ok(new_client) => {
                        match new_client.subscribe_events() {
                            Ok(new_reader) => {
                                reader = new_reader;
                                log::info!("Reconnected to niri EventStream");
                                continue;
                            }
                            Err(e) => {
                                log::error!("Failed to resubscribe: {}", e);
                                return Ok(());
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to reconnect to niri: {}", e);
                        return Ok(());
                    }
                }
            }
        }
    }
}
