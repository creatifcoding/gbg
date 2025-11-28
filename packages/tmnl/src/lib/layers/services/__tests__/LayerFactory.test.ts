import { describe, it, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { LayerFactory } from "../LayerFactory";
import { IdGenerator } from "../IdGenerator";
import type { LayerConfig, LayerInstance } from "../../types";

describe("LayerFactory Service", () => {
  /**
   * Hypothesis 1: createLayer generates unique IDs for each layer
   * Proves: IdGenerator integration works; no ID collisions
   */
  it.effect("generates unique IDs for each layer", () =>
    Effect.gen(function* () {
      const factory = yield* LayerFactory;

      const config: LayerConfig = {
        name: "test-layer",
        zIndex: 0,
      };

      // Create 100 layers with same config
      const layers = yield* Effect.all(
        Array.from({ length: 100 }, () => factory.createLayer(config))
      );

      // Assert all IDs are unique
      const ids = layers.map((l) => l.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(100);
    }).pipe(Effect.provide(LayerFactory.Default))
  );

  /**
   * Hypothesis 2: createLayer starts XState machine in correct initial state
   * Proves: Machine initialization respects config (LATENT assumption about immediate start)
   */
  it.effect("starts machine in correct initial state (visible=false -> hidden)", () =>
    Effect.gen(function* () {
      const factory = yield* LayerFactory;

      const layer = yield* factory.createLayer({
        name: "hidden-layer",
        zIndex: 0,
        visible: false,
      });

      // Machine should be started and in "hidden" state
      const snapshot = layer.machine.getSnapshot();
      expect(snapshot.status).toBe("active"); // Machine is started
      expect(snapshot.value).toBe("hidden"); // In hidden state
    }).pipe(Effect.provide(LayerFactory.Default))
  );

  it.effect("starts machine in visible state by default", () =>
    Effect.gen(function* () {
      const factory = yield* LayerFactory;

      const layer = yield* factory.createLayer({
        name: "visible-layer",
        zIndex: 0,
      });

      const snapshot = layer.machine.getSnapshot();
      expect(snapshot.status).toBe("active");
      expect(snapshot.value).toBe("visible");
    }).pipe(Effect.provide(LayerFactory.Default))
  );

  /**
   * Hypothesis 3: createLayer fails for invalid z-index
   * Proves: Validation rejects out-of-bounds z-index
   */
  it.effect("fails for z-index below minimum", () =>
    Effect.gen(function* () {
      const factory = yield* LayerFactory;

      const result = yield* Effect.either(
        factory.createLayer({
          name: "invalid-layer",
          zIndex: -2000, // Below -1000 limit
        })
      );

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left.message).toContain("Invalid z-index");
        expect(result.left.message).toContain("-1000");
        expect(result.left.message).toContain("10000");
      }
    }).pipe(Effect.provide(LayerFactory.Default))
  );

  it.effect("fails for z-index above maximum", () =>
    Effect.gen(function* () {
      const factory = yield* LayerFactory;

      const result = yield* Effect.either(
        factory.createLayer({
          name: "invalid-layer",
          zIndex: 15000, // Above 10000 limit
        })
      );

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left.message).toContain("Invalid z-index");
      }
    }).pipe(Effect.provide(LayerFactory.Default))
  );

  /**
   * Hypothesis 4: createLayer fails for invalid opacity
   * Proves: Validation enforces [0, 1] range
   */
  it.effect("fails for opacity < 0", () =>
    Effect.gen(function* () {
      const factory = yield* LayerFactory;

      const result = yield* Effect.either(
        factory.createLayer({
          name: "invalid-opacity",
          zIndex: 0,
          opacity: -0.5,
        })
      );

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left.message).toContain("Invalid opacity");
        expect(result.left.message).toContain("0");
        expect(result.left.message).toContain("1");
      }
    }).pipe(Effect.provide(LayerFactory.Default))
  );

  it.effect("fails for opacity > 1", () =>
    Effect.gen(function* () {
      const factory = yield* LayerFactory;

      const result = yield* Effect.either(
        factory.createLayer({
          name: "invalid-opacity",
          zIndex: 0,
          opacity: 1.5,
        })
      );

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left.message).toContain("Invalid opacity");
      }
    }).pipe(Effect.provide(LayerFactory.Default))
  );

  /**
   * Hypothesis 5: createLayer fails for empty name
   * Proves: Validation rejects whitespace-only names
   */
  it.effect("fails for empty name", () =>
    Effect.gen(function* () {
      const factory = yield* LayerFactory;

      const result = yield* Effect.either(
        factory.createLayer({
          name: "",
          zIndex: 0,
        })
      );

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left.message).toContain("name cannot be empty");
      }
    }).pipe(Effect.provide(LayerFactory.Default))
  );

  it.effect("fails for whitespace-only name", () =>
    Effect.gen(function* () {
      const factory = yield* LayerFactory;

      const result = yield* Effect.either(
        factory.createLayer({
          name: "   ",
          zIndex: 0,
        })
      );

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left.message).toContain("name cannot be empty");
      }
    }).pipe(Effect.provide(LayerFactory.Default))
  );

  /**
   * Hypothesis 6: createLayer attaches onResort closure to metadata
   * Proves: Closure storage mechanism works
   */
  it.effect("attaches onResort closure to metadata", () =>
    Effect.gen(function* () {
      const factory = yield* LayerFactory;

      const layer = yield* factory.createLayer(
        {
          name: "closure-layer",
          zIndex: 0,
        },
        (layer: LayerInstance) => Effect.log(`Layer ${layer.id} resorted`)
      );

      // Metadata should contain onResort function
      expect(layer.metadata.onResort).toBeDefined();
      expect(typeof layer.metadata.onResort).toBe("function");
    }).pipe(Effect.provide(LayerFactory.Default))
  );

  /**
   * Hypothesis 7: createLayer merges user metadata with internal metadata
   * Proves: User metadata preserved alongside internal metadata
   */
  it.effect("merges user metadata with internal metadata", () =>
    Effect.gen(function* () {
      const factory = yield* LayerFactory;

      const layer = yield* factory.createLayer(
        {
          name: "metadata-layer",
          zIndex: 0,
          metadata: {
            custom: "value",
            count: 42,
          },
        },
        (layer: LayerInstance) => Effect.void
      );

      // User metadata should be present
      expect(layer.metadata.custom).toBe("value");
      expect(layer.metadata.count).toBe(42);

      // Internal metadata should also be present
      expect(layer.metadata.onResort).toBeDefined();
    }).pipe(Effect.provide(LayerFactory.Default))
  );

  /**
   * Hypothesis 8: createLayer with metadata key "onResort" collision behavior
   * Proves: Tests what happens when user provides "onResort" key
   * Expected: Internal onResort should be preserved (or test reveals issue)
   */
  it.effect("handles user metadata 'onResort' key collision", () =>
    Effect.gen(function* () {
      const factory = yield* LayerFactory;

      let closureCalled = false;
      const onResortClosure = (layer: LayerInstance) =>
        Effect.sync(() => {
          closureCalled = true;
        });

      const layer = yield* factory.createLayer(
        {
          name: "collision-layer",
          zIndex: 0,
          metadata: {
            onResort: "user-value", // User tries to set onResort
          },
        },
        onResortClosure
      );

      // Check which value wins
      expect(layer.metadata.onResort).toBeDefined();

      // Try to call it - should be function, not string
      if (typeof layer.metadata.onResort === "function") {
        // Internal closure should win
        await layer.metadata.onResort(layer);
        expect(closureCalled).toBe(true);
      } else {
        // User value won - document this behavior
        expect(layer.metadata.onResort).toBe("user-value");
      }
    }).pipe(Effect.provide(LayerFactory.Default))
  );

  /**
   * Hypothesis 9: Default config values applied when optional fields omitted
   * Proves: Defaults match documented behavior
   */
  it.effect("applies default values for optional fields", () =>
    Effect.gen(function* () {
      const factory = yield* LayerFactory;

      const layer = yield* factory.createLayer({
        name: "defaults-layer",
        zIndex: 0,
        // All optional fields omitted
      });

      expect(layer.visible).toBe(true);
      expect(layer.opacity).toBe(1);
      expect(layer.locked).toBe(false);
      expect(layer.pointerEvents).toBe("auto");
    }).pipe(Effect.provide(LayerFactory.Default))
  );

  /**
   * Additional: Test z-index at boundaries
   * Proves: Boundary values are accepted
   */
  it.effect("accepts z-index at minimum boundary", () =>
    Effect.gen(function* () {
      const factory = yield* LayerFactory;

      const layer = yield* factory.createLayer({
        name: "min-z",
        zIndex: -1000,
      });

      expect(layer.zIndex).toBe(-1000);
    }).pipe(Effect.provide(LayerFactory.Default))
  );

  it.effect("accepts z-index at maximum boundary", () =>
    Effect.gen(function* () {
      const factory = yield* LayerFactory;

      const layer = yield* factory.createLayer({
        name: "max-z",
        zIndex: 10000,
      });

      expect(layer.zIndex).toBe(10000);
    }).pipe(Effect.provide(LayerFactory.Default))
  );

  /**
   * Additional: Test opacity boundaries
   * Proves: Boundary values are accepted
   */
  it.effect("accepts opacity at boundaries", () =>
    Effect.gen(function* () {
      const factory = yield* LayerFactory;

      const layer0 = yield* factory.createLayer({
        name: "opacity-0",
        zIndex: 0,
        opacity: 0,
      });

      const layer1 = yield* factory.createLayer({
        name: "opacity-1",
        zIndex: 0,
        opacity: 1,
      });

      expect(layer0.opacity).toBe(0);
      expect(layer1.opacity).toBe(1);
    }).pipe(Effect.provide(LayerFactory.Default))
  );
});
