/**
 * Sidebar System Schemas
 *
 * Effect Schema definitions for the TMNL sidebar system.
 * All types are runtime-validated and support encode/decode transformations.
 *
 * @module sidebar/schemas
 */

import { Schema } from "effect"

// =============================================================================
// Identifiers
// =============================================================================

/**
 * Branded identifier for sidebar items.
 *
 * Format: lowercase alphanumeric with hyphens, 1-64 chars
 * Examples: "home", "settings", "data-explorer", "plugin-my-widget"
 */
export const SidebarItemId = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9][a-z0-9-]{0,63}$/),
  Schema.brand("SidebarItemId")
)
export type SidebarItemId = typeof SidebarItemId.Type

// =============================================================================
// Enumerations
// =============================================================================

/**
 * Sidebar item grouping.
 *
 * - "core": Fixed position, not reorderable (top section)
 * - "plugin": User-reorderable section (below divider)
 */
export const SidebarGroup = Schema.Literal("core", "plugin")
export type SidebarGroup = typeof SidebarGroup.Type

/**
 * Action type for sidebar items.
 *
 * - "route": Navigate to a route (TanStack Router)
 * - "command": Execute a command (command palette style)
 * - "drawer": Toggle a drawer panel
 * - "widget": Spawn/focus a widget (tldraw shape, floating panel)
 */
export const SidebarActionType = Schema.Literal(
  "route",
  "command",
  "drawer",
  "widget"
)
export type SidebarActionType = typeof SidebarActionType.Type

/**
 * Icon source type.
 *
 * - "lucide": Lucide React icon name
 * - "custom": Custom SVG component reference
 * - "url": External image URL
 */
export const SidebarIconType = Schema.Literal("lucide", "custom", "url")
export type SidebarIconType = typeof SidebarIconType.Type

// =============================================================================
// Configuration Structs
// =============================================================================

/**
 * Icon configuration for sidebar items.
 */
export const SidebarIconConfig = Schema.Struct({
  type: SidebarIconType,
  /** Icon name (lucide) or component key (custom) or URL (url) */
  value: Schema.String,
  /** Optional size override (default: 20) */
  size: Schema.optional(Schema.Number),
})
export type SidebarIconConfig = typeof SidebarIconConfig.Type

/**
 * Route action payload.
 */
export const RouteAction = Schema.TaggedStruct("RouteAction", {
  /** Route path (e.g., "/settings", "/playground/streams") */
  path: Schema.String,
  /** Optional search params */
  search: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
})
export type RouteAction = typeof RouteAction.Type

/**
 * Command action payload.
 */
export const CommandAction = Schema.TaggedStruct("CommandAction", {
  /** Command identifier */
  commandId: Schema.String,
  /** Optional arguments */
  args: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export type CommandAction = typeof CommandAction.Type

/**
 * Drawer action payload.
 */
export const DrawerAction = Schema.TaggedStruct("DrawerAction", {
  /** Drawer identifier */
  drawerId: Schema.String,
  /** Drawer side */
  side: Schema.Literal("left", "right"),
  /** Drawer width (default: 280) */
  width: Schema.optional(Schema.Number),
})
export type DrawerAction = typeof DrawerAction.Type

/**
 * Widget action payload.
 */
export const WidgetAction = Schema.TaggedStruct("WidgetAction", {
  /** Widget type identifier */
  widgetType: Schema.String,
  /** Initial widget config */
  config: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export type WidgetAction = typeof WidgetAction.Type

/**
 * Union of all action payloads.
 */
export const SidebarAction = Schema.Union(
  RouteAction,
  CommandAction,
  DrawerAction,
  WidgetAction
)
export type SidebarAction = typeof SidebarAction.Type

// =============================================================================
// Sidebar Item Definition
// =============================================================================

/**
 * Complete sidebar item configuration.
 */
export const SidebarItemConfig = Schema.Struct({
  /** Unique identifier */
  id: SidebarItemId,
  /** Display label (shown in tooltip) */
  label: Schema.NonEmptyString,
  /** Icon configuration */
  icon: SidebarIconConfig,
  /** Group membership */
  group: SidebarGroup,
  /** Action to perform on click */
  action: SidebarAction,
  /** Optional keyboard shortcut (e.g., "Ctrl+Shift+S") */
  shortcut: Schema.optional(Schema.String),
  /** Whether item is disabled */
  disabled: Schema.optional(Schema.Boolean),
  /** Sort order within group (lower = higher) */
  order: Schema.optional(Schema.Number),
})
export type SidebarItemConfig = typeof SidebarItemConfig.Type

// =============================================================================
// Runtime State
// =============================================================================

/**
 * Sidebar item runtime state (extends config with ephemeral state).
 */
export const SidebarItemState = Schema.Struct({
  ...SidebarItemConfig.fields,
  /** Whether the item is currently active (route match, drawer open, etc.) */
  isActive: Schema.Boolean,
  /** Whether the item is currently being dragged */
  isDragging: Schema.Boolean,
})
export type SidebarItemState = typeof SidebarItemState.Type

/**
 * Plugin reorder persistence format.
 */
export const SidebarPluginOrder = Schema.Array(SidebarItemId)
export type SidebarPluginOrder = typeof SidebarPluginOrder.Type

// =============================================================================
// Top-Level Configuration
// =============================================================================

/**
 * Sidebar configuration.
 *
 * Defines the core sidebar items (built-in navigation) and global settings.
 * Plugin items are registered dynamically via useSidebarItem hook.
 */
export const SidebarConfig = Schema.Struct({
  /** Core sidebar items (fixed, non-reorderable) */
  coreItems: Schema.Array(SidebarItemConfig),
  /** Sidebar width in pixels (default: 48) */
  width: Schema.optional(Schema.Number),
  /** Whether sidebar starts collapsed */
  defaultCollapsed: Schema.optional(Schema.Boolean),
  /** Storage key for plugin order persistence */
  storageKey: Schema.optional(Schema.String),
})
export type SidebarConfig = typeof SidebarConfig.Type
