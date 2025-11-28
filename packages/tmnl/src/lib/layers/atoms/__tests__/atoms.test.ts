import { describe, it, expect, beforeEach } from "vitest";
import * as Registry from "@effect-atom/atom/Registry";
import * as Result from "@effect-atom/atom/Result";
import * as Effect from "effect/Effect";
import {
  layerRuntimeAtom,
  layersAtom,
  layerIndexAtom,
  layerSortedAtom,
  layerAtom,
  layerOpsAtom,
} from "../index";
import { LayerFactory } from "../../services/LayerFactory";
import { LayerManager } from "../../services/LayerManager";

describe("Layer Atoms", () => {
  let registry: ReturnType<typeof Registry.make>;

  beforeEach(() => {
    registry = Registry.make();
  });

  /**
   * Hypothesis 1: layersAtom syncs with LayerManager.getAllLayers
   * Proves: Effect.Ref → Atom synchronization
   */
  it("layersAtom returns all layers from manager", async () => {
    // Create layer via runtime
    const createLayerAtom = layerRuntimeAtom.fn(
      Effect.gen(function* () {
        const factory = yield* LayerFactory;
        const manager = yield* LayerManager;

        const layer = yield* factory.createLayer({ name: "Test", zIndex: 0 });
        yield* manager.addLayer(layer);
        return layer;
      })
    );

    // Initially empty
    const before = registry.get(layersAtom);
    expect(Result.isSuccess(before)).toBe(true);
    if (Result.isSuccess(before)) {
      expect(before.value.length).toBe(0);
    }

    // Add layer - must registry.get() the atom function first
    const createLayer = registry.get(createLayerAtom);
    await createLayer();

    // Should have 1 layer now
    const after = registry.get(layersAtom);
    expect(Result.isSuccess(after)).toBe(true);
    if (Result.isSuccess(after)) {
      expect(after.value.length).toBe(1);
      expect(after.value[0].name).toBe("Test");
    }
  });

  /**
   * Hypothesis 2: layerIndexAtom returns sorted layers
   * Proves: Sorted atom derivation
   */
  it("layerIndexAtom returns layers sorted by z-index", async () => {
    const createLayersAtom = layerRuntimeAtom.fn(
      Effect.gen(function* () {
        const factory = yield* LayerFactory;
        const manager = yield* LayerManager;

        const layer50 = yield* factory.createLayer({ name: "L50", zIndex: 50 });
        const layer10 = yield* factory.createLayer({ name: "L10", zIndex: 10 });
        const layer30 = yield* factory.createLayer({ name: "L30", zIndex: 30 });

        yield* manager.addLayer(layer50);
        yield* manager.addLayer(layer10);
        yield* manager.addLayer(layer30);
      })
    );

    const createLayers = registry.get(createLayersAtom);
    await createLayers();

    const index = registry.get(layerIndexAtom);
    expect(Result.isSuccess(index)).toBe(true);
    if (Result.isSuccess(index)) {
      const names = index.value.map((l) => l.name);
      expect(names).toEqual(["L10", "L30", "L50"]);
    }
  });

  /**
   * Hypothesis 3: layerAtom family provides per-layer access
   * Proves: Family pattern works
   */
  it("layerAtom returns specific layer by ID", async () => {
    let layerId: string = "";

    const createLayerAtom = layerRuntimeAtom.fn(
      Effect.gen(function* () {
        const factory = yield* LayerFactory;
        const manager = yield* LayerManager;

        const layer = yield* factory.createLayer({ name: "Specific", zIndex: 42 });
        yield* manager.addLayer(layer);
        return layer.id;
      })
    );

    const createLayer = registry.get(createLayerAtom);
    layerId = await createLayer();

    const layer = registry.get(layerAtom(layerId));
    expect(Result.isSuccess(layer)).toBe(true);
    if (Result.isSuccess(layer)) {
      expect(layer.value?.name).toBe("Specific");
      expect(layer.value?.zIndex).toBe(42);
    }
  });

  /**
   * Hypothesis 4: layerAtom returns undefined for missing layer
   * Proves: Atom failure handling (tests LATENT assumption)
   */
  it("layerAtom returns undefined for non-existent layer", () => {
    const layer = registry.get(layerAtom("nonexistent-id"));

    // Should be Success with undefined value, not Failure
    expect(Result.isSuccess(layer)).toBe(true);
    if (Result.isSuccess(layer)) {
      expect(layer.value).toBeUndefined();
    }
  });

  /**
   * Hypothesis 5: layerOpsAtom.bringToFront updates layerIndexAtom
   * Proves: Operations trigger atom updates
   */
  it("layerOpsAtom.bringToFront updates layerIndex reactively", async () => {
    // Create layers
    const setup = layerRuntimeAtom.fn(
      Effect.gen(function* () {
        const factory = yield* LayerFactory;
        const manager = yield* LayerManager;

        const layer10 = yield* factory.createLayer({ name: "L10", zIndex: 10 });
        const layer20 = yield* factory.createLayer({ name: "L20", zIndex: 20 });

        yield* manager.addLayer(layer10);
        yield* manager.addLayer(layer20);

        return { layer10, layer20 };
      })
    );

    const { layer10 } = await setup();

    // Before: L10, L20
    const before = registry.get(layerIndexAtom);
    expect(Result.isSuccess(before)).toBe(true);
    if (Result.isSuccess(before)) {
      expect(before.value.map((l) => l.name)).toEqual(["L10", "L20"]);
    }

    // Bring L10 to front
    const bringToFront = registry.get(layerOpsAtom.bringToFront);
    await bringToFront(layer10.id);

    // After: L20, L10 (L10 moved to end)
    const after = registry.get(layerIndexAtom);
    expect(Result.isSuccess(after)).toBe(true);
    if (Result.isSuccess(after)) {
      expect(after.value.map((l) => l.name)).toEqual(["L20", "L10"]);
    }
  });

  /**
   * Hypothesis 6: layerSortedAtom visualHash changes only on visible layer z-index change
   * Proves: LATENT assumption about hash composition
   */
  it("layerSortedAtom visualHash changes when visible layer z-index changes", async () => {
    const setup = layerRuntimeAtom.fn(
      Effect.gen(function* () {
        const factory = yield* LayerFactory;
        const manager = yield* LayerManager;

        const layer = yield* factory.createLayer({ name: "Test", zIndex: 10, visible: true });
        yield* manager.addLayer(layer);
        return layer;
      })
    );

    const layer = await setup();

    const before = registry.get(layerSortedAtom);
    const hashBefore = before.visualHash;

    // Bring to front (changes z-index)
    const bringToFront = registry.get(layerOpsAtom.bringToFront);
    await bringToFront(layer.id);

    const after = registry.get(layerSortedAtom);
    const hashAfter = after.visualHash;

    // Hash should change
    expect(hashAfter).not.toBe(hashBefore);
  });

  it("layerSortedAtom visualHash unchanged when opacity changes", async () => {
    const setup = layerRuntimeAtom.fn(
      Effect.gen(function* () {
        const factory = yield* LayerFactory;
        const manager = yield* LayerManager;

        const layer = yield* factory.createLayer({ name: "Test", zIndex: 10, visible: true });
        yield* manager.addLayer(layer);
        return layer;
      })
    );

    const layer = await setup();

    const before = registry.get(layerSortedAtom);
    const hashBefore = before.visualHash;

    // Change opacity (doesn't affect z-index or visibility)
    const setOpacity = registry.get(layerOpsAtom.setOpacity);
    await setOpacity({ id: layer.id, opacity: 0.5 });

    const after = registry.get(layerSortedAtom);
    const hashAfter = after.visualHash;

    // Hash should NOT change (only id:zIndex tracked)
    expect(hashAfter).toBe(hashBefore);
  });

  /**
   * Hypothesis 7: layerSortedAtom visualHash ignores hidden layers
   * Proves: Filtering logic
   */
  it("layerSortedAtom visualHash excludes hidden layers", async () => {
    const setup = layerRuntimeAtom.fn(
      Effect.gen(function* () {
        const factory = yield* LayerFactory;
        const manager = yield* LayerManager;

        const visibleLayer = yield* factory.createLayer({ name: "Visible", zIndex: 10, visible: true });
        const hiddenLayer = yield* factory.createLayer({ name: "Hidden", zIndex: 20, visible: false });

        yield* manager.addLayer(visibleLayer);
        yield* manager.addLayer(hiddenLayer);

        return { visibleLayer, hiddenLayer };
      })
    );

    await setup();

    const sorted = registry.get(layerSortedAtom);

    // visualHash should only contain visible layer
    expect(sorted.visualHash).toContain("Visible:10");
    expect(sorted.visualHash).not.toContain("Hidden");
  });

  /**
   * Hypothesis 8: Atom operations return Results (Success/Failure)
   * Proves: Effect error propagation through atoms (or reveals LATENT assumption)
   */
  it("atoms return Result types for Effect-based operations", () => {
    const layers = registry.get(layersAtom);

    // Should be Result.Success or Result.Failure, not raw value
    expect(Result.isSuccess(layers) || Result.isFailure(layers)).toBe(true);
  });

  /**
   * Additional: Test removeLayer via ops
   * Proves: Full CRUD cycle through atoms
   */
  it("layerOpsAtom.removeLayer updates layersAtom", async () => {
    const createLayerAtom = layerRuntimeAtom.fn(
      Effect.gen(function* () {
        const factory = yield* LayerFactory;
        const manager = yield* LayerManager;

        const layer = yield* factory.createLayer({ name: "ToRemove", zIndex: 0 });
        yield* manager.addLayer(layer);
        return layer.id;
      })
    );

    const createLayer = registry.get(createLayerAtom);
    const layerId = await createLayer();

    const before = registry.get(layersAtom);
    expect(Result.isSuccess(before)).toBe(true);
    if (Result.isSuccess(before)) {
      expect(before.value.length).toBe(1);
    }

    // Remove layer
    const removeLayer = registry.get(layerOpsAtom.removeLayer);
    await removeLayer(layerId);

    const after = registry.get(layersAtom);
    expect(Result.isSuccess(after)).toBe(true);
    if (Result.isSuccess(after)) {
      expect(after.value.length).toBe(0);
    }
  });

  /**
   * Additional: Test setVisible via ops
   * Proves: State mutations propagate through atoms
   */
  it("layerOpsAtom.setVisible updates layer state", async () => {
    const createLayerAtom = layerRuntimeAtom.fn(
      Effect.gen(function* () {
        const factory = yield* LayerFactory;
        const manager = yield* LayerManager;

        const layer = yield* factory.createLayer({ name: "Toggle", zIndex: 0, visible: true });
        yield* manager.addLayer(layer);
        return layer.id;
      })
    );

    const createLayer = registry.get(createLayerAtom);
    const layerId = await createLayer();

    // Hide layer
    const setVisible = registry.get(layerOpsAtom.setVisible);
    await setVisible({ id: layerId, visible: false });

    const layer = registry.get(layerAtom(layerId));
    expect(Result.isSuccess(layer)).toBe(true);
    if (Result.isSuccess(layer)) {
      expect(layer.value?.visible).toBe(false);
    }
  });
});
