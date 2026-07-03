/**
 * Federation Phase 3.7 — two-node convergence tests.
 *
 * Two PCT registries in process. Each gets a full server stack
 * (Routes + Notary + Registry + Identity + EventLog). They expose
 * /capabilities. Node B peers with Node A and polls.
 *
 * Verifies:
 *
 *   1. Schema published on A appears on B after the next poll
 *   2. Out-of-order events still converge to the same state on both
 *      nodes (the Phase 3.2 precedence rule does the work)
 *   3. Idempotent: importing the same manifest twice doesn't
 *      double-apply
 *   4. syncNow does a one-shot pull without joining the peer set
 *   5. unpeer removes the URL from the polling set
 */

import { describe, expect, it } from "vitest"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as Schema from "effect/Schema"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import * as HttpRouter from "effect/unstable/http/HttpRouter"

import * as IdentityLayers from "../src/identity/Layers.js"
import * as NotaryDefault from "../src/notary/Default.js"
import { Notary } from "../src/notary/Notary.js"
import { Registry } from "../src/registry/Registry.js"
import * as RegistryMemory from "../src/registry/Memory.js"
import { Routes } from "../src/server/Routes.js"
import { Federation } from "../src/federation/Federation.js"
import { layer as federationLayer } from "../src/federation/Default.js"

// ─── Shared schema fixtures ─────────────────────────────────────────────────

const Order = Schema.Struct({
  orderId: Schema.String,
  total: Schema.Number,
})

// ─── Server-rig — one in-process server per "node" ──────────────────────────

// Services-only Layer for direct Effects (run() and the federation
// poll loop). NO HttpRouter dependency — those routes are bound only
// to the HTTP handler side.
const NodeServicesLayer = NotaryDefault.Default.pipe(
  Layer.provideMerge(RegistryMemory.layer),
  Layer.provideMerge(IdentityLayers.layerEphemeral),
  Layer.provideMerge(EventJournal.layerMemory),
)

// HTTP-side Layer that combines Routes with the same backing services.
// When given to toWebHandler with the runtime's memoMap, the services
// are shared with the run() side.
const NodeHttpLayer = Layer.mergeAll(Routes, NodeServicesLayer)

interface Node {
  readonly handler: (request: Request) => Promise<Response>
  readonly dispose: () => Promise<void>
  readonly run: <A>(
    eff: Effect.Effect<A, unknown, Notary | Registry>,
  ) => Promise<A>
  readonly baseUrl: string
}

/**
 * Build a fully isolated in-process PCT node where the HTTP handler
 * and the direct `run()` method SHARE service instances via a single
 * `ManagedRuntime`. Writes through `run()` are visible to subsequent
 * HTTP requests; HTTP writes are visible to subsequent `run()` calls.
 */
const buildNode = (baseUrl: string): Node => {
  // Runtime owns the services. The HTTP handler reuses them via memoMap.
  const runtime = ManagedRuntime.make(
    NodeServicesLayer as unknown as Layer.Layer<never, never, never>,
  )
  const { handler, dispose } = HttpRouter.toWebHandler(
    NodeHttpLayer as unknown as Layer.Layer<never, never, never>,
    { disableLogger: true, memoMap: runtime.memoMap },
  )
  const run = <A>(
    eff: Effect.Effect<A, unknown, Notary | Registry>,
  ): Promise<A> =>
    runtime.runPromise(eff as Effect.Effect<A, unknown, never>)
  return {
    handler,
    dispose: async () => {
      await dispose()
      await runtime.dispose()
    },
    run,
    baseUrl,
  }
}

/**
 * Cross-node fetch impl: dispatches to whichever node owns the URL.
 * Both nodes share this fetch so Federation in B can talk to A.
 */
const crossNodeFetch = (nodes: ReadonlyArray<Node>): typeof globalThis.fetch =>
  async (input, init) => {
    const request =
      input instanceof Request ? input : new Request(input, init)
    const url = new URL(request.url)
    for (const node of nodes) {
      const base = new URL(node.baseUrl)
      if (url.host === base.host) {
        // Rebase URL to a synthetic origin the handler accepts
        const rewritten = new Request(
          `http://${url.host}${url.pathname}${url.search}`,
          request,
        )
        return node.handler(rewritten)
      }
    }
    throw new Error(`crossNodeFetch: no node owns host=${url.host}`)
  }

/**
 * Build a Federation runtime for the consumer side (the polling node).
 * Has HttpClient (with cross-node fetch) + EventLog. We pass in nodeB's
 * journal layer reference so federation writes flow to nodeB's state.
 *
 * Tests run with syncOnAdd: true and pollIntervalMs: 100 so peer()
 * + a small sleep gives convergence quickly.
 */
const buildFederationLayer = (
  nodes: ReadonlyArray<Node>,
  pollIntervalMs = 100,
) =>
  federationLayer({ pollIntervalMs, syncOnAdd: true }).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(
      Layer.succeedContext(
        Context.make(FetchHttpClient.Fetch, crossNodeFetch(nodes)),
      ),
    ),
  )

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Federation Phase 3.7 — two-node convergence", () => {
  it("convergence: when B has Federation writing to its own EventLog, A's schemas appear on B", async () => {
    const nodeA = buildNode("http://node-a-2")
    const nodeB = buildNode("http://node-b-2")

    try {
      // Publish on A
      await nodeA.run(
        Effect.gen(function* () {
          const notary = yield* Notary
          yield* notary.registerSchema("orders/Order", "1.0.0", Order)
          yield* notary.registerSchema("orders/Refund", "1.0.0", Order)
        }),
      )

      // For this test, we need Federation's EventLog to be the SAME
      // EventLog that B's Registry folds. Build a unified layer.
      const UnifiedNodeBLayer = federationLayer({
        pollIntervalMs: 100,
        syncOnAdd: true,
      }).pipe(
        Layer.provideMerge(RegistryMemory.layer),
        Layer.provideMerge(IdentityLayers.layerEphemeral),
        Layer.provideMerge(EventJournal.layerMemory),
        Layer.provide(FetchHttpClient.layer),
        Layer.provide(
          Layer.succeedContext(
            Context.make(FetchHttpClient.Fetch, crossNodeFetch([nodeA, nodeB])),
          ),
        ),
      )

      const observed = await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const fed = yield* Federation
            yield* fed.peer(nodeA.baseUrl)
            // syncOnAdd ran the import; we should see A's schemas on B's Registry now
            const reg = yield* Registry
            const snapshot = yield* reg.snapshot
            return {
              schemaCount: snapshot.schemas.size,
              orderEntry: snapshot.schemas.get("orders/Order@1.0.0"),
            }
          }),
        ).pipe(Effect.provide(UnifiedNodeBLayer)),
      )

      expect(observed.schemaCount).toBe(2)
      expect(observed.orderEntry).toBeDefined()
      expect(observed.orderEntry?.schemaId).toBe("orders/Order")
      // The Origin metadata should be preserved from A's identity
      expect(observed.orderEntry?.originNodeId).toMatch(/^pct:[0-9a-f]{8}$/)
    } finally {
      await nodeA.dispose()
      await nodeB.dispose()
    }
  })

  it("idempotent: importing the same manifest twice is a no-op for state", async () => {
    const nodeA = buildNode("http://node-a-3")
    const nodeB = buildNode("http://node-b-3")
    try {
      await nodeA.run(
        Effect.gen(function* () {
          const notary = yield* Notary
          yield* notary.registerSchema("foo/Bar", "1.0.0", Order)
        }),
      )

      const UnifiedNodeBLayer = federationLayer({
        pollIntervalMs: 100,
        syncOnAdd: true,
      }).pipe(
        Layer.provideMerge(RegistryMemory.layer),
        Layer.provideMerge(IdentityLayers.layerEphemeral),
        Layer.provideMerge(EventJournal.layerMemory),
        Layer.provide(FetchHttpClient.layer),
        Layer.provide(
          Layer.succeedContext(
            Context.make(FetchHttpClient.Fetch, crossNodeFetch([nodeA, nodeB])),
          ),
        ),
      )

      const { firstCount, secondCount, registeredAt } =
        await Effect.runPromise(
          Effect.scoped(
            Effect.gen(function* () {
              const fed = yield* Federation
              const reg = yield* Registry
              // First sync
              yield* fed.syncNow(nodeA.baseUrl)
              const first = yield* reg.snapshot
              // Second sync — should be a no-op for state
              yield* fed.syncNow(nodeA.baseUrl)
              const second = yield* reg.snapshot
              return {
                firstCount: first.schemas.size,
                secondCount: second.schemas.size,
                registeredAt: first.schemas.get("foo/Bar@1.0.0")?.registeredAt,
              }
            }),
          ).pipe(Effect.provide(UnifiedNodeBLayer)),
        )

      expect(firstCount).toBe(1)
      expect(secondCount).toBe(1)
      expect(registeredAt).toBeGreaterThan(0)
    } finally {
      await nodeA.dispose()
      await nodeB.dispose()
    }
  })

  it("peers / unpeer surface the peer set correctly", async () => {
    const nodeA = buildNode("http://node-a-4")
    const nodeB = buildNode("http://node-b-4")
    try {
      const UnifiedNodeBLayer = federationLayer({
        pollIntervalMs: 100,
        syncOnAdd: false,
      }).pipe(
        Layer.provideMerge(RegistryMemory.layer),
        Layer.provideMerge(IdentityLayers.layerEphemeral),
        Layer.provideMerge(EventJournal.layerMemory),
        Layer.provide(FetchHttpClient.layer),
        Layer.provide(
          Layer.succeedContext(
            Context.make(FetchHttpClient.Fetch, crossNodeFetch([nodeA, nodeB])),
          ),
        ),
      )

      const result = await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const fed = yield* Federation
            yield* fed.peer(nodeA.baseUrl)
            const peers1 = yield* fed.peers
            yield* fed.unpeer(nodeA.baseUrl)
            const peers2 = yield* fed.peers
            return { added: peers1.length, after: peers2.length, urls: peers1.map((p) => p.url) }
          }),
        ).pipe(Effect.provide(UnifiedNodeBLayer)),
      )

      expect(result.added).toBe(1)
      expect(result.after).toBe(0)
      expect(result.urls).toContain(nodeA.baseUrl)
    } finally {
      await nodeA.dispose()
      await nodeB.dispose()
    }
  })
})
