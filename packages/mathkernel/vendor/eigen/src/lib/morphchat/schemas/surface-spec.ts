/**
 * MorphChat Surface Spec — Effect Schema definition.
 *
 * A spec is the single config object that governs what a chat surface
 * renders, how it behaves, and what features are enabled. Every axis
 * has a Schema.Literal so we get runtime validation + type inference.
 *
 * @module morphchat/schemas/surface-spec
 */

import { Schema } from 'effect'

// =============================================================================
// Feature Axis Literals
// =============================================================================

/**
 * Composer variants — the input surface shape.
 *
 * - full: Multiline textarea, toolbar, thinking level, context chips, send/pause
 * - single-line: Compact one-liner, enter-to-send
 * - command: Slash-command input, autocomplete
 * - structured: Predefined fields, form-like
 * - none: No composer (read-only surface)
 */
export const ComposerVariant = Schema.Literal(
  'full', 'single-line', 'command', 'structured', 'none',
)
export type ComposerVariant = typeof ComposerVariant.Type

/**
 * Thread display modes — how messages are rendered.
 *
 * - full: All messages, role badges, timestamps, attachments, animations
 * - compact: Reduced chrome, tighter spacing, no role rail
 * - stream-only: Only the current streaming response, no history
 * - log: Monospace, timestamped, terminal-style
 * - card: Each message as a distinct card surface
 * - none: No thread (composer-only)
 */
export const ThreadMode = Schema.Literal(
  'full', 'compact', 'stream-only', 'log', 'card', 'none',
)
export type ThreadMode = typeof ThreadMode.Type

/**
 * Inline task shell display mode.
 *
 * - full: Virtualized list, transfer, expand/collapse, metrics band
 * - compact: Summary count badge, click to expand
 * - hidden: No task display
 */
export const InlineTaskMode = Schema.Literal(
  'full', 'compact', 'hidden',
)
export type InlineTaskMode = typeof InlineTaskMode.Type

/**
 * Agent selector display mode.
 *
 * - dropdown: Trigger button + dropdown menu
 * - tabs: Tab bar for agent switching
 * - hidden: No selector
 */
export const AgentSelectorMode = Schema.Literal(
  'dropdown', 'tabs', 'hidden',
)
export type AgentSelectorMode = typeof AgentSelectorMode.Type

/**
 * Connection status display mode.
 *
 * - badge: Persistent badge with dot + label + latency
 * - toast-only: Toast notification on state change only
 * - hidden: Silent
 */
export const ConnectionDisplayMode = Schema.Literal(
  'badge', 'toast-only', 'hidden',
)
export type ConnectionDisplayMode = typeof ConnectionDisplayMode.Type

/**
 * Frame chrome level — decorative shell around the surface.
 *
 * - full: Frame corners, title bar, resize handles
 * - minimal: Hairline border, no title bar
 * - none: No frame
 */
export const FrameChromeLevel = Schema.Literal(
  'full', 'minimal', 'none',
)
export type FrameChromeLevel = typeof FrameChromeLevel.Type

/**
 * Keyboard shortcut scope.
 *
 * - full: All shortcuts (Ctrl+Enter send, Escape cancel, Ctrl+C copy, etc.)
 * - minimal: Enter to send only
 * - disabled: No keyboard handling
 */
export const KeyboardShortcutScope = Schema.Literal(
  'full', 'minimal', 'disabled',
)
export type KeyboardShortcutScope = typeof KeyboardShortcutScope.Type

/**
 * Context chip display mode in composer area.
 *
 * - full: Full composer chips with add/remove
 * - read-only: Display only, no interaction
 * - hidden: No chips
 */
export const ContextChipMode = Schema.Literal(
  'full', 'read-only', 'hidden',
)
export type ContextChipMode = typeof ContextChipMode.Type

/**
 * Thread scroll behavior.
 *
 * - auto-follow: Auto-scroll to latest message
 * - manual: User controls scroll position
 * - pinned: Locked to bottom (streaming-optimized)
 */
export const ScrollBehavior = Schema.Literal(
  'auto-follow', 'manual', 'pinned',
)
export type ScrollBehavior = typeof ScrollBehavior.Type

// =============================================================================
// Surface Spec
// =============================================================================

/**
 * ChatSurfaceSpec — the complete configuration object for a MorphChat surface.
 *
 * Every axis has a default. Consumers either use a preset or override individual
 * axes. Effect Schema gives us runtime validation, encode/decode, and JSON Schema
 * generation for free.
 */
export const ChatSurfaceSpec = Schema.Struct({
  /** Unique spec identifier (discriminator for morph machine) */
  _tag: Schema.String,

  /** Human-readable label */
  label: Schema.String,

  // ── Feature axes ──────────────────────────────────────────

  /** Composer input variant */
  composer: ComposerVariant,

  /** Thread display mode */
  thread: ThreadMode,

  /** Inline task shell mode */
  inlineTasks: InlineTaskMode,

  /** Agent selector mode */
  agentSelector: AgentSelectorMode,

  /** Connection status display */
  connectionStatus: ConnectionDisplayMode,

  /** Frame chrome level */
  frameChrome: FrameChromeLevel,

  /** Keyboard shortcut scope */
  keyboardShortcuts: KeyboardShortcutScope,

  /** Context chip mode */
  contextChips: ContextChipMode,

  /** Scroll behavior */
  scrollBehavior: ScrollBehavior,

  // ── Layout constraints ────────────────────────────────────

  /** Maximum height in pixels (undefined = unconstrained) */
  maxHeight: Schema.optional(Schema.Number),

  /** Maximum width in pixels (undefined = unconstrained) */
  maxWidth: Schema.optional(Schema.Number),

  /** Minimum height in pixels */
  minHeight: Schema.optional(Schema.Number),

  // ── Transfer system ───────────────────────────────────────

  /** Enable drag-out from this surface (inline tasks, messages) */
  enableTransferDrag: Schema.optional(Schema.Boolean),

  /** Enable drop-in to this surface (composer references) */
  enableTransferDrop: Schema.optional(Schema.Boolean),
})

export type ChatSurfaceSpec = typeof ChatSurfaceSpec.Type

// =============================================================================
// Spec Utilities
// =============================================================================

/**
 * Create a custom spec by merging overrides onto a base preset.
 *
 * ```ts
 * const mySpec = mergeSpec(presets.Dock, {
 *   composer: 'command',
 *   inlineTasks: 'hidden',
 * })
 * ```
 */
export function mergeSpec(
  base: ChatSurfaceSpec,
  overrides: Partial<Omit<ChatSurfaceSpec, '_tag' | 'label'>> & { _tag?: string; label?: string },
): ChatSurfaceSpec {
  return { ...base, ...overrides }
}

/**
 * Validate a spec at runtime. Returns decoded spec or throws.
 */
export function decodeSpec(input: unknown): ChatSurfaceSpec {
  return Schema.decodeUnknownSync(ChatSurfaceSpec)(input)
}
