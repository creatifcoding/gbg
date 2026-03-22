/**
 * usePanelPersistence — localStorage persistence as a side-effect hook
 *
 * Restores panel state on mount. Subscribes to stx changes and
 * persists to localStorage. Fire-and-forget — no return value.
 *
 * @module
 */

import { useEffect } from 'react'
import {
  getFloatingStx,
  restorePersistedState,
} from '../floating-stx'
import type { PanelStorage } from '../types'

const STORAGE_KEY = 'tmnl-floating-panels'

export interface UsePanelPersistenceOptions {
  disabled?: boolean
}

/**
 * Hook that handles localStorage persistence for floating panels.
 *
 * - On mount: restores persisted positions/dimensions/visibility
 * - On stx change: serializes panel state to localStorage
 */
export function usePanelPersistence({ disabled = false }: UsePanelPersistenceOptions = {}): void {
  const stx = getFloatingStx()

  // ─── Restore on mount ──────────────────────────────────────────
  useEffect(() => {
    if (disabled) return
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const storage = JSON.parse(stored) as PanelStorage
        restorePersistedState(storage)
      }
    } catch { /* Ignore parse errors */ }
  }, [disabled])

  // ─── Subscribe + persist on change ─────────────────────────────
  useEffect(() => {
    if (disabled) return
    const disposer = stx.subscribe(() => {
      const panels = stx.data.panels.peek()
      const zOrder = stx.data.zOrder.peek()
      const storage: PanelStorage = { panels: {}, order: zOrder, version: 1 }
      panels.forEach((panel, id) => {
        storage.panels[id] = {
          position: panel.position,
          dimensions: panel.dimensions,
          visibility: panel.visibility,
          mode: panel.mode,
        }
      })
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(storage)) } catch { /* Storage full */ }
    })
    return disposer
  }, [disabled, stx])
}
