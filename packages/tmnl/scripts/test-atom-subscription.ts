#!/usr/bin/env bun
/**
 * Test atom subscription behavior - simulates what React would see
 *
 * Uses effect-atom Registry subscription directly to verify atoms update.
 */

import { Effect, Stream, pipe } from "effect"
import { Atom, Registry } from "@effect-atom/atom-react"
import { UITree } from "@/lib/json-render/core"
import { processPatches, streamFromFetchProgressive } from "@/lib/json-render/core/streaming"

const SERVER_URL = "http://localhost:7682/ui-generate"

const main = Effect.gen(function* () {
  yield* Effect.log("=== Atom Subscription Test ===")

  // Create a registry like React's RegistryProvider does
  const registry = Registry.make()

  // Create atoms like json-render does
  const treeAtom = Atom.make<UITree>(UITree.empty()).pipe(Atom.keepAlive)
  const isStreamingAtom = Atom.make(false).pipe(Atom.keepAlive)

  // Subscribe to atom changes (simulates useAtomValue / useSyncExternalStore)
  const emissions: { time: number; elements: number; root: string }[] = []
  const startTime = Date.now()

  const unsubscribe = registry.subscribe(treeAtom, (tree) => {
    const elapsed = Date.now() - startTime
    emissions.push({
      time: elapsed,
      elements: Object.keys(tree.elements).length,
      root: tree.root ?? ""
    })
    console.log(`[ATOM SUBSCRIPTION] ${elapsed}ms: ${Object.keys(tree.elements).length} elements, root: ${tree.root}`)
  })

  yield* Effect.log("Subscribed to treeAtom, fetching from server...")
  registry.set(isStreamingAtom, true)

  // Get progressive stream
  const patchStream = yield* streamFromFetchProgressive(
    SERVER_URL,
    { prompt: "Create a simple card with a button" }
  )

  // Process patches like useUIStream does
  yield* pipe(
    processPatches(patchStream),
    Stream.runForEach((newTree) =>
      Effect.gen(function* () {
        registry.set(treeAtom, newTree)
        // Use setTimeout(0) macrotask like the fix
        yield* Effect.promise(() => new Promise<void>(r => setTimeout(r, 0)))
      })
    )
  )

  registry.set(isStreamingAtom, false)
  unsubscribe()

  yield* Effect.log(`\n=== Result: ${emissions.length} subscription callbacks ===`)

  if (emissions.length > 0) {
    yield* Effect.log("Timeline:")
    for (const e of emissions) {
      yield* Effect.log(`  ${e.time}ms: ${e.elements} elements`)
    }

    const isProgressive = emissions.length > 1 &&
      emissions.some((e, i) => i > 0 && e.time - emissions[i-1].time > 10)
    yield* Effect.log(`Progressive subscription callbacks: ${isProgressive ? "YES ✓" : "NO ✗"}`)
  }
})

Effect.runPromise(main).catch(console.error)
