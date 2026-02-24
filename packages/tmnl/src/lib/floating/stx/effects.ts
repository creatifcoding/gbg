/**
 * Floating STX Effect programs
 *
 * Side-effectful operations: persistence, modal spawn.
 * These run inside the Effect runtime, NOT raw JS.
 *
 * Uses lazy ESM imports (cached) to avoid static import cycles
 * while remaining browser-safe (no CommonJS require()).
 *
 * @module
 */

import { Effect } from 'effect'
import type { PanelStorage, Position } from '../types'
import { serialize, deserialize } from '../layout/split-tree'
import { STORAGE_KEY } from './constants'

let instanceModulePromise: Promise<typeof import('./instance')> | null = null
let actionsModulePromise: Promise<typeof import('./actions')> | null = null

const loadInstanceModule = () => {
  if (!instanceModulePromise) instanceModulePromise = import('./instance')
  return instanceModulePromise
}

const loadActionsModule = () => {
  if (!actionsModulePromise) actionsModulePromise = import('./actions')
  return actionsModulePromise
}

const getFloatingStxEffect = Effect.tryPromise({
  try: async () => {
    const mod = await loadInstanceModule()
    return mod.getFloatingStx()
  },
  catch: (cause) => new Error(`Failed to load floating instance module: ${String(cause)}`),
})

const registerPanelEffect = (input: {
  id: string
  title: string
  mode: 'floating'
  initialPosition?: Position
  visitorId: string
  visitorData: unknown
}) =>
  Effect.tryPromise({
    try: async () => {
      const mod = await loadActionsModule()
      mod.registerPanel(input)
    },
    catch: (cause) => new Error(`Failed to load floating actions module: ${String(cause)}`),
  })

export const floatingEffects = {
  /**
   * Persist panel state to localStorage
   */
  persist: Effect.gen(function* () {
    const stx = yield* getFloatingStxEffect

    yield* Effect.sync(() => {
      const panels = stx.data.panels.peek()
      const zOrder = stx.data.zOrder.peek()
      const panelTree = stx.data.panelTree.peek()

      const storage: PanelStorage & { panelTree?: unknown } = {
        panels: {},
        order: zOrder,
        version: 2,
        panelTree: panelTree ? serialize(panelTree) : undefined,
      }

      panels.forEach((panel: any, id: string) => {
        storage.panels[id] = {
          position: panel.position,
          dimensions: panel.dimensions,
          visibility: panel.visibility,
          mode: panel.mode,
          // Tiled persistence (SM Migration §14)
          tiledWidth: panel.tiledWidth,
          isCollapsed: panel.isCollapsed,
          floatOriginSide: panel.floatOriginSide,
          accent: panel.accent,
          headerHidden: panel.headerHidden,
        }
      })

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storage))
      } catch {
        // Storage might be full
      }
    })
  }),

  /**
   * Restore panel state from localStorage
   */
  restore: Effect.gen(function* () {
    return yield* Effect.sync(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return null
        return JSON.parse(stored) as PanelStorage & { panelTree?: unknown }
      } catch {
        return null
      }
    }).pipe(
      Effect.flatMap((parsed) =>
        Effect.gen(function* () {
          if (!parsed) return null

          // Restore panel tree if present (v2+)
          if (parsed.panelTree) {
            const stx = yield* getFloatingStxEffect
            const tree = deserialize(parsed.panelTree)
            if (tree) stx.data.panelTree.set(tree)
          }

          return parsed
        }),
      ),
    )
  }),

  /**
   * Spawn a floating panel from modal detach
   */
  spawnFromModal: (visitorId: string, visitorData: unknown, position?: Position) =>
    Effect.gen(function* () {
      const panelId = `modal-${visitorId}-${Date.now()}`

      yield* registerPanelEffect({
        id: panelId,
        title: visitorId,
        mode: 'floating',
        initialPosition: position,
        visitorId,
        visitorData,
      })

      return panelId
    }),
}
