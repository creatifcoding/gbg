/**
 * stx.pull() v2 — manual pull-based streaming
 */

import { describe, it, expect } from "vitest"
import { AtomRegistry } from "effect/unstable/reactivity"
import * as Stream from "effect/Stream"
import { stxPull } from "../../src/streaming/pull.js"

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

describe("stxPull — append mode (default)", () => {
  it("auto-pull on mount loads first chunk for sync streams", async () => {
    const registry = AtomRegistry.make()

    const pull = stxPull(
      Stream.fromIterable([10, 20, 30, 40, 50]).pipe(Stream.grouped(2)),
      {},
      registry
    )

    // Sync stream: auto-pull fires on mount → items populated immediately
    const items = registry.get(pull.items)
    expect(items.length).toBeGreaterThan(0)
    console.log(`\n  Auto-pull on mount: ${JSON.stringify(items)}`)

    // Explicit pull loads next page
    pull.pull()
    await sleep(20)

    const moreItems = registry.get(pull.items)
    expect(moreItems.length).toBeGreaterThan(items.length)
    console.log(`  After explicit pull: ${JSON.stringify(moreItems)}`)
  })

  it("cursor increments per pull (starts at 1 for sync auto-pull)", async () => {
    const registry = AtomRegistry.make()

    const pull = stxPull(
      Stream.fromIterable([1, 2, 3, 4, 5, 6]).pipe(Stream.grouped(2)),
      { trackCursor: true },
      registry
    )

    // Auto-pull fired on mount → cursor = 1
    expect(registry.get(pull.cursor)).toBe(1)

    pull.pull()
    await sleep(20)
    expect(registry.get(pull.cursor)).toBe(2)

    pull.pull()
    await sleep(20)
    expect(registry.get(pull.cursor)).toBe(3)
  })

  it("reset() clears items and cursor", async () => {
    const registry = AtomRegistry.make()

    const pull = stxPull(
      Stream.fromIterable([1, 2, 3, 4]).pipe(Stream.grouped(2)),
      {},
      registry
    )

    pull.pull()
    await sleep(20)
    expect(registry.get(pull.items).length).toBeGreaterThan(0)

    pull.reset()
    expect(registry.get(pull.items)).toHaveLength(0)
    expect(registry.get(pull.cursor)).toBe(0)
  })
})

describe("stxPull — replace mode", () => {
  it("each pull replaces previous items", async () => {
    const registry = AtomRegistry.make()

    const pull = stxPull(
      Stream.fromIterable([10, 20, 30, 40]).pipe(Stream.grouped(2)),
      { mode: "replace" },
      registry
    )

    pull.pull()
    await sleep(20)
    const first = registry.get(pull.items)

    pull.pull()
    await sleep(20)
    const second = registry.get(pull.items)

    // In replace mode, items should not grow unboundedly
    expect(second.length).toBeLessThanOrEqual(2)
    console.log(`\n  Replace mode: first=${JSON.stringify(first)}, second=${JSON.stringify(second)}`)
  })
})
