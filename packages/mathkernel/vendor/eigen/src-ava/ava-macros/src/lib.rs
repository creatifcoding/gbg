//! AVA Derive Macros
//!
//! Proc-macro crate providing derive macros for AVA domain types.
//!
//! # Macros
//!
//! - `#[derive(AvaEvent)]` - Auto-generates event trait implementations
//! - `#[derive(SourceAdapter)]` - Generates SourceAdapter trait skeleton
//! - `#[ava_channel]` - Channel definition DSL (attribute macro)

use proc_macro::TokenStream;
use syn::{parse_macro_input, DeriveInput};

mod ava_event;
mod source_adapter;
mod channel_attr;

/// Derive macro for AVA domain events.
///
/// Generates accessor methods for common event fields:
/// - `tag()` - Returns the event's discriminant tag
/// - `timestamp_ms()` - Returns the event timestamp
/// - `view_id()` - Returns the associated view ID (if applicable)
///
/// # Example
///
/// ```ignore
/// #[derive(AvaEvent)]
/// #[serde(tag = "event", content = "content")]
/// pub enum MyEvent {
///     Created { view_id: ViewId, timestamp_ms: f64 },
///     Updated { view_id: ViewId, delta: Delta, timestamp_ms: f64 },
/// }
/// ```
#[proc_macro_derive(AvaEvent, attributes(ava_event))]
pub fn derive_ava_event(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    ava_event::expand(input)
        .unwrap_or_else(|e| e.to_compile_error())
        .into()
}

/// Derive macro for SourceAdapter implementations.
///
/// Generates a skeleton implementation of the `SourceAdapter` trait,
/// auto-detecting the `SourceKind` from struct attributes.
///
/// # Example
///
/// ```ignore
/// #[derive(SourceAdapter)]
/// #[source_adapter(kind = "sql", connection = "sqlite::memory:")]
/// pub struct SqliteSource {
///     pool: SqlitePool,
/// }
/// ```
#[proc_macro_derive(SourceAdapter, attributes(source_adapter))]
pub fn derive_source_adapter(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    source_adapter::expand(input)
        .unwrap_or_else(|e| e.to_compile_error())
        .into()
}

/// Attribute macro for channel definition DSL.
///
/// Validates channel configuration and generates `ChannelPipelineSpec`.
///
/// # Example
///
/// ```ignore
/// #[ava_channel(role = "STATE", materialization = "cached")]
/// fn asset_state_channel() -> ChannelPipelineSpec {
///     // Pipeline operators defined here
/// }
/// ```
#[proc_macro_attribute]
pub fn ava_channel(attr: TokenStream, item: TokenStream) -> TokenStream {
    channel_attr::expand(attr.into(), item.into())
        .unwrap_or_else(|e| e.to_compile_error())
        .into()
}
