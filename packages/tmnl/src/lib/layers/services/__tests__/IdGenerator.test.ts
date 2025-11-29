import { describe, it, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { IdGenerator } from "../IdGenerator";

describe("IdGenerator Service", () => {
  /**
   * Hypothesis 1: nanoid strategy generates unique, non-empty strings
   * Proves: Default strategy works correctly; no collisions in reasonable sample size
   */
  it.effect("nanoid strategy generates unique non-empty strings", () =>
    Effect.gen(function* () {
      const gen = yield* IdGenerator;

      // Generate 1000 IDs
      const ids = Array.from({ length: 1000 }, () => gen.generate());

      // Assert all unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(1000);

      // Assert all match nanoid format (21 chars, URL-safe)
      const nanoidPattern = /^[A-Za-z0-9_-]{21}$/;
      ids.forEach((id) => {
        expect(id).toMatch(nanoidPattern);
        expect(id.length).toBe(21);
      });
    }).pipe(Effect.provide(IdGenerator.Default))
  );

  /**
   * Hypothesis 2: uuid strategy generates valid UUIDv4s
   * Proves: uuid strategy produces RFC4122-compliant IDs
   */
  it.effect("uuid strategy generates valid UUIDv4s", () =>
    Effect.gen(function* () {
      const gen = yield* IdGenerator;

      // Generate 100 UUIDs
      const ids = Array.from({ length: 100 }, () => gen.generate());

      // Assert all unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(100);

      // Assert all match UUIDv4 format
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      ids.forEach((id) => {
        expect(id).toMatch(uuidPattern);
      });
    }).pipe(
      // Use WithConfig to bypass default dependencies
      Effect.provide(IdGenerator.WithConfig({ strategy: "uuid" }))
    )
  );

  /**
   * Hypothesis 3: custom strategy with valid generator uses provided function
   * Proves: Custom strategy correctly delegates to user function
   */
  it.effect("custom strategy uses provided generator function", () =>
    Effect.gen(function* () {
      const gen = yield* IdGenerator;

      // Generate 10 IDs using the custom generator
      const ids = Array.from({ length: 10 }, () => gen.generate());

      // Should have sequential IDs
      expect(ids).toEqual([
        "custom-1",
        "custom-2",
        "custom-3",
        "custom-4",
        "custom-5",
        "custom-6",
        "custom-7",
        "custom-8",
        "custom-9",
        "custom-10",
      ]);
    }).pipe(
      Effect.provide(
        IdGenerator.WithConfig({
          strategy: "custom",
          customGenerator: (() => {
            let counter = 0;
            return () => `custom-${++counter}`;
          })(),
        })
      )
    )
  );

  /**
   * Hypothesis 4: custom strategy without generator falls back to nanoid
   * Proves: Silent fallback behavior (LATENT assumption confirmed)
   */
  it.effect("custom strategy without generator falls back to nanoid", () =>
    Effect.gen(function* () {
      const gen = yield* IdGenerator;

      const id = gen.generate();

      // Should generate nanoid-format ID as fallback
      const nanoidPattern = /^[A-Za-z0-9_-]{21}$/;
      expect(id).toMatch(nanoidPattern);
    }).pipe(
      Effect.provide(
        IdGenerator.WithConfig({
          strategy: "custom",
          // customGenerator intentionally omitted
        })
      )
    )
  );

  /**
   * Hypothesis 5: IdGenerator service is effect-based and composable
   * Proves: Service follows Effect dependency injection pattern
   */
  it.effect("service follows Effect DI pattern", () =>
    Effect.gen(function* () {
      // Test that service can be composed with different configs
      const defaultGen = yield* Effect.provide(
        IdGenerator,
        IdGenerator.Default
      );

      // Use WithConfig for custom configuration
      const customGen = yield* Effect.provide(
        IdGenerator,
        IdGenerator.WithConfig({ strategy: "uuid" })
      );

      const defaultId = defaultGen.generate();
      const customId = customGen.generate();

      // Default should be nanoid
      expect(defaultId).toMatch(/^[A-Za-z0-9_-]{21}$/);

      // Custom should be UUID
      expect(customId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    })
  );

  /**
   * Additional: Test default strategy fallback
   * Proves: Invalid strategy falls back to nanoid
   */
  it.effect("invalid strategy falls back to nanoid", () =>
    Effect.gen(function* () {
      const gen = yield* IdGenerator;

      const id = gen.generate();

      // Should fallback to nanoid for invalid strategy
      const nanoidPattern = /^[A-Za-z0-9_-]{21}$/;
      expect(id).toMatch(nanoidPattern);
    }).pipe(
      Effect.provide(
        IdGenerator.WithConfig({
          strategy: "invalid" as any, // Force invalid strategy
        })
      )
    )
  );
});
