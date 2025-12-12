//! ViewService gRPC implementation
//!
//! Implements the ViewService defined in `proto/ava/services/v1/services.proto`.
//! Supports all 4 streaming patterns: unary, server streaming, client streaming, bidirectional.

use std::pin::Pin;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use futures::Stream;
use tokio::sync::{mpsc, RwLock};
use tokio_stream::wrappers::ReceiverStream;
use tonic::{Request, Response, Status, Streaming};

use ava_runtime::AvaRuntimeV2;

use crate::proto::services::v1 as proto;
use crate::proto::common::v1 as common;
use crate::proto::artifacts::v1 as artifacts;
use prost_wkt_types::Timestamp;

// Import MaterializationTier from ava_domain
use ava_domain::MaterializationTier;

// Type aliases for streaming responses
type ViewArtifactStream = Pin<Box<dyn Stream<Item = Result<artifacts::ViewArtifact, Status>> + Send>>;
type ViewDeltaStream = Pin<Box<dyn Stream<Item = Result<artifacts::ViewDelta, Status>> + Send>>;
type TaggedArtifactStream = Pin<Box<dyn Stream<Item = Result<artifacts::TaggedArtifact, Status>> + Send>>;
type SessionEventStream = Pin<Box<dyn Stream<Item = Result<proto::SessionEvent, Status>> + Send>>;

/// ViewService gRPC server
pub struct ViewServiceServer {
    runtime: Arc<RwLock<AvaRuntimeV2>>,
}

impl ViewServiceServer {
    /// Create a new ViewServiceServer with the given runtime
    pub fn new(runtime: AvaRuntimeV2) -> Self {
        Self {
            runtime: Arc::new(RwLock::new(runtime)),
        }
    }

    /// Get shared runtime access
    pub fn runtime(&self) -> Arc<RwLock<AvaRuntimeV2>> {
        self.runtime.clone()
    }

    /// Convert domain ViewId to proto ViewId
    fn to_proto_view_id(view_id: &ava_runtime::ViewId) -> common::ViewId {
        common::ViewId {
            value: view_id.as_str().to_string(),
        }
    }

    /// Convert proto ViewId to domain ViewId
    fn from_proto_view_id(view_id: &common::ViewId) -> ava_runtime::ViewId {
        ava_runtime::ViewId::new(&view_id.value)
    }

    /// Convert domain ViewArtifact to proto ViewArtifact
    fn to_proto_artifact(artifact: &ava_runtime::ViewArtifact) -> artifacts::ViewArtifact {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default();

        artifacts::ViewArtifact {
            view_id: Some(Self::to_proto_view_id(&artifact.view_id)),
            asset_id: artifact.asset_id.as_ref().map(|id| common::AssetId {
                value: id.as_str().to_string(),
            }),
            spec: Some(Self::to_proto_spec(&artifact.spec)),
            channel_bindings: artifact.channel_bindings
                .iter()
                .map(Self::to_proto_channel_binding)
                .collect(),
            created_at: Some(Timestamp {
                seconds: now.as_secs() as i64,
                nanos: now.subsec_nanos() as i32,
            }),
            updated_at: Some(Timestamp {
                seconds: now.as_secs() as i64,
                nanos: now.subsec_nanos() as i32,
            }),
            version: artifact.logical_version,
            state: artifacts::ArtifactState::Active as i32,
            metrics: None,
            metadata: std::collections::HashMap::new(),
        }
    }

    /// Convert domain ViewProfileSpec to proto ViewProfileSpec
    fn to_proto_spec(spec: &ava_runtime::ViewProfileSpec) -> artifacts::ViewProfileSpec {
        artifacts::ViewProfileSpec {
            name: spec.name.clone(),
            description: spec.description.clone(),
            domain: spec.assemblage_id.as_str().to_string(),
            channels: spec.channels.iter().map(|c| {
                artifacts::ChannelSpec {
                    channel_id: Some(common::ChannelId {
                        value: c.id.as_str().to_string(),
                    }),
                    name: c.id.as_str().to_string(),
                    role: Self::channel_role_to_proto(c.role) as i32,
                    required: true,
                    source_expr: Some(c.source.connection.clone()),
                    schema: None,
                }
            }).collect(),
            default_params: std::collections::HashMap::new(),
            tags: spec.tags.keys().cloned().collect(),
        }
    }

    /// Convert domain ChannelBinding to proto ChannelBinding
    fn to_proto_channel_binding(binding: &ava_runtime::ChannelBinding) -> crate::proto::execution::v1::ChannelBinding {
        crate::proto::execution::v1::ChannelBinding {
            channel_id: Some(common::ChannelId {
                value: binding.channel_id.as_str().to_string(),
            }),
            name: binding.channel_id.as_str().to_string(),
            role: Self::channel_role_to_proto(binding.role) as i32,
            active: binding.active,
            row_count: binding.row_count,
            last_updated: binding.last_updated_ms.map(|ms| {
                Timestamp {
                    seconds: (ms / 1000.0) as i64,
                    nanos: ((ms % 1000.0) * 1_000_000.0) as i32,
                }
            }),
            data: None, // TODO: Convert ChannelData
            data_hash: None,
            metadata: std::collections::HashMap::new(),
            subscription: None,
        }
    }

    /// Convert domain ChannelRole to proto ChannelRole
    fn channel_role_to_proto(role: ava_runtime::ChannelRole) -> crate::proto::execution::v1::ChannelRole {
        match role {
            ava_runtime::ChannelRole::State => crate::proto::execution::v1::ChannelRole::State,
            ava_runtime::ChannelRole::Event => crate::proto::execution::v1::ChannelRole::Event,
            ava_runtime::ChannelRole::Metric => crate::proto::execution::v1::ChannelRole::Metric,
            ava_runtime::ChannelRole::Command => crate::proto::execution::v1::ChannelRole::Command,
            ava_runtime::ChannelRole::Log => crate::proto::execution::v1::ChannelRole::Log,
        }
    }

    /// Convert proto ViewProfileSpec to domain ViewProfileSpec
    fn from_proto_spec(spec: &artifacts::ViewProfileSpec, view_id: &str) -> ava_runtime::ViewProfileSpec {
        ava_runtime::ViewProfileSpec {
            id: ava_runtime::ViewId::new(view_id),
            name: spec.name.clone(),
            description: if spec.description.is_some() { spec.description.clone() } else { None },
            assemblage_id: ava_runtime::AssemblageId::new(&spec.domain),
            channels: spec.channels.iter().map(|c| {
                ava_runtime::ChannelPipelineSpec {
                    id: ava_runtime::ChannelId::new(
                        c.channel_id.as_ref().map(|id| id.value.as_str()).unwrap_or(&c.name)
                    ),
                    role: ava_runtime::ChannelRole::State,
                    source: ava_runtime::SourceSpec {
                        id: ava_runtime::SourceId::new("default"),
                        kind: ava_runtime::SourceKind::Sql,
                        connection: c.source_expr.clone().unwrap_or_default(),
                        schema: c.schema.clone(),
                    },
                    additional_sources: vec![],
                    pipeline: vec![],
                    materialization: MaterializationTier::Cached,
                    refresh_ms: None,
                }
            }).collect(),
            tags: spec.tags.iter().map(|t| (t.clone(), String::new())).collect(),
            version: 1,
        }
    }
}

#[tonic::async_trait]
impl proto::view_service_server::ViewService for ViewServiceServer {
    // ========================================================================
    // UNARY RPCs
    // ========================================================================

    /// Get a view's profile specification
    async fn get_spec(
        &self,
        request: Request<proto::GetSpecRequest>,
    ) -> Result<Response<artifacts::ViewProfileSpec>, Status> {
        let view_id = request.into_inner().view_id
            .ok_or_else(|| Status::invalid_argument("view_id is required"))?;

        let domain_view_id = Self::from_proto_view_id(&view_id);

        let runtime = self.runtime.read().await;
        let spec = runtime.get_spec(&domain_view_id)
            .map_err(|e| Status::internal(e.to_string()))?
            .ok_or_else(|| Status::not_found(format!("View {} not found", view_id.value)))?;

        Ok(Response::new(Self::to_proto_spec(&spec)))
    }

    /// Get a view's runtime artifact
    async fn get_artifact(
        &self,
        request: Request<proto::GetArtifactRequest>,
    ) -> Result<Response<artifacts::ViewArtifact>, Status> {
        let req = request.into_inner();
        let view_id = req.view_id
            .ok_or_else(|| Status::invalid_argument("view_id is required"))?;

        let domain_view_id = Self::from_proto_view_id(&view_id);

        let runtime = self.runtime.read().await;

        // Check if view is subscribed (has an active artifact)
        if !runtime.is_subscribed(&domain_view_id).await {
            return Err(Status::not_found(format!("View {} is not subscribed", view_id.value)));
        }

        // Get the spec and create an artifact representation
        let spec = runtime.get_spec(&domain_view_id)
            .map_err(|e| Status::internal(e.to_string()))?
            .ok_or_else(|| Status::not_found(format!("View {} not found", view_id.value)))?;

        let artifact = AvaRuntimeV2::create_artifact(&spec);

        Ok(Response::new(Self::to_proto_artifact(&artifact)))
    }

    /// Invalidate a view (force recomputation)
    async fn invalidate(
        &self,
        request: Request<proto::InvalidateRequest>,
    ) -> Result<Response<()>, Status> {
        let req = request.into_inner();
        let view_id = req.view_id
            .ok_or_else(|| Status::invalid_argument("view_id is required"))?;

        let domain_view_id = Self::from_proto_view_id(&view_id);

        let runtime = self.runtime.read().await;
        runtime.invalidate(&domain_view_id).await
            .map_err(|e| Status::internal(e.to_string()))?;

        Ok(Response::new(()))
    }

    /// Get view status
    async fn get_status(
        &self,
        request: Request<proto::GetStatusRequest>,
    ) -> Result<Response<proto::ViewStatus>, Status> {
        let view_id = request.into_inner().view_id
            .ok_or_else(|| Status::invalid_argument("view_id is required"))?;

        let domain_view_id = Self::from_proto_view_id(&view_id);

        let runtime = self.runtime.read().await;
        let is_subscribed = runtime.is_subscribed(&domain_view_id).await;

        let spec = runtime.get_spec(&domain_view_id)
            .map_err(|e| Status::internal(e.to_string()))?;

        let state = if is_subscribed {
            artifacts::ArtifactState::Active
        } else if spec.is_some() {
            artifacts::ArtifactState::Suspended
        } else {
            return Err(Status::not_found(format!("View {} not found", view_id.value)));
        };

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default();

        Ok(Response::new(proto::ViewStatus {
            view_id: Some(view_id),
            state: state as i32,
            version: spec.map(|s| s.version).unwrap_or(0),
            subscriber_count: if is_subscribed { 1 } else { 0 },
            last_updated: Some(Timestamp {
                seconds: now.as_secs() as i64,
                nanos: now.subsec_nanos() as i32,
            }),
            last_error: None,
        }))
    }

    /// Register a new view spec
    async fn register_spec(
        &self,
        request: Request<proto::RegisterSpecRequest>,
    ) -> Result<Response<proto::RegisterSpecResponse>, Status> {
        let req = request.into_inner();
        let spec = req.spec
            .ok_or_else(|| Status::invalid_argument("spec is required"))?;

        // Generate a view ID from the spec name
        let view_id = uuid::Uuid::new_v4().to_string();
        let domain_spec = Self::from_proto_spec(&spec, &view_id);

        let runtime = self.runtime.read().await;

        // Check if overwriting
        let exists = runtime.get_spec(&domain_spec.id)
            .map_err(|e| Status::internal(e.to_string()))?
            .is_some();

        if exists && !req.overwrite_existing {
            return Err(Status::already_exists(format!("View {} already exists", view_id)));
        }

        if exists {
            runtime.update_spec(domain_spec.clone())
                .map_err(|e| Status::internal(e.to_string()))?;
        } else {
            runtime.register_spec(domain_spec.clone())
                .map_err(|e| Status::internal(e.to_string()))?;
        }

        Ok(Response::new(proto::RegisterSpecResponse {
            view_id: Some(common::ViewId { value: view_id }),
            was_created: !exists,
            version: domain_spec.version,
        }))
    }

    // ========================================================================
    // SERVER STREAMING RPCs
    // ========================================================================

    type SubscribeStream = ViewArtifactStream;

    /// Subscribe to a view - streams artifacts as they update
    async fn subscribe(
        &self,
        request: Request<proto::SubscribeRequest>,
    ) -> Result<Response<Self::SubscribeStream>, Status> {
        let req = request.into_inner();
        let view_id = req.view_id
            .ok_or_else(|| Status::invalid_argument("view_id is required"))?;

        let domain_view_id = Self::from_proto_view_id(&view_id);

        let runtime = self.runtime.read().await;

        // Get the spec
        let spec = runtime.get_spec(&domain_view_id)
            .map_err(|e| Status::internal(e.to_string()))?
            .ok_or_else(|| Status::not_found(format!("View {} not found", view_id.value)))?;

        // Subscribe to the view
        let mut rx = runtime.subscribe_view_hydrated(spec).await
            .map_err(|e| Status::internal(e.to_string()))?;

        // Create an output channel for the gRPC stream
        let (tx, stream_rx) = mpsc::channel(32);

        // Spawn a task to bridge broadcast -> mpsc
        tokio::spawn(async move {
            loop {
                match rx.recv().await {
                    Ok(artifact) => {
                        let proto_artifact = Self::to_proto_artifact(&artifact);
                        if tx.send(Ok(proto_artifact)).await.is_err() {
                            break; // Client disconnected
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                        eprintln!("gRPC subscriber lagged by {} messages", n);
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                        break;
                    }
                }
            }
        });

        let stream = ReceiverStream::new(stream_rx);
        Ok(Response::new(Box::pin(stream)))
    }

    type SubscribeDeltasStream = ViewDeltaStream;

    /// Subscribe to deltas only - lower bandwidth than full artifacts
    async fn subscribe_deltas(
        &self,
        request: Request<proto::SubscribeDeltasRequest>,
    ) -> Result<Response<Self::SubscribeDeltasStream>, Status> {
        let req = request.into_inner();
        let view_id = req.view_id
            .ok_or_else(|| Status::invalid_argument("view_id is required"))?;

        // For now, we'll convert artifacts to deltas
        // In a full implementation, the reconciler would emit deltas directly
        let domain_view_id = Self::from_proto_view_id(&view_id);

        let runtime = self.runtime.read().await;

        let spec = runtime.get_spec(&domain_view_id)
            .map_err(|e| Status::internal(e.to_string()))?
            .ok_or_else(|| Status::not_found(format!("View {} not found", view_id.value)))?;

        let mut rx = runtime.subscribe_view_hydrated(spec).await
            .map_err(|e| Status::internal(e.to_string()))?;

        let (tx, stream_rx) = mpsc::channel(32);
        let mut sequence: u64 = req.from_sequence.unwrap_or(0);

        tokio::spawn(async move {
            loop {
                match rx.recv().await {
                    Ok(artifact) => {
                        sequence += 1;
                        let now = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap_or_default();

                        // Create an ArtifactReplaced delta
                        let delta = artifacts::ViewDelta {
                            view_id: Some(Self::to_proto_view_id(&artifact.view_id)),
                            sequence,
                            timestamp: Some(Timestamp {
                                seconds: now.as_secs() as i64,
                                nanos: now.subsec_nanos() as i32,
                            }),
                            delta: Some(artifacts::view_delta::Delta::ArtifactReplaced(
                                artifacts::ArtifactReplaced {
                                    new_artifact: Some(Self::to_proto_artifact(&artifact)),
                                    previous_version: None,
                                    reason: artifacts::ReplacementReason::Invalidated as i32,
                                }
                            )),
                        };

                        if tx.send(Ok(delta)).await.is_err() {
                            break;
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {}
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                }
            }
        });

        let stream = ReceiverStream::new(stream_rx);
        Ok(Response::new(Box::pin(stream)))
    }

    type SubscribeManyStream = TaggedArtifactStream;

    /// Subscribe to multiple views - multiplexed stream with routing tags
    async fn subscribe_many(
        &self,
        request: Request<proto::SubscribeManyRequest>,
    ) -> Result<Response<Self::SubscribeManyStream>, Status> {
        let req = request.into_inner();

        if req.subscriptions.is_empty() {
            return Err(Status::invalid_argument("At least one subscription is required"));
        }

        let (tx, stream_rx) = mpsc::channel(64);

        for sub in req.subscriptions {
            let view_id = sub.view_id
                .ok_or_else(|| Status::invalid_argument("view_id is required in subscription"))?;
            let tag = sub.tag.clone();

            let domain_view_id = Self::from_proto_view_id(&view_id);
            let runtime = self.runtime.read().await;

            let spec = runtime.get_spec(&domain_view_id)
                .map_err(|e| Status::internal(e.to_string()))?
                .ok_or_else(|| Status::not_found(format!("View {} not found", view_id.value)))?;

            let mut rx = runtime.subscribe_view_hydrated(spec).await
                .map_err(|e| Status::internal(e.to_string()))?;

            let tx = tx.clone();

            tokio::spawn(async move {
                loop {
                    match rx.recv().await {
                        Ok(artifact) => {
                            let tagged = artifacts::TaggedArtifact {
                                view_id: Some(Self::to_proto_view_id(&artifact.view_id)),
                                artifact: Some(Self::to_proto_artifact(&artifact)),
                                tag: tag.clone(),
                            };
                            if tx.send(Ok(tagged)).await.is_err() {
                                break;
                            }
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {}
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                    }
                }
            });
        }

        let stream = ReceiverStream::new(stream_rx);
        Ok(Response::new(Box::pin(stream)))
    }

    // ========================================================================
    // CLIENT STREAMING RPCs
    // ========================================================================

    /// Bulk register view specs
    async fn bulk_register(
        &self,
        request: Request<Streaming<artifacts::ViewProfileSpec>>,
    ) -> Result<Response<proto::BulkRegisterResponse>, Status> {
        let mut stream = request.into_inner();
        let mut registered_count = 0u32;
        let mut failed_count = 0u32;
        let mut errors = Vec::new();

        while let Some(spec_result) = stream.message().await? {
            let view_id = uuid::Uuid::new_v4().to_string();
            let domain_spec = Self::from_proto_spec(&spec_result, &view_id);

            let runtime = self.runtime.read().await;
            match runtime.register_spec(domain_spec) {
                Ok(_) => registered_count += 1,
                Err(e) => {
                    failed_count += 1;
                    errors.push(proto::BulkOperationError {
                        view_id: Some(common::ViewId { value: view_id }),
                        error: Some(common::AvaError {
                            code: "REGISTRATION_FAILED".to_string(),
                            message: e.to_string(),
                            correlation_id: None,
                            details: None,
                            causes: vec![],
                            metadata: std::collections::HashMap::new(),
                        }),
                    });
                }
            }
        }

        Ok(Response::new(proto::BulkRegisterResponse {
            registered_count,
            failed_count,
            errors,
        }))
    }

    /// Bulk invalidate views
    async fn bulk_invalidate(
        &self,
        request: Request<Streaming<common::ViewId>>,
    ) -> Result<Response<proto::BulkInvalidateResponse>, Status> {
        let mut stream = request.into_inner();
        let mut invalidated_count = 0u32;
        let mut not_found_count = 0u32;
        let mut errors = Vec::new();

        while let Some(view_id_result) = stream.message().await? {
            let domain_view_id = Self::from_proto_view_id(&view_id_result);

            let runtime = self.runtime.read().await;
            match runtime.invalidate(&domain_view_id).await {
                Ok(_) => invalidated_count += 1,
                Err(e) => {
                    let error_msg = e.to_string();
                    if error_msg.contains("not found") {
                        not_found_count += 1;
                    } else {
                        errors.push(proto::BulkOperationError {
                            view_id: Some(view_id_result),
                            error: Some(common::AvaError {
                                code: "INVALIDATION_FAILED".to_string(),
                                message: error_msg,
                                correlation_id: None,
                                details: None,
                                causes: vec![],
                                metadata: std::collections::HashMap::new(),
                            }),
                        });
                    }
                }
            }
        }

        Ok(Response::new(proto::BulkInvalidateResponse {
            invalidated_count,
            not_found_count,
            errors,
        }))
    }

    // ========================================================================
    // BIDIRECTIONAL STREAMING RPCs
    // ========================================================================

    type SessionStream = SessionEventStream;

    /// Interactive session - full duplex view management
    async fn session(
        &self,
        request: Request<Streaming<proto::SessionCommand>>,
    ) -> Result<Response<Self::SessionStream>, Status> {
        let mut commands = request.into_inner();
        let (tx, stream_rx) = mpsc::channel(64);
        let runtime = self.runtime.clone();

        tokio::spawn(async move {
            // Track active subscriptions in this session
            let mut active_subscriptions: std::collections::HashMap<
                String,
                tokio::task::JoinHandle<()>
            > = std::collections::HashMap::new();

            while let Ok(Some(cmd)) = commands.message().await {
                match cmd.command {
                    Some(proto::session_command::Command::Subscribe(sub)) => {
                        if let Some(view_id) = sub.view_id {
                            let domain_view_id = Self::from_proto_view_id(&view_id);
                            let tag = sub.tag.clone();
                            let tx_task = tx.clone(); // Clone for spawned task
                            let runtime_task = runtime.clone();

                            let handle = tokio::spawn(async move {
                                let runtime_guard = runtime_task.read().await;
                                if let Ok(Some(spec)) = runtime_guard.get_spec(&domain_view_id) {
                                    if let Ok(mut rx) = runtime_guard.subscribe_view_hydrated(spec).await {
                                        drop(runtime_guard); // Release lock

                                        loop {
                                            match rx.recv().await {
                                                Ok(artifact) => {
                                                    let event = proto::SessionEvent {
                                                        event: Some(proto::session_event::Event::Artifact(
                                                            proto::ArtifactEvent {
                                                                artifact: Some(artifacts::TaggedArtifact {
                                                                    view_id: Some(Self::to_proto_view_id(&artifact.view_id)),
                                                                    artifact: Some(Self::to_proto_artifact(&artifact)),
                                                                    tag: tag.clone(),
                                                                }),
                                                            }
                                                        )),
                                                    };
                                                    if tx_task.send(Ok(event)).await.is_err() {
                                                        break;
                                                    }
                                                }
                                                Err(_) => break,
                                            }
                                        }
                                    }
                                }
                            });

                            active_subscriptions.insert(view_id.value.clone(), handle);

                            // Send status event using original tx
                            let _ = tx.send(Ok(proto::SessionEvent {
                                event: Some(proto::session_event::Event::Status(proto::StatusEvent {
                                    view_id: Some(view_id),
                                    message: "Subscribed".to_string(),
                                    event_type: proto::StatusEventType::Subscribed as i32,
                                })),
                            })).await;
                        }
                    }

                    Some(proto::session_command::Command::Unsubscribe(unsub)) => {
                        if let Some(view_id) = unsub.view_id {
                            if let Some(handle) = active_subscriptions.remove(&view_id.value) {
                                handle.abort();
                            }

                            let runtime = runtime.read().await;
                            let domain_view_id = Self::from_proto_view_id(&view_id);
                            let _ = runtime.unsubscribe(&domain_view_id).await;

                            let _ = tx.send(Ok(proto::SessionEvent {
                                event: Some(proto::session_event::Event::Status(proto::StatusEvent {
                                    view_id: Some(view_id),
                                    message: "Unsubscribed".to_string(),
                                    event_type: proto::StatusEventType::Unsubscribed as i32,
                                })),
                            })).await;
                        }
                    }

                    Some(proto::session_command::Command::Invalidate(inv)) => {
                        if let Some(view_id) = inv.view_id {
                            let runtime = runtime.read().await;
                            let domain_view_id = Self::from_proto_view_id(&view_id);
                            let _ = runtime.invalidate(&domain_view_id).await;

                            let _ = tx.send(Ok(proto::SessionEvent {
                                event: Some(proto::session_event::Event::Status(proto::StatusEvent {
                                    view_id: Some(view_id),
                                    message: "Invalidated".to_string(),
                                    event_type: proto::StatusEventType::Invalidated as i32,
                                })),
                            })).await;
                        }
                    }

                    Some(proto::session_command::Command::Ping(ping)) => {
                        let now = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap_or_default();

                        let _ = tx.send(Ok(proto::SessionEvent {
                            event: Some(proto::session_event::Event::Pong(proto::PongEvent {
                                sequence: ping.sequence,
                                server_time_ms: now.as_millis() as u64,
                            })),
                        })).await;
                    }

                    Some(proto::session_command::Command::SetStrategy(_)) => {
                        // Strategy changes are acknowledged but implementation-specific
                        let _ = tx.send(Ok(proto::SessionEvent {
                            event: Some(proto::session_event::Event::Status(proto::StatusEvent {
                                view_id: None,
                                message: "Strategy updated".to_string(),
                                event_type: proto::StatusEventType::StrategyChanged as i32,
                            })),
                        })).await;
                    }

                    None => {}
                }
            }

            // Cleanup on session end
            for (_, handle) in active_subscriptions {
                handle.abort();
            }
        });

        let stream = ReceiverStream::new(stream_rx);
        Ok(Response::new(Box::pin(stream)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_server_creation() {
        let runtime = AvaRuntimeV2::default();
        let _server = ViewServiceServer::new(runtime);
    }

    #[tokio::test]
    async fn test_view_id_conversion() {
        let proto_id = common::ViewId { value: "test-view".to_string() };
        let domain_id = ViewServiceServer::from_proto_view_id(&proto_id);
        let back = ViewServiceServer::to_proto_view_id(&domain_id);
        assert_eq!(proto_id.value, back.value);
    }
}
