/**
 * Layer System v2 — Hooks Tests
 *
 * Tests for React hooks: useLayer, useLayerStyle, useLayerOps, LayerProvider.
 * Uses @testing-library/react for hook testing.
 */

import { describe, it, expect, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import * as React from "react"
import {
  LayerProvider,
  useLayer,
  useExistingLayer,
  useLayerStyle,
  useLayerStyleFromValues,
  useLayerOps,
  useGlobalLayerOps,
  resetAllLayers,
  getLayer,
  addLayer,
  type LayerInstance,
} from "../index"

// ─────────────────────────────────────────────────────────────────────────────
// Test Wrapper
// ─────────────────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  return <LayerProvider>{children}</LayerProvider>
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Layer System v2 Hooks", () => {
  beforeEach(() => {
    resetAllLayers()
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // useLayerStyle
  // ─────────────────────────────────────────────────────────────────────────────

  describe("useLayerStyle", () => {
    it("should return empty object for null layer", () => {
      const { result } = renderHook(() => useLayerStyle(null), { wrapper })

      expect(result.current).toEqual({})
    })

    it("should compute style from layer instance", () => {
      const layer: LayerInstance = {
        id: "test-1",
        name: "test",
        zIndex: 50,
        visible: true,
        positionMode: "absolute",
        pointerEvents: "auto",
      }

      const { result } = renderHook(() => useLayerStyle(layer), { wrapper })

      expect(result.current).toEqual({
        position: "absolute",
        zIndex: 50,
        pointerEvents: "auto",
        visibility: "visible",
      })
    })

    it("should set visibility hidden when layer not visible", () => {
      const layer: LayerInstance = {
        id: "test-1",
        name: "test",
        zIndex: 0,
        visible: false,
        positionMode: "relative",
        pointerEvents: "auto",
      }

      const { result } = renderHook(() => useLayerStyle(layer), { wrapper })

      expect(result.current.visibility).toBe("hidden")
    })

    it("should map pass-through to pointerEvents none", () => {
      const layer: LayerInstance = {
        id: "test-1",
        name: "test",
        zIndex: 0,
        visible: true,
        positionMode: "relative",
        pointerEvents: "pass-through",
      }

      const { result } = renderHook(() => useLayerStyle(layer), { wrapper })

      expect(result.current.pointerEvents).toBe("none")
    })

    it("should memoize style when layer properties unchanged", () => {
      const layer: LayerInstance = {
        id: "test-1",
        name: "test",
        zIndex: 10,
        visible: true,
        positionMode: "fixed",
        pointerEvents: "none",
      }

      const { result, rerender } = renderHook(() => useLayerStyle(layer), { wrapper })
      const firstStyle = result.current

      rerender()

      expect(result.current).toBe(firstStyle) // Same reference
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // useLayerStyleFromValues
  // ─────────────────────────────────────────────────────────────────────────────

  describe("useLayerStyleFromValues", () => {
    it("should compute style from individual values", () => {
      const { result } = renderHook(
        () =>
          useLayerStyleFromValues({
            zIndex: 100,
            visible: true,
            positionMode: "sticky",
            pointerEvents: "auto",
          }),
        { wrapper }
      )

      expect(result.current).toEqual({
        position: "sticky",
        zIndex: 100,
        pointerEvents: "auto",
        visibility: "visible",
      })
    })

    it("should use defaults for missing values", () => {
      const { result } = renderHook(() => useLayerStyleFromValues({}), { wrapper })

      expect(result.current).toEqual({
        position: "relative",
        zIndex: 0,
        pointerEvents: "auto",
        visibility: "visible",
      })
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // useLayerOps
  // ─────────────────────────────────────────────────────────────────────────────

  describe("useLayerOps", () => {
    it("should return bound operations for layer ID", () => {
      // First add a layer
      const layer: LayerInstance = {
        id: "ops-test",
        name: "ops-test",
        zIndex: 0,
        visible: true,
        positionMode: "relative",
        pointerEvents: "auto",
      }
      addLayer(layer)

      const { result } = renderHook(() => useLayerOps("ops-test"), { wrapper })

      expect(result.current.bringToFront).toBeInstanceOf(Function)
      expect(result.current.sendToBack).toBeInstanceOf(Function)
      expect(result.current.setVisible).toBeInstanceOf(Function)
      expect(result.current.setPointerEvents).toBeInstanceOf(Function)
      expect(result.current.setZIndex).toBeInstanceOf(Function)
      expect(result.current.setPositionMode).toBeInstanceOf(Function)
      expect(result.current.remove).toBeInstanceOf(Function)
    })

    it("should execute setVisible operation", () => {
      const layer: LayerInstance = {
        id: "visibility-test",
        name: "visibility-test",
        zIndex: 0,
        visible: true,
        positionMode: "relative",
        pointerEvents: "auto",
      }
      addLayer(layer)

      const { result } = renderHook(() => useLayerOps("visibility-test"), { wrapper })

      act(() => {
        result.current.setVisible(false)
      })

      const updated = getLayer("visibility-test")
      expect(updated?.visible).toBe(false)
    })

    it("should execute setZIndex operation", () => {
      const layer: LayerInstance = {
        id: "zindex-test",
        name: "zindex-test",
        zIndex: 0,
        visible: true,
        positionMode: "relative",
        pointerEvents: "auto",
      }
      addLayer(layer)

      const { result } = renderHook(() => useLayerOps("zindex-test"), { wrapper })

      act(() => {
        result.current.setZIndex(999)
      })

      const updated = getLayer("zindex-test")
      expect(updated?.zIndex).toBe(999)
    })

    it("should execute remove operation", () => {
      const layer: LayerInstance = {
        id: "remove-test",
        name: "remove-test",
        zIndex: 0,
        visible: true,
        positionMode: "relative",
        pointerEvents: "auto",
      }
      addLayer(layer)

      expect(getLayer("remove-test")).not.toBeNull()

      const { result } = renderHook(() => useLayerOps("remove-test"), { wrapper })

      act(() => {
        result.current.remove()
      })

      expect(getLayer("remove-test")).toBeNull()
    })

    it("should memoize ops object when ID unchanged", () => {
      const { result, rerender } = renderHook(() => useLayerOps("stable-id"), { wrapper })
      const firstOps = result.current

      rerender()

      expect(result.current).toBe(firstOps) // Same reference
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // useGlobalLayerOps
  // ─────────────────────────────────────────────────────────────────────────────

  describe("useGlobalLayerOps", () => {
    it("should return unbound operations", () => {
      const { result } = renderHook(() => useGlobalLayerOps(), { wrapper })

      expect(result.current.bringToFront).toBeInstanceOf(Function)
      expect(result.current.setVisible).toBeInstanceOf(Function)
      expect(result.current.removeLayer).toBeInstanceOf(Function)
    })

    it("should execute operations with explicit ID", () => {
      const layer: LayerInstance = {
        id: "global-ops-test",
        name: "global-ops-test",
        zIndex: 0,
        visible: true,
        positionMode: "relative",
        pointerEvents: "auto",
      }
      addLayer(layer)

      const { result } = renderHook(() => useGlobalLayerOps(), { wrapper })

      act(() => {
        result.current.setVisible("global-ops-test", false)
      })

      expect(getLayer("global-ops-test")?.visible).toBe(false)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // useLayer
  // ─────────────────────────────────────────────────────────────────────────────

  describe("useLayer", () => {
    it("should register layer on mount and return ID", () => {
      const { result } = renderHook(
        () => useLayer({ name: "auto-register" }),
        { wrapper }
      )

      expect(result.current.id).toBe("layer-1")
      expect(result.current.layer).not.toBeNull()
      expect(result.current.layer?.name).toBe("auto-register")
    })

    it("should apply config values to registered layer", () => {
      const { result } = renderHook(
        () =>
          useLayer({
            name: "configured-layer",
            initialZIndex: 50,
            visible: false,
            positionMode: "fixed",
            pointerEvents: "none",
          }),
        { wrapper }
      )

      expect(result.current.layer?.zIndex).toBe(50)
      expect(result.current.layer?.visible).toBe(false)
      expect(result.current.layer?.positionMode).toBe("fixed")
      expect(result.current.layer?.pointerEvents).toBe("none")
    })

    it("should return computed style", () => {
      const { result } = renderHook(
        () =>
          useLayer({
            name: "styled-layer",
            initialZIndex: 25,
            positionMode: "absolute",
          }),
        { wrapper }
      )

      expect(result.current.style.position).toBe("absolute")
      expect(result.current.style.zIndex).toBe(25)
    })

    it("should return bound operations", () => {
      const { result } = renderHook(
        () => useLayer({ name: "ops-layer" }),
        { wrapper }
      )

      expect(result.current.ops.bringToFront).toBeInstanceOf(Function)
      expect(result.current.ops.setVisible).toBeInstanceOf(Function)
    })

    it("should unregister layer on unmount", () => {
      const { result, unmount } = renderHook(
        () => useLayer({ name: "unmount-test" }),
        { wrapper }
      )

      const id = result.current.id
      expect(getLayer(id)).not.toBeNull()

      unmount()

      expect(getLayer(id)).toBeNull()
    })

    it("should generate unique IDs for multiple layers", () => {
      const { result: result1 } = renderHook(
        () => useLayer({ name: "layer-a" }),
        { wrapper }
      )
      const { result: result2 } = renderHook(
        () => useLayer({ name: "layer-b" }),
        { wrapper }
      )

      expect(result1.current.id).not.toBe(result2.current.id)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // useExistingLayer
  // ─────────────────────────────────────────────────────────────────────────────

  describe("useExistingLayer", () => {
    it("should return null for non-existent layer", () => {
      const { result } = renderHook(
        () => useExistingLayer("non-existent"),
        { wrapper }
      )

      expect(result.current.layer).toBeNull()
    })

    it("should return existing layer data", () => {
      const layer: LayerInstance = {
        id: "existing-layer",
        name: "existing-layer",
        zIndex: 100,
        visible: true,
        positionMode: "sticky",
        pointerEvents: "auto",
      }
      addLayer(layer)

      const { result } = renderHook(
        () => useExistingLayer("existing-layer"),
        { wrapper }
      )

      expect(result.current.layer).not.toBeNull()
      expect(result.current.layer?.name).toBe("existing-layer")
      expect(result.current.layer?.zIndex).toBe(100)
    })

    it("should return computed style for existing layer", () => {
      const layer: LayerInstance = {
        id: "styled-existing",
        name: "styled-existing",
        zIndex: 75,
        visible: true,
        positionMode: "absolute",
        pointerEvents: "none",
      }
      addLayer(layer)

      const { result } = renderHook(
        () => useExistingLayer("styled-existing"),
        { wrapper }
      )

      expect(result.current.style.position).toBe("absolute")
      expect(result.current.style.zIndex).toBe(75)
      expect(result.current.style.pointerEvents).toBe("none")
    })

    it("should return bound operations for existing layer", () => {
      const layer: LayerInstance = {
        id: "ops-existing",
        name: "ops-existing",
        zIndex: 0,
        visible: true,
        positionMode: "relative",
        pointerEvents: "auto",
      }
      addLayer(layer)

      const { result } = renderHook(
        () => useExistingLayer("ops-existing"),
        { wrapper }
      )

      expect(result.current.ops.bringToFront).toBeInstanceOf(Function)

      act(() => {
        result.current.ops.setVisible(false)
      })

      expect(getLayer("ops-existing")?.visible).toBe(false)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // LayerProvider
  // ─────────────────────────────────────────────────────────────────────────────

  describe("LayerProvider", () => {
    it("should provide registry context to children", () => {
      // If hooks work within LayerProvider, context is provided
      const { result } = renderHook(
        () => useLayer({ name: "context-test" }),
        { wrapper }
      )

      expect(result.current.id).toBeDefined()
      expect(result.current.layer).not.toBeNull()
    })

    it("should share state between multiple hook instances", () => {
      // Create a layer in one hook
      const { result: creator } = renderHook(
        () => useLayer({ name: "shared-layer" }),
        { wrapper }
      )

      const createdId = creator.current.id

      // Access it from another hook
      const { result: accessor } = renderHook(
        () => useExistingLayer(createdId),
        { wrapper }
      )

      expect(accessor.current.layer).not.toBeNull()
      expect(accessor.current.layer?.name).toBe("shared-layer")
    })
  })
})
