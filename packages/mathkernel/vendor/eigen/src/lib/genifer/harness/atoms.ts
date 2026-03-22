/**
 * Genifer Harness Atoms — Custom effect-atom state for harness integration
 *
 * Atom-as-State pattern: these are the primary state stores.
 * Service methods mutate atoms directly. React subscribes directly.
 * No Effect.Ref→Atom bridge. No polling. No streams-to-consume-streams.
 *
 * Atoms:
 *   surfaceRegistryAtom  — all active surfaces (Map<id, GeniferSurface>)
 *   activeGenerationAtom — current generation/refinement in progress
 *   streamDeltasAtom     — incremental element discovery events
 *   qualityMetricsAtom   — quality metadata for current surface
 *   threadHistoryAtom    — previous generations in conversation
 *   catalogContextAtom   — available component types for prompt enrichment
 *   sessionTreeIdsAtom   — persisted tree IDs in this session
 *
 * @module genifer/harness/atoms
 */

import * as Atom from '@effect-atom/atom/Atom'
import type { GeniferSurface } from './surface'
import type { GeniferStreamDeltaEvent } from './schemas'
import type { TreeSummary } from '../services'

// =============================================================================
// Active Generation State
// =============================================================================

export interface ActiveGeneration {
  readonly toolCallId: string
  readonly surfaceId: string
  readonly prompt: string
  readonly instruction: string | null  // non-null for refine
  readonly status: 'streaming' | 'normalizing' | 'persisting' | 'complete' | 'error'
  readonly model: string
  readonly startedAt: number
  readonly elementCount: number
  readonly error: string | null
}

/**
 * Currently active generation/refinement (null when idle).
 * Only one generation can be active at a time.
 */
export const activeGenerationAtom = Atom.make<ActiveGeneration | null>(null).pipe(Atom.keepAlive)

// =============================================================================
// Surface Registry
// =============================================================================

/**
 * All active surfaces in the thread, keyed by surface ID.
 * Multiple surfaces coexist — each genifer output is its own surface.
 */
export const surfaceRegistryAtom = Atom.make<ReadonlyMap<string, GeniferSurface>>(
  new Map(),
).pipe(Atom.keepAlive)

// =============================================================================
// Stream Deltas
// =============================================================================

/**
 * Incremental element discovery events for the current generation.
 * Reset when a new generation starts. Drives streaming preview rendering.
 */
export const streamDeltasAtom = Atom.make<readonly GeniferStreamDeltaEvent[]>([]).pipe(
  Atom.keepAlive,
)

// =============================================================================
// Quality Metrics
// =============================================================================

export interface QualityMetrics {
  readonly surfaceId: string
  readonly score: number
  readonly elementCount: number
  readonly repairCount: number
  readonly durationMs: number
  readonly model: string
}

/**
 * Quality metrics for the most recently completed surface.
 */
export const qualityMetricsAtom = Atom.make<QualityMetrics | null>(null).pipe(Atom.keepAlive)

// =============================================================================
// Thread History
// =============================================================================

/**
 * Previous generation summaries in the conversation thread (oldest first).
 * Enables context-aware refinement (the LLM can see what was generated before).
 */
export const threadHistoryAtom = Atom.make<readonly TreeSummary[]>([]).pipe(Atom.keepAlive)

// =============================================================================
// Catalog Context
// =============================================================================

export interface CatalogContext {
  /** All available component types (from CatalogService) */
  readonly availableTypes: readonly string[]
  /** Recently used composite names */
  readonly recentComposites: readonly string[]
  /** Top-ranked composite names */
  readonly topComposites: readonly string[]
}

/**
 * Catalog context for prompt enrichment.
 * Populated at service init, refreshed when composites change.
 */
export const catalogContextAtom = Atom.make<CatalogContext | null>(null).pipe(Atom.keepAlive)

// =============================================================================
// Session Tree IDs
// =============================================================================

/**
 * Persisted tree IDs created in this session.
 * Enables the genifer_query tool to list "trees from this session."
 */
export const sessionTreeIdsAtom = Atom.make<readonly string[]>([]).pipe(Atom.keepAlive)

// =============================================================================
// Focused Surface
// =============================================================================

/**
 * Currently focused surface ID (for keyboard navigation, refinement targeting).
 * null = no surface focused.
 */
export const focusedSurfaceIdAtom = Atom.make<string | null>(null).pipe(Atom.keepAlive)

// =============================================================================
// Derived: Surface Count
// =============================================================================

/**
 * Number of active surfaces (derived).
 */
export const surfaceCountAtom = Atom.make((get) => {
  return get(surfaceRegistryAtom).size
})
