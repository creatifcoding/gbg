import { describe, expect, it } from "vitest"
import { Effect } from "effect"
import {
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
})
