/**
 * Layer System v2 — LayerOperations Service
 *
 * Effect service wrapping atom operations for z-index algorithms and mutations.
 * Follows Atom-as-State doctrine: atoms own state, service provides Effect composition.
 *
 * Pattern: Effect.Service<>() (RECOMMENDED DEFAULT)
 *
 * @experimental v2 API - Wrapper-free layer system
 */

import * as Effect from "effect/Effect"
import type { PointerEventsBehavior, PositionMode, LayerOperationsOps } from "../types"
import {
  bringToFront as bringToFrontAtom,
  sendToBack as sendToBackAtom,
  setVisible as setVisibleAtom,
  setPointerEvents as setPointerEventsAtom,
  setZIndex as setZIndexAtom,
  setPositionMode as setPositionModeAtom,
  getLayer,
} from "../atoms"

// ─────────────────────────────────────────────────────────────────────────────
// LayerOperations Service (Effect.Service<>() Pattern)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LayerOperations Service
 *
 * Provides Effect-wrapped operations for z-index algorithms and layer mutations.
 * All mutations go through the module-level atoms via layerRegistry singleton.
 *
 * Smart Z-Index Algorithm:
 * - bringToFront: Sets z-index to max + Z_INDEX_GAP (default 10)
 * - sendToBack: Sets z-index to min - Z_INDEX_GAP
 * - Gaps minimize cascading updates when reordering
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const ops = yield* LayerOperations
 *   yield* ops.bringToFront('layer-1')
 *   yield* ops.setVisible('layer-2', false)
 * })
 * ```
 */
export class LayerOperations extends Effect.Service<LayerOperations>()(
  "tmnl/layers/v2/LayerOperations",
  {
    effect: Effect.gen(function* () {
      /**
       * Move layer to front (highest z-index + gap).
       * No-op if layer not found or already at front.
       */
      const bringToFront = (id: string): Effect.Effect<void> =>
        Effect.gen(function* () {
          const layer = getLayer(id)
          if (!layer) {
            yield* Effect.logWarning(`[LayerOperations] bringToFront: Layer not found: ${id}`)
            return
          }

          const prevZ = layer.zIndex
          bringToFrontAtom(id)
          const newZ = getLayer(id)?.zIndex ?? prevZ

          if (newZ !== prevZ) {
            yield* Effect.log(`[LayerOperations] bringToFront: ${id} (${prevZ} → ${newZ})`)
          }
        }).pipe(
          Effect.withSpan("LayerOperations.bringToFront", {
            attributes: { id },
          })
        )

      /**
       * Move layer to back (lowest z-index - gap).
       * No-op if layer not found or already at back.
       */
      const sendToBack = (id: string): Effect.Effect<void> =>
        Effect.gen(function* () {
          const layer = getLayer(id)
          if (!layer) {
            yield* Effect.logWarning(`[LayerOperations] sendToBack: Layer not found: ${id}`)
            return
          }

          const prevZ = layer.zIndex
          sendToBackAtom(id)
          const newZ = getLayer(id)?.zIndex ?? prevZ

          if (newZ !== prevZ) {
            yield* Effect.log(`[LayerOperations] sendToBack: ${id} (${prevZ} → ${newZ})`)
          }
        }).pipe(
          Effect.withSpan("LayerOperations.sendToBack", {
            attributes: { id },
          })
        )

      /**
       * Set layer visibility.
       * No-op if layer not found.
       */
      const setVisible = (id: string, visible: boolean): Effect.Effect<void> =>
        Effect.sync(() => setVisibleAtom(id, visible))

      /**
       * Set pointer event behavior.
       * No-op if layer not found.
       */
      const setPointerEvents = (
        id: string,
        behavior: PointerEventsBehavior
      ): Effect.Effect<void> =>
        Effect.sync(() => setPointerEventsAtom(id, behavior))

      /**
       * Set explicit z-index value.
       * No-op if layer not found.
       */
      const setZIndex = (id: string, zIndex: number): Effect.Effect<void> =>
        Effect.sync(() => setZIndexAtom(id, zIndex))

      /**
       * Set position mode.
       * No-op if layer not found.
       */
      const setPositionMode = (id: string, positionMode: PositionMode): Effect.Effect<void> =>
        Effect.sync(() => setPositionModeAtom(id, positionMode))

      return {
        bringToFront,
        sendToBack,
        setVisible,
        setPointerEvents,
        setZIndex,
        setPositionMode,
      } as const satisfies LayerOperationsOps & { setPositionMode: typeof setPositionMode }
    }),
  }
) {}
