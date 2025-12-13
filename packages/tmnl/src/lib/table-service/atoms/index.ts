/**
 * TableService Atoms (Materialized Views)
 *
 * These atoms represent the **materialized views** that TableService publishes.
 * Components subscribe to these atoms; TableService updates them during operations.
 *
 * Pattern:
 * - Atoms declared at module level (singleton, writable)
 * - Operation atoms use FnContext.set() to publish updates
 * - Components call useAtomValue() to subscribe
 * - Multiple components share the same view (same atom)
 *
 * @module
 */

import { Atom } from '@effect-atom/atom-react'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'

import { TableService } from '../TableService'
import { DEFAULT_VARIANT } from '@/lib/data-grid/variants'
import type { Preset, GridId, PresetId, TableServiceState } from '../types'
import type { GridVariant, GridVariantPartial } from '@/lib/data-grid/schemas/variant'

// =============================================================================
// Materialized View Atoms (Module-Level Singletons)
// =============================================================================

/**
 * All presets (built-in + user-created)
 */
export const presetsAtom = Atom.make<readonly Preset[]>([])

/**
 * Currently active preset ID (null = default variant)
 */
export const activePresetIdAtom = Atom.make<PresetId | null>(null)

/**
 * Resolved active variant (preset variant or default)
 */
export const activeVariantAtom = Atom.make<GridVariant>(DEFAULT_VARIANT)

/**
 * Per-grid overrides keyed by GridId
 */
export const gridOverridesAtom = Atom.make<Record<string, { overrides: GridVariantPartial }>>({})

/**
 * Service ready state
 */
export const isReadyAtom = Atom.make<boolean>(false)

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * Count of user-created (non-built-in) presets
 */
export const userPresetCountAtom = Atom.make((get) => {
  const presets = get(presetsAtom)
  return presets.filter((p) => !p.isBuiltIn).length
})

/**
 * Active preset instance (resolved from ID)
 */
export const activePresetAtom = Atom.make((get) => {
  const presetId = get(activePresetIdAtom)
  const presets = get(presetsAtom)

  if (presetId === null) return null
  return presets.find((p) => p.id === presetId) ?? null
})

/**
 * Whether a preset is currently active (vs using default)
 */
export const hasActivePresetAtom = Atom.make((get) => {
  return get(activePresetIdAtom) !== null
})

// =============================================================================
// Runtime Atom (For Effect Operations)
// =============================================================================

/**
 * TableService Runtime Atom
 *
 * Provides Effect runtime for operations that need TableService.
 * Used by operation atoms to execute Effects.
 */
export const tableServiceRuntimeAtom = Atom.runtime(TableService.Default)

// =============================================================================
// Sync State Helper
// =============================================================================

/**
 * Sync service state to atoms.
 * Called by operations to keep atoms in sync with service state.
 */
const syncState = (ctx: { set: <T>(atom: Atom.Writable<T>, value: T) => void }) =>
  Effect.gen(function* () {
    const service = yield* TableService
    const state = yield* service.getState

    ctx.set(presetsAtom, state.presets)
    ctx.set(activePresetIdAtom, state.activePresetId)
    ctx.set(gridOverridesAtom, state.gridOverrides as Record<string, { overrides: GridVariantPartial }>)

    // Resolve active variant
    const activeVariant = yield* service.getActiveVariant
    ctx.set(activeVariantAtom, activeVariant)
  })

// =============================================================================
// Operation Atoms (Mutations via Effect)
// =============================================================================

/**
 * Preset Operations
 */
export const presetOps = {
  /**
   * Initialize service and sync state to atoms
   */
  init: tableServiceRuntimeAtom.fn()((_, ctx) =>
    Effect.gen(function* () {
      yield* syncState(ctx)
      ctx.set(isReadyAtom, true)
    })
  ),

  /**
   * Create a new preset
   */
  create: tableServiceRuntimeAtom.fn<{ name: string; variant: GridVariant }>()(
    ({ name, variant }, ctx) =>
      Effect.gen(function* () {
        const service = yield* TableService
        const preset = yield* service.createPreset(name, variant)
        yield* syncState(ctx)
        return preset
      })
  ),

  /**
   * Update an existing preset
   */
  update: tableServiceRuntimeAtom.fn<{
    id: PresetId
    partial: Partial<Pick<Preset, 'name'> & { variant: Partial<GridVariant> }>
  }>()(({ id, partial }, ctx) =>
    Effect.gen(function* () {
      const service = yield* TableService
      const result = yield* service.updatePreset(id, partial)
      yield* syncState(ctx)
      return Option.getOrNull(result)
    })
  ),

  /**
   * Delete a preset
   */
  delete: tableServiceRuntimeAtom.fn<PresetId>()((id, ctx) =>
    Effect.gen(function* () {
      const service = yield* TableService
      const deleted = yield* service.deletePreset(id)
      yield* syncState(ctx)
      return deleted
    })
  ),

  /**
   * Set active preset
   */
  setActive: tableServiceRuntimeAtom.fn<PresetId | null>()((id, ctx) =>
    Effect.gen(function* () {
      const service = yield* TableService
      yield* service.setActivePreset(id)
      yield* syncState(ctx)
    })
  ),
}

/**
 * Grid Override Operations
 */
export const gridOps = {
  /**
   * Get variant for a specific grid (with layered resolution)
   */
  getVariant: tableServiceRuntimeAtom.fn<GridId>()((gridId, _ctx) =>
    Effect.gen(function* () {
      const service = yield* TableService
      return yield* service.getVariantForGrid(gridId)
    })
  ),

  /**
   * Set grid-specific override
   */
  setOverride: tableServiceRuntimeAtom.fn<{
    gridId: GridId
    overrides: GridVariantPartial
  }>()(({ gridId, overrides }, ctx) =>
    Effect.gen(function* () {
      const service = yield* TableService
      yield* service.setGridOverride(gridId, overrides)
      yield* syncState(ctx)
    })
  ),

  /**
   * Clear grid-specific override
   */
  clearOverride: tableServiceRuntimeAtom.fn<GridId>()((gridId, ctx) =>
    Effect.gen(function* () {
      const service = yield* TableService
      yield* service.clearGridOverride(gridId)
      yield* syncState(ctx)
    })
  ),
}

/**
 * Persistence Operations
 */
export const persistOps = {
  /**
   * Force persist current state
   */
  persist: tableServiceRuntimeAtom.fn()((_, _ctx) =>
    Effect.gen(function* () {
      const service = yield* TableService
      yield* service.persist
    })
  ),

  /**
   * Restore state from storage
   */
  restore: tableServiceRuntimeAtom.fn()((_, ctx) =>
    Effect.gen(function* () {
      const service = yield* TableService
      yield* service.restore
      yield* syncState(ctx)
    })
  ),
}
