/**
 * Floating STX Effect programs
 *
 * Side-effectful operations: persistence, modal spawn.
 * These run inside the Effect runtime, NOT raw JS.
 *
 * NOTE: Effects use late-bound references to avoid import cycles.
 * getFloatingStx() and registerPanel() are resolved at call time,
 * not at import time.
 *
 * @module
 */

import { Effect } from 'effect'
import type { PanelStorage, Position } from '../types'
import { STORAGE_KEY } from './constants'

export const floatingEffects = {
  /**
   * Persist panel state to localStorage
   */
  persist: Effect.gen(function* () {
    yield* Effect.sync(() => {
      // Late-bind: imported at call time to avoid circular
      const { getFloatingStx } = require('./instance')
      const stx = getFloatingStx()
      const panels = stx.data.panels.peek()
      const zOrder = stx.data.zOrder.peek()

      const storage: PanelStorage = {
        panels: {},
        order: zOrder,
        version: 1,
      }

      panels.forEach((panel: any, id: string) => {
        storage.panels[id] = {
          position: panel.position,
          dimensions: panel.dimensions,
          visibility: panel.visibility,
          mode: panel.mode,
        }
      })

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storage))
      } catch { /* Storage might be full */ }
    })
  }),

  /**
   * Restore panel state from localStorage
   */
  restore: Effect.gen(function* () {
    yield* Effect.sync(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return null
        return JSON.parse(stored) as PanelStorage
      } catch {
        return null
      }
    })
  }),

  /**
   * Spawn a floating panel from modal detach
   */
  spawnFromModal: (visitorId: string, visitorData: unknown, position?: Position) =>
    Effect.gen(function* () {
      const panelId = `modal-${visitorId}-${Date.now()}`

      yield* Effect.sync(() => {
        // Late-bind: imported at call time to avoid circular
        const { registerPanel } = require('./actions')
        registerPanel({
          id: panelId,
          title: visitorId,
          mode: 'floating',
          initialPosition: position,
          visitorId,
          visitorData,
        })
      })

      return panelId
    }),
}
