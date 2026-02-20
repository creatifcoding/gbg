/**
 * ContentViewSpec — Preset-Aware Compound Rendering Configuration
 *
 * Derived from ChatSurfaceSpec, this schema defines HOW content block
 * compounds render at each density tier. Every compound reads this
 * from context and self-adapts.
 *
 * Three density tiers:
 * - full:    All detail visible — expanded blocks, rich chrome, full interactivity
 * - compact: Collapsed by default — single-line summaries, expand on click
 * - pill:    Minimal indicators — icon/dot only, tooltip for detail
 *
 * 7 adaptation axes:
 * 1. density            — full / compact / pill
 * 2. interactivity      — expand/collapse, approval actions, copy buttons
 * 3. animation          — enter/exit, pulse, expand transitions
 * 4. maxBlockHeight     — overflow scroll threshold per block
 * 5. autoCollapse       — collapse thinking/tool blocks after streaming completes
 * 6. groupAdjacent      — coalesce adjacent same-type parts
 * 7. tokenBudgetVisible — show/hide token usage & cost
 *
 * @module morphchat/schemas/content-view-spec
 */

import { Schema } from 'effect'
import type { ChatSurfaceSpec } from './surface-spec'

// =============================================================================
// Density Tier
// =============================================================================

export const ContentDensity = Schema.Literal('full', 'compact', 'pill')
export type ContentDensity = typeof ContentDensity.Type

// =============================================================================
// Interactivity Config
// =============================================================================

export const InteractivityConfig = Schema.Struct({
  /** Can blocks expand/collapse on click? */
  expandCollapse: Schema.Boolean,
  /** Show approval actions on tool blocks? */
  approvalActions: Schema.Boolean,
  /** Show copy button on code blocks? */
  copyButton: Schema.Boolean,
  /** Show footer actions (copy/retry/feedback) on messages? */
  footerActions: Schema.Boolean,
})
export type InteractivityConfig = typeof InteractivityConfig.Type

// =============================================================================
// Animation Config
// =============================================================================

export const AnimationConfig = Schema.Struct({
  /** Enable enter/exit animations on blocks */
  enterExit: Schema.Boolean,
  /** Enable streaming pulse/shimmer */
  streamingPulse: Schema.Boolean,
  /** Enable expand/collapse transitions */
  expandTransition: Schema.Boolean,
  /** Enable morph transitions between density tiers */
  morphTransition: Schema.Boolean,
})
export type AnimationConfig = typeof AnimationConfig.Type

// =============================================================================
// Spacing Config
// =============================================================================

export const SpacingConfig = Schema.Struct({
  /** Gap between messages in px */
  messageGap: Schema.Number,
  /** Gap between parts within a message in px */
  partGap: Schema.Number,
  /** Padding inside content blocks in px */
  blockPadding: Schema.Number,
})
export type SpacingConfig = typeof SpacingConfig.Type

// =============================================================================
// Per-Block Overrides
// =============================================================================

/**
 * Optional overrides for individual block types.
 * If undefined, the block uses the top-level density.
 */
export const BlockOverrides = Schema.Struct({
  thinking: Schema.optional(ContentDensity),
  tool: Schema.optional(ContentDensity),
  code: Schema.optional(ContentDensity),
  tokenUsage: Schema.optional(ContentDensity),
  fileAttachment: Schema.optional(ContentDensity),
})
export type BlockOverrides = typeof BlockOverrides.Type

// =============================================================================
// ContentViewSpec — The Complete Config
// =============================================================================

export const ContentViewSpec = Schema.Struct({
  // ── Core density ──────────────────────────────────────────
  density: ContentDensity,

  // ── 7 adaptation axes ─────────────────────────────────────
  interactivity: InteractivityConfig,
  animation: AnimationConfig,
  spacing: SpacingConfig,

  /** Max height for individual content blocks before overflow scroll (0 = no limit) */
  maxBlockHeight: Schema.Number,

  /** Auto-collapse thinking/tool blocks after streaming completes */
  autoCollapse: Schema.Boolean,

  /** Coalesce adjacent same-type parts into grouped renders */
  groupAdjacent: Schema.Boolean,

  /** Show token usage & cost display */
  tokenBudgetVisible: Schema.Boolean,

  // ── Per-block overrides ───────────────────────────────────
  blockOverrides: Schema.optional(BlockOverrides),
})
export type ContentViewSpec = typeof ContentViewSpec.Type

// =============================================================================
// Preset Tier Defaults
// =============================================================================

const FULL: ContentViewSpec = {
  density: 'full',
  interactivity: {
    expandCollapse: true,
    approvalActions: true,
    copyButton: true,
    footerActions: true,
  },
  animation: {
    enterExit: true,
    streamingPulse: true,
    expandTransition: true,
    morphTransition: true,
  },
  spacing: {
    messageGap: 16,
    partGap: 8,
    blockPadding: 12,
  },
  maxBlockHeight: 400,
  autoCollapse: false,
  groupAdjacent: false,
  tokenBudgetVisible: true,
}

const COMPACT: ContentViewSpec = {
  density: 'compact',
  interactivity: {
    expandCollapse: true,
    approvalActions: false,
    copyButton: true,
    footerActions: false,
  },
  animation: {
    enterExit: true,
    streamingPulse: true,
    expandTransition: true,
    morphTransition: true,
  },
  spacing: {
    messageGap: 8,
    partGap: 4,
    blockPadding: 8,
  },
  maxBlockHeight: 200,
  autoCollapse: true,
  groupAdjacent: true,
  tokenBudgetVisible: false,
}

const PILL: ContentViewSpec = {
  density: 'pill',
  interactivity: {
    expandCollapse: false,
    approvalActions: false,
    copyButton: false,
    footerActions: false,
  },
  animation: {
    enterExit: false,
    streamingPulse: false,
    expandTransition: false,
    morphTransition: true,
  },
  spacing: {
    messageGap: 4,
    partGap: 2,
    blockPadding: 4,
  },
  maxBlockHeight: 0,
  autoCollapse: true,
  groupAdjacent: true,
  tokenBudgetVisible: false,
}

/** Tier defaults indexed by density name */
export const DENSITY_TIERS = { full: FULL, compact: COMPACT, pill: PILL } as const

// =============================================================================
// Preset → ContentViewSpec Mapping
// =============================================================================

/**
 * Maps a preset _tag to its default density tier.
 *
 * Conductor / Monitor → full
 * Dock / Dialog / Embed → compact
 * Widget / Card / Spotlight → pill
 *
 * Individual presets can apply surgical overrides on top of tier defaults.
 */
const PRESET_MAP: Record<string, ContentViewSpec> = {
  // ── Full tier ─────────────────────────────────────────────
  conductor: { ...FULL },
  monitor: {
    ...FULL,
    autoCollapse: true, // Monitor watches, doesn't interact
    interactivity: { ...FULL.interactivity, approvalActions: false },
  },

  // ── Compact tier ──────────────────────────────────────────
  dock: { ...COMPACT },
  dialog: {
    ...COMPACT,
    tokenBudgetVisible: true, // Dialogs may show cost
  },
  embed: {
    ...COMPACT,
    interactivity: { ...COMPACT.interactivity, expandCollapse: false }, // Embedded = no expand
  },

  // ── Pill tier ─────────────────────────────────────────────
  widget: { ...PILL },
  card: { ...PILL },
  spotlight: {
    ...PILL,
    spacing: { ...PILL.spacing, messageGap: 2 }, // Tightest possible
  },
}

/**
 * Derive ContentViewSpec from a ChatSurfaceSpec.
 *
 * Looks up the preset by `spec._tag`, falls back to compact tier.
 * Consumers call this once when spec changes; the result is placed
 * into React context for all compounds to read.
 */
export function deriveContentViewSpec(spec: ChatSurfaceSpec): ContentViewSpec {
  return PRESET_MAP[spec._tag] ?? COMPACT
}

/**
 * Merge overrides onto a ContentViewSpec (for runtime customization).
 */
export function mergeContentViewSpec(
  base: ContentViewSpec,
  overrides: Partial<ContentViewSpec>,
): ContentViewSpec {
  return {
    ...base,
    ...overrides,
    interactivity: { ...base.interactivity, ...overrides.interactivity },
    animation: { ...base.animation, ...overrides.animation },
    spacing: { ...base.spacing, ...overrides.spacing },
  }
}
