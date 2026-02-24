//! Supervision tree wiring for the Tsingou fusion pipeline.
//!
//! Defines the [`AppSpec`] for the complete fusion pipeline:
//!
//! ```text
//! AppSpec("tsingou-fusion")
//! ├── sensor-adsb-feed       [Restart, OneForOne semantics]
//! ├── sensor-ais-feed        [Restart, OneForOne semantics]
//! ├── sensor-sdr-iq-feed     [Restart, OneForOne semantics]
//! ├── sensor-osint-feed      [Restart, OneForOne semantics]
//! ├── fusion-tier1-hard-key  [Restart, OneForAll semantics]
//! ├── fusion-tier2-soft-key  [Restart, OneForAll semantics]
//! ├── fusion-tier3-derived   [Restart, depends_on tier1+tier2]
//! ├── alarm-evaluator        [Restart]
//! ├── track-manager          [Restart]
//! ├── absence-detector       [Restart]
//! └── entity-resolver        [Restart(max 5), singleton via NameRegistry]
//! ```
//!
//! The top-level AppSpec uses `OneForOne` restart policy. Individual child
//! restart strategies and dependency ordering enforce the correct semantics
//! from the synthesis document (TSGC-RES-001 §2.3).

use std::sync::Arc;
use std::time::Duration;

use ava_fusion::{FusionTier, JoinPathEntryV2, JoinPathId, SignalKind, SignalSourceId};
use asupersync::app::AppSpec;
use asupersync::cx::{RegistryCap, RegistryHandle};
use asupersync::gen_server::named_gen_server_start;
use asupersync::supervision::{
    BackoffStrategy, ChildSpec, NameCollisionPolicy, NameRegistrationPolicy,
    RestartConfig, RestartPolicy, SupervisionStrategy,
};
use asupersync::types::Budget;

use crate::actors::{
    AbsenceDetector, AbsenceInfo, AlarmEvaluator, EntityResolver, FusionEngine,
    SensorIngestor, TrackManager,
};

// ---------------------------------------------------------------------------
// Pipeline configuration
// ---------------------------------------------------------------------------

/// Configuration for a single sensor ingestor child.
#[derive(Debug, Clone)]
pub struct SensorConfig {
    pub source_id: SignalSourceId,
    pub signal_kind: SignalKind,
    pub max_buffer_size: usize,
}

/// Configuration for a single fusion engine child.
#[derive(Debug, Clone)]
pub struct FusionTierConfig {
    pub name: String,
    pub tier: FusionTier,
    pub join_paths: Vec<JoinPathId>,
    /// Full join path configs for dataflow graph construction.
    /// Empty vec = no dataflow worker (configs populated at runtime).
    pub join_path_configs: Vec<JoinPathEntryV2>,
}

/// Top-level pipeline configuration.
#[derive(Debug, Clone)]
pub struct PipelineConfig {
    /// Sensor sources to ingest.
    pub sensors: Vec<SensorConfig>,
    /// Fusion tiers to run.
    pub fusion_tiers: Vec<FusionTierConfig>,
    /// Name for the alarm evaluator.
    pub alarm_evaluator_name: String,
    /// Name for the track manager.
    pub track_manager_name: String,
    /// Name for the absence detector.
    pub absence_detector_name: String,
    /// Name for the entity resolver (also the registry key).
    pub entity_resolver_name: String,
    /// GenServer mailbox capacity.
    pub mailbox_capacity: usize,
    /// Absence detector evaluation interval in seconds.
    /// Set to 0 to disable self-scheduling (external ticks only).
    pub eval_interval_secs: u64,
}

impl Default for PipelineConfig {
    fn default() -> Self {
        Self {
            sensors: vec![
                SensorConfig {
                    source_id: SignalSourceId::new("adsb-feed"),
                    signal_kind: SignalKind::AdsB,
                    max_buffer_size: 4096,
                },
                SensorConfig {
                    source_id: SignalSourceId::new("ais-feed"),
                    signal_kind: SignalKind::Ais,
                    max_buffer_size: 4096,
                },
                SensorConfig {
                    source_id: SignalSourceId::new("sdr-iq-feed"),
                    signal_kind: SignalKind::Sdr,
                    max_buffer_size: 2048,
                },
                SensorConfig {
                    source_id: SignalSourceId::new("osint-feed"),
                    signal_kind: SignalKind::Osint,
                    max_buffer_size: 1024,
                },
            ],
            fusion_tiers: vec![
                FusionTierConfig {
                    name: "tier1-hard-key".into(),
                    tier: FusionTier::Tier1Kinematic,
                    join_paths: vec![JoinPathId::new("identity-join")],
                    join_path_configs: vec![],
                },
                FusionTierConfig {
                    name: "tier2-soft-key".into(),
                    tier: FusionTier::Tier2Attribute,
                    join_paths: vec![
                        JoinPathId::new("spatial-join"),
                        JoinPathId::new("temporal-join"),
                    ],
                    join_path_configs: vec![],
                },
                FusionTierConfig {
                    name: "tier3-derived".into(),
                    tier: FusionTier::Tier3Behavioral,
                    join_paths: vec![JoinPathId::new("statistical-join")],
                    join_path_configs: vec![],
                },
            ],
            alarm_evaluator_name: "isg-alarms".into(),
            track_manager_name: "all-tracks".into(),
            absence_detector_name: "esr-monitor".into(),
            entity_resolver_name: "entity-resolver".into(),
            mailbox_capacity: 256,
            eval_interval_secs: 5,
        }
    }
}

// ---------------------------------------------------------------------------
// Restart configurations
// ---------------------------------------------------------------------------

/// Standard restart config: 3 restarts / 60s window, exponential backoff.
fn standard_restart() -> RestartConfig {
    RestartConfig {
        max_restarts: 3,
        window: Duration::from_secs(60),
        backoff: BackoffStrategy::Exponential {
            initial: Duration::from_millis(100),
            max: Duration::from_secs(10),
            multiplier: 2.0,
        },
        restart_cost: 0,
        min_remaining_for_restart: None,
        min_polls_for_restart: 0,
    }
}

/// Conservative restart config for singletons: 5 restarts / 120s window.
fn singleton_restart() -> RestartConfig {
    RestartConfig {
        max_restarts: 5,
        window: Duration::from_secs(120),
        backoff: BackoffStrategy::Exponential {
            initial: Duration::from_millis(200),
            max: Duration::from_secs(30),
            multiplier: 2.0,
        },
        restart_cost: 0,
        min_remaining_for_restart: None,
        min_polls_for_restart: 0,
    }
}

// ---------------------------------------------------------------------------
// Pipeline builder
// ---------------------------------------------------------------------------

/// Build the complete Tsingou fusion pipeline supervision tree.
///
/// Returns an [`AppSpec`] ready to be compiled and started via
/// `app.start(&mut state, &cx, root_region)`.
///
/// # Registry
///
/// The `registry` parameter is required for the EntityResolver singleton.
/// Pass the same registry handle that the runtime uses for name lookups
/// via `Cx::whereis()`.
pub fn build_pipeline(
    config: PipelineConfig,
    registry: Arc<parking_lot::Mutex<asupersync::cx::NameRegistry>>,
) -> AppSpec {
    let mailbox_cap = config.mailbox_capacity;

    // Build a RegistryHandle from the Arc<Mutex<NameRegistry>>.
    // parking_lot::Mutex<NameRegistry> implements RegistryCap via blanket impl.
    let registry_handle = RegistryHandle::new(
        registry.clone() as Arc<dyn RegistryCap>,
    );

    let mut app = AppSpec::new("tsingou-fusion")
        .with_restart_policy(RestartPolicy::OneForOne)
        .with_registry(registry_handle);

    // -----------------------------------------------------------------------
    // 1. Sensor children [OneForOne — independent per-source restart]
    // -----------------------------------------------------------------------
    for sensor in &config.sensors {
        app = app.child(sensor_child(sensor, mailbox_cap));
    }

    // -----------------------------------------------------------------------
    // 2. Fusion children [OneForAll — correlated restart on any failure]
    //
    // NOTE: True OneForAll semantics require a nested supervisor. Since
    // AppSpec uses a flat child list, the OneForAll behavior is documented
    // but must be enforced via a nested SupervisorBuilder ChildStart factory
    // in the production deployment. For now, individual restart strategies
    // and dependency ordering provide the correct startup semantics.
    // -----------------------------------------------------------------------
    for tier_config in &config.fusion_tiers {
        app = app.child(fusion_child(tier_config, mailbox_cap));
    }

    // -----------------------------------------------------------------------
    // 3. Evaluation children [OneForOne — startup after fusion tiers]
    //
    // depends_on enforces topological start ordering: evaluation actors
    // wait for their upstream data producers to be ready.
    // -----------------------------------------------------------------------
    app = app
        .child(
            alarm_evaluator_child(&config.alarm_evaluator_name, mailbox_cap)
                .depends_on("fusion-tier1-hard-key")
                .depends_on("fusion-tier2-soft-key")
                .depends_on("fusion-tier3-derived")
        )
        .child(
            track_manager_child(&config.track_manager_name, mailbox_cap)
                .depends_on("fusion-tier1-hard-key")
        )
        .child(
            absence_detector_child(
                &config.absence_detector_name,
                mailbox_cap,
                config.eval_interval_secs,
            )
                .depends_on("sensor-adsb-feed")
                .depends_on("sensor-ais-feed")
        );

    // -----------------------------------------------------------------------
    // 4. Entity resolver [Restart(max 5), singleton via NameRegistry]
    // -----------------------------------------------------------------------
    let resolver_name = config.entity_resolver_name.clone();
    let resolver_name_for_factory = resolver_name.clone();

    let entity_resolver_child = ChildSpec::new(
        "entity-resolver",
        named_gen_server_start(
            registry,
            resolver_name.clone(),
            mailbox_cap,
            move || EntityResolver::new(resolver_name_for_factory.clone()),
        ),
    )
    .with_restart(SupervisionStrategy::Restart(singleton_restart()))
    .with_shutdown_budget(Budget::MINIMAL)
    .with_registration(NameRegistrationPolicy::Register {
        name: resolver_name,
        collision: NameCollisionPolicy::Fail,
    });

    app = app.child(entity_resolver_child);

    app
}

// ---------------------------------------------------------------------------
// Child spec factories
// ---------------------------------------------------------------------------

/// Create a ChildSpec for a sensor ingestor.
fn sensor_child(sensor: &SensorConfig, mailbox_cap: usize) -> ChildSpec {
    let source_id = sensor.source_id.clone();
    let signal_kind = sensor.signal_kind;
    let max_buf = sensor.max_buffer_size;

    ChildSpec::new(
        format!("sensor-{}", source_id),
        move |scope: &asupersync::cx::Scope<'static, asupersync::types::policy::FailFast>,
              state: &mut asupersync::runtime::RuntimeState,
              cx: &asupersync::cx::Cx| {
            let server = SensorIngestor::new(source_id.clone(), signal_kind, max_buf);
            let (handle, stored) = scope.spawn_gen_server(state, cx, server, mailbox_cap)?;
            let task_id = handle.task_id();
            state.store_spawned_task(task_id, stored);
            Ok(task_id)
        },
    )
    .with_restart(SupervisionStrategy::Restart(standard_restart()))
    .with_shutdown_budget(Budget::MINIMAL)
}

/// Create a ChildSpec for a fusion engine tier.
fn fusion_child(tier_config: &FusionTierConfig, mailbox_cap: usize) -> ChildSpec {
    let name = tier_config.name.clone();
    let tier = tier_config.tier;
    let join_paths = tier_config.join_paths.clone();
    let join_path_configs = tier_config.join_path_configs.clone();

    let mut child = ChildSpec::new(
        format!("fusion-{}", name),
        move |scope: &asupersync::cx::Scope<'static, asupersync::types::policy::FailFast>,
              state: &mut asupersync::runtime::RuntimeState,
              cx: &asupersync::cx::Cx| {
            let server = FusionEngine::new(name.clone(), tier, join_paths.clone(), join_path_configs.clone());
            let (handle, stored) = scope.spawn_gen_server(state, cx, server, mailbox_cap)?;
            let task_id = handle.task_id();
            state.store_spawned_task(task_id, stored);
            Ok(task_id)
        },
    )
    .with_restart(SupervisionStrategy::Restart(standard_restart()))
    .with_shutdown_budget(Budget::MINIMAL);

    // Tier3 depends on tier1 and tier2 being started first.
    if tier == FusionTier::Tier3Behavioral {
        child = child
            .depends_on("fusion-tier1-hard-key")
            .depends_on("fusion-tier2-soft-key");
    }

    child
}

/// Create a ChildSpec for the alarm evaluator.
fn alarm_evaluator_child(name: &str, mailbox_cap: usize) -> ChildSpec {
    let name = name.to_owned();
    ChildSpec::new(
        "alarm-evaluator",
        move |scope: &asupersync::cx::Scope<'static, asupersync::types::policy::FailFast>,
              state: &mut asupersync::runtime::RuntimeState,
              cx: &asupersync::cx::Cx| {
            let server = AlarmEvaluator::new(name.clone());
            let (handle, stored) = scope.spawn_gen_server(state, cx, server, mailbox_cap)?;
            let task_id = handle.task_id();
            state.store_spawned_task(task_id, stored);
            Ok(task_id)
        },
    )
    .with_restart(SupervisionStrategy::Restart(standard_restart()))
    .with_shutdown_budget(Budget::MINIMAL)
}

/// Create a ChildSpec for the track manager.
fn track_manager_child(name: &str, mailbox_cap: usize) -> ChildSpec {
    let name = name.to_owned();
    ChildSpec::new(
        "track-manager",
        move |scope: &asupersync::cx::Scope<'static, asupersync::types::policy::FailFast>,
              state: &mut asupersync::runtime::RuntimeState,
              cx: &asupersync::cx::Cx| {
            let server = TrackManager::new(name.clone());
            let (handle, stored) = scope.spawn_gen_server(state, cx, server, mailbox_cap)?;
            let task_id = handle.task_id();
            state.store_spawned_task(task_id, stored);
            Ok(task_id)
        },
    )
    .with_restart(SupervisionStrategy::Restart(standard_restart()))
    .with_shutdown_budget(Budget::MINIMAL)
}

/// Create a ChildSpec for the absence detector.
///
/// When `eval_interval_secs > 0`, spawns a background ticker thread that
/// sends periodic `EvaluationTick` messages via `GenServerRef::try_info()`.
/// The ticker thread exits when the server stops (try_info returns Err or
/// is_alive returns false), ensuring clean lifecycle on supervisor restart.
///
/// When `eval_interval_secs == 0`, no ticker is spawned — the actor relies
/// on external `EvaluationTick` messages (useful for deterministic testing).
fn absence_detector_child(
    name: &str,
    mailbox_cap: usize,
    eval_interval_secs: u64,
) -> ChildSpec {
    let name = name.to_owned();
    ChildSpec::new(
        "absence-detector",
        move |scope: &asupersync::cx::Scope<'static, asupersync::types::policy::FailFast>,
              state: &mut asupersync::runtime::RuntimeState,
              cx: &asupersync::cx::Cx| {
            let server = AbsenceDetector::new(name.clone());
            let (handle, stored) = scope.spawn_gen_server(state, cx, server, mailbox_cap)?;
            let task_id = handle.task_id();
            let server_ref = handle.server_ref();
            state.store_spawned_task(task_id, stored);

            // Self-scheduling ticker: sends EvaluationTick at a fixed interval.
            // Uses GenServerRef::try_info() — non-async, no &Cx required.
            // Thread exits when the server stops (natural lifecycle).
            if eval_interval_secs > 0 {
                let interval = Duration::from_secs(eval_interval_secs);
                let ticker_name = format!("absence-ticker-{}", name.clone());
                std::thread::Builder::new()
                    .name(ticker_name)
                    .spawn(move || {
                        let mut tick_id = 0u64;
                        loop {
                            std::thread::sleep(interval);

                            if !server_ref.is_alive() {
                                break;
                            }

                            tick_id += 1;
                            let now_ms = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_millis() as f64;

                            if server_ref.try_info(AbsenceInfo::EvaluationTick {
                                tick_id,
                                current_time_ms: now_ms,
                            }).is_err() {
                                // Server mailbox full or stopped — exit ticker.
                                break;
                            }
                        }
                        tracing::debug!(
                            ticks = tick_id,
                            "AbsenceDetector ticker thread exited"
                        );
                    })
                    .expect("Failed to spawn absence ticker thread");
            }

            Ok(task_id)
        },
    )
    .with_restart(SupervisionStrategy::Restart(standard_restart()))
    .with_shutdown_budget(Budget::MINIMAL)
}
