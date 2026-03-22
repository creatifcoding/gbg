//! TriggerEngine - Event-driven reactivity system
//!
//! Manages multiple trigger sources:
//! - Source data changes (detected by watchers)
//! - Explicit invalidation requests
//! - Timer-based refresh (refresh_ms)

use std::collections::HashMap;
use std::time::Duration;

use ava_domain::{ViewId, ViewProfileSpec, SourceId};
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use tokio::time::interval;

/// A trigger event that causes view recomputation
#[derive(Debug, Clone)]
pub enum Trigger {
    /// Source data changed (detected by watcher)
    SourceChanged {
        source_id: SourceId,
        affected_views: Vec<ViewId>,
    },

    /// Explicit invalidation request
    Invalidate {
        view_id: ViewId,
    },

    /// Timer fired (refresh_ms elapsed)
    TimerFired {
        view_id: ViewId,
    },

    /// Initial subscription (compute first artifact)
    Initial {
        view_id: ViewId,
    },
}

/// Engine for managing view triggers
pub struct TriggerEngine {
    /// Pending triggers to process
    trigger_tx: mpsc::Sender<Trigger>,
    trigger_rx: mpsc::Receiver<Trigger>,

    /// Active timers for refresh_ms (view_id -> timer handle)
    timers: HashMap<ViewId, JoinHandle<()>>,

    /// Source to views mapping (which views depend on which sources)
    source_views: HashMap<SourceId, Vec<ViewId>>,

    /// View to sources mapping (which sources a view depends on)
    view_sources: HashMap<ViewId, Vec<SourceId>>,
}

impl TriggerEngine {
    /// Create a new trigger engine
    pub fn new() -> Self {
        let (trigger_tx, trigger_rx) = mpsc::channel(256);

        Self {
            trigger_tx,
            trigger_rx,
            timers: HashMap::new(),
            source_views: HashMap::new(),
            view_sources: HashMap::new(),
        }
    }

    /// Get a sender for external trigger injection
    pub fn sender(&self) -> mpsc::Sender<Trigger> {
        self.trigger_tx.clone()
    }

    /// Register a view for trigger monitoring
    ///
    /// Sets up:
    /// - Source change tracking
    /// - Timer if refresh_ms is specified
    pub fn register(&mut self, view_id: ViewId, spec: &ViewProfileSpec) {
        // Track source dependencies
        let mut sources = Vec::new();
        for channel in &spec.channels {
            sources.push(channel.source.id.clone());

            // Add to source_views mapping
            self.source_views
                .entry(channel.source.id.clone())
                .or_default()
                .push(view_id.clone());

            // Add additional sources
            for source in &channel.additional_sources {
                sources.push(source.id.clone());
                self.source_views
                    .entry(source.id.clone())
                    .or_default()
                    .push(view_id.clone());
            }

            // Set up timer if refresh_ms specified
            if let Some(refresh_ms) = channel.refresh_ms {
                self.start_timer(view_id.clone(), refresh_ms);
            }
        }

        self.view_sources.insert(view_id, sources);
    }

    /// Unregister a view
    pub fn unregister(&mut self, view_id: &ViewId) {
        // Stop timer
        if let Some(handle) = self.timers.remove(view_id) {
            handle.abort();
        }

        // Remove from source_views
        if let Some(sources) = self.view_sources.remove(view_id) {
            for source_id in sources {
                if let Some(views) = self.source_views.get_mut(&source_id) {
                    views.retain(|v| v != view_id);
                    if views.is_empty() {
                        self.source_views.remove(&source_id);
                    }
                }
            }
        }
    }

    /// Manually trigger invalidation
    pub fn invalidate(&self, view_id: ViewId) {
        let tx = self.trigger_tx.clone();
        tokio::spawn(async move {
            let _ = tx.send(Trigger::Invalidate { view_id }).await;
        });
    }

    /// Trigger initial computation for a view
    pub fn trigger_initial(&self, view_id: ViewId) {
        let tx = self.trigger_tx.clone();
        tokio::spawn(async move {
            let _ = tx.send(Trigger::Initial { view_id }).await;
        });
    }

    /// Notify that a source has changed
    pub fn notify_source_changed(&self, source_id: SourceId) {
        let affected = self.source_views
            .get(&source_id)
            .cloned()
            .unwrap_or_default();

        if !affected.is_empty() {
            let tx = self.trigger_tx.clone();
            tokio::spawn(async move {
                let _ = tx.send(Trigger::SourceChanged {
                    source_id,
                    affected_views: affected,
                }).await;
            });
        }
    }

    /// Receive next trigger (async)
    pub async fn next_trigger(&mut self) -> Option<Trigger> {
        self.trigger_rx.recv().await
    }

    /// Start a timer for a view
    fn start_timer(&mut self, view_id: ViewId, refresh_ms: u32) {
        // Cancel existing timer if any
        if let Some(handle) = self.timers.remove(&view_id) {
            handle.abort();
        }

        let tx = self.trigger_tx.clone();
        let vid = view_id.clone();

        let handle = tokio::spawn(async move {
            let mut timer = interval(Duration::from_millis(refresh_ms as u64));
            timer.tick().await; // First tick is immediate, skip it

            loop {
                timer.tick().await;
                if tx.send(Trigger::TimerFired { view_id: vid.clone() }).await.is_err() {
                    break;
                }
            }
        });

        self.timers.insert(view_id, handle);
    }

    /// Number of registered views
    pub fn registered_view_count(&self) -> usize {
        self.view_sources.len()
    }

    /// Number of active timers
    pub fn active_timer_count(&self) -> usize {
        self.timers.len()
    }

    /// Check if a view is registered
    pub fn is_registered(&self, view_id: &ViewId) -> bool {
        self.view_sources.contains_key(view_id)
    }
}

impl Default for TriggerEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ava_domain::{
        AssemblageId, ChannelPipelineSpec, ChannelId, ChannelRole,
        SourceSpec, SourceKind, MaterializationTier,
    };
    use std::collections::HashMap;
    use std::time::Duration;

    fn make_spec(id: &str, refresh_ms: Option<u32>) -> ViewProfileSpec {
        ViewProfileSpec {
            id: ViewId::new(id),
            name: format!("View {}", id),
            description: None,
            assemblage_id: AssemblageId::new("test"),
            channels: vec![ChannelPipelineSpec {
                id: ChannelId::new("state"),
                role: ChannelRole::State,
                source: SourceSpec {
                    id: SourceId::new("main"),
                    kind: SourceKind::Stream,
                    connection: "memory://test".into(),
                    schema: None,
                },
                additional_sources: vec![],
                pipeline: vec![],
                materialization: MaterializationTier::Cached,
                refresh_ms,
            }],
            tags: HashMap::new(),
            version: 1,
        }
    }

    #[tokio::test]
    async fn test_new_engine() {
        let engine = TriggerEngine::new();
        assert_eq!(engine.registered_view_count(), 0);
        assert_eq!(engine.active_timer_count(), 0);
    }

    #[tokio::test]
    async fn test_register_view() {
        let mut engine = TriggerEngine::new();
        let spec = make_spec("view-1", None);

        engine.register(ViewId::new("view-1"), &spec);

        assert_eq!(engine.registered_view_count(), 1);
        assert!(engine.is_registered(&ViewId::new("view-1")));
    }

    #[tokio::test]
    async fn test_register_view_with_timer() {
        let mut engine = TriggerEngine::new();
        let spec = make_spec("view-1", Some(100));

        engine.register(ViewId::new("view-1"), &spec);

        assert_eq!(engine.active_timer_count(), 1);
    }

    #[tokio::test]
    async fn test_unregister_view() {
        let mut engine = TriggerEngine::new();
        let spec = make_spec("view-1", Some(100));

        engine.register(ViewId::new("view-1"), &spec);
        engine.unregister(&ViewId::new("view-1"));

        assert_eq!(engine.registered_view_count(), 0);
        assert_eq!(engine.active_timer_count(), 0);
    }

    #[tokio::test]
    async fn test_invalidate() {
        let mut engine = TriggerEngine::new();
        let spec = make_spec("view-1", None);
        engine.register(ViewId::new("view-1"), &spec);

        engine.invalidate(ViewId::new("view-1"));

        // Give time for the async send
        tokio::time::sleep(Duration::from_millis(10)).await;

        let trigger = engine.next_trigger().await.unwrap();
        assert!(matches!(trigger, Trigger::Invalidate { view_id } if view_id == ViewId::new("view-1")));
    }

    #[tokio::test]
    async fn test_trigger_initial() {
        let mut engine = TriggerEngine::new();
        let spec = make_spec("view-1", None);
        engine.register(ViewId::new("view-1"), &spec);

        engine.trigger_initial(ViewId::new("view-1"));

        tokio::time::sleep(Duration::from_millis(10)).await;

        let trigger = engine.next_trigger().await.unwrap();
        assert!(matches!(trigger, Trigger::Initial { view_id } if view_id == ViewId::new("view-1")));
    }

    #[tokio::test]
    async fn test_source_changed() {
        let mut engine = TriggerEngine::new();
        let spec = make_spec("view-1", None);
        engine.register(ViewId::new("view-1"), &spec);

        engine.notify_source_changed(SourceId::new("main"));

        tokio::time::sleep(Duration::from_millis(10)).await;

        let trigger = engine.next_trigger().await.unwrap();
        assert!(matches!(trigger, Trigger::SourceChanged { source_id, .. } if source_id == SourceId::new("main")));
    }

    #[tokio::test]
    async fn test_timer_fires() {
        let mut engine = TriggerEngine::new();
        let spec = make_spec("view-1", Some(50)); // 50ms refresh

        engine.register(ViewId::new("view-1"), &spec);

        // Wait for timer to fire
        tokio::time::sleep(Duration::from_millis(100)).await;

        let trigger = engine.next_trigger().await.unwrap();
        assert!(matches!(trigger, Trigger::TimerFired { view_id } if view_id == ViewId::new("view-1")));
    }
}
