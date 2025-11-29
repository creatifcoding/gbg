import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as Registry from "@effect-atom/atom/Registry";
import * as Result from "@effect-atom/atom/Result";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
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
import { IdGenerator } from "../../services/IdGenerator";
import type { LayerInstance } from "../../types";

// Shared test layer for Effect operations
const testLayer = Layer.mergeAll(
  IdGenerator.Default,
  LayerFactory.Default,
  LayerManager.Default
);

// Helper to run Effect in test context - creates layer
const createTestLayer = (config: { name: string; zIndex: number; visible?: boolean; opacity?: number }) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const factory = yield* LayerFactory;
      return yield* factory.createLayer(config);
    }).pipe(Effect.provide(testLayer))
  );

describe("Layer Atoms", () => {
  let registry: ReturnType<typeof Registry.make>;
  let cleanups: Array<() => void> = [];

  beforeEach(() => {
    registry = Registry.make();
    cleanups = [];
  });

  afterEach(() => {
    cleanups.forEach((fn) => fn());
    cleanups = [];
  });

  // Helper to add layer using canonical r.mount() + r.set() pattern
  const addLayerToRegistry = async (layer: LayerInstance) => {
    const cancel = registry.mount(layerOpsAtom.addLayer);
    cleanups.push(cancel);
    registry.set(layerOpsAtom.addLayer, layer);
    // Wait for effect to complete
    await new Promise((resolve) => resolve(null));
  };

  /**
   * Hypothesis 1: layersAtom syncs with LayerManager.getAllLayers
   * Proves: Effect.Ref → Atom synchronization
   */
  it("layersAtom returns all layers from manager", async () => {
    // Initially empty
    const before = registry.get(layersAtom);
    expect(Result.isSuccess(before)).toBe(true);
    if (Result.isSuccess(before)) {
      expect(before.value.length).toBe(0);
    }

    // Create layer via Effect, add via ops using canonical pattern
    const layer = await createTestLayer({ name: "Test", zIndex: 0 });
    await addLayerToRegistry(layer);

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
    // Create and add layers out of order
    const layer50 = await createTestLayer({ name: "L50", zIndex: 50 });
    const layer10 = await createTestLayer({ name: "L10", zIndex: 10 });
    const layer30 = await createTestLayer({ name: "L30", zIndex: 30 });

    await addLayerToRegistry(layer50);
    await addLayerToRegistry(layer10);
    await addLayerToRegistry(layer30);

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
    // Create and add layer
    const createdLayer = await createTestLayer({ name: "Specific", zIndex: 42 });
    await addLayerToRegistry(createdLayer);

    const layer = registry.get(layerAtom(createdLayer.id));
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
    const layer10 = await createTestLayer({ name: "L10", zIndex: 10 });
    const layer20 = await createTestLayer({ name: "L20", zIndex: 20 });

    await addLayerToRegistry(layer10);
    await addLayerToRegistry(layer20);

    // Before: L10, L20
    const before = registry.get(layerIndexAtom);
    expect(Result.isSuccess(before)).toBe(true);
    if (Result.isSuccess(before)) {
      expect(before.value.map((l) => l.name)).toEqual(["L10", "L20"]);
    }

    // Bring L10 to front using canonical pattern
    const cancelBringToFront = registry.mount(layerOpsAtom.bringToFront);
    cleanups.push(cancelBringToFront);
    registry.set(layerOpsAtom.bringToFront, layer10.id);
    await new Promise((resolve) => resolve(null));

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
    const layer = await createTestLayer({ name: "Test", zIndex: 10, visible: true });
    await addLayerToRegistry(layer);

    const before = registry.get(layerSortedAtom);
    const hashBefore = before.visualHash;

    // Bring to front (changes z-index)
    const cancelBringToFront = registry.mount(layerOpsAtom.bringToFront);
    cleanups.push(cancelBringToFront);
    registry.set(layerOpsAtom.bringToFront, layer.id);
    await new Promise((resolve) => resolve(null));

    const after = registry.get(layerSortedAtom);
    const hashAfter = after.visualHash;

    // Hash should change
    expect(hashAfter).not.toBe(hashBefore);
  });

  it("layerSortedAtom visualHash unchanged when opacity changes", async () => {
    const layer = await createTestLayer({ name: "Test", zIndex: 10, visible: true });
    await addLayerToRegistry(layer);

    const before = registry.get(layerSortedAtom);
    const hashBefore = before.visualHash;

    // Change opacity using canonical pattern
    const cancelSetOpacity = registry.mount(layerOpsAtom.setOpacity);
    cleanups.push(cancelSetOpacity);
    registry.set(layerOpsAtom.setOpacity, { id: layer.id, opacity: 0.5 });
    await new Promise((resolve) => resolve(null));

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
    const visibleLayer = await createTestLayer({ name: "Visible", zIndex: 10, visible: true });
    const hiddenLayer = await createTestLayer({ name: "Hidden", zIndex: 20, visible: false });

    await addLayerToRegistry(visibleLayer);
    await addLayerToRegistry(hiddenLayer);

    const sorted = registry.get(layerSortedAtom);

    // visualHash should only contain visible layer
    // The hash format is "id:zIndex", so we check for the pattern
    expect(sorted.visualHash).toContain(`:10`);
    expect(sorted.visualHash).not.toContain(`:20`);
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
    const layer = await createTestLayer({ name: "ToRemove", zIndex: 0 });
    await addLayerToRegistry(layer);

    const before = registry.get(layersAtom);
    expect(Result.isSuccess(before)).toBe(true);
    if (Result.isSuccess(before)) {
      expect(before.value.length).toBe(1);
    }

    // Remove layer using canonical pattern
    const cancelRemove = registry.mount(layerOpsAtom.removeLayer);
    cleanups.push(cancelRemove);
    registry.set(layerOpsAtom.removeLayer, layer.id);
    await new Promise((resolve) => resolve(null));

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
    const layer = await createTestLayer({ name: "Toggle", zIndex: 0, visible: true });
    await addLayerToRegistry(layer);

    // Hide layer using canonical pattern
    const cancelSetVisible = registry.mount(layerOpsAtom.setVisible);
    cleanups.push(cancelSetVisible);
    registry.set(layerOpsAtom.setVisible, { id: layer.id, visible: false });
    await new Promise((resolve) => resolve(null));

    const result = registry.get(layerAtom(layer.id));
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.value?.visible).toBe(false);
    }
  });
});
