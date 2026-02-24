//! EntityResolver — singleton GenServer via NameRegistry.
//!
//! Pattern: Identity resolution service registered as a named singleton
//! via asupersync's `NameRegistry`. The `NameLease` obligation ensures
//! the registry entry is properly cleaned up on shutdown.
//!
//! Other actors discover the EntityResolver via `whereis("entity-resolver")`
//! on the registry. Only one instance runs at a time (singleton guarantee).
//!
//! Supervised under `Restart(max 5)` — if it crashes, it restarts and
//! re-registers. After 5 crashes, it stops permanently (to prevent
//! infinite restart loops from poisoning the registry).

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;

use ava_fusion::{EntityClass, EntityId, SignalSourceId};
use asupersync::cx::Cx;
use asupersync::gen_server::{GenServer, Reply, SystemMsg};
use asupersync::types::Budget;

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

/// Calls to the entity resolver.
#[derive(Debug)]
pub enum ResolverCall {
    /// Resolve an entity from signal source + identifier.
    Resolve {
        source_id: SignalSourceId,
        identifier: String,
        entity_class: EntityClass,
    },
    /// Create or update an entity identity binding.
    Bind {
        entity_id: EntityId,
        source_id: SignalSourceId,
        identifier: String,
        entity_class: EntityClass,
    },
    /// Unbind a specific source identifier from an entity.
    Unbind {
        entity_id: EntityId,
        source_id: SignalSourceId,
    },
    /// Query all known identifiers for an entity.
    GetIdentifiers { entity_id: EntityId },
    /// Query all known entities.
    ListEntities,
}

/// Reply from the entity resolver.
#[derive(Debug)]
pub enum ResolverReply {
    /// Entity resolved successfully.
    Resolved {
        entity_id: EntityId,
        entity_class: EntityClass,
        confidence: f64,
    },
    /// No matching entity found — a new one should be created.
    Unresolved {
        suggested_entity_id: EntityId,
        entity_class: EntityClass,
    },
    /// Binding created/updated.
    Bound { entity_id: EntityId },
    /// Binding removed.
    Unbound { entity_id: EntityId },
    /// Entity not found.
    NotFound { entity_id: EntityId },
    /// Known identifiers for an entity.
    Identifiers {
        entity_id: EntityId,
        bindings: Vec<IdentifierBinding>,
    },
    /// All known entities.
    Entities(Vec<EntitySummary>),
}

/// Cast messages.
#[derive(Debug)]
pub enum ResolverCast {
    /// Hint: observation suggests these two entities might be the same.
    MergeHint {
        entity_a: EntityId,
        entity_b: EntityId,
        confidence: f64,
    },
    /// Invalidate cached resolution for a source.
    InvalidateCache { source_id: SignalSourceId },
}

/// Info messages.
#[derive(Debug)]
pub enum ResolverInfo {
    /// System message.
    System(SystemMsg),
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/// A binding between an entity and a source identifier.
#[derive(Debug, Clone)]
pub struct IdentifierBinding {
    pub source_id: SignalSourceId,
    pub identifier: String,
    pub entity_class: EntityClass,
    pub bound_at_ms: f64,
}

/// Summary of a known entity.
#[derive(Debug, Clone)]
pub struct EntitySummary {
    pub entity_id: EntityId,
    pub entity_class: EntityClass,
    pub binding_count: usize,
}

/// Internal entity record.
struct EntityRecord {
    entity_class: EntityClass,
    bindings: Vec<IdentifierBinding>,
}

// ---------------------------------------------------------------------------
// Actor state
// ---------------------------------------------------------------------------

/// Entity resolver singleton actor.
///
/// Provides identity resolution: given a signal source and an identifier
/// (e.g., ICAO hex code, MMSI, IP address), determines which entity it
/// belongs to or suggests creating a new entity.
///
/// Registered as a singleton via `NameRegistry` under `"entity-resolver"`.
/// The `NameLease` obligation ensures cleanup on shutdown.
pub struct EntityResolver {
    /// Name for tracing / registry key.
    name: String,
    /// Entity ID → record mapping.
    entities: HashMap<EntityId, EntityRecord>,
    /// Reverse index: (source_id, identifier) → entity_id for fast resolution.
    resolution_index: HashMap<(SignalSourceId, String), EntityId>,
    /// Monotonic entity counter for generating new IDs.
    next_entity_seq: u64,
    /// Total resolutions performed.
    total_resolved: u64,
    /// Total new entities created.
    total_created: u64,
}

impl EntityResolver {
    /// Create a new entity resolver.
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            entities: HashMap::new(),
            resolution_index: HashMap::new(),
            next_entity_seq: 0,
            total_resolved: 0,
            total_created: 0,
        }
    }

    /// The registry name this resolver registers under.
    pub fn registry_name(&self) -> &str {
        &self.name
    }

    /// Generate a new entity ID.
    fn next_entity_id(&mut self, entity_class: EntityClass) -> EntityId {
        let id = EntityId::new(format!(
            "{:?}-{:06}",
            entity_class, self.next_entity_seq
        ));
        self.next_entity_seq += 1;
        id
    }
}

// ---------------------------------------------------------------------------
// GenServer implementation
// ---------------------------------------------------------------------------

impl GenServer for EntityResolver {
    type Call = ResolverCall;
    type Reply = ResolverReply;
    type Cast = ResolverCast;
    type Info = ResolverInfo;

    fn handle_call(
        &mut self,
        cx: &Cx,
        request: Self::Call,
        reply: Reply<Self::Reply>,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("entity_resolver::handle_call");
        Box::pin(async move {
            let response = match request {
                ResolverCall::Resolve {
                    source_id,
                    identifier,
                    entity_class,
                } => {
                    self.total_resolved += 1;

                    let key = (source_id, identifier);
                    if let Some(entity_id) = self.resolution_index.get(&key) {
                        ResolverReply::Resolved {
                            entity_id: entity_id.clone(),
                            entity_class,
                            confidence: 1.0, // Direct match = full confidence
                        }
                    } else {
                        // No match — suggest creating a new entity.
                        let suggested = self.next_entity_id(entity_class);
                        self.total_created += 1;
                        ResolverReply::Unresolved {
                            suggested_entity_id: suggested,
                            entity_class,
                        }
                    }
                }

                ResolverCall::Bind {
                    entity_id,
                    source_id,
                    identifier,
                    entity_class,
                } => {
                    let binding = IdentifierBinding {
                        source_id: source_id.clone(),
                        identifier: identifier.clone(),
                        entity_class,
                        bound_at_ms: 0.0, // TODO: virtual time
                    };

                    // Update forward index.
                    let record = self.entities.entry(entity_id.clone()).or_insert_with(|| {
                        EntityRecord {
                            entity_class,
                            bindings: Vec::new(),
                        }
                    });
                    record.bindings.push(binding);

                    // Update reverse index.
                    self.resolution_index
                        .insert((source_id, identifier), entity_id.clone());

                    tracing::debug!(
                        resolver = %self.name,
                        entity_id = %entity_id,
                        "Identifier bound"
                    );
                    ResolverReply::Bound { entity_id }
                }

                ResolverCall::Unbind { entity_id, source_id } => {
                    if let Some(record) = self.entities.get_mut(&entity_id) {
                        // Remove from reverse index.
                        record.bindings.retain(|b| {
                            if b.source_id == source_id {
                                self.resolution_index
                                    .remove(&(b.source_id.clone(), b.identifier.clone()));
                                false
                            } else {
                                true
                            }
                        });
                        ResolverReply::Unbound { entity_id }
                    } else {
                        ResolverReply::NotFound { entity_id }
                    }
                }

                ResolverCall::GetIdentifiers { entity_id } => {
                    if let Some(record) = self.entities.get(&entity_id) {
                        ResolverReply::Identifiers {
                            entity_id,
                            bindings: record.bindings.clone(),
                        }
                    } else {
                        ResolverReply::NotFound { entity_id }
                    }
                }

                ResolverCall::ListEntities => {
                    let entities: Vec<EntitySummary> = self
                        .entities
                        .iter()
                        .map(|(eid, record)| EntitySummary {
                            entity_id: eid.clone(),
                            entity_class: record.entity_class,
                            binding_count: record.bindings.len(),
                        })
                        .collect();
                    ResolverReply::Entities(entities)
                }
            };
            let _ = reply.send(response);
        })
    }

    fn handle_cast(
        &mut self,
        cx: &Cx,
        msg: Self::Cast,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("entity_resolver::handle_cast");
        Box::pin(async move {
            match msg {
                ResolverCast::MergeHint {
                    entity_a,
                    entity_b,
                    confidence,
                } => {
                    tracing::debug!(
                        resolver = %self.name,
                        entity_a = %entity_a,
                        entity_b = %entity_b,
                        confidence,
                        "Merge hint received"
                    );
                    // TODO: Implement merge logic — combine bindings from entity_b
                    // into entity_a, update resolution_index, emit merge event to
                    // TrackManager.
                }
                ResolverCast::InvalidateCache { source_id } => {
                    tracing::debug!(
                        resolver = %self.name,
                        source = %source_id,
                        "Cache invalidated"
                    );
                    // TODO: Remove cached resolutions for this source.
                }
            }
        })
    }

    fn handle_info(
        &mut self,
        cx: &Cx,
        msg: Self::Info,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("entity_resolver::handle_info");
        Box::pin(async move {
            match msg {
                ResolverInfo::System(_sys_msg) => {}
            }
        })
    }

    fn on_start(&mut self, cx: &Cx) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("entity_resolver::started");
        Box::pin(async move {
            tracing::info!(
                resolver = %self.name,
                "EntityResolver started (singleton via NameRegistry)"
            );
            // NOTE: Name registration is handled by the supervision tree via
            // `named_gen_server_start` in pipeline.rs. The NameLease obligation
            // is managed by the GenServerHandle, not by the actor itself.
        })
    }

    fn on_stop(&mut self, cx: &Cx) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("entity_resolver::stopped");
        Box::pin(async move {
            tracing::info!(
                resolver = %self.name,
                total_entities = self.entities.len(),
                total_resolved = self.total_resolved,
                total_created = self.total_created,
                "EntityResolver stopped"
            );
            // NOTE: NameLease release is handled by the supervision tree.
            // The named_gen_server_start helper ensures the lease obligation
            // is resolved (committed or aborted) on actor stop.
        })
    }

    fn on_stop_budget(&self) -> Budget {
        Budget::MINIMAL
    }
}
