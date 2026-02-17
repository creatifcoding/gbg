import { describe, expect, it } from "vitest"
import { Effect } from "effect"
import {
  makeHeavyAdapterAdmissionMiddleware,
  makeQueryAdapterRouter,
  makeStaticRowsAdapter,
  queryAdapterMiddleware,
  type QueryRow,
} from "../index"

describe("nu-cmdk query adapter router slice", () => {
  it("dispatches fast adapters before heavy adapters", async () => {
    const order: Array<string> = []

    const fast = makeStaticRowsAdapter({
      adapterId: "fast-adapter",
      laneId: "fast-lane",
      emits: ["docs"],
      costClass: "fast",
      rows: ({ dispatchPlan }) => {
        order.push(`fast:${dispatchPlan?.normalizedQuery ?? "none"}`)
        return [
          {
            rowId: "fast-row",
            laneId: "fast-lane",
            score: 0.8,
            category: "docs",
            rendererToken: "docs/document/list@v2",
            resolverIdentity: "docs:http.fetch@v1",
          } as unknown as QueryRow,
        ]
      },
    })

    const heavy = makeStaticRowsAdapter({
      adapterId: "heavy-adapter",
      laneId: "heavy-lane",
      emits: ["docs"],
      costClass: "heavy",
      rows: ({ dispatchPlan }) => {
        order.push(`heavy:${dispatchPlan?.normalizedQuery ?? "none"}`)
        return [
          {
            rowId: "heavy-row",
            laneId: "heavy-lane",
            score: 0.7,
            category: "docs",
            rendererToken: "docs/document/list@v2",
            resolverIdentity: "docs:http.fetch@v1",
          } as unknown as QueryRow,
        ]
      },
    })

    const router = await Effect.runPromise(
      makeQueryAdapterRouter({ adapters: [heavy, fast], maxConcurrency: 1 }),
    )

    const results = await Effect.runPromise(
      router.dispatch({
        queryId: "q-order",
        scenarioId: "TEST-ORDER",
        query: "  HeLLo   World  ",
        scope: "global",
      }),
    )

    expect(results).toHaveLength(2)
    expect(order[0]).toBe("fast:hello   world")
    expect(order[1]).toBe("heavy:hello   world")
  })

  it("supports deterministic middleware composition", async () => {
    const adapter = makeStaticRowsAdapter({
      adapterId: "middleware-adapter",
      laneId: "middleware-lane",
      emits: ["docs"],
      rows: [
        {
          rowId: "mid-row",
          laneId: "middleware-lane",
          score: 0.6,
          category: "docs",
          rendererToken: "docs/document/list@v2",
          resolverIdentity: "docs:http.fetch@v1",
        } as unknown as QueryRow,
      ],
    })

    const boostScore = queryAdapterMiddleware({
      id: "boost-score",
      run: (effect) =>
        effect.pipe(
          Effect.map((rows) => rows.map((row) => ({ ...row, score: row.score + 0.2 }))),
        ),
    })

    const clampScore = queryAdapterMiddleware({
      id: "clamp-score",
      run: (effect) =>
        effect.pipe(
          Effect.map((rows) => rows.filter((row) => row.score >= 0.75)),
        ),
    })

    const router = await Effect.runPromise(
      makeQueryAdapterRouter({
        adapters: [adapter],
        maxConcurrency: 1,
        globalMiddleware: [boostScore.combine(clampScore)],
      }),
    )

    const [result] = await Effect.runPromise(
      router.dispatch({
        queryId: "q-middleware",
        scenarioId: "TEST-MIDDLEWARE",
        query: "middleware",
        scope: "global",
      }),
    )

    expect(result?._tag).toBe("DispatchSucceeded")
    if (result?._tag === "DispatchSucceeded") {
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0]?.score).toBeCloseTo(0.8, 5)
    }
  })

  it("enforces bounded concurrency during dispatch", async () => {
    let active = 0
    let maxActive = 0

    const mkSlowAdapter = (id: string, laneId: string) =>
      makeStaticRowsAdapter({
        adapterId: id,
        laneId,
        emits: ["docs"],
        costClass: "medium",
        rows: () => {
          active += 1
          maxActive = Math.max(maxActive, active)
          return [
            {
              rowId: `${id}-row`,
              laneId,
              score: 0.5,
              category: "docs",
              rendererToken: "docs/document/list@v2",
              resolverIdentity: "docs:http.fetch@v1",
            } as unknown as QueryRow,
          ]
        },
      })

    const router = await Effect.runPromise(
      makeQueryAdapterRouter({
        adapters: [
          mkSlowAdapter("a", "lane-a"),
          mkSlowAdapter("b", "lane-b"),
          mkSlowAdapter("c", "lane-c"),
        ],
        maxConcurrency: 1,
        globalMiddleware: [
          queryAdapterMiddleware({
            id: "slow-down",
            run: (effect) =>
              effect.pipe(
                Effect.delay("10 millis"),
                Effect.ensuring(Effect.sync(() => {
                  active = Math.max(0, active - 1)
                })),
              ),
          }),
        ],
      }),
    )

    await Effect.runPromise(
      router.dispatch({
        queryId: "q-concurrency",
        scenarioId: "TEST-CONCURRENCY",
        query: "concurrency",
        scope: "global",
      }),
    )

    expect(maxActive).toBe(1)
  })

  it("supports middleware registry IDs for global middleware", async () => {
    const adapter = makeStaticRowsAdapter({
      adapterId: "registry-adapter",
      laneId: "registry-lane",
      emits: ["docs"],
      rows: [
        {
          rowId: "registry-row",
          laneId: "registry-lane",
          score: 0.5,
          category: "docs",
          rendererToken: "docs/document/list@v2",
          resolverIdentity: "docs:http.fetch@v1",
        } as unknown as QueryRow,
      ],
    })

    const registryBoost = queryAdapterMiddleware({
      id: "registry.boost",
      run: (effect) => effect.pipe(Effect.map((rows) => rows.map((row) => ({ ...row, score: row.score + 0.4 })))),
    })

    const router = await Effect.runPromise(
      makeQueryAdapterRouter({
        adapters: [adapter],
        middlewareRegistry: [registryBoost],
      }),
    )

    await Effect.runPromise(router.addGlobalMiddlewareId("registry.boost"))

    const [result] = await Effect.runPromise(
      router.dispatch({
        queryId: "q-registry",
        scenarioId: "TEST-REGISTRY",
        query: "registry",
        scope: "global",
      }),
    )

    expect(result?._tag).toBe("DispatchSucceeded")
    if (result?._tag === "DispatchSucceeded") {
      expect(result.rows[0]?.score).toBeCloseTo(0.9, 5)
    }
  })

  it("admits heavy adapters only when query passes admission policy", async () => {
    const fast = makeStaticRowsAdapter({
      adapterId: "fast-admission",
      laneId: "fast-admission-lane",
      emits: ["docs"],
      costClass: "fast",
      rows: [
        {
          rowId: "fast-adm-row",
          laneId: "fast-admission-lane",
          score: 0.8,
          category: "docs",
          rendererToken: "docs/document/list@v2",
          resolverIdentity: "docs:http.fetch@v1",
        } as unknown as QueryRow,
      ],
    })

    const heavy = makeStaticRowsAdapter({
      adapterId: "heavy-admission",
      laneId: "heavy-admission-lane",
      emits: ["docs"],
      costClass: "heavy",
      rows: [
        {
          rowId: "heavy-adm-row",
          laneId: "heavy-admission-lane",
          score: 0.7,
          category: "docs",
          rendererToken: "docs/document/list@v2",
          resolverIdentity: "docs:http.fetch@v1",
        } as unknown as QueryRow,
      ],
    })

    const router = await Effect.runPromise(
      makeQueryAdapterRouter({
        adapters: [fast, heavy],
        globalMiddleware: [
          makeHeavyAdapterAdmissionMiddleware({
            minNormalizedQueryLength: 8,
            minTerms: 2,
          }),
        ],
      }),
    )

    const short = await Effect.runPromise(
      router.dispatch({
        queryId: "q-admit-short",
        scenarioId: "TEST-ADMIT",
        query: "abc",
        scope: "global",
      }),
    )

    const long = await Effect.runPromise(
      router.dispatch({
        queryId: "q-admit-long",
        scenarioId: "TEST-ADMIT",
        query: "alpha beta",
        scope: "global",
      }),
    )

    const shortHeavy = short.find((r) => r._tag === "DispatchSucceeded" && r.adapterId === "heavy-admission")
    const longHeavy = long.find((r) => r._tag === "DispatchSucceeded" && r.adapterId === "heavy-admission")

    expect(shortHeavy?._tag).toBe("DispatchSucceeded")
    if (shortHeavy?._tag === "DispatchSucceeded") {
      expect(shortHeavy.rows).toHaveLength(0)
    }

    expect(longHeavy?._tag).toBe("DispatchSucceeded")
    if (longHeavy?._tag === "DispatchSucceeded") {
      expect(longHeavy.rows).toHaveLength(1)
    }
  })

  it("rejects dispatch when middleware phase budget is breached", async () => {
    const events: Array<{ event: string; phase: string; middlewareId?: string }> = []

    const adapter = makeStaticRowsAdapter({
      adapterId: "budget-adapter",
      laneId: "budget-lane",
      emits: ["docs"],
      rows: [
        {
          rowId: "budget-row",
          laneId: "budget-lane",
          score: 0.61,
          category: "docs",
          rendererToken: "docs/document/list@v2",
          resolverIdentity: "docs:http.fetch@v1",
        } as unknown as QueryRow,
      ],
    })

    const slowMiddleware = queryAdapterMiddleware({
      id: "budget.slow",
      run: (effect) => effect.pipe(Effect.delay("5 millis")),
    })

    const router = await Effect.runPromise(
      makeQueryAdapterRouter({
        adapters: [adapter],
        globalMiddleware: [slowMiddleware],
        phaseBudgetsMs: {
          "middleware.global": 1,
        },
        rejectOnBudgetBreach: {
          "middleware.global": true,
        },
        onEvent: (event) => {
          events.push({ event: event.event, phase: event.phase, middlewareId: event.middlewareId })
        },
      }),
    )

    const [result] = await Effect.runPromise(
      router.dispatch({
        queryId: "q-budget",
        scenarioId: "TEST-BUDGET",
        query: "budget",
        scope: "global",
      }),
    )

    expect(result?._tag).toBe("DispatchFailed")
    expect(
      events.some((event) => event.event === "query.phase.budget.breached" && event.phase === "middleware.global"),
    ).toBe(true)
  })

  it("emits middleware phase telemetry", async () => {
    const events: Array<{ event: string; phase: string; middlewareId?: string }> = []

    const adapter = makeStaticRowsAdapter({
      adapterId: "telemetry-adapter",
      laneId: "telemetry-lane",
      emits: ["docs"],
      rows: [
        {
          rowId: "telemetry-row",
          laneId: "telemetry-lane",
          score: 0.6,
          category: "docs",
          rendererToken: "docs/document/list@v2",
          resolverIdentity: "docs:http.fetch@v1",
        } as unknown as QueryRow,
      ],
    })

    const middleware = queryAdapterMiddleware({
      id: "telemetry.global",
      run: (effect) => effect,
    })

    const router = await Effect.runPromise(
      makeQueryAdapterRouter({
        adapters: [adapter],
        globalMiddleware: [middleware],
        onEvent: (event) => {
          events.push({ event: event.event, phase: event.phase, middlewareId: event.middlewareId })
        },
      }),
    )

    await Effect.runPromise(
      router.dispatch({
        queryId: "q-telemetry",
        scenarioId: "TEST-TELEMETRY",
        query: "telemetry",
        scope: "global",
      }),
    )

    expect(events.some((e) => e.event === "query.middleware.phase.started" && e.phase === "query.parse")).toBe(true)
    expect(events.some((e) => e.event === "query.middleware.phase.completed" && e.middlewareId === "telemetry.global")).toBe(true)
    expect(events.some((e) => e.event === "query.adapter.dispatch.completed" && e.phase === "adapter.dispatch")).toBe(true)
  })
})
