//! Dataflow worker thread — bridges crossbeam channels to differential-dataflow.
//!
//! The worker runs on a dedicated OS thread (not async). It owns:
//! - A timely dataflow computation (`execute_directly`)
//! - InputSessions for each signal kind
//! - A ProbeHandle for progress tracking
//!
//! The main loop:
//! 1. `cmd_rx.try_recv()` — process commands (Insert, Remove, AdvanceTime, Shutdown)
//! 2. `worker.step()` — drive computation forward
//! 3. On AdvanceTime: advance all inputs, flush, step until probe catches up
//!
//! Results flow out via `result_tx` from `inspect()` callbacks in the graph.

use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

use crossbeam_channel::{bounded, unbounded, Receiver, Sender, TryRecvError};

use ava_fusion::join_path::JoinPathEntryV2;

use crate::dataflow::graph::build_dataflow_graph;
use crate::dataflow::{DataflowCommand, FusionResult, Observation};

// ---------------------------------------------------------------------------
// Signal kind routing table
// ---------------------------------------------------------------------------

/// Maps source_id strings (from DataflowCommand) to their signal kind key
/// used in the InputSession map. Built from the join path configs at startup.
fn build_source_routing(join_paths: &[JoinPathEntryV2]) -> HashMap<String, String> {
    let mut routing = HashMap::new();
    for jp in join_paths {
        // Map the serialized signal kind to the graph key.
        let left_key = format!("{:?}", jp.left.signal_kind);
        let right_key = format!("{:?}", jp.right.signal_kind);

        // Also create lowercase variants for flexible source_id matching.
        let left_lower = format!("{:?}", jp.left.signal_kind).to_lowercase();
        let right_lower = format!("{:?}", jp.right.signal_kind).to_lowercase();

        routing.insert(left_key.clone(), left_key.clone());
        routing.insert(right_key.clone(), right_key.clone());
        routing.insert(left_lower, left_key);
        routing.insert(right_lower, right_key);
    }
    routing
}

/// Try to resolve a source_id to the signal kind key used in the graph.
fn resolve_source(source_id: &str, routing: &HashMap<String, String>) -> Option<String> {
    // Direct match.
    if let Some(key) = routing.get(source_id) {
        return Some(key.clone());
    }
    // Case-insensitive match.
    let lower = source_id.to_lowercase();
    if let Some(key) = routing.get(&lower) {
        return Some(key.clone());
    }
    // Try partial match on signal kind names.
    for (pattern, key) in routing {
        if pattern.to_lowercase().contains(&lower) || lower.contains(&pattern.to_lowercase()) {
            return Some(key.clone());
        }
    }
    None
}

// ---------------------------------------------------------------------------
// DataflowWorker — lifecycle handle
// ---------------------------------------------------------------------------

/// Handle to the running dataflow worker thread.
///
/// Owns the command sender, result receiver, and thread join handle.
/// Created via `DataflowWorker::new()` which spawns the worker thread.
pub struct DataflowWorker {
    cmd_tx: Sender<DataflowCommand>,
    result_rx: Receiver<FusionResult>,
    thread: Option<thread::JoinHandle<()>>,
    /// Cooperative cancellation flag — set by the actor's on_stop().
    cancel_flag: Arc<AtomicBool>,
}

impl DataflowWorker {
    /// Spawn a new dataflow worker thread with the given join path configs.
    ///
    /// Creates bounded command channel (4096) and unbounded result channel.
    /// The worker thread constructs the dataflow graph and enters its
    /// processing loop.
    pub fn new(join_paths: Vec<JoinPathEntryV2>) -> Self {
        let (cmd_tx, cmd_rx) = bounded::<DataflowCommand>(4096);
        let (result_tx, result_rx) = unbounded::<FusionResult>();
        let cancel_flag = Arc::new(AtomicBool::new(false));
        let worker_cancel = cancel_flag.clone();

        // NOTE: Using std::thread::spawn rather than spawn_blocking
        // because the timely worker runs an indefinite event loop.
        // spawn_blocking is designed for bounded blocking work; this
        // is an unbounded co-process. The cancel_flag provides the
        // cooperative shutdown that spawn_blocking would give us.
        let handle = thread::spawn(move || {
            run_worker(cmd_rx, result_tx, join_paths, worker_cancel);
        });

        Self {
            cmd_tx,
            result_rx,
            thread: Some(handle),
            cancel_flag,
        }
    }

    /// Signal the worker thread to stop cooperatively.
    pub fn request_cancel(&self) {
        self.cancel_flag.store(true, Ordering::Release);
    }

    /// Send a command to the worker thread.
    pub fn send(&self, cmd: DataflowCommand) -> Result<(), crossbeam_channel::SendError<DataflowCommand>> {
        self.cmd_tx.send(cmd)
    }

    /// Drain all available results from the worker.
    ///
    /// Non-blocking: returns immediately with whatever results are available.
    pub fn drain_results(&self) -> Vec<FusionResult> {
        let mut results = Vec::new();
        loop {
            match self.result_rx.try_recv() {
                Ok(result) => results.push(result),
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => break,
            }
        }
        results
    }

    /// Drain results with a timeout, waiting for at least one result.
    ///
    /// Spins with short sleeps until results arrive or the timeout expires.
    /// After first results arrive, waits a brief settling period to collect
    /// any remaining results that are still being delivered through the channel.
    pub fn drain_results_timeout(&self, timeout: std::time::Duration) -> Vec<FusionResult> {
        let start = std::time::Instant::now();
        let mut all_results = Vec::new();

        // Phase 1: Wait for first results.
        loop {
            let batch = self.drain_results();
            if !batch.is_empty() {
                all_results.extend(batch);
                break;
            }
            if start.elapsed() >= timeout {
                return all_results;
            }
            thread::sleep(std::time::Duration::from_millis(1));
        }

        // Phase 2: Brief settling — collect any stragglers.
        let settle_deadline = std::time::Instant::now() + std::time::Duration::from_millis(50);
        while std::time::Instant::now() < settle_deadline {
            let batch = self.drain_results();
            if !batch.is_empty() {
                all_results.extend(batch);
            }
            thread::sleep(std::time::Duration::from_millis(1));
        }

        all_results
    }

    /// Shut down the worker thread and join it.
    ///
    /// Sends a Shutdown command (if channel is still open) and waits
    /// for the thread to exit.
    pub fn shutdown(&mut self) {
        // Try to send shutdown; ignore errors (thread may have already exited).
        let _ = self.cmd_tx.send(DataflowCommand::Shutdown);

        if let Some(handle) = self.thread.take() {
            let _ = handle.join();
        }
    }
}

impl Drop for DataflowWorker {
    fn drop(&mut self) {
        self.shutdown();
    }
}

// ---------------------------------------------------------------------------
// run_worker — the main worker thread function
// ---------------------------------------------------------------------------

/// Main worker loop running inside `timely::execute_directly`.
///
/// 1. Builds the dataflow graph from join_paths
/// 2. Enters command processing loop
/// 3. On Insert: create Observation, insert into appropriate InputSession
/// 4. On Remove: remove from InputSession
/// 5. On AdvanceTime: advance all inputs, flush, step until probe catches up
/// 6. On Shutdown: break
fn run_worker(
    cmd_rx: Receiver<DataflowCommand>,
    result_tx: Sender<FusionResult>,
    join_paths: Vec<JoinPathEntryV2>,
    cancel_flag: Arc<AtomicBool>,
) {
    // Build the source routing table before entering timely.
    let source_routing = build_source_routing(&join_paths);

    timely::execute_directly(move |worker| {
        // Build the dataflow graph inside the worker's scope.
        let mut handles = worker.dataflow(|scope| {
            build_dataflow_graph(scope, &join_paths, result_tx)
        });

        let mut current_time: u64 = 0;
        let mut late_arrivals_dropped: u64 = 0;

        // Main processing loop.
        loop {
            // Check cooperative cancel flag FIRST (from supervisor shutdown).
            if cancel_flag.load(Ordering::Acquire) {
                tracing::info!("Worker received cancel signal, exiting");
                return;
            }

            // Process all pending commands.
            loop {
                match cmd_rx.try_recv() {
                    Ok(DataflowCommand::Insert {
                        source_id,
                        key,
                        value,
                        timestamp_ms,
                        lat_deg,
                        lon_deg,
                    }) => {
                        // Late arrival detection: if we've already advanced past
                        // this observation's time window, drop it.
                        let obs_window = (timestamp_ms as u64) / 60000; // 60s windows
                        if current_time > 0 && obs_window < current_time {
                            tracing::debug!(
                                source = %source_id,
                                obs_window,
                                current_time,
                                "Dropped late arrival"
                            );
                            late_arrivals_dropped += 1;
                            continue;
                        }

                        if let Some(input_key) = resolve_source(&source_id, &source_routing) {
                            if let Some(input) = handles.inputs.get_mut(&input_key) {
                                // Convert f64 degrees to i64 micro-degrees for Ord compliance.
                                let lat_microdeg = lat_deg.map(|d| (d * 1_000_000.0) as i64);
                                let lon_microdeg = lon_deg.map(|d| (d * 1_000_000.0) as i64);
                                let obs = Observation {
                                    key: key.clone(),
                                    source_id: source_id.clone(),
                                    payload_hash: hash_bytes(&value),
                                    lat_microdeg,
                                    lon_microdeg,
                                };
                                input.insert((key, obs));
                            }
                        }
                    }
                    Ok(DataflowCommand::Remove {
                        source_id,
                        key,
                        value,
                    }) => {
                        if let Some(input_key) = resolve_source(&source_id, &source_routing) {
                            if let Some(input) = handles.inputs.get_mut(&input_key) {
                                let obs = Observation {
                                    key: key.clone(),
                                    source_id: source_id.clone(),
                                    payload_hash: hash_bytes(&value),
                                    lat_microdeg: None,
                                    lon_microdeg: None,
                                };
                                input.remove((key, obs));
                            }
                        }
                    }
                    Ok(DataflowCommand::AdvanceTime(new_time)) => {
                        current_time = new_time;
                        // Advance all inputs to the new time and flush.
                        for input in handles.inputs.values_mut() {
                            input.advance_to(current_time);
                            input.flush();
                        }
                        // Step until the probe confirms all computation
                        // for times < current_time is complete.
                        while handles.probe.less_than(&current_time) {
                            worker.step();
                        }
                    }
                    Ok(DataflowCommand::Shutdown) => {
                        if late_arrivals_dropped > 0 {
                            tracing::info!(late_arrivals_dropped, "Worker shutting down");
                        }
                        return; // Exit the timely closure.
                    }
                    Err(TryRecvError::Empty) => break,
                    Err(TryRecvError::Disconnected) => {
                        if late_arrivals_dropped > 0 {
                            tracing::info!(late_arrivals_dropped, "Worker disconnected");
                        }
                        return;
                    }
                }
            }

            // Step the worker to drive any pending computation.
            worker.step();

            // Brief yield to avoid spinning.
            std::thread::yield_now();
        }
    });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Hash a byte slice to a u64 for Observation.payload_hash.
fn hash_bytes(data: &[u8]) -> u64 {
    let mut hasher = DefaultHasher::new();
    data.hash(&mut hasher);
    hasher.finish()
}
