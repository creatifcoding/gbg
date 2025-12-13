/**
 * useTableService Hook
 *
 * Main React hook for TableService integration.
 * Provides access to atoms and operations.
 *
 * @example
 * ```tsx
 * function VariantBuilder() {
 *   const {
 *     presets,
 *     activeVariant,
 *     createPreset,
 *     setActivePreset,
 *     getVariantForGrid,
 *   } = useTableService()
 *
 *   const handleSave = async () => {
 *     await createPreset('My Preset', currentVariant)
 *   }
 *
 *   return (
 *     <div>
 *       <select onChange={(e) => setActivePreset(e.target.value)}>
 *         {presets.map((p) => <option key={p.id}>{p.name}</option>)}
 *       </select>
 *     </div>
 *   )
 * }
 * ```
 *
 * @module
 */

import { useCallback, useEffect } from 'react'
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react'

import {
  presetsAtom,
  activePresetIdAtom,
  activeVariantAtom,
  gridOverridesAtom,
  isReadyAtom,
  userPresetCountAtom,
  activePresetAtom,
  hasActivePresetAtom,
  presetOps,
  gridOps,
  persistOps,
} from '../atoms'
import type { Preset, GridId, PresetId } from '../types'
import type { GridVariant, GridVariantPartial } from '@/lib/data-grid/schemas/variant'

// =============================================================================
// Types
// =============================================================================

export interface UseTableServiceResult {
  // State (from atoms)
  readonly presets: readonly Preset[]
  readonly activePresetId: PresetId | null
  readonly activeVariant: GridVariant
  readonly activePreset: Preset | null
  readonly gridOverrides: Record<string, { overrides: GridVariantPartial }>
  readonly isReady: boolean

  // Derived state
  readonly userPresetCount: number
  readonly hasActivePreset: boolean

  // Preset operations
  readonly createPreset: (name: string, variant: GridVariant) => Promise<Preset>
  readonly updatePreset: (
    id: PresetId,
    partial: Partial<Pick<Preset, 'name'> & { variant: Partial<GridVariant> }>
  ) => Promise<Preset | null>
  readonly deletePreset: (id: PresetId) => Promise<boolean>
  readonly setActivePreset: (id: PresetId | null) => Promise<void>

  // Grid operations
  readonly getVariantForGrid: (gridId: GridId) => Promise<GridVariant>
  readonly setGridOverride: (
    gridId: GridId,
    overrides: GridVariantPartial
  ) => Promise<void>
  readonly clearGridOverride: (gridId: GridId) => Promise<void>

  // Persistence
  readonly persist: () => Promise<void>
  readonly restore: () => Promise<void>
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * useTableService - Main hook for TableService integration
 *
 * Provides reactive access to variant presets and operations.
 * All state updates are automatic via effect-atom subscriptions.
 *
 * Auto-initializes on first mount.
 */
export function useTableService(): UseTableServiceResult {
  // ---------------------------------------------------------------------------
  // Atom Subscriptions
  // ---------------------------------------------------------------------------

  const presets = useAtomValue(presetsAtom)
  const activePresetId = useAtomValue(activePresetIdAtom)
  const activeVariant = useAtomValue(activeVariantAtom)
  const gridOverrides = useAtomValue(gridOverridesAtom)
  const isReady = useAtomValue(isReadyAtom)

  // Derived atoms
  const userPresetCount = useAtomValue(userPresetCountAtom)
  const activePreset = useAtomValue(activePresetAtom)
  const hasActivePreset = useAtomValue(hasActivePresetAtom)

  // ---------------------------------------------------------------------------
  // Operation Setters
  // ---------------------------------------------------------------------------

  const doInit = useAtomSet(presetOps.init, { mode: 'promise' })
  const doCreate = useAtomSet(presetOps.create, { mode: 'promise' })
  const doUpdate = useAtomSet(presetOps.update, { mode: 'promise' })
  const doDelete = useAtomSet(presetOps.delete, { mode: 'promise' })
  const doSetActive = useAtomSet(presetOps.setActive, { mode: 'promise' })

  const doGetVariant = useAtomSet(gridOps.getVariant, { mode: 'promise' })
  const doSetOverride = useAtomSet(gridOps.setOverride, { mode: 'promise' })
  const doClearOverride = useAtomSet(gridOps.clearOverride, { mode: 'promise' })

  const doPersist = useAtomSet(persistOps.persist, { mode: 'promise' })
  const doRestore = useAtomSet(persistOps.restore, { mode: 'promise' })

  // ---------------------------------------------------------------------------
  // Auto-Initialize
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isReady) {
      doInit(undefined).catch(console.error)
    }
  }, [isReady, doInit])

  // ---------------------------------------------------------------------------
  // Wrapped Operations
  // ---------------------------------------------------------------------------

  const createPreset = useCallback(
    async (name: string, variant: GridVariant): Promise<Preset> => {
      return (await doCreate({ name, variant })) as Preset
    },
    [doCreate]
  )

  const updatePreset = useCallback(
    async (
      id: PresetId,
      partial: Partial<Pick<Preset, 'name'> & { variant: Partial<GridVariant> }>
    ): Promise<Preset | null> => {
      return (await doUpdate({ id, partial })) as Preset | null
    },
    [doUpdate]
  )

  const deletePreset = useCallback(
    async (id: PresetId): Promise<boolean> => {
      return (await doDelete(id)) as boolean
    },
    [doDelete]
  )

  const setActivePreset = useCallback(
    async (id: PresetId | null): Promise<void> => {
      await doSetActive(id)
    },
    [doSetActive]
  )

  const getVariantForGrid = useCallback(
    async (gridId: GridId): Promise<GridVariant> => {
      return (await doGetVariant(gridId)) as GridVariant
    },
    [doGetVariant]
  )

  const setGridOverride = useCallback(
    async (gridId: GridId, overrides: GridVariantPartial): Promise<void> => {
      await doSetOverride({ gridId, overrides })
    },
    [doSetOverride]
  )

  const clearGridOverride = useCallback(
    async (gridId: GridId): Promise<void> => {
      await doClearOverride(gridId)
    },
    [doClearOverride]
  )

  const persist = useCallback(async (): Promise<void> => {
    await doPersist(undefined)
  }, [doPersist])

  const restore = useCallback(async (): Promise<void> => {
    await doRestore(undefined)
  }, [doRestore])

  // ---------------------------------------------------------------------------
  // Return Interface
  // ---------------------------------------------------------------------------

  return {
    // State
    presets,
    activePresetId,
    activeVariant,
    activePreset,
    gridOverrides,
    isReady,

    // Derived
    userPresetCount,
    hasActivePreset,

    // Preset operations
    createPreset,
    updatePreset,
    deletePreset,
    setActivePreset,

    // Grid operations
    getVariantForGrid,
    setGridOverride,
    clearGridOverride,

    // Persistence
    persist,
    restore,
  }
}
