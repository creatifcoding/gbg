import { describe, it, expect } from "vitest"
import { Registry } from "@effect-atom/atom"
import { Effect } from "effect"
import {
  makeNuCmdkSearchBroker,
  QuerySessionNotFound,
  makeStaticRowsAdapter,
  type Theta,
  type QueryRow,
  type EventRecord,
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

const mkRow = (params: {
  rowId: string
  laneId: string
  score: number
  resolverIdentity: string
}): QueryRow =>
  ({
    rowId: params.rowId,
    laneId: params.laneId,
    score: params.score,
    category: "docs",
    rendererToken: "docs/document/list@v2",
    resolverIdentity: params.resolverIdentity,
  } as unknown as QueryRow)

describe("nu-cmdk search broker slice", () => {
  it("maintains query isolation across concurrent sessions", async () => {
    const events: Array<EventRecord> = []

    const out = await Effect.runPromise(
      Effect.gen(function* () {
        const broker = yield* makeNuCmdkSearchBroker({
          theta,
          runId: "test-run",
          registry: Registry.make(),
          onEvent: (event) => events.push(event),
        })

        yield* broker.startQuery({
          queryId: "q-1",
          queryText: "alpha",
          scope: "global",
          scenarioId: "TEST-A",
        })
        yield* broker.startQuery({
          queryId: "q-2",
          queryText: "beta",
          scope: "global",
          scenarioId: "TEST-B",
        })

        yield* broker.tell("q-1", {
          _tag: "IngestChunk",
          laneId: "rpc",
          seq: 1,
          rows: [mkRow({ rowId: "r-a", laneId: "rpc", score: 0.9, resolverIdentity: "search:rpc.lookup@v1" })],
          scenarioId: "TEST-A",
        })
        yield* broker.tell("q-1", { _tag: "PlannerTick", scenarioId: "TEST-A" })

        yield* broker.tell("q-2", {
          _tag: "IngestChunk",
          laneId: "rpc",
          seq: 1,
          rows: [mkRow({ rowId: "r-b", laneId: "rpc", score: 0.85, resolverIdentity: "search:rpc.lookup@v1" })],
          scenarioId: "TEST-B",
        })
        yield* broker.tell("q-2", { _tag: "PlannerTick", scenarioId: "TEST-B" })
        yield* Effect.sleep("10 millis")

        const q1 = yield* broker.snapshot("q-1")
        const q2 = yield* broker.snapshot("q-2")

        yield* broker.stopAll

        return { q1, q2 }
      }),
    )

    expect(out.q1.rowsById["r-a"]).toBeDefined()
    expect(out.q1.rowsById["r-b"]).toBeUndefined()
    expect(out.q2.rowsById["r-b"]).toBeDefined()
    expect(out.q2.rowsById["r-a"]).toBeUndefined()
  })

  it("stopQuery closes only the targeted query", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const broker = yield* makeNuCmdkSearchBroker({
          theta,
          runId: "test-run",
          registry: Registry.make(),
          onEvent: () => {},
        })

        yield* broker.startQuery({
          queryId: "q-1",
          queryText: "alpha",
          scope: "global",
          scenarioId: "TEST-A",
        })
        yield* broker.startQuery({
          queryId: "q-2",
          queryText: "beta",
          scope: "global",
          scenarioId: "TEST-B",
        })

        yield* broker.stopQuery("q-1")

        const idsAfter = yield* broker.listQueryIds

        // q-2 should still be alive
        yield* broker.tell("q-2", {
          _tag: "IngestChunk",
          laneId: "rpc",
          seq: 1,
          rows: [mkRow({ rowId: "r-live", laneId: "rpc", score: 0.8, resolverIdentity: "search:rpc.lookup@v1" })],
          scenarioId: "TEST-B",
        })
        yield* broker.tell("q-2", { _tag: "PlannerTick", scenarioId: "TEST-B" })
        yield* Effect.sleep("10 millis")
        const q2 = yield* broker.snapshot("q-2")

        const q1Lookup = yield* broker.snapshot("q-1").pipe(
          Effect.map(() => "unexpected-success" as const),
          Effect.catchTag("QuerySessionNotFound", () => Effect.succeed("not-found" as const)),
        )

        yield* broker.stopAll

        return { idsAfter, q2, q1Lookup }
      }),
    )

    expect(result.idsAfter).toEqual(["q-2"])
    expect(result.q2.rowsById["r-live"]).toBeDefined()
    expect(result.q1Lookup).toBe("not-found")
  })

  it("runAdapters ingests generic multi-kind results (not commands-only)", async () => {
    const events: Array<EventRecord> = []

    const out = await Effect.runPromise(
      Effect.gen(function* () {
        const adapters = [
          makeStaticRowsAdapter({
            adapterId: "generic-docs",
            laneId: "docs-lane",
            emits: ["docs", "agent"],
            rows: [
              mkRow({ rowId: "doc-1", laneId: "docs-lane", score: 0.82, resolverIdentity: "docs:http.fetch@v1" }),
              {
                rowId: "agent-1",
                laneId: "docs-lane",
                score: 0.78,
                category: "agent",
                rendererToken: "agent/workflow/list@v1",
                resolverIdentity: "search:rpc.lookup@v1",
              } as unknown as QueryRow,
            ],
          }),
        ]

        const broker = yield* makeNuCmdkSearchBroker({
          theta,
          runId: "test-run",
          registry: Registry.make(),
          onEvent: (event) => events.push(event),
          adapters,
        })

        yield* broker.startQuery({
          queryId: "q-generic",
          queryText: "multi-kind",
          scope: "global",
          scenarioId: "TEST-G",
        })

        yield* broker.runAdapters("q-generic")
        yield* Effect.sleep("10 millis")

        const snap = yield* broker.snapshot("q-generic")
        yield* broker.stopAll

        return snap
      }),
    )

    expect(Object.keys(out.rowsById)).toContain("doc-1")
    expect(Object.keys(out.rowsById)).toContain("agent-1")
    expect(events.some((e) => e.event === "lane.adapter.succeeded")).toBe(true)
  })

  it("drops rows that exceed adapter declared result kinds", async () => {
    const events: Array<EventRecord> = []

    const out = await Effect.runPromise(
      Effect.gen(function* () {
        const adapters = [
          makeStaticRowsAdapter({
            adapterId: "docs-only",
            laneId: "docs-lane",
            emits: ["docs"],
            rows: [
              mkRow({ rowId: "doc-2", laneId: "docs-lane", score: 0.8, resolverIdentity: "docs:http.fetch@v1" }),
              {
                rowId: "cmd-should-drop",
                laneId: "docs-lane",
                score: 0.99,
                category: "command",
                rendererToken: "commands/command/list@v1",
                resolverIdentity: "commands:open@v1",
              } as unknown as QueryRow,
            ],
          }),
        ]

        const broker = yield* makeNuCmdkSearchBroker({
          theta,
          runId: "test-run",
          registry: Registry.make(),
          onEvent: (event) => events.push(event),
          adapters,
        })

        yield* broker.startQuery({
          queryId: "q-typed-emits",
          queryText: "typed",
          scope: "global",
          scenarioId: "TEST-TE",
        })

        yield* broker.runAdapters("q-typed-emits")
        yield* Effect.sleep("10 millis")

        const snap = yield* broker.snapshot("q-typed-emits")
        yield* broker.stopAll

        return snap
      }),
    )

    expect(Object.keys(out.rowsById)).toContain("doc-2")
    expect(Object.keys(out.rowsById)).not.toContain("cmd-should-drop")
    expect(events.some((e) => e.event === "lane.adapter.kind_mismatch")).toBe(true)
  })
})
