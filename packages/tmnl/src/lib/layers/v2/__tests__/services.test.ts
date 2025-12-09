/**
 * Layer System v2 — Services Tests
 *
 * Tests for LayerRegistry and LayerOperations Effect services.
 * Uses Effect.runSync for synchronous test execution.
 */

import { describe, it, expect, beforeEach } from "vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { LayerRegistry, LayerOperations, resetAllLayers, getLayer, getAllLayers } from "../index"

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Combined service layer for testing
 */
const TestLayer = Layer.mergeAll(LayerRegistry.Default, LayerOperations.Default)

/**
 * Run an Effect with test services
 */
function runTest<A, E>(effect: Effect.Effect<A, E, LayerRegistry | LayerOperations>): A {
  return Effect.runSync(Effect.provide(effect, TestLayer))
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Layer System v2 Services", () => {
  beforeEach(() => {
    resetAllLayers()
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // LayerRegistry Service
  // ─────────────────────────────────────────────────────────────────────────────

  describe("LayerRegistry", () => {
    describe("register", () => {
      it("should register a layer and return an ID", () => {
        const id = runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            return yield* registry.register({ name: "test-layer" })
          })
        )

        expect(id).toBe("layer-1")
      })

      it("should create layer with default values", () => {
        runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            const id = yield* registry.register({ name: "test-layer" })
            const layer = yield* registry.getLayer(id)

            expect(layer).not.toBeNull()
            expect(layer?.name).toBe("test-layer")
            expect(layer?.zIndex).toBe(0)
            expect(layer?.visible).toBe(true)
            expect(layer?.positionMode).toBe("relative")
            expect(layer?.pointerEvents).toBe("auto")
          })
        )
      })

      it("should respect custom config values", () => {
        runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            const id = yield* registry.register({
              name: "custom-layer",
              initialZIndex: 50,
              visible: false,
              positionMode: "fixed",
              pointerEvents: "none",
            })
            const layer = yield* registry.getLayer(id)

            expect(layer?.zIndex).toBe(50)
            expect(layer?.visible).toBe(false)
            expect(layer?.positionMode).toBe("fixed")
            expect(layer?.pointerEvents).toBe("none")
          })
        )
      })

      it("should generate unique IDs for multiple registrations", () => {
        runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            const id1 = yield* registry.register({ name: "layer-1" })
            const id2 = yield* registry.register({ name: "layer-2" })
            const id3 = yield* registry.register({ name: "layer-3" })

            expect(id1).toBe("layer-1")
            expect(id2).toBe("layer-2")
            expect(id3).toBe("layer-3")
          })
        )
      })
    })

    describe("unregister", () => {
      it("should remove a registered layer", () => {
        runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            const id = yield* registry.register({ name: "to-remove" })

            let layer = yield* registry.getLayer(id)
            expect(layer).not.toBeNull()

            yield* registry.unregister(id)

            layer = yield* registry.getLayer(id)
            expect(layer).toBeNull()
          })
        )
      })

      it("should handle unregistering non-existent layer gracefully", () => {
        // Should not throw
        runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            yield* registry.unregister("non-existent")
          })
        )
      })
    })

    describe("getLayer", () => {
      it("should return null for non-existent layer", () => {
        const layer = runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            return yield* registry.getLayer("non-existent")
          })
        )

        expect(layer).toBeNull()
      })

      it("should return the correct layer by ID", () => {
        runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            const id1 = yield* registry.register({ name: "first" })
            yield* registry.register({ name: "second" })

            const layer = yield* registry.getLayer(id1)
            expect(layer?.name).toBe("first")
          })
        )
      })
    })

    describe("getAllLayers", () => {
      it("should return empty array when no layers", () => {
        const layers = runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            return yield* registry.getAllLayers()
          })
        )

        expect(layers).toHaveLength(0)
      })

      it("should return all registered layers", () => {
        runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            yield* registry.register({ name: "layer-1" })
            yield* registry.register({ name: "layer-2" })
            yield* registry.register({ name: "layer-3" })

            const layers = yield* registry.getAllLayers()
            expect(layers).toHaveLength(3)
          })
        )
      })
    })

    describe("getSorted", () => {
      it("should return layers sorted by z-index", () => {
        runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            yield* registry.register({ name: "high", initialZIndex: 100 })
            yield* registry.register({ name: "low", initialZIndex: -10 })
            yield* registry.register({ name: "mid", initialZIndex: 50 })

            const sorted = yield* registry.getSorted()

            expect(sorted[0].name).toBe("low")
            expect(sorted[1].name).toBe("mid")
            expect(sorted[2].name).toBe("high")
          })
        )
      })
    })

    describe("updateLayer", () => {
      it("should update layer properties", () => {
        runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            const id = yield* registry.register({ name: "to-update" })

            yield* registry.updateLayer(id, {
              zIndex: 999,
              visible: false,
              positionMode: "absolute",
            })

            const layer = yield* registry.getLayer(id)
            expect(layer?.zIndex).toBe(999)
            expect(layer?.visible).toBe(false)
            expect(layer?.positionMode).toBe("absolute")
          })
        )
      })

      it("should not update id or name", () => {
        runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            const id = yield* registry.register({ name: "original-name" })

            // TypeScript prevents this, but test the behavior anyway
            yield* registry.updateLayer(id, { zIndex: 50 })

            const layer = yield* registry.getLayer(id)
            expect(layer?.id).toBe(id)
            expect(layer?.name).toBe("original-name")
          })
        )
      })
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // LayerOperations Service
  // ─────────────────────────────────────────────────────────────────────────────

  describe("LayerOperations", () => {
    describe("bringToFront", () => {
      it("should move layer to front (max + gap)", () => {
        runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            const ops = yield* LayerOperations

            const id1 = yield* registry.register({ name: "back", initialZIndex: 0 })
            yield* registry.register({ name: "front", initialZIndex: 100 })

            yield* ops.bringToFront(id1)

            const layer = yield* registry.getLayer(id1)
            expect(layer?.zIndex).toBe(110) // 100 + 10 (gap)
          })
        )
      })

      it("should not change z-index if already at front", () => {
        runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            const ops = yield* LayerOperations

            yield* registry.register({ name: "back", initialZIndex: 0 })
            const frontId = yield* registry.register({ name: "front", initialZIndex: 100 })

            yield* ops.bringToFront(frontId)

            const layer = yield* registry.getLayer(frontId)
            expect(layer?.zIndex).toBe(100) // Unchanged
          })
        )
      })

      it("should handle non-existent layer gracefully", () => {
        // Should not throw
        runTest(
          Effect.gen(function* () {
            const ops = yield* LayerOperations
            yield* ops.bringToFront("non-existent")
          })
        )
      })
    })

    describe("sendToBack", () => {
      it("should move layer to back (min - gap)", () => {
        runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            const ops = yield* LayerOperations

            yield* registry.register({ name: "back", initialZIndex: 0 })
            const frontId = yield* registry.register({ name: "front", initialZIndex: 100 })

            yield* ops.sendToBack(frontId)

            const layer = yield* registry.getLayer(frontId)
            expect(layer?.zIndex).toBe(-10) // 0 - 10 (gap)
          })
        )
      })

      it("should not change z-index if already at back", () => {
        runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            const ops = yield* LayerOperations

            const backId = yield* registry.register({ name: "back", initialZIndex: 0 })
            yield* registry.register({ name: "front", initialZIndex: 100 })

            yield* ops.sendToBack(backId)

            const layer = yield* registry.getLayer(backId)
            expect(layer?.zIndex).toBe(0) // Unchanged
          })
        )
      })
    })

    describe("setVisible", () => {
      it("should set layer visibility to false", () => {
        runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            const ops = yield* LayerOperations

            const id = yield* registry.register({ name: "layer" })
            expect((yield* registry.getLayer(id))?.visible).toBe(true)

            yield* ops.setVisible(id, false)
            expect((yield* registry.getLayer(id))?.visible).toBe(false)
          })
        )
      })

      it("should set layer visibility to true", () => {
        runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            const ops = yield* LayerOperations

            const id = yield* registry.register({ name: "layer", visible: false })
            expect((yield* registry.getLayer(id))?.visible).toBe(false)

            yield* ops.setVisible(id, true)
            expect((yield* registry.getLayer(id))?.visible).toBe(true)
          })
        )
      })
    })

    describe("setPointerEvents", () => {
      it("should change pointer events behavior", () => {
        runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            const ops = yield* LayerOperations

            const id = yield* registry.register({ name: "layer" })

            yield* ops.setPointerEvents(id, "none")
            expect((yield* registry.getLayer(id))?.pointerEvents).toBe("none")

            yield* ops.setPointerEvents(id, "pass-through")
            expect((yield* registry.getLayer(id))?.pointerEvents).toBe("pass-through")

            yield* ops.setPointerEvents(id, "auto")
            expect((yield* registry.getLayer(id))?.pointerEvents).toBe("auto")
          })
        )
      })
    })

    describe("setZIndex", () => {
      it("should set explicit z-index value", () => {
        runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            const ops = yield* LayerOperations

            const id = yield* registry.register({ name: "layer", initialZIndex: 0 })

            yield* ops.setZIndex(id, 500)
            expect((yield* registry.getLayer(id))?.zIndex).toBe(500)

            yield* ops.setZIndex(id, -100)
            expect((yield* registry.getLayer(id))?.zIndex).toBe(-100)
          })
        )
      })
    })

    describe("setPositionMode", () => {
      it("should change position mode", () => {
        runTest(
          Effect.gen(function* () {
            const registry = yield* LayerRegistry
            const ops = yield* LayerOperations

            const id = yield* registry.register({ name: "layer" })

            yield* ops.setPositionMode(id, "absolute")
            expect((yield* registry.getLayer(id))?.positionMode).toBe("absolute")

            yield* ops.setPositionMode(id, "fixed")
            expect((yield* registry.getLayer(id))?.positionMode).toBe("fixed")

            yield* ops.setPositionMode(id, "sticky")
            expect((yield* registry.getLayer(id))?.positionMode).toBe("sticky")
          })
        )
      })
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Integration Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Integration", () => {
    it("should allow combining registry and operations", () => {
      runTest(
        Effect.gen(function* () {
          const registry = yield* LayerRegistry
          const ops = yield* LayerOperations

          // Register layers
          const bg = yield* registry.register({ name: "background", initialZIndex: -10 })
          const content = yield* registry.register({ name: "content", initialZIndex: 0 })
          const modal = yield* registry.register({ name: "modal", initialZIndex: 100 })

          // Operations
          yield* ops.bringToFront(bg)
          yield* ops.setVisible(content, false)
          yield* ops.setPointerEvents(modal, "none")

          // Verify
          const sorted = yield* registry.getSorted()
          expect(sorted[0].id).toBe(content) // z: 0, invisible
          expect(sorted[1].id).toBe(modal) // z: 100
          expect(sorted[2].id).toBe(bg) // z: 110 (brought to front)

          expect((yield* registry.getLayer(content))?.visible).toBe(false)
          expect((yield* registry.getLayer(modal))?.pointerEvents).toBe("none")
        })
      )
    })

    it("should maintain consistency between atom functions and services", () => {
      runTest(
        Effect.gen(function* () {
          const registry = yield* LayerRegistry

          const id = yield* registry.register({ name: "test" })

          // Service getLayer
          const serviceLayer = yield* registry.getLayer(id)

          // Atom getLayer
          const atomLayer = getLayer(id)

          // Should be the same object
          expect(serviceLayer).toBe(atomLayer)
        })
      )
    })
  })
})
