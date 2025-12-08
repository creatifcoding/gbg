import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as Array from "effect/Array";
import * as Option from "effect/Option";
import type { LayerInstance, LayerManagerOps, PointerEventsBehavior } from "../types";

/**
 * LayerManager Service - Manages layer state and z-index ordering
 *
 * Maintains canonical state in Effect.Ref<Array<LayerInstance>>
 * Provides operations for z-index manipulation with smart algorithms
 * Triggers onResort closures when z-index changes
 */
export class LayerManager extends Effect.Service<LayerManager>()("app/layers/LayerManager", {
  effect: Effect.gen(function* () {
    // Canonical layer state
    const layersRef = yield* Ref.make<ReadonlyArray<LayerInstance>>([]);

    /**
     * Smart z-index algorithm
     *
     * Strategy: Find gap in z-index space and insert there
     * - If bringing to front: find gap above max z-index
     * - If sending to back: find gap below min z-index
     * - Minimize reassignments (only change target layer)
     * - If no gap exists, create one by spacing (but don't trigger re-render)
     */
    const calculateNewZIndex = (
      layers: ReadonlyArray<LayerInstance>,
      targetId: string,
      direction: "front" | "back"
    ): number => {
      if (layers.length === 0) return 0;

      const sorted = Array.sort(layers, (a, b) => a.zIndex - b.zIndex);

      if (direction === "front") {
        const maxZ = sorted[sorted.length - 1]?.zIndex ?? 0;
        // Add 10 to create gap (allows future insertions without reassignment)
        return maxZ + 10;
      } else {
        const minZ = sorted[0]?.zIndex ?? 0;
        // Subtract 10 to create gap
        return minZ - 10;
      }
    };

    /**
     * Get all layers (unsorted)
     */
    const getAllLayers = (): Effect.Effect<ReadonlyArray<LayerInstance>> =>
      Ref.get(layersRef);

    /**
     * Get layer by ID
     */
    const getLayer = (id: string): Effect.Effect<LayerInstance | undefined> =>
      Effect.gen(function* () {
        const layers = yield* Ref.get(layersRef);
        const option = Array.findFirst(layers, (l) => l.id === id);
        return Option.getOrUndefined(option);
      });

    /**
     * Get layers sorted by z-index (LayerIndex)
     */
    const getLayerIndex = (): Effect.Effect<ReadonlyArray<LayerInstance>> =>
      Effect.gen(function* () {
        const layers = yield* Ref.get(layersRef);
        return Array.sort(layers, (a, b) => a.zIndex - b.zIndex);
      });

    /**
     * Add layer to registry
     */
    const addLayer = (layer: LayerInstance): Effect.Effect<void> =>
      Ref.update(layersRef, (layers) => Array.append(layers, layer));

    /**
     * Remove layer from registry
     */
    const removeLayer = (id: string): Effect.Effect<void> =>
      Ref.update(layersRef, (layers) => Array.filter(layers, (l) => l.id !== id));

    /**
     * Bring layer to front (increase z-index)
     */
    const bringToFront = (id: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const layers = yield* Ref.get(layersRef);
        const targetOption = Array.findFirst(layers, (l) => l.id === id);
        const target = Option.getOrUndefined(targetOption);

        if (!target) return;

        const newZIndex = calculateNewZIndex(layers, id, "front");
        const updated = { ...target, zIndex: newZIndex };

        // Update layer
        yield* Ref.update(layersRef, (layers) =>
          Array.map(layers, (l) => (l.id === id ? updated : l))
        );

        // Trigger onResort closure (errors are caught and logged, not propagated)
        const onResort = updated.metadata.onResort as ((layer: LayerInstance) => Promise<void>) | undefined;
        if (onResort) {
          yield* Effect.tryPromise(() => onResort(updated)).pipe(
            Effect.catchAll((error) =>
              Effect.logWarning(`onResort listener error in bringToFront: ${error}`)
            )
          );
        }
      });

    /**
     * Send layer to back (decrease z-index)
     */
    const sendToBack = (id: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const layers = yield* Ref.get(layersRef);
        const targetOption = Array.findFirst(layers, (l) => l.id === id);
        const target = Option.getOrUndefined(targetOption);

        if (!target) return;

        const newZIndex = calculateNewZIndex(layers, id, "back");
        const updated = { ...target, zIndex: newZIndex };

        // Update layer
        yield* Ref.update(layersRef, (layers) =>
          Array.map(layers, (l) => (l.id === id ? updated : l))
        );

        // Trigger onResort closure (errors are caught and logged, not propagated)
        const onResort = updated.metadata.onResort as ((layer: LayerInstance) => Promise<void>) | undefined;
        if (onResort) {
          yield* Effect.tryPromise(() => onResort(updated)).pipe(
            Effect.catchAll((error) =>
              Effect.logWarning(`onResort listener error in sendToBack: ${error}`)
            )
          );
        }
      });

    /**
     * Set layer visibility
     */
    const setVisible = (id: string, visible: boolean): Effect.Effect<void> =>
      Effect.gen(function* () {
        yield* Ref.update(layersRef, (layers) =>
          Array.map(layers, (l) =>
            l.id === id ? { ...l, visible } : l
          )
        );

        // Send event to XState machine
        const layer = yield* getLayer(id);
        if (layer) {
          layer.machine.send({ type: visible ? "SHOW" : "HIDE" });
        }
      });

    /**
     * Set layer opacity
     */
    const setOpacity = (id: string, opacity: number): Effect.Effect<void> =>
      Ref.update(layersRef, (layers) =>
        Array.map(layers, (l) =>
          l.id === id ? { ...l, opacity: Math.max(0, Math.min(1, opacity)) } : l
        )
      );

    /**
     * Set layer locked state
     */
    const setLocked = (id: string, locked: boolean): Effect.Effect<void> =>
      Effect.gen(function* () {
        yield* Ref.update(layersRef, (layers) =>
          Array.map(layers, (l) =>
            l.id === id ? { ...l, locked } : l
          )
        );

        // Send event to XState machine
        const layer = yield* getLayer(id);
        if (layer) {
          layer.machine.send({ type: locked ? "LOCK" : "UNLOCK" });
        }
      });

    /**
     * Set pointer events behavior
     */
    const setPointerEvents = (id: string, behavior: PointerEventsBehavior): Effect.Effect<void> =>
      Ref.update(layersRef, (layers) =>
        Array.map(layers, (l) =>
          l.id === id ? { ...l, pointerEvents: behavior } : l
        )
      );

    return {
      getAllLayers,
      getLayer,
      getLayerIndex,
      addLayer,
      removeLayer,
      bringToFront,
      sendToBack,
      setVisible,
      setOpacity,
      setLocked,
      setPointerEvents,
    } as const;
  }),
}) {}
