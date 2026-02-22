//! Shared state types for TMNL ecosystem.
//!
//! These types are used by both the main app and the bar for state sync.

use serde::{Deserialize, Serialize};

/// Bar configuration that can be synced or loaded.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BarConfig {
    /// Which screen edge to dock to.
    pub edge: BarEdge,
    /// Bar width (for vertical) or height (for horizontal) in pixels.
    pub size: u32,
    /// Layer shell layer.
    pub layer: BarLayer,
    /// Whether to reserve exclusive zone.
    pub exclusive: bool,
    /// Keyboard interactivity mode.
    pub keyboard: KeyboardMode,
}

impl Default for BarConfig {
    fn default() -> Self {
        Self {
            edge: BarEdge::Left,
            size: 48,
            layer: BarLayer::Top,
            exclusive: true,
            keyboard: KeyboardMode::OnDemand,
        }
    }
}

/// Screen edge for bar docking.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum BarEdge {
    Top,
    Bottom,
    Left,
    Right,
}

/// Layer shell layer.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum BarLayer {
    Background,
    Bottom,
    Top,
    Overlay,
}

/// Keyboard interactivity for layer shell.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum KeyboardMode {
    None,
    Exclusive,
    OnDemand,
}
