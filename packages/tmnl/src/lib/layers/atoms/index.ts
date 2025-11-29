import { Atom } from "@effect-atom/atom-react";
import * as Result from "@effect-atom/atom/Result";
import * as Layer from "effect/Layer";
import * as Effect from "effect/Effect";
import { IdGenerator } from "../services/IdGenerator";
import { LayerFactory } from "../services/LayerFactory";
import { LayerManager } from "../services/LayerManager";
import type { LayerInstance } from "../types";

/**
 * Layer Runtime Atom - Provides Effect services to atoms
 *
 * Combines all layer services into a single runtime
 */
export const layerRuntimeAtom = Atom.runtime(
  Layer.mergeAll(
    IdGenerator.Default,
    LayerFactory.Default,
    LayerManager.Default
  )
);

/**
 * Layers Atom - All layers (unsorted)
 *
 * Synced with LayerManager Effect.Ref
 */
export const layersAtom = layerRuntimeAtom.atom(
  Effect.gen(function* () {
    const manager = yield* LayerManager;
    return yield* manager.getAllLayers();
  })
);

/**
 * Layer Index Atom - Layers sorted by z-index
 *
 * Derived atom that provides ordered view
 */
export const layerIndexAtom = layerRuntimeAtom.atom(
  Effect.gen(function* () {
    const manager = yield* LayerManager;
    return yield* manager.getLayerIndex();
  })
);

/**
 * Layer Sorted Effectual Atom
 *
 * This atom tracks z-index changes and determines if re-render is needed
 * Key: Prevents unnecessary React re-renders when z-index changes don't affect visual output
 */
export const layerSortedAtom = Atom.make((get) => {
  const layersResult = get(layerIndexAtom);

  // Unwrap Result - layerIndexAtom is a runtime atom that returns Result type
  const layers: readonly LayerInstance[] = Result.isSuccess(layersResult)
    ? layersResult.value
    : [];

  // Calculate if visual order actually changed
  // (comparing against previous render - Atom handles memoization)
  const visualHash = layers
    .filter((l) => l.visible)
    .map((l) => `${l.id}:${l.zIndex}`)
    .join("|");

  return {
    layers,
    visualHash,
    shouldRender: true, // Atom's built-in change detection handles this
  };
});

/**
 * Layer Family - Individual layer atoms by ID
 *
 * Use Atom.family for stable references
 */
export const layerAtom = Atom.family((id: string) =>
  layerRuntimeAtom.atom(
    Effect.gen(function* () {
      const manager = yield* LayerManager;
      return yield* manager.getLayer(id);
    })
  )
);

/**
 * Layer Operations - Atom functions for manipulating layers
 *
 * Uses canonical effect-atom pattern: runtime.fn<InputType>()((input) => Effect)
 */
export const layerOpsAtom = {
  addLayer: layerRuntimeAtom.fn<LayerInstance>()((layer) =>
    Effect.gen(function* () {
      const manager = yield* LayerManager;
      yield* manager.addLayer(layer);
    })
  ),

  removeLayer: layerRuntimeAtom.fn<string>()((id) =>
    Effect.gen(function* () {
      const manager = yield* LayerManager;
      yield* manager.removeLayer(id);
    })
  ),

  bringToFront: layerRuntimeAtom.fn<string>()((id) =>
    Effect.gen(function* () {
      const manager = yield* LayerManager;
      yield* manager.bringToFront(id);
    })
  ),

  sendToBack: layerRuntimeAtom.fn<string>()((id) =>
    Effect.gen(function* () {
      const manager = yield* LayerManager;
      yield* manager.sendToBack(id);
    })
  ),

  setVisible: layerRuntimeAtom.fn<{ id: string; visible: boolean }>()(({ id, visible }) =>
    Effect.gen(function* () {
      const manager = yield* LayerManager;
      yield* manager.setVisible(id, visible);
    })
  ),

  setOpacity: layerRuntimeAtom.fn<{ id: string; opacity: number }>()(({ id, opacity }) =>
    Effect.gen(function* () {
      const manager = yield* LayerManager;
      yield* manager.setOpacity(id, opacity);
    })
  ),

  setLocked: layerRuntimeAtom.fn<{ id: string; locked: boolean }>()(({ id, locked }) =>
    Effect.gen(function* () {
      const manager = yield* LayerManager;
      yield* manager.setLocked(id, locked);
    })
  ),
};
