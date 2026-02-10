use once_cell::sync::Lazy;
use rustler::NifResult;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;

static REGISTRY: Lazy<Mutex<HashMap<String, Value>>> = Lazy::new(|| Mutex::new(HashMap::new()));

#[rustler::nif]
fn nif_version() -> &'static str {
    "0.1.0"
}

#[rustler::nif(schedule = "DirtyCpu")]
fn runtime_ping(payload: String) -> NifResult<String> {
    Ok(format!("ava-runtime:{payload}"))
}

#[rustler::nif(schedule = "DirtyCpu")]
fn register_spec_json(spec_json: String) -> Result<String, String> {
    let payload: Value = serde_json::from_str(&spec_json).map_err(|e| format!("invalid_json:{e}"))?;

    let view_id = payload
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "missing_id".to_string())?
        .to_string();

    let mut registry = REGISTRY
        .lock()
        .map_err(|_| "registry_lock_poisoned".to_string())?;

    registry.insert(view_id.clone(), payload);

    Ok(format!("registered:{view_id}"))
}

#[rustler::nif]
fn invalidate_view(view_id: String) -> Result<String, String> {
    let registry = REGISTRY
        .lock()
        .map_err(|_| "registry_lock_poisoned".to_string())?;

    if registry.contains_key(&view_id) {
        Ok(format!("invalidated:{view_id}"))
    } else {
        Err(format!("view_not_found:{view_id}"))
    }
}

rustler::init!("Elixir.AvaElixir.Native");
