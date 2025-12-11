//! AVA Domain Types
//!
//! Pure data structures for the AVA (Asset View Agent) runtime.
//! All types are annotated with `#[typeshare]` for TypeScript generation.
//!
//! # Modules
//!
//! - `ids` - Branded identifier types (AssetId, ViewId, etc.)
//! - `channels` - Channel roles and specifications
//! - `views` - View profiles and artifacts
//! - `assemblages` - Assemblage constraints and specs
//! - `events` - Reconciler event types
//! - `errors` - Domain error types
//! - `traits` - Core extensibility traits (SourceAdapter, ChannelCompiler, etc.)

pub mod ids;
pub mod channels;
pub mod views;
pub mod assemblages;
pub mod events;
pub mod errors;
pub mod traits;

// Re-export all types at crate root for convenience
pub use ids::*;
pub use channels::*;
pub use views::*;
pub use assemblages::*;
pub use events::*;
pub use errors::*;
pub use traits::*;
