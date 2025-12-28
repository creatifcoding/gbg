//! Advanced Subject Router DSL
//!
//! Provides pattern-based routing, subject transformations, and view multiplexing.
//!
//! # Example
//!
//! ```ignore
//! let router = SubjectRouter::new()
//!     .route("artifacts", |r| {
//!         r.with_prefix("tmnl.ava.artifacts")
//!          .partition_by(|artifact| artifact.spec.assemblage_id.as_str())
//!          .fanout_to(["main", "replica-1", "replica-2"])
//!     })
//!     .route("deltas", |r| {
//!         r.with_prefix("tmnl.ava.deltas")
//!          .filter(|delta| matches!(delta, ViewDelta::ChannelUpdated { .. }))
//!          .transform(|delta| compress(delta))
//!     });
//! ```

use std::collections::HashMap;
use std::sync::Arc;
use std::fmt;

use ava_domain::views::{ViewArtifact, ViewDelta};
use ava_domain::ids::ViewId;

/// Subject pattern with wildcards and captures.
///
/// Supports:
/// - `*` - Single token wildcard
/// - `>` - Multi-token wildcard (greedy, at end)
/// - `{name}` - Named capture group
#[derive(Debug, Clone)]
pub struct SubjectPattern {
    segments: Vec<PatternSegment>,
    original: String,
}

#[derive(Debug, Clone)]
enum PatternSegment {
    Literal(String),
    SingleWildcard,
    MultiWildcard,
    Capture(String),
}

impl SubjectPattern {
    /// Parses a subject pattern string.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// let pattern = SubjectPattern::parse("tmnl.ava.artifacts.{view_id}");
    /// ```
    pub fn parse(pattern: &str) -> Self {
        let segments: Vec<PatternSegment> = pattern
            .split('.')
            .map(|seg| {
                if seg == "*" {
                    PatternSegment::SingleWildcard
                } else if seg == ">" {
                    PatternSegment::MultiWildcard
                } else if seg.starts_with('{') && seg.ends_with('}') {
                    let name = seg[1..seg.len() - 1].to_string();
                    PatternSegment::Capture(name)
                } else {
                    PatternSegment::Literal(seg.to_string())
                }
            })
            .collect();

        Self {
            segments,
            original: pattern.to_string(),
        }
    }

    /// Tests if a subject matches this pattern, returning captures.
    pub fn matches(&self, subject: &str) -> Option<HashMap<String, String>> {
        let subject_parts: Vec<&str> = subject.split('.').collect();
        let mut captures = HashMap::new();
        let mut i = 0;

        for seg in &self.segments {
            match seg {
                PatternSegment::Literal(lit) => {
                    if i >= subject_parts.len() || subject_parts[i] != lit {
                        return None;
                    }
                    i += 1;
                }
                PatternSegment::SingleWildcard => {
                    if i >= subject_parts.len() {
                        return None;
                    }
                    i += 1;
                }
                PatternSegment::MultiWildcard => {
                    // Consumes rest of subject
                    return Some(captures);
                }
                PatternSegment::Capture(name) => {
                    if i >= subject_parts.len() {
                        return None;
                    }
                    captures.insert(name.clone(), subject_parts[i].to_string());
                    i += 1;
                }
            }
        }

        if i == subject_parts.len() {
            Some(captures)
        } else {
            None
        }
    }

    /// Builds a concrete subject from captures.
    pub fn build(&self, captures: &HashMap<String, String>) -> String {
        self.segments
            .iter()
            .map(|seg| match seg {
                PatternSegment::Literal(lit) => lit.clone(),
                PatternSegment::Capture(name) => {
                    captures.get(name).cloned().unwrap_or_else(|| "*".into())
                }
                PatternSegment::SingleWildcard => "*".into(),
                PatternSegment::MultiWildcard => ">".into(),
            })
            .collect::<Vec<_>>()
            .join(".")
    }
}

impl fmt::Display for SubjectPattern {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.original)
    }
}

/// Subject builder for constructing complex subjects.
#[derive(Debug, Clone)]
pub struct SubjectBuilder {
    prefix: String,
    segments: Vec<String>,
}

impl SubjectBuilder {
    pub fn new(prefix: impl Into<String>) -> Self {
        Self {
            prefix: prefix.into(),
            segments: Vec::new(),
        }
    }

    /// Adds a literal segment.
    pub fn segment(mut self, seg: impl Into<String>) -> Self {
        self.segments.push(seg.into());
        self
    }

    /// Adds a dynamic segment from a value.
    pub fn with<T: fmt::Display>(mut self, value: T) -> Self {
        self.segments.push(value.to_string());
        self
    }

    /// Adds the view ID segment.
    pub fn view(self, view_id: &ViewId) -> Self {
        self.with(view_id.as_str())
    }

    /// Builds the final subject string.
    pub fn build(self) -> String {
        if self.segments.is_empty() {
            self.prefix
        } else {
            format!("{}.{}", self.prefix, self.segments.join("."))
        }
    }
}

/// Routing decision for a message.
#[derive(Debug, Clone)]
pub enum RoutingDecision {
    /// Publish to a single subject
    Single(String),
    /// Fanout to multiple subjects
    Fanout(Vec<String>),
    /// Drop the message
    Drop,
    /// Transform then route
    Transform {
        subject: String,
        transformer: String, // Identifier for transform pipeline
    },
}

/// Route configuration for a message type.
pub struct Route<T> {
    /// Base subject pattern
    pattern: SubjectPattern,
    /// Optional partitioner function
    partitioner: Option<Box<dyn Fn(&T) -> String + Send + Sync>>,
    /// Optional filter predicate
    filter: Option<Box<dyn Fn(&T) -> bool + Send + Sync>>,
    /// Fanout targets (additional subjects beyond primary)
    fanout: Vec<String>,
    /// Transform pipeline identifier
    transform: Option<String>,
}

impl<T> Route<T> {
    /// Creates a new route with the given pattern.
    pub fn new(pattern: &str) -> Self {
        Self {
            pattern: SubjectPattern::parse(pattern),
            partitioner: None,
            filter: None,
            fanout: Vec::new(),
            transform: None,
        }
    }

    /// Sets the partitioner function.
    ///
    /// The partitioner extracts a partition key from the message,
    /// which becomes the `{partition}` segment in the subject.
    pub fn partition_by<F>(mut self, f: F) -> Self
    where
        F: Fn(&T) -> String + Send + Sync + 'static,
    {
        self.partitioner = Some(Box::new(f));
        self
    }

    /// Sets the filter predicate.
    ///
    /// Messages that fail the filter are dropped.
    pub fn filter<F>(mut self, f: F) -> Self
    where
        F: Fn(&T) -> bool + Send + Sync + 'static,
    {
        self.filter = Some(Box::new(f));
        self
    }

    /// Adds fanout targets.
    ///
    /// Messages are published to the primary subject AND all fanout targets.
    pub fn fanout_to<I, S>(mut self, targets: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.fanout.extend(targets.into_iter().map(Into::into));
        self
    }

    /// Sets the transform pipeline.
    pub fn transform(mut self, pipeline: impl Into<String>) -> Self {
        self.transform = Some(pipeline.into());
        self
    }

    /// Computes the routing decision for a message.
    pub fn route(&self, msg: &T, view_id: &ViewId) -> RoutingDecision {
        // Apply filter
        if let Some(filter) = &self.filter {
            if !filter(msg) {
                return RoutingDecision::Drop;
            }
        }

        // Build captures
        let mut captures = HashMap::new();
        captures.insert("view_id".to_string(), view_id.as_str().to_string());

        // Apply partitioner
        if let Some(partitioner) = &self.partitioner {
            captures.insert("partition".to_string(), partitioner(msg));
        }

        // Build primary subject
        let primary = self.pattern.build(&captures);

        // Handle fanout
        if !self.fanout.is_empty() {
            let mut subjects = vec![primary.clone()];
            for target in &self.fanout {
                let fanout_subject = format!("{}.{}", target, view_id.as_str());
                subjects.push(fanout_subject);
            }
            return RoutingDecision::Fanout(subjects);
        }

        // Handle transform
        if let Some(transform) = &self.transform {
            return RoutingDecision::Transform {
                subject: primary,
                transformer: transform.clone(),
            };
        }

        RoutingDecision::Single(primary)
    }
}

/// Router for artifact messages.
pub struct ArtifactRouter {
    routes: Vec<Route<ViewArtifact>>,
}

impl ArtifactRouter {
    pub fn new() -> Self {
        Self { routes: Vec::new() }
    }

    /// Adds a route (builder pattern).
    pub fn with_route(mut self, route: Route<ViewArtifact>) -> Self {
        self.routes.push(route);
        self
    }

    /// Adds a route (mutable).
    pub fn add_route(&mut self, route: Route<ViewArtifact>) {
        self.routes.push(route);
    }

    /// Computes all routing decisions for an artifact.
    pub fn route_artifact(&self, artifact: &ViewArtifact) -> Vec<RoutingDecision> {
        self.routes
            .iter()
            .map(|r| r.route(artifact, &artifact.view_id))
            .collect()
    }

    /// Generic route method (alias for route_artifact).
    pub fn route(&self, artifact: &ViewArtifact) -> Vec<RoutingDecision> {
        self.route_artifact(artifact)
    }
}

impl Default for ArtifactRouter {
    fn default() -> Self {
        Self::new()
    }
}

/// Router for delta messages.
pub struct DeltaRouter {
    routes: Vec<Route<ViewDelta>>,
}

impl DeltaRouter {
    pub fn new() -> Self {
        Self { routes: Vec::new() }
    }

    /// Adds a route (builder pattern).
    pub fn with_route(mut self, route: Route<ViewDelta>) -> Self {
        self.routes.push(route);
        self
    }

    /// Adds a route (mutable).
    pub fn add_route(&mut self, route: Route<ViewDelta>) {
        self.routes.push(route);
    }

    /// Computes routing decisions for a delta.
    pub fn route_delta(&self, delta: &ViewDelta, view_id: &ViewId) -> Vec<RoutingDecision> {
        self.routes.iter().map(|r| r.route(delta, view_id)).collect()
    }

    /// Generic route method.
    pub fn route(&self, delta: &ViewDelta) -> Vec<RoutingDecision> {
        // For deltas, we need the view_id from context. This is a simplified version.
        // In production, the delta should carry its view_id.
        Vec::new()
    }
}

impl Default for DeltaRouter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_subject_pattern_literal() {
        let pattern = SubjectPattern::parse("tmnl.ava.artifacts.view-1");
        assert!(pattern.matches("tmnl.ava.artifacts.view-1").is_some());
        assert!(pattern.matches("tmnl.ava.artifacts.view-2").is_none());
    }

    #[test]
    fn test_subject_pattern_capture() {
        let pattern = SubjectPattern::parse("tmnl.ava.artifacts.{view_id}");
        let captures = pattern.matches("tmnl.ava.artifacts.my-view").unwrap();
        assert_eq!(captures.get("view_id").unwrap(), "my-view");
    }

    #[test]
    fn test_subject_pattern_wildcard() {
        let pattern = SubjectPattern::parse("tmnl.ava.*.{view_id}");
        let captures = pattern.matches("tmnl.ava.artifacts.view-1").unwrap();
        assert_eq!(captures.get("view_id").unwrap(), "view-1");

        let captures = pattern.matches("tmnl.ava.deltas.view-2").unwrap();
        assert_eq!(captures.get("view_id").unwrap(), "view-2");
    }

    #[test]
    fn test_subject_pattern_multi_wildcard() {
        let pattern = SubjectPattern::parse("tmnl.ava.>");
        assert!(pattern.matches("tmnl.ava.artifacts.view-1.extra").is_some());
        assert!(pattern.matches("tmnl.ava").is_none());
    }

    #[test]
    fn test_subject_builder() {
        let subject = SubjectBuilder::new("tmnl.ava")
            .segment("artifacts")
            .with("view-123")
            .build();
        assert_eq!(subject, "tmnl.ava.artifacts.view-123");
    }

    #[test]
    fn test_subject_pattern_build() {
        let pattern = SubjectPattern::parse("tmnl.ava.artifacts.{view_id}.{partition}");
        let mut captures = HashMap::new();
        captures.insert("view_id".to_string(), "v1".to_string());
        captures.insert("partition".to_string(), "shard-0".to_string());

        let subject = pattern.build(&captures);
        assert_eq!(subject, "tmnl.ava.artifacts.v1.shard-0");
    }
}
