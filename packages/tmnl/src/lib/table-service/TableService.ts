/**
 * TableService
 *
 * Effect.Service for TmnlDataGrid variant configuration.
 * Manages presets, per-grid overrides, and layered inheritance.
 *
 * @example
 * ```tsx
 * // In atoms/index.ts
 * export const tableServiceRuntime = Atom.runtime(TableService.Default)
 *
 * // Usage via atoms
 * const presets = useAtomValue(presetsAtom)
 * const createPreset = useAtomValue(createPresetOp)
 * ```
 *
 * @module
 */

import { Context, Effect, Layer, Ref, Option } from 'effect'
import { nanoid } from 'nanoid'
import type {
  PresetId,
  GridId,
  Preset,
  GridOverride,
  TableServiceState,
} from './types'
import { initialState, CURRENT_VERSION } from './types'
import type { GridVariant, GridVariantPartial } from '@/lib/data-grid/schemas/variant'
import { DEFAULT_VARIANT } from '@/lib/data-grid/variants'
import {
  deepMerge,
  loadPersistedState,
  savePersistedState,
  createDebouncedPersist,
} from './persistence'

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface TableServiceShape {
  // ---------------------------------------------------------------------------
  // Preset CRUD
  // ---------------------------------------------------------------------------

  /** Get all presets */
  readonly getPresets: Effect.Effect<ReadonlyArray<Preset>>

  /** Get preset by ID */
  readonly getPreset: (id: PresetId) => Effect.Effect<Option.Option<Preset>>

  /** Create a new preset from current variant */
  readonly createPreset: (
    name: string,
    variant: GridVariant
  ) => Effect.Effect<Preset>

  /** Update an existing preset */
  readonly updatePreset: (
    id: PresetId,
    partial: Partial<Pick<Preset, 'name'> & { variant: Partial<GridVariant> }>
  ) => Effect.Effect<Option.Option<Preset>>

  /** Delete a preset (fails for built-in) */
  readonly deletePreset: (id: PresetId) => Effect.Effect<boolean>

  // ---------------------------------------------------------------------------
  // Active Preset
  // ---------------------------------------------------------------------------

  /** Get the active preset ID (null = default variant) */
  readonly getActivePresetId: Effect.Effect<PresetId | null>

  /** Set the active preset */
  readonly setActivePreset: (id: PresetId | null) => Effect.Effect<void>

  /** Get the resolved active variant (preset or default) */
  readonly getActiveVariant: Effect.Effect<GridVariant>

  // ---------------------------------------------------------------------------
  // Grid Overrides (Layered Inheritance)
  // ---------------------------------------------------------------------------

  /** Get variant for a specific grid with layered resolution */
  readonly getVariantForGrid: (gridId: GridId) => Effect.Effect<GridVariant>

  /** Set grid-specific override */
  readonly setGridOverride: (
    gridId: GridId,
    overrides: GridVariantPartial
  ) => Effect.Effect<void>

  /** Clear grid-specific override */
  readonly clearGridOverride: (gridId: GridId) => Effect.Effect<void>

  /** Get all grid overrides */
  readonly getGridOverrides: Effect.Effect<Record<string, GridOverride>>

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  /** Force persist current state */
  readonly persist: Effect.Effect<void>

  /** Restore state from storage */
  readonly restore: Effect.Effect<void>

  // ---------------------------------------------------------------------------
  // Internal State Access
  // ---------------------------------------------------------------------------

  /** Get full service state (for atoms) */
  readonly getState: Effect.Effect<TableServiceState>
}

// =============================================================================
// SERVICE TAG
// =============================================================================

export class TableService extends Context.Tag('tmnl/TableService')<
  TableService,
  TableServiceShape
>() {
  /**
   * Default service layer with localStorage persistence.
   */
  static Default = Layer.effect(
    TableService,
    Effect.gen(function* () {
      // Internal state ref
      const stateRef = yield* Ref.make<TableServiceState>(initialState)

      // Debounced persist (500ms delay)
      const debouncedPersist = createDebouncedPersist(500)

      // Auto-persist on state change
      const persistOnChange = () => {
        Effect.runPromise(Ref.get(stateRef)).then(debouncedPersist)
      }

      // -----------------------------------------------------------------------
      // Preset CRUD
      // -----------------------------------------------------------------------

      const getPresets: TableServiceShape['getPresets'] = Effect.gen(
        function* () {
          const state = yield* Ref.get(stateRef)
          return state.presets
        }
      )

      const getPreset: TableServiceShape['getPreset'] = (id) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const preset = state.presets.find((p) => p.id === id)
          return preset ? Option.some(preset) : Option.none()
        })

      const createPreset: TableServiceShape['createPreset'] = (name, variant) =>
        Effect.gen(function* () {
          const now = new Date()
          const preset: Preset = {
            id: nanoid(8) as PresetId,
            name: name as typeof name & { readonly NonEmptyString: unique symbol },
            variant,
            createdAt: now,
            updatedAt: now,
            isBuiltIn: false,
          }

          yield* Ref.update(stateRef, (state) => ({
            ...state,
            presets: [...state.presets, preset],
          }))

          persistOnChange()
          return preset
        })

      const updatePreset: TableServiceShape['updatePreset'] = (id, partial) =>
        Effect.gen(function* () {
          let updated: Preset | null = null

          yield* Ref.update(stateRef, (state) => {
            const index = state.presets.findIndex((p) => p.id === id)
            if (index === -1) return state

            const existing = state.presets[index]
            updated = {
              ...existing,
              name: partial.name
                ? (partial.name as typeof existing.name)
                : existing.name,
              variant: partial.variant
                ? deepMerge(existing.variant, partial.variant as Partial<GridVariant>)
                : existing.variant,
              updatedAt: new Date(),
            }

            const newPresets = [...state.presets]
            newPresets[index] = updated
            return { ...state, presets: newPresets }
          })

          if (updated) persistOnChange()
          return updated ? Option.some(updated) : Option.none()
        })

      const deletePreset: TableServiceShape['deletePreset'] = (id) =>
        Effect.gen(function* () {
          let deleted = false

          yield* Ref.update(stateRef, (state) => {
            const preset = state.presets.find((p) => p.id === id)
            if (!preset || preset.isBuiltIn) return state

            deleted = true
            return {
              ...state,
              presets: state.presets.filter((p) => p.id !== id),
              // Clear active if deleted
              activePresetId:
                state.activePresetId === id ? null : state.activePresetId,
            }
          })

          if (deleted) persistOnChange()
          return deleted
        })

      // -----------------------------------------------------------------------
      // Active Preset
      // -----------------------------------------------------------------------

      const getActivePresetId: TableServiceShape['getActivePresetId'] =
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return state.activePresetId
        })

      const setActivePreset: TableServiceShape['setActivePreset'] = (id) =>
        Effect.gen(function* () {
          yield* Ref.update(stateRef, (state) => ({
            ...state,
            activePresetId: id,
          }))
          persistOnChange()
        })

      const getActiveVariant: TableServiceShape['getActiveVariant'] = Effect.gen(
        function* () {
          const state = yield* Ref.get(stateRef)

          if (state.activePresetId === null) {
            return DEFAULT_VARIANT
          }

          const preset = state.presets.find(
            (p) => p.id === state.activePresetId
          )
          return preset?.variant ?? DEFAULT_VARIANT
        }
      )

      // -----------------------------------------------------------------------
      // Grid Overrides (Layered Inheritance)
      // -----------------------------------------------------------------------

      const getVariantForGrid: TableServiceShape['getVariantForGrid'] = (
        gridId
      ) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)

          // Layer 1: Start with default or active preset
          const base = yield* getActiveVariant

          // Layer 2: Apply grid-specific overrides
          const override = state.gridOverrides[gridId]
          if (!override) return base

          // Deep merge override on top of base
          return deepMerge(base, override.overrides as Partial<GridVariant>)
        })

      const setGridOverride: TableServiceShape['setGridOverride'] = (
        gridId,
        overrides
      ) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)

          const gridOverride: GridOverride = {
            gridId,
            basePresetId: state.activePresetId ?? undefined,
            overrides,
            updatedAt: new Date(),
          }

          yield* Ref.update(stateRef, (s) => ({
            ...s,
            gridOverrides: {
              ...s.gridOverrides,
              [gridId]: gridOverride,
            },
          }))

          persistOnChange()
        })

      const clearGridOverride: TableServiceShape['clearGridOverride'] = (
        gridId
      ) =>
        Effect.gen(function* () {
          yield* Ref.update(stateRef, (state) => {
            const { [gridId]: _, ...rest } = state.gridOverrides
            return { ...state, gridOverrides: rest }
          })
          persistOnChange()
        })

      const getGridOverrides: TableServiceShape['getGridOverrides'] = Effect.gen(
        function* () {
          const state = yield* Ref.get(stateRef)
          return state.gridOverrides
        }
      )

      // -----------------------------------------------------------------------
      // Persistence
      // -----------------------------------------------------------------------

      const persist: TableServiceShape['persist'] = Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        yield* savePersistedState(state)
      })

      const restore: TableServiceShape['restore'] = Effect.gen(function* () {
        const loaded = yield* loadPersistedState

        if (Option.isSome(loaded)) {
          yield* Ref.set(stateRef, loaded.value)
        }
      })

      // -----------------------------------------------------------------------
      // State Access
      // -----------------------------------------------------------------------

      const getState: TableServiceShape['getState'] = Ref.get(stateRef)

      // -----------------------------------------------------------------------
      // Auto-restore on init
      // -----------------------------------------------------------------------
      yield* restore

      // -----------------------------------------------------------------------
      // Return service shape
      // -----------------------------------------------------------------------
      return {
        getPresets,
        getPreset,
        createPreset,
        updatePreset,
        deletePreset,
        getActivePresetId,
        setActivePreset,
        getActiveVariant,
        getVariantForGrid,
        setGridOverride,
        clearGridOverride,
        getGridOverrides,
        persist,
        restore,
        getState,
      } satisfies TableServiceShape
    })
  )
}
