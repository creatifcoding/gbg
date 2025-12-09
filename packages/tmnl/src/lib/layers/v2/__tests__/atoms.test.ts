/**
 * Layer System v2 Atoms Tests
 *
 * Tests the Atom-as-State doctrine implementation:
 * - Module-level Registry singleton for synchronous access
 * - Core state atoms (layersMapAtom, layerIdCounterAtom)
 * - Derived atoms (sorted, visible, count, z-index bounds, visual hash)
 * - Layer family (parameterized atom access)
 * - Mutation utilities (CRUD operations)
 * - Z-index operations (smart gap algorithm)
 * - Property setters
 * - Reset utilities
 */

import { describe, it, expect, beforeEach } from "vitest"
import {
  // Registry
  layerRegistry,
  // Core atoms
  layersMapAtom,
  layerIdCounterAtom,
  // Derived atoms
  sortedLayersAtom,
  visibleLayersAtom,
  layerCountAtom,
  maxZIndexAtom,
  minZIndexAtom,
  visualHashAtom,
  // Layer family
  layerFamily,
  // Mutation utilities
  generateLayerId,
  addLayer,
  removeLayer,
  updateLayer,
  getLayer,
  getAllLayers,
  getSortedLayers,
  // Z-index operations
  calculateFrontZIndex,
  calculateBackZIndex,
  bringToFront,
  sendToBack,
  // Property setters
  setVisible,
  setPointerEvents,
  setZIndex,
  setPositionMode,
  // Reset utilities
  resetAllLayers,
  // Types
  Z_INDEX_GAP,
  LAYER_DEFAULTS,
} from "../index"
import type { LayerInstance } from "../types"

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createTestLayer(overrides: Partial<LayerInstance> = {}): LayerInstance {
  return {
    id: overrides.id ?? "test-layer",
    name: overrides.name ?? "Test Layer",
    zIndex: overrides.zIndex ?? 0,
    visible: overrides.visible ?? true,
    positionMode: overrides.positionMode ?? "relative",
    pointerEvents: overrides.pointerEvents ?? "auto",
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe("Layer System v2 Atoms", () => {
  beforeEach(() => {
    // Reset all state before each test
    resetAllLayers()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Registry Singleton
  // ─────────────────────────────────────────────────────────────────────────

  describe("layerRegistry (singleton)", () => {
    it("should be defined", () => {
      expect(layerRegistry).toBeDefined()
    })

    it("should have get method", () => {
      expect(typeof layerRegistry.get).toBe("function")
    })

    it("should have set method", () => {
      expect(typeof layerRegistry.set).toBe("function")
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Core State Atoms
  // ─────────────────────────────────────────────────────────────────────────

  describe("layersMapAtom", () => {
    it("should initialize as empty Map", () => {
      const map = layerRegistry.get(layersMapAtom)
      expect(map).toBeInstanceOf(Map)
      expect(map.size).toBe(0)
    })

    it("should allow direct set via registry", () => {
      const layer = createTestLayer({ id: "direct-set" })
      const newMap = new Map([[layer.id, layer]])
      layerRegistry.set(layersMapAtom, newMap)

      const result = layerRegistry.get(layersMapAtom)
      expect(result.get("direct-set")).toEqual(layer)
    })
  })

  describe("layerIdCounterAtom", () => {
    it("should initialize at 0", () => {
      const counter = layerRegistry.get(layerIdCounterAtom)
      expect(counter).toBe(0)
    })

    it("should allow direct set via registry", () => {
      layerRegistry.set(layerIdCounterAtom, 42)
      const counter = layerRegistry.get(layerIdCounterAtom)
      expect(counter).toBe(42)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Derived Atoms
  // ─────────────────────────────────────────────────────────────────────────

  describe("sortedLayersAtom", () => {
    it("should return empty array when no layers", () => {
      const sorted = layerRegistry.get(sortedLayersAtom)
      expect(sorted).toEqual([])
    })

    it("should return layers sorted by z-index (ascending)", () => {
      addLayer(createTestLayer({ id: "high", name: "High", zIndex: 100 }))
      addLayer(createTestLayer({ id: "low", name: "Low", zIndex: -50 }))
      addLayer(createTestLayer({ id: "mid", name: "Mid", zIndex: 25 }))

      const sorted = layerRegistry.get(sortedLayersAtom)
      expect(sorted.map((l) => l.id)).toEqual(["low", "mid", "high"])
      expect(sorted.map((l) => l.zIndex)).toEqual([-50, 25, 100])
    })
  })

  describe("visibleLayersAtom", () => {
    it("should return empty array when no layers", () => {
      const visible = layerRegistry.get(visibleLayersAtom)
      expect(visible).toEqual([])
    })

    it("should filter out hidden layers", () => {
      addLayer(createTestLayer({ id: "visible1", visible: true, zIndex: 0 }))
      addLayer(createTestLayer({ id: "hidden", visible: false, zIndex: 10 }))
      addLayer(createTestLayer({ id: "visible2", visible: true, zIndex: 20 }))

      const visible = layerRegistry.get(visibleLayersAtom)
      expect(visible.map((l) => l.id)).toEqual(["visible1", "visible2"])
    })

    it("should maintain z-index order for visible layers", () => {
      addLayer(createTestLayer({ id: "a", visible: true, zIndex: 30 }))
      addLayer(createTestLayer({ id: "b", visible: false, zIndex: 20 }))
      addLayer(createTestLayer({ id: "c", visible: true, zIndex: 10 }))

      const visible = layerRegistry.get(visibleLayersAtom)
      expect(visible.map((l) => l.id)).toEqual(["c", "a"])
    })
  })

  describe("layerCountAtom", () => {
    it("should return 0 when no layers", () => {
      const count = layerRegistry.get(layerCountAtom)
      expect(count).toBe(0)
    })

    it("should return correct count", () => {
      addLayer(createTestLayer({ id: "1" }))
      addLayer(createTestLayer({ id: "2" }))
      addLayer(createTestLayer({ id: "3" }))

      const count = layerRegistry.get(layerCountAtom)
      expect(count).toBe(3)
    })
  })

  describe("maxZIndexAtom", () => {
    it("should return 0 when no layers", () => {
      const maxZ = layerRegistry.get(maxZIndexAtom)
      expect(maxZ).toBe(0)
    })

    it("should return highest z-index", () => {
      addLayer(createTestLayer({ id: "1", zIndex: -100 }))
      addLayer(createTestLayer({ id: "2", zIndex: 50 }))
      addLayer(createTestLayer({ id: "3", zIndex: 200 }))

      const maxZ = layerRegistry.get(maxZIndexAtom)
      expect(maxZ).toBe(200)
    })
  })

  describe("minZIndexAtom", () => {
    it("should return 0 when no layers", () => {
      const minZ = layerRegistry.get(minZIndexAtom)
      expect(minZ).toBe(0)
    })

    it("should return lowest z-index", () => {
      addLayer(createTestLayer({ id: "1", zIndex: -100 }))
      addLayer(createTestLayer({ id: "2", zIndex: 50 }))
      addLayer(createTestLayer({ id: "3", zIndex: 200 }))

      const minZ = layerRegistry.get(minZIndexAtom)
      expect(minZ).toBe(-100)
    })
  })

  describe("visualHashAtom", () => {
    it("should return empty string when no layers", () => {
      const hash = layerRegistry.get(visualHashAtom)
      expect(hash).toBe("")
    })

    it("should generate hash from visible layers", () => {
      addLayer(createTestLayer({ id: "a", visible: true, zIndex: 10 }))
      addLayer(createTestLayer({ id: "b", visible: true, zIndex: 20 }))

      const hash = layerRegistry.get(visualHashAtom)
      expect(hash).toBe("a:10|b:20")
    })

    it("should exclude hidden layers from hash", () => {
      addLayer(createTestLayer({ id: "a", visible: true, zIndex: 10 }))
      addLayer(createTestLayer({ id: "b", visible: false, zIndex: 15 }))
      addLayer(createTestLayer({ id: "c", visible: true, zIndex: 20 }))

      const hash = layerRegistry.get(visualHashAtom)
      expect(hash).toBe("a:10|c:20")
    })

    it("should change when z-index changes", () => {
      addLayer(createTestLayer({ id: "a", visible: true, zIndex: 10 }))
      const hash1 = layerRegistry.get(visualHashAtom)

      setZIndex("a", 100)
      const hash2 = layerRegistry.get(visualHashAtom)

      expect(hash1).not.toBe(hash2)
      expect(hash2).toBe("a:100")
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Layer Family
  // ─────────────────────────────────────────────────────────────────────────

  describe("layerFamily", () => {
    it("should return null for non-existent layer", () => {
      const atom = layerFamily("non-existent")
      const layer = layerRegistry.get(atom)
      expect(layer).toBeNull()
    })

    it("should return layer for existing ID", () => {
      const testLayer = createTestLayer({ id: "family-test" })
      addLayer(testLayer)

      const atom = layerFamily("family-test")
      const layer = layerRegistry.get(atom)
      expect(layer).toEqual(testLayer)
    })

    it("should return same atom instance for same ID", () => {
      const atom1 = layerFamily("same-id")
      const atom2 = layerFamily("same-id")
      expect(atom1).toBe(atom2)
    })

    it("should return different atom instances for different IDs", () => {
      const atom1 = layerFamily("id-1")
      const atom2 = layerFamily("id-2")
      expect(atom1).not.toBe(atom2)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Mutation Utilities
  // ─────────────────────────────────────────────────────────────────────────

  describe("generateLayerId", () => {
    it("should generate sequential IDs", () => {
      const id1 = generateLayerId()
      const id2 = generateLayerId()
      const id3 = generateLayerId()

      expect(id1).toBe("layer-1")
      expect(id2).toBe("layer-2")
      expect(id3).toBe("layer-3")
    })

    it("should increment counter atom", () => {
      expect(layerRegistry.get(layerIdCounterAtom)).toBe(0)
      generateLayerId()
      expect(layerRegistry.get(layerIdCounterAtom)).toBe(1)
      generateLayerId()
      expect(layerRegistry.get(layerIdCounterAtom)).toBe(2)
    })
  })

  describe("addLayer", () => {
    it("should add layer to map", () => {
      const layer = createTestLayer({ id: "add-test" })
      addLayer(layer)

      const result = getLayer("add-test")
      expect(result).toEqual(layer)
    })

    it("should increment layer count", () => {
      expect(layerRegistry.get(layerCountAtom)).toBe(0)
      addLayer(createTestLayer({ id: "1" }))
      expect(layerRegistry.get(layerCountAtom)).toBe(1)
      addLayer(createTestLayer({ id: "2" }))
      expect(layerRegistry.get(layerCountAtom)).toBe(2)
    })

    it("should overwrite existing layer with same ID", () => {
      addLayer(createTestLayer({ id: "dup", name: "Original" }))
      addLayer(createTestLayer({ id: "dup", name: "Replacement" }))

      const result = getLayer("dup")
      expect(result?.name).toBe("Replacement")
      expect(layerRegistry.get(layerCountAtom)).toBe(1)
    })
  })

  describe("removeLayer", () => {
    it("should remove layer from map", () => {
      addLayer(createTestLayer({ id: "remove-test" }))
      expect(getLayer("remove-test")).not.toBeNull()

      removeLayer("remove-test")
      expect(getLayer("remove-test")).toBeNull()
    })

    it("should decrement layer count", () => {
      addLayer(createTestLayer({ id: "1" }))
      addLayer(createTestLayer({ id: "2" }))
      expect(layerRegistry.get(layerCountAtom)).toBe(2)

      removeLayer("1")
      expect(layerRegistry.get(layerCountAtom)).toBe(1)
    })

    it("should do nothing for non-existent layer", () => {
      addLayer(createTestLayer({ id: "exists" }))
      removeLayer("does-not-exist")
      expect(layerRegistry.get(layerCountAtom)).toBe(1)
    })
  })

  describe("updateLayer", () => {
    it("should update layer properties", () => {
      addLayer(createTestLayer({ id: "update-test", zIndex: 0, visible: true }))
      updateLayer("update-test", { zIndex: 100, visible: false })

      const result = getLayer("update-test")
      expect(result?.zIndex).toBe(100)
      expect(result?.visible).toBe(false)
    })

    it("should preserve unchanged properties", () => {
      addLayer(
        createTestLayer({
          id: "partial-update",
          name: "Original Name",
          zIndex: 50,
          visible: true,
          positionMode: "absolute",
        })
      )
      updateLayer("partial-update", { zIndex: 100 })

      const result = getLayer("partial-update")
      expect(result?.name).toBe("Original Name")
      expect(result?.visible).toBe(true)
      expect(result?.positionMode).toBe("absolute")
      expect(result?.zIndex).toBe(100)
    })

    it("should do nothing for non-existent layer", () => {
      updateLayer("non-existent", { zIndex: 999 })
      expect(getLayer("non-existent")).toBeNull()
    })
  })

  describe("getLayer", () => {
    it("should return null for non-existent layer", () => {
      expect(getLayer("nope")).toBeNull()
    })

    it("should return layer for existing ID", () => {
      const layer = createTestLayer({ id: "get-test" })
      addLayer(layer)
      expect(getLayer("get-test")).toEqual(layer)
    })
  })

  describe("getAllLayers", () => {
    it("should return empty array when no layers", () => {
      expect(getAllLayers()).toEqual([])
    })

    it("should return all layers (unsorted)", () => {
      addLayer(createTestLayer({ id: "1" }))
      addLayer(createTestLayer({ id: "2" }))
      addLayer(createTestLayer({ id: "3" }))

      const all = getAllLayers()
      expect(all.length).toBe(3)
      expect(all.map((l) => l.id).sort()).toEqual(["1", "2", "3"])
    })
  })

  describe("getSortedLayers", () => {
    it("should return empty array when no layers", () => {
      expect(getSortedLayers()).toEqual([])
    })

    it("should return layers sorted by z-index", () => {
      addLayer(createTestLayer({ id: "c", zIndex: 30 }))
      addLayer(createTestLayer({ id: "a", zIndex: 10 }))
      addLayer(createTestLayer({ id: "b", zIndex: 20 }))

      const sorted = getSortedLayers()
      expect(sorted.map((l) => l.id)).toEqual(["a", "b", "c"])
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Z-Index Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe("calculateFrontZIndex", () => {
    it("should add Z_INDEX_GAP to current max", () => {
      expect(calculateFrontZIndex(0)).toBe(Z_INDEX_GAP)
      expect(calculateFrontZIndex(50)).toBe(50 + Z_INDEX_GAP)
      expect(calculateFrontZIndex(-10)).toBe(-10 + Z_INDEX_GAP)
    })
  })

  describe("calculateBackZIndex", () => {
    it("should subtract Z_INDEX_GAP from current min", () => {
      expect(calculateBackZIndex(0)).toBe(-Z_INDEX_GAP)
      expect(calculateBackZIndex(50)).toBe(50 - Z_INDEX_GAP)
      expect(calculateBackZIndex(-10)).toBe(-10 - Z_INDEX_GAP)
    })
  })

  describe("bringToFront", () => {
    it("should do nothing for non-existent layer", () => {
      bringToFront("nope")
      // No error, no change
      expect(getAllLayers()).toEqual([])
    })

    it("should do nothing for single layer", () => {
      addLayer(createTestLayer({ id: "solo", zIndex: 0 }))
      bringToFront("solo")

      // Single layer doesn't change
      expect(getLayer("solo")?.zIndex).toBe(0)
    })

    it("should move layer to front (max + gap)", () => {
      addLayer(createTestLayer({ id: "back", zIndex: 0 }))
      addLayer(createTestLayer({ id: "front", zIndex: 100 }))

      bringToFront("back")

      const backLayer = getLayer("back")
      expect(backLayer?.zIndex).toBe(100 + Z_INDEX_GAP)
    })

    it("should not change already-front layer", () => {
      addLayer(createTestLayer({ id: "back", zIndex: 0 }))
      addLayer(createTestLayer({ id: "front", zIndex: 100 }))

      bringToFront("front")

      // Already at front - no change (zIndex stays 100, not 100 + gap)
      expect(getLayer("front")?.zIndex).toBe(100)
    })
  })

  describe("sendToBack", () => {
    it("should do nothing for non-existent layer", () => {
      sendToBack("nope")
      expect(getAllLayers()).toEqual([])
    })

    it("should do nothing for single layer", () => {
      addLayer(createTestLayer({ id: "solo", zIndex: 50 }))
      sendToBack("solo")

      expect(getLayer("solo")?.zIndex).toBe(50)
    })

    it("should move layer to back (min - gap)", () => {
      addLayer(createTestLayer({ id: "back", zIndex: 0 }))
      addLayer(createTestLayer({ id: "front", zIndex: 100 }))

      sendToBack("front")

      const frontLayer = getLayer("front")
      expect(frontLayer?.zIndex).toBe(0 - Z_INDEX_GAP)
    })

    it("should not change already-back layer", () => {
      addLayer(createTestLayer({ id: "back", zIndex: 0 }))
      addLayer(createTestLayer({ id: "front", zIndex: 100 }))

      sendToBack("back")

      // Already at back - no change
      expect(getLayer("back")?.zIndex).toBe(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Property Setters
  // ─────────────────────────────────────────────────────────────────────────

  describe("setVisible", () => {
    it("should update visibility", () => {
      addLayer(createTestLayer({ id: "vis-test", visible: true }))

      setVisible("vis-test", false)
      expect(getLayer("vis-test")?.visible).toBe(false)

      setVisible("vis-test", true)
      expect(getLayer("vis-test")?.visible).toBe(true)
    })

    it("should affect visibleLayersAtom", () => {
      addLayer(createTestLayer({ id: "a", visible: true }))

      expect(layerRegistry.get(visibleLayersAtom).length).toBe(1)

      setVisible("a", false)
      expect(layerRegistry.get(visibleLayersAtom).length).toBe(0)
    })
  })

  describe("setPointerEvents", () => {
    it("should update pointer events behavior", () => {
      addLayer(createTestLayer({ id: "pe-test", pointerEvents: "auto" }))

      setPointerEvents("pe-test", "none")
      expect(getLayer("pe-test")?.pointerEvents).toBe("none")

      setPointerEvents("pe-test", "pass-through")
      expect(getLayer("pe-test")?.pointerEvents).toBe("pass-through")
    })
  })

  describe("setZIndex", () => {
    it("should update z-index directly", () => {
      addLayer(createTestLayer({ id: "z-test", zIndex: 0 }))

      setZIndex("z-test", 999)
      expect(getLayer("z-test")?.zIndex).toBe(999)

      setZIndex("z-test", -500)
      expect(getLayer("z-test")?.zIndex).toBe(-500)
    })

    it("should affect sorted order", () => {
      addLayer(createTestLayer({ id: "a", zIndex: 10 }))
      addLayer(createTestLayer({ id: "b", zIndex: 20 }))

      expect(getSortedLayers().map((l) => l.id)).toEqual(["a", "b"])

      setZIndex("a", 100)
      expect(getSortedLayers().map((l) => l.id)).toEqual(["b", "a"])
    })
  })

  describe("setPositionMode", () => {
    it("should update position mode", () => {
      addLayer(createTestLayer({ id: "pos-test", positionMode: "relative" }))

      setPositionMode("pos-test", "absolute")
      expect(getLayer("pos-test")?.positionMode).toBe("absolute")

      setPositionMode("pos-test", "fixed")
      expect(getLayer("pos-test")?.positionMode).toBe("fixed")

      setPositionMode("pos-test", "sticky")
      expect(getLayer("pos-test")?.positionMode).toBe("sticky")
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Reset Utilities
  // ─────────────────────────────────────────────────────────────────────────

  describe("resetAllLayers", () => {
    it("should clear all layers", () => {
      addLayer(createTestLayer({ id: "1" }))
      addLayer(createTestLayer({ id: "2" }))
      addLayer(createTestLayer({ id: "3" }))

      expect(layerRegistry.get(layerCountAtom)).toBe(3)

      resetAllLayers()

      expect(layerRegistry.get(layerCountAtom)).toBe(0)
      expect(getAllLayers()).toEqual([])
    })

    it("should reset ID counter", () => {
      generateLayerId()
      generateLayerId()
      expect(layerRegistry.get(layerIdCounterAtom)).toBe(2)

      resetAllLayers()

      expect(layerRegistry.get(layerIdCounterAtom)).toBe(0)
    })

    it("should reset derived atoms", () => {
      addLayer(createTestLayer({ id: "test", zIndex: 100, visible: true }))

      expect(layerRegistry.get(maxZIndexAtom)).toBe(100)
      expect(layerRegistry.get(visibleLayersAtom).length).toBe(1)

      resetAllLayers()

      expect(layerRegistry.get(maxZIndexAtom)).toBe(0)
      expect(layerRegistry.get(visibleLayersAtom).length).toBe(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Constants
  // ─────────────────────────────────────────────────────────────────────────

  describe("Z_INDEX_GAP", () => {
    it("should be 10", () => {
      expect(Z_INDEX_GAP).toBe(10)
    })
  })

  describe("LAYER_DEFAULTS", () => {
    it("should have correct default values", () => {
      expect(LAYER_DEFAULTS.initialZIndex).toBe(0)
      expect(LAYER_DEFAULTS.visible).toBe(true)
      expect(LAYER_DEFAULTS.positionMode).toBe("relative")
      expect(LAYER_DEFAULTS.pointerEvents).toBe("auto")
    })
  })
})
