//! Declarative Routing Macros
//!
//! Provides macros for concise route and handler definitions.
//!
//! # Example
//!
//! ```ignore
//! use ava_adapters::nats::macros::*;
//!
//! // Define routes declaratively
//! routes! {
//!     artifacts => "tmnl.ava.artifacts.{view_id}" {
//!         partition_by: |a| a.spec.assemblage_id.as_str(),
//!         filter: |a| !a.channel_bindings.is_empty(),
//!     },
//!     deltas => "tmnl.ava.deltas.{view_id}" {
//!         fanout: ["replica-1", "replica-2"],
//!     },
//!     metrics => "tmnl.metrics.{view_id}" {
//!         transform: "compress",
//!     },
//! }
//!
//! // Define handlers
//! handlers! {
//!     on_artifact(artifact: ViewArtifact) -> Result<(), NatsError> {
//!         tracing::info!("Received artifact: {}", artifact.view_id);
//!         Ok(())
//!     },
//!     on_delta(delta: ViewDelta) -> Result<(), NatsError> {
//!         tracing::info!("Received delta");
//!         Ok(())
//!     },
//! }
//! ```

/// Macro for building a subject string at compile time.
///
/// # Example
///
/// ```ignore
/// let subject = subject!("tmnl.ava.artifacts", view_id);
/// // Results in: "tmnl.ava.artifacts.{view_id}"
/// ```
#[macro_export]
macro_rules! subject {
    ($prefix:literal) => {
        $prefix.to_string()
    };
    ($prefix:literal, $($segment:expr),+ $(,)?) => {{
        let mut s = $prefix.to_string();
        $(
            s.push('.');
            s.push_str(&$segment.to_string());
        )+
        s
    }};
}

/// Macro for defining a route inline.
///
/// # Example
///
/// ```ignore
/// let route = route! {
///     pattern: "tmnl.ava.artifacts.{view_id}",
///     filter: |artifact| artifact.logical_version > 0,
///     partition_by: |artifact| artifact.spec.assemblage_id.as_str(),
/// };
/// ```
#[macro_export]
macro_rules! route {
    (
        pattern: $pattern:literal
        $(, filter: $filter:expr)?
        $(, partition_by: $partition:expr)?
        $(, fanout: [$($target:literal),* $(,)?])?
        $(, transform: $transform:literal)?
        $(,)?
    ) => {{
        #[allow(unused_mut)]
        let mut route = $crate::nats::router::Route::new($pattern);

        $(
            route = route.filter($filter);
        )?

        $(
            route = route.partition_by($partition);
        )?

        $(
            route = route.fanout_to([$($target),*]);
        )?

        $(
            route = route.transform($transform);
        )?

        route
    }};
}

/// Macro for defining multiple routes in a router.
///
/// # Example
///
/// ```ignore
/// let router = routes! {
///     artifacts => "tmnl.ava.artifacts.{view_id}" {
///         filter: |a| a.logical_version > 0,
///     },
///     deltas => "tmnl.ava.deltas.{view_id}" {},
/// };
/// ```
#[macro_export]
macro_rules! routes {
    (
        $($name:ident => $pattern:literal {
            $(filter: $filter:expr,)?
            $(partition_by: $partition:expr,)?
            $(fanout: [$($target:literal),* $(,)?],)?
            $(transform: $transform:literal,)?
        }),* $(,)?
    ) => {{
        #[allow(unused_mut)]
        let mut router = $crate::nats::router::ArtifactRouter::new();

        $(
            let route = route! {
                pattern: $pattern
                $(, filter: $filter)?
                $(, partition_by: $partition)?
                $(, fanout: [$($target),*])?
                $(, transform: $transform)?
            };
            router = router.route(route);
        )*

        router
    }};
}

/// Macro for defining a transform pipeline.
///
/// # Example
///
/// ```ignore
/// let pipeline = pipeline! {
///     name: "compress-and-chunk",
///     transforms: [
///         FilterTransform::new(|a| a.channel_bindings.len() > 0),
///         ChunkTransform::new(64 * 1024),
///     ]
/// };
/// ```
#[macro_export]
macro_rules! pipeline {
    (
        name: $name:literal,
        transforms: [$($transform:expr),* $(,)?]
    ) => {{
        #[allow(unused_mut)]
        let mut pipeline = $crate::nats::transform::TransformPipeline::named($name);
        $(
            pipeline = pipeline.add($transform);
        )*
        pipeline
    }};
}

/// Macro for creating a batch publisher configuration.
///
/// # Example
///
/// ```ignore
/// let config = batch_config! {
///     batch_size: 100,
///     flush_ms: 50,
///     workers: 4,
///     retries: 3,
/// };
/// ```
#[macro_export]
macro_rules! batch_config {
    (
        $(batch_size: $batch_size:expr,)?
        $(flush_ms: $flush_ms:expr,)?
        $(workers: $workers:expr,)?
        $(retries: $retries:expr,)?
        $(pending_batches: $pending:expr,)?
    ) => {{
        #[allow(unused_mut)]
        let mut config = $crate::nats::batch::BatchConfig::default();

        $(
            config.max_batch_size = $batch_size;
        )?
        $(
            config.flush_interval = std::time::Duration::from_millis($flush_ms);
        )?
        $(
            config.publish_workers = $workers;
        )?
        $(
            config.max_retries = $retries;
        )?
        $(
            config.max_pending_batches = $pending;
        )?

        config
    }};
}

/// Macro for creating NATS configuration.
///
/// # Example
///
/// ```ignore
/// let config = nats_config! {
///     server: "localhost:4222",
///     stream: "TMNL_AVA",
///     prefix: "tmnl.ava",
/// };
/// ```
#[macro_export]
macro_rules! nats_config {
    (
        server: $server:expr
        $(, stream: $stream:expr)?
        $(, prefix: $prefix:expr)?
        $(,)?
    ) => {{
        #[allow(unused_mut)]
        let mut config = $crate::nats::NatsConfig::with_server($server);

        $(
            config = config.stream_name($stream);
        )?
        $(
            config = config.subject_prefix($prefix);
        )?

        config
    }};
}

/// Macro for declaring message handlers with automatic deserialization.
///
/// # Example
///
/// ```ignore
/// nats_handler!(
///     async fn handle_artifact(msg: &Message, artifact: ViewArtifact) -> Result<(), NatsError> {
///         tracing::info!("Received: {}", artifact.view_id);
///         msg.ack().await?;
///         Ok(())
///     }
/// );
/// ```
#[macro_export]
macro_rules! nats_handler {
    (
        async fn $name:ident($msg:ident: &Message, $payload:ident: $payload_ty:ty) -> Result<(), $err:ty> $body:block
    ) => {
        async fn $name($msg: &async_nats::jetstream::message::Message) -> Result<(), $err> {
            let $payload: $payload_ty = serde_json::from_slice(&$msg.payload)?;
            $body
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_subject_macro() {
        let s = subject!("tmnl.ava");
        assert_eq!(s, "tmnl.ava");

        let view_id = "view-123";
        let s = subject!("tmnl.ava.artifacts", view_id);
        assert_eq!(s, "tmnl.ava.artifacts.view-123");

        let s = subject!("tmnl.ava", "artifacts", view_id, "extra");
        assert_eq!(s, "tmnl.ava.artifacts.view-123.extra");
    }

    #[test]
    fn test_batch_config_macro() {
        let config = batch_config! {
            batch_size: 200,
            flush_ms: 100,
            workers: 8,
        };

        assert_eq!(config.max_batch_size, 200);
        assert_eq!(config.flush_interval.as_millis(), 100);
        assert_eq!(config.publish_workers, 8);
    }
}
