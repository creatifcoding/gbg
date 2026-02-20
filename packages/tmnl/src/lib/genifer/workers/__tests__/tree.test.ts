/**
 * Tree Worker Tests
 *
 * Tests the TreeWorker service using the Fallback layer
 * (actual web workers don't run in Node/Bun test environment).
 *
 * @module genifer/workers/__tests__/tree
 */

import { describe, it, expect } from "vitest"
import { Effect, Stream, Chunk, HashMap, Option } from "effect"
import {
  TreeWorker,
  TreeWorkerFallback,
  makeTreeWorkerFallback,
} from "../tree-worker-api"
import { UITree, UIElement, JsonPatch } from "../../core/schemas"

// =============================================================================
// Test Data
// =============================================================================

const emptyTree = UITree.empty()

const makeElement = (key: string, type: string, props: Record<string, unknown> = {}): UIElement =>
  new UIElement({
    key,
    type,
    props,
    children: [],
    parentKey: null,
  })

const makePatch = (
  op: "add" | "remove" | "replace" | "set",
  path: string,
  value?: unknown
): JsonPatch =>
  new JsonPatch({ op, path, value })

// =============================================================================
// Test Suite
// =============================================================================

describe("TreeWorker", () => {
  describe("applyPatches", () => {
    it("should set root", async () => {
      const patches = Chunk.fromIterable([
        makePatch("set", "/root", "root-key"),
      ])

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* TreeWorker
          return yield* worker.applyPatches(emptyTree, patches)
        }).pipe(Effect.provide(TreeWorkerFallback))
      )

      expect(result.root).toBe("root-key")
    })

    it("should add entire element", async () => {
      const element = {
        key: "box-1",
        type: "Box",
        props: { color: "red" },
        children: [],
        parentKey: null,
      }
      const patches = Chunk.fromIterable([
        makePatch("add", "/elements/box-1", element),
      ])

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* TreeWorker
          return yield* worker.applyPatches(emptyTree, patches)
        }).pipe(Effect.provide(TreeWorkerFallback))
      )

      expect(result.getElementUnsafe("box-1")).toBeDefined()
      expect(result.getElementUnsafe("box-1")?.type).toBe("Box")
      expect(result.getElementUnsafe("box-1")?.props["color"]).toBe("red")
    })

    it("should update element property", async () => {
      // Start with a tree that has an element
      const initialTree = emptyTree.setElement(
        "box-1",
        makeElement("box-1", "Box", { color: "red" })
      )

      const patches = Chunk.fromIterable([
        makePatch("replace", "/elements/box-1/props/color", "blue"),
      ])

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* TreeWorker
          return yield* worker.applyPatches(initialTree, patches)
        }).pipe(Effect.provide(TreeWorkerFallback))
      )

      expect(result.getElementUnsafe("box-1")?.props["color"]).toBe("blue")
    })

    it("should remove element", async () => {
      const initialTree = emptyTree.setElement(
        "box-1",
        makeElement("box-1", "Box")
      )

      const patches = Chunk.fromIterable([
        makePatch("remove", "/elements/box-1"),
      ])

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* TreeWorker
          return yield* worker.applyPatches(initialTree, patches)
        }).pipe(Effect.provide(TreeWorkerFallback))
      )

      expect(result.getElementUnsafe("box-1")).toBeUndefined()
    })

    it("should apply multiple patches in sequence", async () => {
      const patches = Chunk.fromIterable([
        makePatch("set", "/root", "container"),
        makePatch("add", "/elements/container", {
          key: "container",
          type: "Stack",
          props: { direction: "vertical" },
          children: [],
          parentKey: null,
        }),
        makePatch("add", "/elements/item-1", {
          key: "item-1",
          type: "Text",
          props: { content: "Hello" },
          children: [],
          parentKey: "container",
        }),
      ])

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* TreeWorker
          return yield* worker.applyPatches(emptyTree, patches)
        }).pipe(Effect.provide(TreeWorkerFallback))
      )

      expect(result.root).toBe("container")
      expect(HashMap.size(result.elements)).toBe(2)
      expect(result.getElementUnsafe("container")?.type).toBe("Stack")
      expect(result.getElementUnsafe("item-1")?.type).toBe("Text")
      expect(result.getElementUnsafe("item-1")?.parentKey).toBe("container")
    })

    it("should handle empty patch list", async () => {
      const initialTree = emptyTree.setRoot("test")
      const patches = Chunk.empty<JsonPatch>()

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* TreeWorker
          return yield* worker.applyPatches(initialTree, patches)
        }).pipe(Effect.provide(TreeWorkerFallback))
      )

      // Should return same tree (no changes)
      expect(result.root).toBe("test")
    })
  })

  describe("applyStream", () => {
    it("should process patch stream into tree updates", async () => {
      const patchStream = Stream.fromIterable([
        makePatch("set", "/root", "root"),
        makePatch("add", "/elements/a", {
          key: "a",
          type: "Box",
          props: {},
          children: [],
          parentKey: null,
        }),
        makePatch("add", "/elements/b", {
          key: "b",
          type: "Text",
          props: {},
          children: [],
          parentKey: "a",
        }),
      ])

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* TreeWorker
          // Batch size 2 means: [root, a], [b]
          const treeStream = worker.applyStream(emptyTree, patchStream, 2)
          return yield* Stream.runCollect(treeStream)
        }).pipe(Effect.provide(TreeWorkerFallback))
      )

      const trees = Array.from(result)
      // With batch size 2: first batch [root, a], second batch [b]
      // Initial emptyTree + 2 updates = 3 total
      expect(trees.length).toBeGreaterThanOrEqual(2)

      // Final tree should have both elements
      const finalTree = trees[trees.length - 1]!
      expect(finalTree.root).toBe("root")
      expect(finalTree.getElementUnsafe("a")).toBeDefined()
      expect(finalTree.getElementUnsafe("b")).toBeDefined()
    })

    it("should handle batch size 1", async () => {
      const patches = [
        makePatch("set", "/root", "x"),
        makePatch("add", "/elements/x", {
          key: "x",
          type: "Box",
          props: {},
          children: [],
          parentKey: null,
        }),
      ]
      const patchStream = Stream.fromIterable(patches)

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* TreeWorker
          const treeStream = worker.applyStream(emptyTree, patchStream, 1)
          return yield* Stream.runCollect(treeStream)
        }).pipe(Effect.provide(TreeWorkerFallback))
      )

      // Should have 3 tree updates: initial + 2 patches
      // (scanEffect includes initial value in output)
      expect(Array.from(result)).toHaveLength(3)
    })
  })

  describe("terminate", () => {
    it("should be a no-op for fallback (no worker to terminate)", async () => {
      await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* TreeWorker
          yield* worker.terminate()
        }).pipe(Effect.provide(TreeWorkerFallback))
      )
    })
  })

  describe("makeTreeWorkerFallback (raw)", () => {
    it("should create service directly without Layer", async () => {
      const patches = Chunk.fromIterable([
        makePatch("set", "/root", "direct"),
      ])

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* makeTreeWorkerFallback
          return yield* service.applyPatches(emptyTree, patches)
        })
      )

      expect(result.root).toBe("direct")
    })
  })
})

describe("Patch Operations", () => {
  describe("set/add/replace behave identically", () => {
    it.each(["set", "add", "replace"] as const)(
      "op %s should create element",
      async (op) => {
        const element = {
          key: "el",
          type: "Box",
          props: {},
          children: [],
          parentKey: null,
        }
        const patches = Chunk.fromIterable([makePatch(op, "/elements/el", element)])

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const worker = yield* TreeWorker
            return yield* worker.applyPatches(emptyTree, patches)
          }).pipe(Effect.provide(TreeWorkerFallback))
        )

        expect(result.getElementUnsafe("el")).toBeDefined()
        expect(result.getElementUnsafe("el")?.type).toBe("Box")
      }
    )
  })

  describe("nested property updates", () => {
    it("should update deeply nested props", async () => {
      const initialTree = emptyTree.setElement(
        "box",
        makeElement("box", "Box", {
          style: { color: "red", margin: { top: 0 } },
        })
      )

      const patches = Chunk.fromIterable([
        makePatch("set", "/elements/box/props/style/margin/top", 10),
      ])

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* TreeWorker
          return yield* worker.applyPatches(initialTree, patches)
        }).pipe(Effect.provide(TreeWorkerFallback))
      )

      const props = result.getElementUnsafe("box")?.props as {
        style: { margin: { top: number } }
      }
      expect(props.style.margin.top).toBe(10)
    })
  })

  describe("element children", () => {
    it("should preserve children array", async () => {
      const element = {
        key: "parent",
        type: "Stack",
        props: {},
        children: ["child-1", "child-2"],
        parentKey: null,
      }
      const patches = Chunk.fromIterable([
        makePatch("add", "/elements/parent", element),
      ])

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const worker = yield* TreeWorker
          return yield* worker.applyPatches(emptyTree, patches)
        }).pipe(Effect.provide(TreeWorkerFallback))
      )

      expect(result.getElementUnsafe("parent")?.children).toEqual(["child-1", "child-2"])
    })
  })
})

describe("Edge Cases", () => {
  it("should handle updating non-existent element gracefully", async () => {
    const patches = Chunk.fromIterable([
      makePatch("replace", "/elements/nonexistent/props/x", 1),
    ])

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const worker = yield* TreeWorker
        return yield* worker.applyPatches(emptyTree, patches)
      }).pipe(Effect.provide(TreeWorkerFallback))
    )

    // Should not throw, tree unchanged
    expect(HashMap.size(result.elements)).toBe(0)
  })

  it("should handle removing non-existent element gracefully", async () => {
    const patches = Chunk.fromIterable([
      makePatch("remove", "/elements/nonexistent"),
    ])

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const worker = yield* TreeWorker
        return yield* worker.applyPatches(emptyTree, patches)
      }).pipe(Effect.provide(TreeWorkerFallback))
    )

    // Should not throw
    expect(HashMap.size(result.elements)).toBe(0)
  })

  it("should ignore unknown paths", async () => {
    const patches = Chunk.fromIterable([
      makePatch("set", "/unknown/path", "value"),
    ])

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const worker = yield* TreeWorker
        return yield* worker.applyPatches(emptyTree, patches)
      }).pipe(Effect.provide(TreeWorkerFallback))
    )

    // Should not throw, tree unchanged
    expect(result.root).toBe("")
  })
})
