import { describe, it, expect } from "vitest"
import { Registry } from "@effect-atom/atom"
import { Effect } from "effect"
import {
  createQuerySession,
  defaultRendererRegistry,
  makeDefaultPolicyBundle,
  makeDefaultRendererCompatibilityMap,
  makeInMemoryCacheGuard,
  type EventRecord,
  type QueryRow,
  type Theta,
} from "../index"

const theta: Theta = {
  publish_budget_base: 4,
  publish_budget_degraded: 2,
  rank_weight: { provider: 0.45, lexical: 0.35, semantic: 0.2, recency: 0 },
  stability_epsilon: 0.015,
  stability_window_ms: 120,
  quality_budget: {
    max_fallback_ratio: 0.35,
    max_decode_drop_ratio: 0.1,
    max_resolver_deny_ratio: 0,
  },
  cacheguard: {
    singleflight_ttl_ms: 250,
    checkpoint_wal_pages: 1000,
  },
}

describe("nu-cmdk query session slice", () => {
  it("drops stale sequence chunks", async () => {
    const events: Array<EventRecord> = []

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const registry = Registry.make()
          const handle = yield* createQuerySession({
            queryId: "q-stale",
            queryText: "stale",
            scope: "global",
            deps: {
              theta,
              policyBundle: makeDefaultPolicyBundle(),
              rendererCompatibility: makeDefaultRendererCompatibilityMap(),
              rendererRegistry: defaultRendererRegistry(),
              cacheGuard: makeInMemoryCacheGuard(registry),
              registry,
              runId: "test-run",
              scenarioId: "TEST",
              onEvent: (event) => events.push(event),
            },
          })

          const rowA: QueryRow = {
            rowId: "a" as QueryRow["rowId"],
            laneId: "rpc" as QueryRow["laneId"],
            score: 0.9,
            category: "docs",
            rendererToken: "docs/document/list@v2",
            resolverIdentity: "search:rpc.lookup@v1",
          }

          const rowB: QueryRow = {
            ...rowA,
            rowId: "b" as QueryRow["rowId"],
          }

          yield* handle.tell({ _tag: "IngestChunk", laneId: "rpc", seq: 2, rows: [rowA], scenarioId: "TEST" })
          yield* handle.tell({ _tag: "IngestChunk", laneId: "rpc", seq: 1, rows: [rowB], scenarioId: "TEST" })
          yield* handle.tell({ _tag: "PlannerTick", scenarioId: "TEST" })
          yield* Effect.sleep("10 millis")

          const snapshot = yield* handle.snapshot
          yield* handle.shutdown

          return snapshot
        }),
      ),
    )

    expect(result.lanes.rpc?.lastSeq).toBe(2)
    expect(result.rowsById["a"]).toBeDefined()
    expect(result.rowsById["b"]).toBeUndefined()
    expect(events.some((e) => e.event === "lane.chunk.dropped.stale_seq")).toBe(true)
  })

  it("denies unapproved resolver identities", async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const registry = Registry.make()
          const events: Array<EventRecord> = []
          const handle = yield* createQuerySession({
            queryId: "q-policy",
            queryText: "policy",
            scope: "global",
            deps: {
              theta,
              policyBundle: makeDefaultPolicyBundle(),
              rendererCompatibility: makeDefaultRendererCompatibilityMap(),
              rendererRegistry: defaultRendererRegistry(),
              cacheGuard: makeInMemoryCacheGuard(registry),
              registry,
              runId: "test-run",
              scenarioId: "TEST",
              onEvent: (event) => events.push(event),
            },
          })

          const bad: QueryRow = {
            rowId: "bad" as QueryRow["rowId"],
            laneId: "rpc" as QueryRow["laneId"],
            score: 1,
            category: "command",
            rendererToken: "commands/command/list@v1",
            resolverIdentity: "malicious:admin.delete@v1",
          }

          yield* handle.tell({ _tag: "IngestChunk", laneId: "rpc", seq: 1, rows: [bad], scenarioId: "TEST" })
          yield* handle.tell({ _tag: "PlannerTick", scenarioId: "TEST" })
          yield* Effect.sleep("10 millis")

          const snapshot = yield* handle.snapshot
          yield* handle.shutdown

          return {
            snapshot,
            deniedEvents: events.filter((e) => e.event === "resolver.dispatch.denied").length,
          }
        }),
      ),
    )

    expect(Object.keys(result.snapshot.rowsById)).toHaveLength(0)
    expect(result.deniedEvents).toBeGreaterThan(0)
  })
})
