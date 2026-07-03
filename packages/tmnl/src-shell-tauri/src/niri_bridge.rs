//! Compositor event bridge.
//!
//! Niri exposes a push EventStream; DriftWM currently exposes a throttled state
//! file (`$XDG_RUNTIME_DIR/driftwm/state`) and no subscription stream. This
//! bridge chooses DriftWM first when explicit override/session/live-state signals
//! identify it, otherwise it uses niri and falls back to DriftWM polling.

use tauri::{AppHandle, Emitter};
use tmnl_shared::{driftwm::DriftClient, niri::NiriClient};

/// Start the compositor event bridge.
pub fn start_event_bridge(app: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    log::info!("Starting compositor event bridge...");

    if DriftClient::should_prefer() {
        return start_driftwm_poll_bridge(app);
    }

    match NiriClient::connect() {
        Ok(client) => match start_niri_event_bridge(app.clone(), client) {
            Ok(()) => {
                log::warn!("Niri EventStream ended — falling back to DriftWM polling");
                start_driftwm_poll_bridge(app)
            }
            Err(e) => {
                log::warn!(
                    "Niri EventStream failed: {} — falling back to DriftWM polling",
                    e
                );
                start_driftwm_poll_bridge(app)
            }
        },
        Err(e) => {
            log::warn!(
                "Could not connect to niri: {} — falling back to DriftWM polling",
                e
            );
            start_driftwm_poll_bridge(app)
        }
    }
}

fn start_niri_event_bridge(
    app: AppHandle,
    client: NiriClient,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut reader = client
        .subscribe_events()
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
                    Ok(new_client) => match new_client.subscribe_events() {
                        Ok(new_reader) => {
                            reader = new_reader;
                            log::info!("Reconnected to niri EventStream");
                            continue;
                        }
                        Err(e) => {
                            log::error!("Failed to resubscribe: {}", e);
                            return Ok(());
                        }
                    },
                    Err(e) => {
                        log::error!("Failed to reconnect to niri: {}", e);
                        return Ok(());
                    }
                }
            }
        }
    }
}

fn start_driftwm_poll_bridge(app: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    log::info!("Starting DriftWM state-file poll bridge...");

    let mut last_json: Option<serde_json::Value> = None;

    loop {
        match DriftClient::read_state() {
            Ok(state) => {
                let json = serde_json::to_value(&state)?;
                if last_json.as_ref() != Some(&json) {
                    if let Err(e) = app.emit("driftwm-state", json.clone()) {
                        log::error!("Failed to emit driftwm-state: {}", e);
                    }
                    last_json = Some(json);
                }
            }
            Err(e) => {
                // The bar may start before the compositor has written its first
                // state file. Keep polling rather than permanently downgrading.
                log::debug!("DriftWM state unavailable: {}", e);
            }
        }

        std::thread::sleep(std::time::Duration::from_millis(500));
    }
}
