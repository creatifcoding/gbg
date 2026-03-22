use once_cell::sync::Lazy;
use rustler::{Encoder, Env, LocalPid, NifMap, NifResult, OwnedEnv};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

#[derive(Debug, Clone)]
struct SubscriptionEntry {
    view_id: String,
    cancel: Arc<AtomicBool>,
}

#[derive(NifMap)]
struct ArtifactPayload {
    view_id: String,
    sequence: u64,
}

static REGISTRY: Lazy<Mutex<HashMap<String, Value>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static SUBSCRIPTIONS: Lazy<Mutex<HashMap<String, SubscriptionEntry>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
static NEXT_SUBSCRIPTION_ID: AtomicU64 = AtomicU64::new(1);

mod atoms {
    rustler::atoms! {
        ava_artifact,
        ava_error,
        ava_lagged
    }
}

#[rustler::nif]
fn nif_version() -> &'static str {
    "0.2.0"
}

#[rustler::nif]
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
fn get_spec_json(view_id: String) -> Result<String, String> {
    let registry = REGISTRY
        .lock()
        .map_err(|_| "registry_lock_poisoned".to_string())?;

    let payload = registry
        .get(&view_id)
        .ok_or_else(|| format!("view_not_found:{view_id}"))?;

    serde_json::to_string(payload).map_err(|e| format!("serialize_failed:{e}"))
}

#[rustler::nif]
fn list_specs() -> Result<Vec<String>, String> {
    let registry = REGISTRY
        .lock()
        .map_err(|_| "registry_lock_poisoned".to_string())?;

    let mut ids: Vec<String> = registry.keys().cloned().collect();
    ids.sort();
    Ok(ids)
}

#[rustler::nif(schedule = "DirtyCpu")]
fn invalidate_view(view_id: String) -> Result<String, String> {
    {
        let mut registry = REGISTRY
            .lock()
            .map_err(|_| "registry_lock_poisoned".to_string())?;

        if registry.remove(&view_id).is_none() {
            return Err(format!("view_not_found:{view_id}"));
        }
    }

    let mut subscriptions = SUBSCRIPTIONS
        .lock()
        .map_err(|_| "subscriptions_lock_poisoned".to_string())?;

    subscriptions.retain(|_sub_id, entry| {
        let matches = entry.view_id == view_id;
        if matches {
            entry.cancel.store(true, Ordering::Release);
        }
        !matches
    });

    Ok(format!("invalidated:{view_id}"))
}

#[rustler::nif]
fn subscribe_view(
    env: Env,
    view_id: String,
    interval_ms: u64,
    pid: Option<LocalPid>,
) -> Result<String, String> {
    {
        let registry = REGISTRY
            .lock()
            .map_err(|_| "registry_lock_poisoned".to_string())?;

        if !registry.contains_key(&view_id) {
            return Err(format!("view_not_found:{view_id}"));
        }
    }

    let target_pid = pid.unwrap_or_else(|| env.pid());
    let subscription_id = format!("sub-{}", NEXT_SUBSCRIPTION_ID.fetch_add(1, Ordering::Relaxed));
    let cancel = Arc::new(AtomicBool::new(false));

    {
        let mut subscriptions = SUBSCRIPTIONS
            .lock()
            .map_err(|_| "subscriptions_lock_poisoned".to_string())?;

        subscriptions.insert(
            subscription_id.clone(),
            SubscriptionEntry {
                view_id: view_id.clone(),
                cancel: cancel.clone(),
            },
        );
    }

    let interval_ms = interval_ms.max(10);
    let worker_subscription_id = subscription_id.clone();
    let worker_view_id = view_id;

    thread::spawn(move || {
        let mut sequence: u64 = 0;

        while !cancel.load(Ordering::Relaxed) {
            let mut owned_env = OwnedEnv::new();
            let payload = ArtifactPayload {
                view_id: worker_view_id.clone(),
                sequence,
            };

            let _ = owned_env.send_and_clear(&target_pid, |env| {
                (atoms::ava_artifact(), worker_subscription_id.clone(), payload).encode(env)
            });

            sequence = sequence.wrapping_add(1);
            thread::sleep(Duration::from_millis(interval_ms));
        }
    });

    Ok(subscription_id)
}

#[rustler::nif]
fn unsubscribe(subscription_id: String) -> Result<String, String> {
    let mut subscriptions = SUBSCRIPTIONS
        .lock()
        .map_err(|_| "subscriptions_lock_poisoned".to_string())?;

    match subscriptions.remove(&subscription_id) {
        Some(entry) => {
            entry.cancel.store(true, Ordering::Release);
            Ok(format!("unsubscribed:{subscription_id}"))
        }
        None => Err(format!("subscription_not_found:{subscription_id}")),
    }
}

#[rustler::nif]
fn list_subscriptions() -> Result<Vec<String>, String> {
    let subscriptions = SUBSCRIPTIONS
        .lock()
        .map_err(|_| "subscriptions_lock_poisoned".to_string())?;

    let mut ids: Vec<String> = subscriptions.keys().cloned().collect();
    ids.sort();
    Ok(ids)
}

rustler::init!("Elixir.AvaElixir.Native");
