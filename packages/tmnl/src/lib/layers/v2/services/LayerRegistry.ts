/**
 * Layer System v2 — LayerRegistry Service
 *
 * Effect service wrapping atom operations for layer storage and retrieval.
 * Follows Atom-as-State doctrine: atoms own state, service provides Effect composition.
 *
 * Pattern: Effect.Service<>() (RECOMMENDED DEFAULT)
 *
 * @experimental v2 API - Wrapper-free layer system
 */

import * as Effect from "effect/Effect"
import type { LayerConfig, LayerInstance, LayerRegistryOps } from "../types"
import { LAYER_DEFAULTS } from "../types"
import {
  generateLayerId,
  addLayer,
  removeLayer,
  getLayer,
  getAllLayers,
  getSortedLayers,
  updateLayer,
} from "../atoms"

// ─────────────────────────────────────────────────────────────────────────────
// LayerRegistry Service (Effect.Service<>() Pattern)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LayerRegistry Service
 *
 * Provides Effect-wrapped operations for layer storage and retrieval.
 * All mutations go through the module-level atoms via layerRegistry singleton.
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const registry = yield* LayerRegistry
 *   const id = yield* registry.register({ name: 'my-layer' })
 *   const layer = yield* registry.getLayer(id)
 * })
 * ```
 */
export class LayerRegistry extends Effect.Service<LayerRegistry>()(
  "tmnl/layers/v2/LayerRegistry",
  {
    effect: Effect.gen(function* () {
      /**
       * Register a new layer, returns generated ID.
       */
      const register = (config: LayerConfig): Effect.Effect<string> =>
        Effect.gen(function* () {
          const id = generateLayerId()

          const layer: LayerInstance = {
            id,
            name: config.name,
            zIndex: config.initialZIndex ?? LAYER_DEFAULTS.initialZIndex,
            visible: config.visible ?? LAYER_DEFAULTS.visible,
            positionMode: config.positionMode ?? LAYER_DEFAULTS.positionMode,
            pointerEvents: config.pointerEvents ?? LAYER_DEFAULTS.pointerEvents,
          }

          addLayer(layer)

          yield* Effect.log(`[LayerRegistry] Registered layer: ${id} (${config.name})`)

          return id
        }).pipe(
          Effect.withSpan("LayerRegistry.register", {
            attributes: { name: config.name },
          })
        )

      /**
       * Unregister a layer by ID.
       */
      const unregister = (id: string): Effect.Effect<void> =>
        Effect.gen(function* () {
          removeLayer(id)
          yield* Effect.log(`[LayerRegistry] Unregistered layer: ${id}`)
        }).pipe(
          Effect.withSpan("LayerRegistry.unregister", {
            attributes: { id },
          })
        )

      /**
       * Get a single layer by ID.
       */
      const get = (id: string): Effect.Effect<LayerInstance | null> =>
        Effect.sync(() => getLayer(id))

      /**
       * Get all layers (unsorted).
       */
      const getAll = (): Effect.Effect<LayerInstance[]> =>
        Effect.sync(() => getAllLayers())

      /**
       * Get all layers sorted by z-index.
       */
      const getSorted = (): Effect.Effect<readonly LayerInstance[]> =>
        Effect.sync(() => getSortedLayers())

      /**
       * Update a layer's properties.
       */
      const update = (
        id: string,
        updates: Partial<Omit<LayerInstance, "id" | "name">>
      ): Effect.Effect<void> =>
        Effect.sync(() => updateLayer(id, updates))

      return {
        register,
        unregister,
        getLayer: get,
        getAllLayers: getAll,
        getSorted,
        updateLayer: update,
      } as const satisfies LayerRegistryOps
    }),
  }
) {}
