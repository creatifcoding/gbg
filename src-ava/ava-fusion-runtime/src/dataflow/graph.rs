//! Dataflow graph construction from fusion ontology join paths.
//!
//! Builds a fixed differential-dataflow graph from `Vec<JoinPathEntryV2>`.
//! Each enabled join path becomes a pipeline of differential-dataflow
//! operators matching its tier and join type:
//!
//! - **Tier 1 (Identity)**: Direct equijoin on identifier key (confidence ~0.99)
//! - **Tier 2 (Spatial/Temporal/Spectral)**: `flat_map` blocking -> `join` ->
//!   `consolidate` -> `inspect` with confidence scoring
//! - **Tier 3 (Behavioral/Statistical/Semantic)**: Per-method pipelines using
//!   `reduce`, `iterate`, `filter`, and `join` operators
//!
//! **Trace sharing**: Collections referenced by 2+ join paths are pre-arranged
//! via `arrange_by_key()`. Identity joins use `join_core()` on the shared
//! `Arranged` traces, paying the indexing cost once instead of per-join-path.
//!
//! The graph is constructed once at worker startup and cannot be modified.
//! Data flows dynamically through `InputSession::insert/remove`.

use std::collections::HashMap;

use differential_dataflow::input::InputSession;
use differential_dataflow::operators::arrange::ArrangeByKey;
use differential_dataflow::operators::{Iterate, Join, Reduce};
use timely::dataflow::ProbeHandle;
use timely::dataflow::Scope;

use ava_fusion::join_path::{EnabledState, JoinPathEntryV2, JoinType};
use ava_fusion::SignalKind;

use crate::dataflow::blocking::{
    CompositeKeyConfig, SpatialKeyConfig, SpectralKeyConfig, TemporalKeyConfig,
    extract_composite_key,
};
use crate::dataflow::scoring::{score_dempster_shafer, score_log_odds, score_weighted_average};
use crate::dataflow::{FusionResult, Observation};

// ---------------------------------------------------------------------------
// InputHandle -- typed wrapper for InputSession + signal kind mapping
// ---------------------------------------------------------------------------

/// Key for the input session map: one input per signal kind.
///
/// Multiple join paths reading from the same signal kind share the same
/// InputSession. This matches the architecture design where InputSessions
/// are keyed by `SignalKind`, not by source ID.
fn signal_kind_key(kind: SignalKind) -> String {
    format!("{:?}", kind)
}

// ---------------------------------------------------------------------------
// Graph output: handles returned to the worker loop
// ---------------------------------------------------------------------------

/// Handles returned by `build_dataflow_graph` for the worker loop to use.
pub struct DataflowHandles {
    /// Map of signal_kind_key -> InputSession for feeding data.
    pub inputs: HashMap<String, InputSession<u64, (String, Observation), isize>>,
    /// Probe handle for tracking dataflow progress.
    pub probe: ProbeHandle<u64>,
}

// ---------------------------------------------------------------------------
// Confidence model helpers
// ---------------------------------------------------------------------------

/// Select scoring function based on the confidence_model string from
/// JoinPathEntryV2. Returns a function pointer for WeightedAverage/LogOdds,
/// or a closure for DempsterShafer.
///
/// Possible values: "weightedAverage" (default), "logOdds", "dempsterShafer".
fn compute_confidence(model: &Option<String>, pairs: &[(f64, f64)]) -> f64 {
    match model.as_deref() {
        Some("logOdds") => score_log_odds(pairs),
        Some("dempsterShafer") => score_dempster_shafer(pairs, "standard"),
        _ => score_weighted_average(pairs),
    }
}

/// Compute a base similarity score between two observations for Tier 2.
///
/// Uses a deterministic pseudo-similarity from XOR of payload hashes,
/// mapped to [0.3, 0.95]. In production this would use actual distance
/// metrics (haversine, time delta, frequency separation).
fn tier2_base_score(left: &Observation, right: &Observation) -> f64 {
    let xor = left.payload_hash ^ right.payload_hash;
    let normalized = (xor % 1000) as f64 / 1000.0;
    0.3 + normalized * 0.65
}

// ---------------------------------------------------------------------------
// Blocking config builder
// ---------------------------------------------------------------------------

/// Build a CompositeKeyConfig from the PairBlocking flags on a JoinPathEntryV2.
/// Uses default configs for each enabled dimension.
fn build_blocking_config(jp: &JoinPathEntryV2) -> CompositeKeyConfig {
    let blocking = jp.blocking.as_ref();

    let spatial = if blocking.is_some_and(|b| b.spatial) || jp.join_type == JoinType::Spatial {
        Some(SpatialKeyConfig {
            h3_resolution: 8,
            k_ring: 1,
        })
    } else {
        None
    };

    let temporal = if blocking.is_some_and(|b| b.temporal) || jp.join_type == JoinType::Temporal {
        Some(TemporalKeyConfig {
            window_seconds: 60,
        })
    } else {
        None
    };

    let spectral = if blocking.is_some_and(|b| b.spectral) || jp.join_type == JoinType::Spectral {
        Some(SpectralKeyConfig {
            band_width_mhz: 2.0,
        })
    } else {
        None
    };

    CompositeKeyConfig {
        spatial,
        temporal,
        spectral,
    }
}

// ---------------------------------------------------------------------------
// build_dataflow_graph
// ---------------------------------------------------------------------------

/// Construct the differential-dataflow graph from join path configurations.
///
/// For each enabled `JoinPathEntryV2`:
/// 1. Get or create an `InputSession` for left.signal_kind
/// 2. Get or create an `InputSession` for right.signal_kind
/// 3. Wire the appropriate pipeline based on join_type/tier:
///    - Tier 1: Direct equijoin
///    - Tier 2: flat_map blocking -> join -> consolidate -> inspect(scoring)
///    - Tier 3: Per-method statistical pipelines -> inspect
///
/// Returns `DataflowHandles` containing all input sessions and the probe.
pub fn build_dataflow_graph<S: Scope<Timestamp = u64>>(
    scope: &mut S,
    join_paths: &[JoinPathEntryV2],
    result_tx: crossbeam_channel::Sender<FusionResult>,
) -> DataflowHandles {
    let mut inputs: HashMap<String, InputSession<u64, (String, Observation), isize>> =
        HashMap::new();
    let mut probe = ProbeHandle::new();

    // Collect enabled join paths.
    let enabled_paths: Vec<_> = join_paths
        .iter()
        .filter(|jp| jp.enabled == EnabledState::Enabled)
        .collect();

    if enabled_paths.is_empty() {
        return DataflowHandles { inputs, probe };
    }

    // Phase 1: Create all needed InputSessions.
    let mut needed_kinds = std::collections::HashSet::new();
    for jp in &enabled_paths {
        needed_kinds.insert(jp.left.signal_kind);
        needed_kinds.insert(jp.right.signal_kind);
    }

    let mut collections = HashMap::new();
    for kind in needed_kinds {
        let key = signal_kind_key(kind);
        if !inputs.contains_key(&key) {
            let mut input = InputSession::new();
            let collection = input.to_collection(scope);
            inputs.insert(key.clone(), input);
            collections.insert(key, collection);
        }
    }

    // Phase 1.5: Pre-arrange collections referenced by 2+ join paths.
    //
    // When multiple join paths read from the same source (e.g., ADS-B used by
    // 3 identity joins), `arrange_by_key()` builds the index once. Each
    // `join_core()` call then shares the arranged trace via TraceAgent's
    // internal reference counting, instead of each `join()` independently
    // re-arranging the same data.
    let mut ref_counts: HashMap<String, usize> = HashMap::new();
    for jp in &enabled_paths {
        *ref_counts
            .entry(signal_kind_key(jp.left.signal_kind))
            .or_default() += 1;
        *ref_counts
            .entry(signal_kind_key(jp.right.signal_kind))
            .or_default() += 1;
    }

    let arrangements: HashMap<String, _> = ref_counts
        .iter()
        .filter(|(_, count)| **count >= 2)
        .filter_map(|(key, _)| {
            collections
                .get(key)
                .map(|c| (key.clone(), c.arrange_by_key()))
        })
        .collect();

    // Phase 2: Wire up joins for each enabled path.
    for jp in &enabled_paths {
        let left_key = signal_kind_key(jp.left.signal_kind);
        let right_key = signal_kind_key(jp.right.signal_kind);

        let left_collection = match collections.get(&left_key) {
            Some(c) => c.clone(),
            None => continue,
        };
        let right_collection = match collections.get(&right_key) {
            Some(c) => c.clone(),
            None => continue,
        };

        let join_path_id = jp.id.clone();
        let output_type = jp.output;
        let join_type = jp.join_type;
        let confidence_model = jp.confidence_model.clone();
        let tx = result_tx.clone();

        match join_type {
            // =================================================================
            // Tier 1: Identity -- direct equijoin on the observation key
            // =================================================================
            JoinType::Identity => {
                // Use pre-arranged traces when both sides have arrangements
                // (collections referenced by 2+ join paths). join_core shares
                // the arranged index via TraceAgent reference counting instead
                // of each .join() independently re-arranging the data.
                match (arrangements.get(&left_key), arrangements.get(&right_key)) {
                    (Some(left_arr), Some(right_arr)) => {
                        left_arr
                            .join_core(right_arr, |key, left_obs, right_obs| {
                                Some((key.clone(), (left_obs.clone(), right_obs.clone())))
                            })
                            .inspect(move |&((ref _join_key, (ref left_obs, ref right_obs)), time, diff)| {
                                let result = FusionResult {
                                    join_path_id: join_path_id.clone(),
                                    left_key: left_obs.key.clone(),
                                    right_key: right_obs.key.clone(),
                                    confidence: 0.99,
                                    output_type,
                                    time,
                                    diff: diff as i64,
                                };
                                let _ = tx.send(result);
                            })
                            .probe_with(&mut probe);
                    }
                    _ => {
                        // Fallback: collections referenced by only 1 join path
                        // use regular .join() (arranges internally, no sharing).
                        left_collection
                            .join(&right_collection)
                            .inspect(move |&((ref _join_key, (ref left_obs, ref right_obs)), time, diff)| {
                                let result = FusionResult {
                                    join_path_id: join_path_id.clone(),
                                    left_key: left_obs.key.clone(),
                                    right_key: right_obs.key.clone(),
                                    confidence: 0.99,
                                    output_type,
                                    time,
                                    diff: diff as i64,
                                };
                                let _ = tx.send(result);
                            })
                            .probe_with(&mut probe);
                    }
                }
            }

            // =================================================================
            // Tier 2: Spatial / Temporal / Spectral
            //
            // Pipeline:
            //   1. flat_map: Expand observations into block keys using
            //      blocking.rs functions (H3 + k_ring, time buckets, freq bands)
            //   2. join: Equijoin on the composite block keys
            //   3. consolidate: Eliminate cancelling diffs after join
            //   4. inspect: Compute confidence using scoring.rs functions
            //      and emit FusionResult
            // =================================================================
            JoinType::Spatial | JoinType::Temporal | JoinType::Spectral => {
                let blocking_config = build_blocking_config(jp);
                let left_config = blocking_config.clone();
                let right_config = blocking_config;

                // Step 1: flat_map each collection to (block_key, Observation).
                let left_blocked = left_collection
                    .flat_map(move |(_orig_key, obs)| {
                        let block_keys = extract_composite_key(&obs, &left_config);
                        block_keys
                            .into_iter()
                            .map(move |bk| (bk, obs.clone()))
                            .collect::<Vec<_>>()
                    });

                let right_blocked = right_collection
                    .flat_map(move |(_orig_key, obs)| {
                        let block_keys = extract_composite_key(&obs, &right_config);
                        block_keys
                            .into_iter()
                            .map(move |bk| (bk, obs.clone()))
                            .collect::<Vec<_>>()
                    });

                // Step 2: Join on block keys.
                // Step 3: Consolidate — merges cancelling diffs from the
                // flat_map expansion (k_ring produces N block keys per obs,
                // and some diffs cancel when observations are retracted).
                let joined = left_blocked.join(&right_blocked).consolidate();

                // Step 4: Score and emit.
                let conf_model = confidence_model.clone();
                joined
                    .inspect(move |&((ref _block_key, (ref left_obs, ref right_obs)), time, diff)| {
                        let base = tier2_base_score(left_obs, right_obs);
                        let pairs = [(base, 1.0)];
                        let confidence = compute_confidence(&conf_model, &pairs);

                        let result = FusionResult {
                            join_path_id: join_path_id.clone(),
                            left_key: left_obs.key.clone(),
                            right_key: right_obs.key.clone(),
                            confidence,
                            output_type,
                            time,
                            diff: diff as i64,
                        };
                        let _ = tx.send(result);
                    })
                    .probe_with(&mut probe);
            }

            // =================================================================
            // Tier 3: Semantic / Behavioral / Statistical
            //
            // Each tier3_method gets its own pipeline pattern.
            // Falls back to a simple scored join for Semantic or unrecognized.
            // =================================================================
            JoinType::Semantic | JoinType::Behavioral | JoinType::Statistical => {
                let tier3_method = jp.tier3_method.as_deref();

                match tier3_method {
                    // ---------------------------------------------------------
                    // 3A: Periodicity
                    //
                    // reduce per entity -> inter-arrival stats ->
                    // join for cross-entity comparison on periodicity bucket
                    // ---------------------------------------------------------
                    Some("periodicity") => {
                        // Key by source_id for per-entity reduction.
                        let left_by_entity = left_collection.map(|(_k, obs)| {
                            let entity = obs.source_id.clone();
                            (entity, obs)
                        });
                        let right_by_entity = right_collection.map(|(_k, obs)| {
                            let entity = obs.source_id.clone();
                            (entity, obs)
                        });

                        // Reduce: compute periodicity proxy -> output (bucket_key, entity_key).
                        // Uses payload_hash variance as a proxy for inter-arrival regularity.
                        let left_periodicity = left_by_entity.reduce(
                            |_entity, input: &[(&Observation, isize)], output: &mut Vec<((String, String), isize)>| {
                                let hashes: Vec<u64> = input
                                    .iter()
                                    .filter(|&&(_, d)| d > 0)
                                    .map(|&(obs, _)| obs.payload_hash)
                                    .collect();
                                if hashes.len() < 2 {
                                    return;
                                }
                                let mean = hashes.iter().map(|&h| h as f64).sum::<f64>() / hashes.len() as f64;
                                let variance = hashes
                                    .iter()
                                    .map(|&h| {
                                        let d = h as f64 - mean;
                                        d * d
                                    })
                                    .sum::<f64>()
                                    / hashes.len() as f64;
                                // Low variance = high periodicity.
                                let period_score = 1.0 / (1.0 + (variance / 1e12).sqrt());
                                let bucket = (period_score * 10.0) as u32;
                                let bucket_key = format!("period_{}", bucket);
                                let entity_key = input[0].0.key.clone();
                                output.push(((bucket_key, entity_key), 1isize));
                            },
                        );

                        let right_periodicity = right_by_entity.reduce(
                            |_entity, input: &[(&Observation, isize)], output: &mut Vec<((String, String), isize)>| {
                                let hashes: Vec<u64> = input
                                    .iter()
                                    .filter(|&&(_, d)| d > 0)
                                    .map(|&(obs, _)| obs.payload_hash)
                                    .collect();
                                if hashes.len() < 2 {
                                    return;
                                }
                                let mean = hashes.iter().map(|&h| h as f64).sum::<f64>() / hashes.len() as f64;
                                let variance = hashes
                                    .iter()
                                    .map(|&h| {
                                        let d = h as f64 - mean;
                                        d * d
                                    })
                                    .sum::<f64>()
                                    / hashes.len() as f64;
                                let period_score = 1.0 / (1.0 + (variance / 1e12).sqrt());
                                let bucket = (period_score * 10.0) as u32;
                                let bucket_key = format!("period_{}", bucket);
                                let entity_key = input[0].0.key.clone();
                                output.push(((bucket_key, entity_key), 1isize));
                            },
                        );

                        // Re-key reduce output from (entity, (bucket, entity_key)) to
                        // (bucket, (entity_id, entity_key)).
                        let left_keyed = left_periodicity.map(
                            |(entity, (bucket, ek))| (bucket, (entity, ek)),
                        );
                        let right_keyed = right_periodicity.map(
                            |(entity, (bucket, ek))| (bucket, (entity, ek)),
                        );

                        // Join on periodicity bucket.
                        left_keyed
                            .join(&right_keyed)
                            .inspect(move |&((ref _bucket, ((ref _l_entity, ref l_key), (ref _r_entity, ref r_key))), time, diff)| {
                                let result = FusionResult {
                                    join_path_id: join_path_id.clone(),
                                    left_key: l_key.clone(),
                                    right_key: r_key.clone(),
                                    confidence: 0.55, // Periodicity match.
                                    output_type,
                                    time,
                                    diff: diff as i64,
                                };
                                let _ = tx.send(result);
                            })
                            .probe_with(&mut probe);
                    }

                    // ---------------------------------------------------------
                    // 3B: Co-Occurrence
                    //
                    // join on temporal buckets -> reduce for co-occurrence count
                    // -> inspect (emit pairs with confidence from count)
                    // ---------------------------------------------------------
                    Some("coOccurrence") => {
                        let window_seconds = 300u64; // 5-min windows.

                        // Bucket by temporal window.
                        let left_bucketed = left_collection.map(move |(_k, obs)| {
                            let bucket = obs.payload_hash / (window_seconds * 1000);
                            let bucket_key = format!("cooc_{}", bucket);
                            (bucket_key, obs)
                        });
                        let right_bucketed = right_collection.map(move |(_k, obs)| {
                            let bucket = obs.payload_hash / (window_seconds * 1000);
                            let bucket_key = format!("cooc_{}", bucket);
                            (bucket_key, obs)
                        });

                        // Join on temporal bucket.
                        let joined = left_bucketed.join(&right_bucketed);

                        // Re-key by entity pair and reduce to count co-occurrences.
                        let pair_keyed = joined.map(|(_bucket, (l_obs, r_obs))| {
                            let pair = if l_obs.key <= r_obs.key {
                                format!("{}|{}", l_obs.key, r_obs.key)
                            } else {
                                format!("{}|{}", r_obs.key, l_obs.key)
                            };
                            // Value: (left_key, right_key) for downstream.
                            (pair, (l_obs.key, r_obs.key))
                        });

                        let co_counts = pair_keyed.reduce(
                            |_pair, input: &[(&(String, String), isize)], output: &mut Vec<((String, String, u64), isize)>| {
                                let count: u64 = input
                                    .iter()
                                    .map(|&(_, diff)| diff.max(0) as u64)
                                    .sum();
                                if count > 0 {
                                    let (lk, rk) = input[0].0;
                                    output.push(((lk.clone(), rk.clone(), count), 1isize));
                                }
                            },
                        );

                        // Inspect and emit.
                        co_counts
                            .map(|(pair, (lk, rk, count))| (pair, lk, rk, count))
                            .inspect(move |&((ref _pair, ref lk, ref rk, count), time, diff)| {
                                // Confidence from co-occurrence count.
                                let confidence =
                                    (1.0 - 1.0 / (1.0 + count as f64 * 0.1)).min(0.95);
                                let result = FusionResult {
                                    join_path_id: join_path_id.clone(),
                                    left_key: lk.clone(),
                                    right_key: rk.clone(),
                                    confidence,
                                    output_type,
                                    time,
                                    diff: diff as i64,
                                };
                                let _ = tx.send(result);
                            })
                            .probe_with(&mut probe);
                    }

                    // ---------------------------------------------------------
                    // 3C: Community Detection
                    //
                    // iterate with label propagation -> reduce (min label) ->
                    // consolidate inside loop -> emit community pairs
                    // ---------------------------------------------------------
                    Some("community") => {
                        // Build edge collection from the join.
                        // Uses arrange_by_key trace sharing when available.
                        let edges = match (arrangements.get(&left_key), arrangements.get(&right_key)) {
                            (Some(left_arr), Some(right_arr)) => {
                                left_arr
                                    .join_core(right_arr, |key, left_obs, right_obs| {
                                        Some((key.clone(), (left_obs.clone(), right_obs.clone())))
                                    })
                                    .map(|(_k, (l_obs, r_obs))| (l_obs.key, r_obs.key))
                            }
                            _ => {
                                left_collection
                                    .join(&right_collection)
                                    .map(|(_k, (l_obs, r_obs))| (l_obs.key, r_obs.key))
                            }
                        };

                        // Initial labels: each node labeled with itself.
                        let initial_labels = edges
                            .flat_map(|(l, r)| vec![(l.clone(), l), (r.clone(), r)]);

                        // Label propagation via iterate.
                        let communities = initial_labels.iterate(|labels: &differential_dataflow::VecCollection<_, (String, String), isize>| {
                            let edges_inner = edges.enter(&labels.scope());

                            // Propagate labels along edges.
                            let proposed = labels
                                .map(|(node, label)| (node, label))
                                .join(&edges_inner)
                                .map(|(_node, (label, neighbor))| (neighbor, label));

                            // Combine with existing labels.
                            let all_proposals = labels.concat(&proposed);

                            // Reduce: pick minimum label per node.
                            // Consolidate after reduce to prevent infinite diff
                            // circulation in the iterate loop — required for convergence.
                            all_proposals
                                .reduce(
                                    |_node: &String, input: &[(&String, isize)], output: &mut Vec<(String, isize)>| {
                                        // input is sorted by value (String ord), first is min.
                                        let min_label = input[0].0.clone();
                                        output.push((min_label, 1isize));
                                    },
                                )
                                .consolidate()
                                .map(|(node, label)| (node, label))
                        });

                        // Emit pairs: nodes sharing the same community label.
                        // Re-key by label, reduce to collect members, emit pairs.
                        let by_label = communities.map(|(node, label)| (label, node));
                        let community_pairs = by_label.reduce(
                            |_label: &String, input: &[(&String, isize)], output: &mut Vec<((String, String), isize)>| {
                                let nodes: Vec<&String> = input
                                    .iter()
                                    .filter(|&&(_, d)| d > 0)
                                    .map(|&(n, _)| n)
                                    .collect();
                                for i in 0..nodes.len() {
                                    for j in (i + 1)..nodes.len() {
                                        output.push((
                                            (nodes[i].clone(), nodes[j].clone()),
                                            1isize,
                                        ));
                                    }
                                }
                            },
                        );

                        community_pairs
                            .map(|(label, (lk, rk))| (label, lk, rk))
                            .inspect(move |&((ref _label, ref lk, ref rk), time, diff)| {
                                let result = FusionResult {
                                    join_path_id: join_path_id.clone(),
                                    left_key: lk.clone(),
                                    right_key: rk.clone(),
                                    confidence: 0.6,
                                    output_type,
                                    time,
                                    diff: diff as i64,
                                };
                                let _ = tx.send(result);
                            })
                            .probe_with(&mut probe);
                    }

                    // ---------------------------------------------------------
                    // 3D: Anomaly Coincidence
                    //
                    // reduce for running stats per entity ->
                    // output anomalous observations keyed by time bucket ->
                    // join for coincidence detection
                    // ---------------------------------------------------------
                    Some("anomalyCoincidence") => {
                        // Step 1: Per-entity stats via reduce, flag anomalies.
                        let left_by_entity = left_collection.map(|(_k, obs)| {
                            let entity = obs.key.clone();
                            (entity, obs)
                        });
                        let right_by_entity = right_collection.map(|(_k, obs)| {
                            let entity = obs.key.clone();
                            (entity, obs)
                        });

                        // Reduce: compute stats, emit anomalous obs with time bucket.
                        // Output value: (bucket_key, entity_key) for join.
                        let left_anomalies = left_by_entity.reduce(
                            |_entity, input: &[(&Observation, isize)], output: &mut Vec<((String, String), isize)>| {
                                let values: Vec<u64> = input
                                    .iter()
                                    .filter(|&&(_, d)| d > 0)
                                    .map(|&(obs, _)| obs.payload_hash)
                                    .collect();
                                if values.len() < 2 {
                                    return;
                                }
                                let mean = values.iter().map(|&v| v as f64).sum::<f64>() / values.len() as f64;
                                let variance = values
                                    .iter()
                                    .map(|&v| (v as f64 - mean).powi(2))
                                    .sum::<f64>()
                                    / values.len() as f64;
                                let std_dev = variance.sqrt();
                                if std_dev == 0.0 {
                                    return;
                                }

                                for &(obs, diff) in input.iter() {
                                    if diff > 0 {
                                        let z = ((obs.payload_hash as f64) - mean).abs() / std_dev;
                                        if z >= 3.0 {
                                            let bucket = obs.payload_hash / 60000;
                                            let bucket_key = format!("anom_{}", bucket);
                                            output.push(((bucket_key, obs.key.clone()), 1isize));
                                        }
                                    }
                                }
                            },
                        );

                        let right_anomalies = right_by_entity.reduce(
                            |_entity, input: &[(&Observation, isize)], output: &mut Vec<((String, String), isize)>| {
                                let values: Vec<u64> = input
                                    .iter()
                                    .filter(|&&(_, d)| d > 0)
                                    .map(|&(obs, _)| obs.payload_hash)
                                    .collect();
                                if values.len() < 2 {
                                    return;
                                }
                                let mean = values.iter().map(|&v| v as f64).sum::<f64>() / values.len() as f64;
                                let variance = values
                                    .iter()
                                    .map(|&v| (v as f64 - mean).powi(2))
                                    .sum::<f64>()
                                    / values.len() as f64;
                                let std_dev = variance.sqrt();
                                if std_dev == 0.0 {
                                    return;
                                }

                                for &(obs, diff) in input.iter() {
                                    if diff > 0 {
                                        let z = ((obs.payload_hash as f64) - mean).abs() / std_dev;
                                        if z >= 3.0 {
                                            let bucket = obs.payload_hash / 60000;
                                            let bucket_key = format!("anom_{}", bucket);
                                            output.push(((bucket_key, obs.key.clone()), 1isize));
                                        }
                                    }
                                }
                            },
                        );

                        // Step 2: Re-key by bucket for coincidence join.
                        let left_keyed = left_anomalies.map(
                            |(_entity, (bucket, key))| (bucket, key),
                        );
                        let right_keyed = right_anomalies.map(
                            |(_entity, (bucket, key))| (bucket, key),
                        );

                        // Step 3: Join anomalies on time bucket.
                        left_keyed
                            .join(&right_keyed)
                            .inspect(move |&((ref _bucket, (ref lk, ref rk)), time, diff)| {
                                let result = FusionResult {
                                    join_path_id: join_path_id.clone(),
                                    left_key: lk.clone(),
                                    right_key: rk.clone(),
                                    confidence: 0.45, // Anomaly coincidence base.
                                    output_type,
                                    time,
                                    diff: diff as i64,
                                };
                                let _ = tx.send(result);
                            })
                            .probe_with(&mut probe);
                    }

                    // ---------------------------------------------------------
                    // Fallback: Semantic or unrecognized tier3_method
                    //
                    // Simple scored join with confidence from scoring.rs.
                    // Uses arrange_by_key trace sharing when available.
                    // ---------------------------------------------------------
                    _ => {
                        match (arrangements.get(&left_key), arrangements.get(&right_key)) {
                            (Some(left_arr), Some(right_arr)) => {
                                left_arr
                                    .join_core(right_arr, |key, left_obs, right_obs| {
                                        Some((key.clone(), (left_obs.clone(), right_obs.clone())))
                                    })
                                    .inspect(move |&((ref _join_key, (ref left_obs, ref right_obs)), time, diff)| {
                                        let base = tier2_base_score(left_obs, right_obs);
                                        let pairs = [(base, 1.0)];
                                        let confidence = compute_confidence(&confidence_model, &pairs);

                                        let result = FusionResult {
                                            join_path_id: join_path_id.clone(),
                                            left_key: left_obs.key.clone(),
                                            right_key: right_obs.key.clone(),
                                            confidence,
                                            output_type,
                                            time,
                                            diff: diff as i64,
                                        };
                                        let _ = tx.send(result);
                                    })
                                    .probe_with(&mut probe);
                            }
                            _ => {
                                left_collection
                                    .join(&right_collection)
                                    .inspect(move |&((ref _join_key, (ref left_obs, ref right_obs)), time, diff)| {
                                        let base = tier2_base_score(left_obs, right_obs);
                                        let pairs = [(base, 1.0)];
                                        let confidence = compute_confidence(&confidence_model, &pairs);

                                        let result = FusionResult {
                                            join_path_id: join_path_id.clone(),
                                            left_key: left_obs.key.clone(),
                                            right_key: right_obs.key.clone(),
                                            confidence,
                                            output_type,
                                            time,
                                            diff: diff as i64,
                                        };
                                        let _ = tx.send(result);
                                    })
                                    .probe_with(&mut probe);
                            }
                        }
                    }
                }
            }
        }
    }

    DataflowHandles { inputs, probe }
}
