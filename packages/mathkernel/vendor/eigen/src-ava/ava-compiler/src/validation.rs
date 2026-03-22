//! Validation Types
//!
//! Rich validation errors with precise location information for UI feedback.
//! These types are designed to be:
//! - Serializable (JSON/Protobuf) for wire transport
//! - Informative (include context like available columns)
//! - Locatable (pinpoint exactly where in the spec the error occurs)
//!
//! # Design
//!
//! Validation errors are separate from `CompilerError`:
//! - `ValidationError` — User-facing, serializable, for UI display
//! - `CompilerError` — Internal, for Rust error handling
//!
//! The execution service validates specs and returns `Vec<ValidationError>`
//! on failure, enabling the UI to show inline errors.

use serde::{Deserialize, Serialize};
use typeshare::typeshare;

// ============================================================================
// ValidationResult - The top-level result of validation
// ============================================================================

/// Result of validating a ViewProfileSpec.
///
/// On success, contains the validated spec (potentially with normalizations).
/// On failure, contains a list of validation errors.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    /// Whether the spec is valid
    pub valid: bool,

    /// Validation errors (empty if valid)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub errors: Vec<ValidationError>,

    /// Warnings (valid but potentially problematic)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub warnings: Vec<ValidationWarning>,
}

impl ValidationResult {
    /// Creates a successful validation result
    pub fn ok() -> Self {
        Self {
            valid: true,
            errors: Vec::new(),
            warnings: Vec::new(),
        }
    }

    /// Creates a failed validation result with errors
    pub fn failed(errors: impl IntoIterator<Item = ValidationError>) -> Self {
        Self {
            valid: false,
            errors: errors.into_iter().collect(),
            warnings: Vec::new(),
        }
    }

    /// Creates a result with a single error
    pub fn error(error: ValidationError) -> Self {
        Self::failed(std::iter::once(error))
    }

    /// Adds a warning to the result
    pub fn with_warning(mut self, warning: ValidationWarning) -> Self {
        self.warnings.push(warning);
        self
    }

    /// Adds multiple warnings
    pub fn with_warnings(mut self, warnings: impl IntoIterator<Item = ValidationWarning>) -> Self {
        self.warnings.extend(warnings);
        self
    }

    /// Merges another result into this one
    pub fn merge(mut self, other: ValidationResult) -> Self {
        if !other.valid {
            self.valid = false;
        }
        self.errors.extend(other.errors);
        self.warnings.extend(other.warnings);
        self
    }

    /// Returns true if there are any errors
    pub fn has_errors(&self) -> bool {
        !self.errors.is_empty()
    }

    /// Returns true if there are any warnings
    pub fn has_warnings(&self) -> bool {
        !self.warnings.is_empty()
    }
}

impl Default for ValidationResult {
    fn default() -> Self {
        Self::ok()
    }
}

// ============================================================================
// ValidationError - Detailed validation errors
// ============================================================================

/// Validation error with location information.
///
/// Each variant contains:
/// - Error-specific context (e.g., which column, which source)
/// - Location within the spec where the error occurred
/// - Helpful information for fixing (e.g., available columns)
///
/// # Serialization
///
/// Uses tagged union format for Protobuf compatibility:
/// ```json
/// {
///   "type": "columnNotFound",
///   "column": "statuz",
///   "sourceId": "assets-db",
///   "availableColumns": ["id", "name", "status"],
///   "location": { "channelId": "state", "pipelineIndex": 0 }
/// }
/// ```
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum ValidationError {
    /// Referenced source doesn't exist in the registry
    #[serde(rename_all = "camelCase")]
    SourceNotFound {
        source_id: String,
        location: ErrorLocation,
    },

    /// Referenced column doesn't exist in the source schema
    #[serde(rename_all = "camelCase")]
    ColumnNotFound {
        column: String,
        source_id: String,
        /// Available columns for autocomplete/suggestions
        available_columns: Vec<String>,
        location: ErrorLocation,
    },

    /// Type mismatch (e.g., comparing string to number, incompatible join keys)
    #[serde(rename_all = "camelCase")]
    TypeMismatch {
        expected: String,
        actual: String,
        context: String,
        location: ErrorLocation,
    },

    /// Invalid aggregation function or usage
    #[serde(rename_all = "camelCase")]
    InvalidAggregation {
        function: String,
        reason: String,
        location: ErrorLocation,
    },

    /// Operation not supported by the source
    #[serde(rename_all = "camelCase")]
    UnsupportedOperation {
        operation: String,
        source_id: String,
        /// What capability is missing
        required_capability: Option<String>,
        location: ErrorLocation,
    },

    /// Circular dependency detected in joins or references
    #[serde(rename_all = "camelCase")]
    CircularDependency {
        /// The cycle path (e.g., ["A", "B", "C", "A"])
        cycle: Vec<String>,
    },

    /// Invalid predicate syntax in filter
    #[serde(rename_all = "camelCase")]
    InvalidPredicate {
        predicate: String,
        reason: String,
        location: ErrorLocation,
    },

    /// Duplicate identifier (e.g., duplicate column alias)
    #[serde(rename_all = "camelCase")]
    DuplicateIdentifier {
        identifier: String,
        context: String,
        location: ErrorLocation,
    },

    /// Missing required field
    #[serde(rename_all = "camelCase")]
    MissingRequired {
        field: String,
        context: String,
        location: ErrorLocation,
    },

    /// Invalid value for a field
    #[serde(rename_all = "camelCase")]
    InvalidValue {
        field: String,
        value: String,
        reason: String,
        location: ErrorLocation,
    },
}

impl ValidationError {
    // Convenience constructors

    /// Creates a SourceNotFound error
    pub fn source_not_found(source_id: impl Into<String>, location: ErrorLocation) -> Self {
        Self::SourceNotFound {
            source_id: source_id.into(),
            location,
        }
    }

    /// Creates a ColumnNotFound error
    pub fn column_not_found(
        column: impl Into<String>,
        source_id: impl Into<String>,
        available: impl IntoIterator<Item = impl Into<String>>,
        location: ErrorLocation,
    ) -> Self {
        Self::ColumnNotFound {
            column: column.into(),
            source_id: source_id.into(),
            available_columns: available.into_iter().map(Into::into).collect(),
            location,
        }
    }

    /// Creates a TypeMismatch error
    pub fn type_mismatch(
        expected: impl Into<String>,
        actual: impl Into<String>,
        context: impl Into<String>,
        location: ErrorLocation,
    ) -> Self {
        Self::TypeMismatch {
            expected: expected.into(),
            actual: actual.into(),
            context: context.into(),
            location,
        }
    }

    /// Creates an UnsupportedOperation error
    pub fn unsupported_operation(
        operation: impl Into<String>,
        source_id: impl Into<String>,
        location: ErrorLocation,
    ) -> Self {
        Self::UnsupportedOperation {
            operation: operation.into(),
            source_id: source_id.into(),
            required_capability: None,
            location,
        }
    }

    /// Creates an UnsupportedOperation error with required capability
    pub fn unsupported_operation_with_capability(
        operation: impl Into<String>,
        source_id: impl Into<String>,
        capability: impl Into<String>,
        location: ErrorLocation,
    ) -> Self {
        Self::UnsupportedOperation {
            operation: operation.into(),
            source_id: source_id.into(),
            required_capability: Some(capability.into()),
            location,
        }
    }

    /// Creates an InvalidPredicate error
    pub fn invalid_predicate(
        predicate: impl Into<String>,
        reason: impl Into<String>,
        location: ErrorLocation,
    ) -> Self {
        Self::InvalidPredicate {
            predicate: predicate.into(),
            reason: reason.into(),
            location,
        }
    }

    /// Creates an InvalidAggregation error
    pub fn invalid_aggregation(
        function: impl Into<String>,
        reason: impl Into<String>,
        location: ErrorLocation,
    ) -> Self {
        Self::InvalidAggregation {
            function: function.into(),
            reason: reason.into(),
            location,
        }
    }

    /// Creates a CircularDependency error
    pub fn circular_dependency(cycle: impl IntoIterator<Item = impl Into<String>>) -> Self {
        Self::CircularDependency {
            cycle: cycle.into_iter().map(Into::into).collect(),
        }
    }

    /// Returns the location of this error, if any
    pub fn location(&self) -> Option<&ErrorLocation> {
        match self {
            Self::SourceNotFound { location, .. }
            | Self::ColumnNotFound { location, .. }
            | Self::TypeMismatch { location, .. }
            | Self::InvalidAggregation { location, .. }
            | Self::UnsupportedOperation { location, .. }
            | Self::InvalidPredicate { location, .. }
            | Self::DuplicateIdentifier { location, .. }
            | Self::MissingRequired { location, .. }
            | Self::InvalidValue { location, .. } => Some(location),
            Self::CircularDependency { .. } => None,
        }
    }

    /// Returns a human-readable error message
    pub fn message(&self) -> String {
        match self {
            Self::SourceNotFound { source_id, .. } => {
                format!("Source '{}' not found", source_id)
            }
            Self::ColumnNotFound { column, source_id, .. } => {
                format!("Column '{}' not found in source '{}'", column, source_id)
            }
            Self::TypeMismatch { expected, actual, context, .. } => {
                format!("Type mismatch in {}: expected {}, got {}", context, expected, actual)
            }
            Self::InvalidAggregation { function, reason, .. } => {
                format!("Invalid aggregation '{}': {}", function, reason)
            }
            Self::UnsupportedOperation { operation, source_id, .. } => {
                format!("Operation '{}' not supported by source '{}'", operation, source_id)
            }
            Self::CircularDependency { cycle } => {
                format!("Circular dependency detected: {}", cycle.join(" → "))
            }
            Self::InvalidPredicate { predicate, reason, .. } => {
                format!("Invalid predicate '{}': {}", predicate, reason)
            }
            Self::DuplicateIdentifier { identifier, context, .. } => {
                format!("Duplicate identifier '{}' in {}", identifier, context)
            }
            Self::MissingRequired { field, context, .. } => {
                format!("Missing required field '{}' in {}", field, context)
            }
            Self::InvalidValue { field, value, reason, .. } => {
                format!("Invalid value '{}' for field '{}': {}", value, field, reason)
            }
        }
    }
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message())
    }
}

impl std::error::Error for ValidationError {}

// ============================================================================
// ValidationWarning - Non-fatal issues
// ============================================================================

/// Validation warning (non-fatal).
///
/// The spec is valid but there may be issues:
/// - Deprecated features
/// - Performance concerns
/// - Potential data quality issues
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum ValidationWarning {
    /// Using a deprecated feature
    #[serde(rename_all = "camelCase")]
    DeprecatedFeature {
        feature: String,
        alternative: Option<String>,
        location: ErrorLocation,
    },

    /// Potential performance issue
    #[serde(rename_all = "camelCase")]
    PerformanceWarning {
        message: String,
        suggestion: Option<String>,
        location: ErrorLocation,
    },

    /// Missing optional but recommended field
    #[serde(rename_all = "camelCase")]
    MissingRecommended {
        field: String,
        reason: String,
        location: ErrorLocation,
    },
}

impl ValidationWarning {
    /// Creates a DeprecatedFeature warning
    pub fn deprecated(
        feature: impl Into<String>,
        alternative: Option<String>,
        location: ErrorLocation,
    ) -> Self {
        Self::DeprecatedFeature {
            feature: feature.into(),
            alternative,
            location,
        }
    }

    /// Creates a PerformanceWarning
    pub fn performance(
        message: impl Into<String>,
        suggestion: Option<String>,
        location: ErrorLocation,
    ) -> Self {
        Self::PerformanceWarning {
            message: message.into(),
            suggestion,
            location,
        }
    }

    /// Returns the location of this warning
    pub fn location(&self) -> &ErrorLocation {
        match self {
            Self::DeprecatedFeature { location, .. }
            | Self::PerformanceWarning { location, .. }
            | Self::MissingRecommended { location, .. } => location,
        }
    }

    /// Returns a human-readable message
    pub fn message(&self) -> String {
        match self {
            Self::DeprecatedFeature { feature, alternative, .. } => {
                match alternative {
                    Some(alt) => format!("'{}' is deprecated, use '{}' instead", feature, alt),
                    None => format!("'{}' is deprecated", feature),
                }
            }
            Self::PerformanceWarning { message, suggestion, .. } => {
                match suggestion {
                    Some(sug) => format!("{}: {}", message, sug),
                    None => message.clone(),
                }
            }
            Self::MissingRecommended { field, reason, .. } => {
                format!("Missing recommended field '{}': {}", field, reason)
            }
        }
    }
}

impl std::fmt::Display for ValidationWarning {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message())
    }
}

// ============================================================================
// ErrorLocation - Precise error positioning
// ============================================================================

/// Location of an error within a ViewProfileSpec.
///
/// Enables the UI to highlight exactly where the error occurred:
/// - Which channel
/// - Which pipeline operator (by index)
/// - Which field within the operator
///
/// # Example
///
/// For an error in the predicate of the first filter in channel "state":
/// ```json
/// {
///   "channelId": "state",
///   "pipelineIndex": 0,
///   "field": "predicate"
/// }
/// ```
#[typeshare]
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorLocation {
    /// Channel ID where the error occurred
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel_id: Option<String>,

    /// Index of the pipeline operator (0-based)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pipeline_index: Option<usize>,

    /// Field name within the operator
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
}

impl ErrorLocation {
    /// Creates an empty location (spec-level error)
    pub fn root() -> Self {
        Self::default()
    }

    /// Creates a location pointing to a channel
    pub fn channel(id: impl Into<String>) -> Self {
        Self {
            channel_id: Some(id.into()),
            pipeline_index: None,
            field: None,
        }
    }

    /// Creates a location pointing to a pipeline operator
    pub fn pipeline(channel_id: impl Into<String>, index: usize) -> Self {
        Self {
            channel_id: Some(channel_id.into()),
            pipeline_index: Some(index),
            field: None,
        }
    }

    /// Creates a location pointing to a specific field
    pub fn field(channel_id: impl Into<String>, index: usize, field: impl Into<String>) -> Self {
        Self {
            channel_id: Some(channel_id.into()),
            pipeline_index: Some(index),
            field: Some(field.into()),
        }
    }

    /// Builder: set channel ID
    pub fn in_channel(mut self, id: impl Into<String>) -> Self {
        self.channel_id = Some(id.into());
        self
    }

    /// Builder: set pipeline index
    pub fn at_index(mut self, index: usize) -> Self {
        self.pipeline_index = Some(index);
        self
    }

    /// Builder: set field name
    pub fn at_field(mut self, field: impl Into<String>) -> Self {
        self.field = Some(field.into());
        self
    }

    /// Returns a human-readable path string
    pub fn path(&self) -> String {
        let mut parts = Vec::new();

        if let Some(ref ch) = self.channel_id {
            parts.push(format!("channel[{}]", ch));
        }

        if let Some(idx) = self.pipeline_index {
            parts.push(format!("pipeline[{}]", idx));
        }

        if let Some(ref f) = self.field {
            parts.push(f.clone());
        }

        if parts.is_empty() {
            "root".to_string()
        } else {
            parts.join(".")
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validation_result_merge() {
        let result1 = ValidationResult::error(ValidationError::source_not_found(
            "db1",
            ErrorLocation::channel("ch1"),
        ));

        let result2 = ValidationResult::error(ValidationError::source_not_found(
            "db2",
            ErrorLocation::channel("ch2"),
        ));

        let merged = result1.merge(result2);
        assert!(!merged.valid);
        assert_eq!(merged.errors.len(), 2);
    }

    #[test]
    fn test_column_not_found_serialization() {
        let error = ValidationError::column_not_found(
            "statuz",
            "assets-db",
            vec!["id", "name", "status", "value"],
            ErrorLocation::field("state", 0, "predicate"),
        );

        let json = serde_json::to_string_pretty(&error).unwrap();
        assert!(json.contains("\"type\": \"columnNotFound\""));
        assert!(json.contains("\"statuz\""));
        assert!(json.contains("\"availableColumns\""));
        assert!(json.contains("\"status\""));

        let parsed: ValidationError = serde_json::from_str(&json).unwrap();
        if let ValidationError::ColumnNotFound { column, available_columns, .. } = parsed {
            assert_eq!(column, "statuz");
            assert!(available_columns.contains(&"status".to_string()));
        } else {
            panic!("Wrong variant");
        }
    }

    #[test]
    fn test_error_location_path() {
        assert_eq!(ErrorLocation::root().path(), "root");
        assert_eq!(ErrorLocation::channel("state").path(), "channel[state]");
        assert_eq!(
            ErrorLocation::pipeline("state", 2).path(),
            "channel[state].pipeline[2]"
        );
        assert_eq!(
            ErrorLocation::field("state", 0, "predicate").path(),
            "channel[state].pipeline[0].predicate"
        );
    }

    #[test]
    fn test_error_message() {
        let error = ValidationError::type_mismatch(
            "Int64",
            "Utf8",
            "join key comparison",
            ErrorLocation::pipeline("state", 1),
        );

        assert_eq!(
            error.message(),
            "Type mismatch in join key comparison: expected Int64, got Utf8"
        );
    }

    #[test]
    fn test_circular_dependency() {
        let error = ValidationError::circular_dependency(vec!["A", "B", "C", "A"]);

        assert_eq!(
            error.message(),
            "Circular dependency detected: A → B → C → A"
        );
        assert!(error.location().is_none());
    }

    #[test]
    fn test_validation_warning() {
        let warning = ValidationWarning::deprecated(
            "legacyJoin",
            Some("use 'join' instead".to_string()),
            ErrorLocation::pipeline("state", 0),
        );

        assert_eq!(
            warning.message(),
            "'legacyJoin' is deprecated, use 'use 'join' instead' instead"
        );
    }

    #[test]
    fn test_full_validation_result_serialization() {
        let result = ValidationResult::failed(vec![
            ValidationError::source_not_found("unknown-db", ErrorLocation::channel("ch1")),
            ValidationError::column_not_found(
                "bad_col",
                "assets",
                vec!["id", "name"],
                ErrorLocation::field("ch1", 0, "columns"),
            ),
        ])
        .with_warning(ValidationWarning::performance(
            "Query may be slow without index",
            Some("Add index on 'status' column".to_string()),
            ErrorLocation::pipeline("ch1", 1),
        ));

        let json = serde_json::to_string_pretty(&result).unwrap();

        assert!(json.contains("\"valid\": false"));
        assert!(json.contains("\"sourceNotFound\""));
        assert!(json.contains("\"columnNotFound\""));
        assert!(json.contains("\"performanceWarning\""));

        let parsed: ValidationResult = serde_json::from_str(&json).unwrap();
        assert!(!parsed.valid);
        assert_eq!(parsed.errors.len(), 2);
        assert_eq!(parsed.warnings.len(), 1);
    }
}
