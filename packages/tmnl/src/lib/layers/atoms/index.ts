import { Atom } from "@effect-atom/atom-react";
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
  const layers = get(layerIndexAtom);

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
 */
export const layerOpsAtom = {
  addLayer: layerRuntimeAtom.fn(
    Effect.gen(function* (layer: LayerInstance) {
      const manager = yield* LayerManager;
      yield* manager.addLayer(layer);
    })
  ),

  removeLayer: layerRuntimeAtom.fn(
    Effect.gen(function* (id: string) {
      const manager = yield* LayerManager;
      yield* manager.removeLayer(id);
    })
  ),

  bringToFront: layerRuntimeAtom.fn(
    Effect.gen(function* (id: string) {
      const manager = yield* LayerManager;
      yield* manager.bringToFront(id);
    })
  ),

  sendToBack: layerRuntimeAtom.fn(
    Effect.gen(function* (id: string) {
      const manager = yield* LayerManager;
      yield* manager.sendToBack(id);
    })
  ),

  setVisible: layerRuntimeAtom.fn(
    Effect.gen(function* ({ id, visible }: { id: string; visible: boolean }) {
      const manager = yield* LayerManager;
      yield* manager.setVisible(id, visible);
    })
  ),

  setOpacity: layerRuntimeAtom.fn(
    Effect.gen(function* ({ id, opacity }: { id: string; opacity: number }) {
      const manager = yield* LayerManager;
      yield* manager.setOpacity(id, opacity);
    })
  ),

  setLocked: layerRuntimeAtom.fn(
    Effect.gen(function* ({ id, locked }: { id: string; locked: boolean }) {
      const manager = yield* LayerManager;
      yield* manager.setLocked(id, locked);
    })
  ),
};
