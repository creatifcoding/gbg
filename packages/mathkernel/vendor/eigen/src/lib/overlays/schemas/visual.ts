/**
 * Visual Overlay Schemas
 *
 * Schema-backed types for the visual overlay orchestration layer.
 * Uses TaggedStruct for discriminated data, TaggedClass for entities with methods.
 *
 * @module
 */

import { Schema } from "effect"

// ─────────────────────────────────────────────────────────────
// Identity (Branded primitives)
// ─────────────────────────────────────────────────────────────

/** Unique identifier for a visual overlay instance */
export const VisualOverlayId = Schema.String.pipe(
  Schema.brand("VisualOverlayId"),
  Schema.minLength(1),
)
export type VisualOverlayId = typeof VisualOverlayId.Type

/** Create a VisualOverlayId from a string (unsafe, no validation) */
export const overlayId = (id: string): VisualOverlayId => id as VisualOverlayId

/** Slot identifier ('global' or panelId) */
export const SlotId = Schema.String.pipe(
  Schema.brand("SlotId"),
  Schema.minLength(1),
)
export type SlotId = typeof SlotId.Type

/** Create a SlotId from a string (unsafe, no validation) */
export const slotId = (id: string): SlotId => id as SlotId

// ─────────────────────────────────────────────────────────────
// Overlay Types (Literal union)
// ─────────────────────────────────────────────────────────────

/** Visual overlay type discriminator */
export const VisualOverlayType = Schema.Literal(
  "drawer",
  "modal",
  "toast",
  "command-palette",
  "top-bar",
  "sidebar",
)
export type VisualOverlayType = typeof VisualOverlayType.Type

/** Overlay animation state */
export const OverlayAnimationState = Schema.Literal(
  "entering",
  "visible",
  "exiting",
  "exited",
)
export type OverlayAnimationState = typeof OverlayAnimationState.Type

/** Positioning side for drawers/sidebars */
export const OverlaySide = Schema.Literal("left", "right", "top", "bottom")
export type OverlaySide = typeof OverlaySide.Type

/** Toast position presets */
export const ToastPosition = Schema.Literal(
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
)
export type ToastPosition = typeof ToastPosition.Type

// ─────────────────────────────────────────────────────────────
// Suppression Key Pattern
// ─────────────────────────────────────────────────────────────

/**
 * Suppression key format:
 * - Type-level: "modal", "drawer", "toast"
 * - Instance-level: "modal:settings", "drawer:preferences"
 */
export const SuppressionKey = Schema.String.pipe(
  Schema.pattern(/^[a-z-]+(:[\w-]+)?$/),
  Schema.brand("SuppressionKey"),
)
export type SuppressionKey = typeof SuppressionKey.Type

// ─────────────────────────────────────────────────────────────
// Persistence Configuration
// ─────────────────────────────────────────────────────────────

/** Persistence behavior across navigation */
export const PersistenceMode = Schema.Literal(
  "persist",       // Survives navigation (default)
  "route-scoped",  // Closes on route change
  "ephemeral",     // Closes immediately on any navigation event
)
export type PersistenceMode = typeof PersistenceMode.Type

// ─────────────────────────────────────────────────────────────
// Drawer Config (TaggedStruct)
// ─────────────────────────────────────────────────────────────

export const DrawerConfig = Schema.TaggedStruct("DrawerConfig", {
  /** Unique instance identifier */
  id: VisualOverlayId,
  /** Target slot ('global' or panelId) */
  slot: SlotId,
  /** Positioning side */
  side: Schema.optionalWith(OverlaySide, { default: () => "right" as const }),
  /** Width for left/right drawers */
  width: Schema.optionalWith(Schema.Union(Schema.Number, Schema.String), { default: () => 400 }),
  /** Height for top/bottom drawers */
  height: Schema.optionalWith(Schema.Union(Schema.Number, Schema.String), { default: () => "50%" }),
  /** Show backdrop overlay */
  showBackdrop: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Close on backdrop click */
  closeOnOverlayClick: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Close on Escape key */
  closeOnEscape: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Persistence behavior */
  persistence: Schema.optionalWith(PersistenceMode, { default: () => "persist" as const }),
  /** Z-index offset from tier base */
  zIndexOffset: Schema.optionalWith(Schema.Number, { default: () => 0 }),
})
export type DrawerConfig = typeof DrawerConfig.Type

// ─────────────────────────────────────────────────────────────
// Modal Config (TaggedStruct)
// ─────────────────────────────────────────────────────────────

/** Modal size presets */
export const ModalSize = Schema.Literal("sm", "md", "lg", "xl", "full")
export type ModalSize = typeof ModalSize.Type

export const ModalConfig = Schema.TaggedStruct("ModalConfig", {
  /** Unique instance identifier */
  id: VisualOverlayId,
  /** Modal size preset */
  size: Schema.optionalWith(ModalSize, { default: () => "md" as const }),
  /** Show backdrop overlay */
  showBackdrop: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Close on backdrop click */
  closeOnOverlayClick: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Block scrolling when open */
  blockScroll: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Center vertically */
  centered: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Close on Escape key */
  closeOnEscape: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Persistence behavior */
  persistence: Schema.optionalWith(PersistenceMode, { default: () => "route-scoped" as const }),
  /** Z-index offset from tier base */
  zIndexOffset: Schema.optionalWith(Schema.Number, { default: () => 0 }),
})
export type ModalConfig = typeof ModalConfig.Type

// ─────────────────────────────────────────────────────────────
// Toast Config (TaggedStruct)
// ─────────────────────────────────────────────────────────────

/** Toast variant for styling */
export const ToastVariant = Schema.Literal("default", "success", "warning", "error", "info")
export type ToastVariant = typeof ToastVariant.Type

export const ToastConfig = Schema.TaggedStruct("ToastConfig", {
  /** Unique instance identifier */
  id: VisualOverlayId,
  /** Toast variant */
  variant: Schema.optionalWith(ToastVariant, { default: () => "default" as const }),
  /** Position on screen */
  position: Schema.optionalWith(ToastPosition, { default: () => "bottom-right" as const }),
  /** Auto-dismiss duration (ms), 0 = no auto-dismiss */
  duration: Schema.optionalWith(Schema.Number, { default: () => 5000 }),
  /** Allow manual dismiss */
  dismissible: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Close on Escape key */
  closeOnEscape: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Persistence behavior */
  persistence: Schema.optionalWith(PersistenceMode, { default: () => "persist" as const }),
  /** Z-index offset from tier base */
  zIndexOffset: Schema.optionalWith(Schema.Number, { default: () => 0 }),
})
export type ToastConfig = typeof ToastConfig.Type

// ─────────────────────────────────────────────────────────────
// Command Palette Config (TaggedStruct)
// ─────────────────────────────────────────────────────────────

export const CommandPaletteConfig = Schema.TaggedStruct("CommandPaletteConfig", {
  /** Unique instance identifier */
  id: VisualOverlayId,
  /** Placeholder text */
  placeholder: Schema.optionalWith(Schema.String, { default: () => "Enter command..." }),
  /** Show recent commands */
  showRecent: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Explicit width for palette container */
  width: Schema.optionalWith(Schema.Union(Schema.Number, Schema.String), { default: () => "100%" }),
  /** Maximum width for palette container */
  maxWidth: Schema.optionalWith(Schema.Union(Schema.Number, Schema.String), { default: () => 600 }),
  /** Top padding for the backdrop container */
  paddingTop: Schema.optionalWith(Schema.Union(Schema.Number, Schema.String), { default: () => "15vh" }),
  /** Close on Escape key */
  closeOnEscape: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Persistence behavior */
  persistence: Schema.optionalWith(PersistenceMode, { default: () => "ephemeral" as const }),
  /** Z-index offset from tier base */
  zIndexOffset: Schema.optionalWith(Schema.Number, { default: () => 0 }),
})
export type CommandPaletteConfig = typeof CommandPaletteConfig.Type

// ─────────────────────────────────────────────────────────────
// Top Bar Config (TaggedStruct)
// ─────────────────────────────────────────────────────────────

export const TopBarConfig = Schema.TaggedStruct("TopBarConfig", {
  /** Unique instance identifier */
  id: VisualOverlayId,
  /** Fixed height */
  height: Schema.optionalWith(Schema.Number, { default: () => 56 }),
  /** Transparent background */
  transparent: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Hide on scroll down */
  autoHide: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Close on Escape key (not applicable for top bar) */
  closeOnEscape: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Persistence behavior (top bar always persists) */
  persistence: Schema.optionalWith(PersistenceMode, { default: () => "persist" as const }),
  /** Z-index offset from tier base */
  zIndexOffset: Schema.optionalWith(Schema.Number, { default: () => 0 }),
})
export type TopBarConfig = typeof TopBarConfig.Type

// ─────────────────────────────────────────────────────────────
// Sidebar Config (TaggedStruct) - FUTURE
// ─────────────────────────────────────────────────────────────

/** Sidebar collapse modes */
export const SidebarCollapseMode = Schema.Literal("offcanvas", "icon", "none")
export type SidebarCollapseMode = typeof SidebarCollapseMode.Type

export const SidebarConfig = Schema.TaggedStruct("SidebarConfig", {
  /** Unique instance identifier */
  id: VisualOverlayId,
  /** Target slot */
  slot: SlotId,
  /** Positioning side (left or right only) */
  side: Schema.optionalWith(Schema.Literal("left", "right"), { default: () => "left" as const }),
  /** Collapsed width */
  collapsedWidth: Schema.optionalWith(Schema.Number, { default: () => 48 }),
  /** Expanded width */
  expandedWidth: Schema.optionalWith(Schema.Number, { default: () => 256 }),
  /** Collapsible mode */
  collapsible: Schema.optionalWith(SidebarCollapseMode, { default: () => "offcanvas" as const }),
  /** Close on Escape key */
  closeOnEscape: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Persistence behavior */
  persistence: Schema.optionalWith(PersistenceMode, { default: () => "persist" as const }),
  /** Z-index offset from tier base */
  zIndexOffset: Schema.optionalWith(Schema.Number, { default: () => 0 }),
})
export type SidebarConfig = typeof SidebarConfig.Type

// ─────────────────────────────────────────────────────────────
// Union of All Visual Overlay Configs
// ─────────────────────────────────────────────────────────────

export const VisualOverlayConfig = Schema.Union(
  DrawerConfig,
  ModalConfig,
  ToastConfig,
  CommandPaletteConfig,
  TopBarConfig,
  SidebarConfig,
)
export type VisualOverlayConfig = typeof VisualOverlayConfig.Type

// ─────────────────────────────────────────────────────────────
// Visual Overlay Instance (TaggedClass for entity with methods)
// ─────────────────────────────────────────────────────────────

/**
 * Runtime instance of a visual overlay.
 * Contains config, animation state, z-index, and content reference.
 */
export class VisualOverlayInstance extends Schema.TaggedClass<VisualOverlayInstance>()(
  "VisualOverlayInstance",
  {
    /** Instance ID (matches config.id) */
    id: VisualOverlayId,
    /** Overlay type (discriminator) */
    type: VisualOverlayType,
    /** Configuration (polymorphic by _tag) */
    config: VisualOverlayConfig,
    /** Current animation state */
    animationState: OverlayAnimationState,
    /** Computed z-index */
    zIndex: Schema.Number,
    /** Timestamp when opened (ms since epoch) */
    openedAt: Schema.Number,
    /** Reference key for content registry (ReactNode stored separately) */
    contentKey: Schema.String,
  }
) {
  /** Check if overlay is visible (entering or visible) */
  get isVisible(): boolean {
    return this.animationState === "entering" || this.animationState === "visible"
  }

  /** Check if overlay is in exit transition */
  get isExiting(): boolean {
    return this.animationState === "exiting"
  }

  /** Check if overlay has fully exited */
  get hasExited(): boolean {
    return this.animationState === "exited"
  }

  /** Get the overlay type from config _tag */
  get configType(): VisualOverlayType {
    const tag = this.config._tag
    switch (tag) {
      case "DrawerConfig": return "drawer"
      case "ModalConfig": return "modal"
      case "ToastConfig": return "toast"
      case "CommandPaletteConfig": return "command-palette"
      case "TopBarConfig": return "top-bar"
      case "SidebarConfig": return "sidebar"
    }
  }

  /** Get persistence mode from config */
  get persistence(): PersistenceMode {
    return this.config.persistence ?? "persist"
  }

  /** Check if overlay should close on escape */
  get closesOnEscape(): boolean {
    return this.config.closeOnEscape ?? false
  }
}

// ─────────────────────────────────────────────────────────────
// Slot Registration (TaggedStruct)
// ─────────────────────────────────────────────────────────────

/** Registered slot for overlay rendering */
export const SlotRegistration = Schema.TaggedStruct("SlotRegistration", {
  /** Slot identifier */
  id: SlotId,
  /** Portal container element ID */
  containerId: Schema.String,
  /** Bounding rect (for panel-scoped slots) */
  bounds: Schema.optional(Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    width: Schema.Number,
    height: Schema.Number,
  })),
})
export type SlotRegistration = typeof SlotRegistration.Type

// ─────────────────────────────────────────────────────────────
// Suppression Helpers (Type constructors)
// ─────────────────────────────────────────────────────────────

/**
 * Create a type-level suppression key.
 * @example typeSuppressionKey("modal") // "modal"
 */
export const typeSuppressionKey = (type: VisualOverlayType): SuppressionKey =>
  type as unknown as SuppressionKey

/**
 * Create an instance-level suppression key.
 * @example instanceSuppressionKey("modal", "settings") // "modal:settings"
 */
export const instanceSuppressionKey = (type: VisualOverlayType, id: string): SuppressionKey =>
  `${type}:${id}` as unknown as SuppressionKey

/**
 * Parse a suppression key into type and optional instance.
 * @example parseSuppressionKey("modal:settings") // { type: "modal", instance: "settings" }
 */
export const parseSuppressionKey = (key: SuppressionKey): {
  type: VisualOverlayType
  instance?: string
} => {
  const str = key as unknown as string
  const [type, instance] = str.split(":")
  return { type: type as VisualOverlayType, instance }
}
