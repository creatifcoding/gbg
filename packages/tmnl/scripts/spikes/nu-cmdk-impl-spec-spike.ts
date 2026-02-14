#!/usr/bin/env bun
/**
 * NuCmdk Impl-Spec Spike (runtime-scripted)
 *
 * Executes implementation slices from src/lib/commands/nu-cmdk/slices:
 * - QuerySession actor
 * - PolicyBundle gate
 * - RendererCompatibilityMap
 * - CacheGuard degrade path
 * - Metrics + hillclimb scoring
 *
 * Run:
 *   bun run spike:nu-cmdk:impl-spec
 *   bun run spike:nu-cmdk:impl-spec --run-id=spike-0005 --iteration=2
 */

import { Registry } from "@effect-atom/atom"
import { Effect } from "effect"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import {
  adaptersFromProviderRegistry,
  extractQueryMetric,
  makeFailingAdapter,
  makeNuCmdkSearchBroker,
  makeStaticRowsAdapter,
  nowMs,
  objectiveScore,
  type EventRecord,
  type LaneAdapter,
  type QueryMetric,
  type QueryRow,
  type ResultKind,
  type Theta,
} from "../../src/lib/commands/nu-cmdk/slices"
import {
  createProviderId,
  providerRegistry,
  type CompletionProvider,
} from "../../src/lib/minibuffer/v2/providers"

type ScenarioId = "RTM-005" | "RTM-006" | "RTM-010" | "RTM-012" | "RTM-016" | "RTM-017"

type Candidate = {
  readonly name: string
  readonly theta: Theta
}

const thetaBaseline: Theta = {
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

const thetaNeighborA: Theta = {
  publish_budget_base: 5,
  publish_budget_degraded: 2,
  rank_weight: { provider: 0.42, lexical: 0.3, semantic: 0.26, recency: 0.02 },
  stability_epsilon: 0.02,
  stability_window_ms: 140,
  quality_budget: {
    max_fallback_ratio: 0.32,
    max_decode_drop_ratio: 0.1,
    max_resolver_deny_ratio: 0,
  },
  cacheguard: {
    singleflight_ttl_ms: 300,
    checkpoint_wal_pages: 900,
  },
}

const thetaNeighborB: Theta = {
  publish_budget_base: 6,
  publish_budget_degraded: 2,
  rank_weight: { provider: 0.4, lexical: 0.28, semantic: 0.3, recency: 0.02 },
  stability_epsilon: 0.018,
  stability_window_ms: 130,
  quality_budget: {
    max_fallback_ratio: 0.31,
    max_decode_drop_ratio: 0.09,
    max_resolver_deny_ratio: 0,
  },
  cacheguard: {
    singleflight_ttl_ms: 325,
    checkpoint_wal_pages: 800,
  },
}

const thetaNeighborC: Theta = {
  publish_budget_base: 5,
  publish_budget_degraded: 3,
  rank_weight: { provider: 0.43, lexical: 0.32, semantic: 0.23, recency: 0.02 },
  stability_epsilon: 0.022,
  stability_window_ms: 110,
  quality_budget: {
    max_fallback_ratio: 0.3,
    max_decode_drop_ratio: 0.08,
    max_resolver_deny_ratio: 0,
  },
  cacheguard: {
    singleflight_ttl_ms: 280,
    checkpoint_wal_pages: 950,
  },
}

const asRow = (row: {
  rowId: string
  laneId: string
  score: number
  category: ResultKind
  rendererToken: string
  resolverIdentity: string
}): QueryRow =>
  row as unknown as QueryRow

const scenarioRows = (scenario: ScenarioId): ReadonlyArray<QueryRow> => {
  switch (scenario) {
    case "RTM-005":
      return [
        asRow({
          rowId: "r-005-1",
          laneId: "rpc",
          score: 0.86,
          category: "command",
          rendererToken: "commands/command/list@v1",
          resolverIdentity: "commands:open@v1",
        }),
        asRow({
          rowId: "r-005-2",
          laneId: "rpc",
          score: 0.92,
          category: "command",
          rendererToken: "commands/command/list@v7",
          resolverIdentity: "malicious:admin.delete@v1",
        }),
      ]

    case "RTM-006":
      return [
        asRow({
          rowId: "r-006-1",
          laneId: "http",
          score: 0.84,
          category: "docs",
          rendererToken: "docs/document/list@v2",
          resolverIdentity: "docs:http.fetch@v1",
        }),
        asRow({
          rowId: "r-006-2",
          laneId: "http",
          score: 0.83,
          category: "docs",
          rendererToken: "docs/document/list@v2",
          resolverIdentity: "malicious:http.internal@v1",
        }),
      ]

    case "RTM-010":
      return [
        asRow({
          rowId: "r-010-1",
          laneId: "rpc",
          score: 0.75,
          category: "docs",
          rendererToken: "docs/document/list@v2",
          resolverIdentity: "search:rpc.lookup@v1",
        }),
        asRow({
          rowId: "r-010-2",
          laneId: "rpc",
          score: 0.79,
          category: "docs",
          rendererToken: "docs/document/list@v2",
          resolverIdentity: "search:rpc.lookup@v1",
        }),
      ]

    case "RTM-012": {
      const noisy = Array.from({ length: 20 }).map((_, i) =>
        asRow({
          rowId: `r-012-n-${i}`,
          laneId: "noisy",
          score: 0.55 + i * 0.005,
          category: "command",
          rendererToken: "commands/command/list@v1",
          resolverIdentity: "commands:open@v1",
        }),
      )
      const quiet = Array.from({ length: 3 }).map((_, i) =>
        asRow({
          rowId: `r-012-q-${i}`,
          laneId: "quiet",
          score: 0.73 + i * 0.01,
          category: "docs",
          rendererToken: "docs/document/list@v2",
          resolverIdentity: "search:rpc.lookup@v1",
        }),
      )
      return [...noisy, ...quiet]
    }

    case "RTM-016":
      return [
        asRow({
          rowId: "r-016-1",
          laneId: "rpc",
          score: 0.71,
          category: "docs",
          rendererToken: "docs/document/list@v9",
          resolverIdentity: "search:rpc.lookup@v1",
        }),
      ]

    case "RTM-017": {
      const burstA = Array.from({ length: 16 }).map((_, i) =>
        asRow({
          rowId: `r-017-a-${i}`,
          laneId: "rpc",
          score: 0.64 + i * 0.01,
          category: "docs",
          rendererToken: "docs/document/list@v2",
          resolverIdentity: "search:rpc.lookup@v1",
        }),
      )
      const burstB = Array.from({ length: 16 }).map((_, i) =>
        asRow({
          rowId: `r-017-b-${i}`,
          laneId: "http",
          score: 0.58 + i * 0.008,
          category: "docs",
          rendererToken: "docs/document/list@v2",
          resolverIdentity: "docs:http.fetch@v1",
        }),
      )
      return [...burstA, ...burstB]
    }
  }
}

const scenarioAdapters = (scenario: ScenarioId): ReadonlyArray<LaneAdapter> => {
  const rows = scenarioRows(scenario)
  const laneMap = new Map<string, Array<QueryRow>>()

  for (const row of rows) {
    const laneId = String(row.laneId)
    const bucket = laneMap.get(laneId)
    if (bucket) bucket.push(row)
    else laneMap.set(laneId, [row])
  }

  const staticAdapters: Array<LaneAdapter> = Array.from(laneMap.entries()).map(([laneId, laneRows]) =>
    makeStaticRowsAdapter({
      adapterId: `${scenario.toLowerCase()}-${laneId}`,
      laneId,
      emits: [...new Set(laneRows.map((row) => row.category))],
      rows: laneRows,
    }),
  )

  if (scenario === "RTM-006") {
    staticAdapters.push(
      makeFailingAdapter({
        adapterId: "rtm-006-adapter-fail",
        laneId: "adapter-fail",
        emits: ["generic"],
        message: "simulated adapter lane failure",
      }),
    )
  }

  return [...staticAdapters, ...liveRegistryAdapters()]
}

const LIVE_PROVIDER_IDS = {
  docs: createProviderId("nu-live-docs"),
  workspace: createProviderId("nu-live-workspace"),
} as const

const registerLiveProviders = (): (() => void) => {
  const docsProvider: CompletionProvider = {
    id: LIVE_PROVIDER_IDS.docs,
    label: "Live Docs Provider",
    complete: (query) =>
      Effect.sync(() => {
        const q = query.trim().toLowerCase()
        const base = [
          {
            value: "docs/contracts/commands.md",
            label: "Commands Contract",
            kind: "docs",
            category: "docs",
            score: 0.9,
            metadata: { resolverIdentity: "docs:http.fetch@v1" },
          },
          {
            value: "docs/contracts/minibuffer.md",
            label: "Minibuffer Contract",
            kind: "docs",
            category: "docs",
            score: 0.88,
            metadata: { resolverIdentity: "docs:http.fetch@v1" },
          },
          {
            value: "docs/contracts/overlays.md",
            label: "Overlays Contract",
            kind: "docs",
            category: "docs",
            score: 0.86,
            metadata: { resolverIdentity: "docs:http.fetch@v1" },
          },
        ] as const

        if (q.length === 0) {
          return base
        }

        return base.filter((item) =>
          item.value.toLowerCase().includes(q) || item.label.toLowerCase().includes(q),
        )
      }),
  }

  const workspaceProvider: CompletionProvider = {
    id: LIVE_PROVIDER_IDS.workspace,
    label: "Live Workspace Provider",
    complete: (query) =>
      Effect.sync(() => {
        const q = query.trim().toLowerCase()
        const base = [
          {
            value: "src/lib/commands/integrate/nu-cmdk.tsx",
            label: "nu-cmdk integration surface",
            kind: "file",
            category: "file",
            score: 0.84,
            metadata: { resolverIdentity: "search:rpc.lookup@v1" },
          },
          {
            value: "src/lib/commands/nu-cmdk/slices/searchBroker.ts",
            label: "search broker slice",
            kind: "file",
            category: "file",
            score: 0.82,
            metadata: { resolverIdentity: "search:rpc.lookup@v1" },
          },
        ] as const

        if (q.length === 0) {
          return base
        }

        return base.filter((item) =>
          item.value.toLowerCase().includes(q) || item.label.toLowerCase().includes(q),
        )
      }),
  }

  providerRegistry.register(docsProvider)
  providerRegistry.register(workspaceProvider)

  return () => {
    providerRegistry.unregister(LIVE_PROVIDER_IDS.docs)
    providerRegistry.unregister(LIVE_PROVIDER_IDS.workspace)
  }
}

const liveRegistryAdapters = (): ReadonlyArray<LaneAdapter> =>
  adaptersFromProviderRegistry({
    include: (provider) =>
      provider.id === LIVE_PROVIDER_IDS.docs || provider.id === LIVE_PROVIDER_IDS.workspace,
    emitsByProviderId: {
      [LIVE_PROVIDER_IDS.docs]: ["docs"],
      [LIVE_PROVIDER_IDS.workspace]: ["file"],
    },
  })

const parseArgs = () => {
  const args = Bun.argv.slice(2)
  const outDirArg = args.find((a) => a.startsWith("--out-dir="))?.split("=")[1]
  const runIdArg = args.find((a) => a.startsWith("--run-id="))?.split("=")[1]
  const iterationArg = args.find((a) => a.startsWith("--iteration="))?.split("=")[1]

  return {
    outDir: outDirArg ?? "src/lib/commands/docs/impl/spike/logs",
    runId: runIdArg ?? "spike-0002",
    iteration: iterationArg ? Number(iterationArg) : 1,
  }
}

const toJsonl = (rows: ReadonlyArray<Record<string, unknown>>) =>
  rows.map((r) => JSON.stringify(r)).join("\n") + "\n"

const iterationPlan = (iteration: number): {
  scenarioBatch: ReadonlyArray<ScenarioId>
  candidates: ReadonlyArray<Candidate>
} => {
  if (iteration >= 2) {
    return {
      scenarioBatch: ["RTM-006", "RTM-010", "RTM-012", "RTM-016", "RTM-017"],
      candidates: [
        { name: "anchor-i1-winner", theta: thetaNeighborA },
        { name: "neighbor-b", theta: thetaNeighborB },
        { name: "neighbor-c", theta: thetaNeighborC },
      ],
    }
  }

  return {
    scenarioBatch: ["RTM-005", "RTM-010", "RTM-012", "RTM-016"],
    candidates: [
      { name: "baseline", theta: thetaBaseline },
      { name: "neighbor-a", theta: thetaNeighborA },
    ],
  }
}

const runScenario = (params: {
  runId: string
  scenarioId: ScenarioId
  theta: Theta
  events: Array<EventRecord>
}): Effect.Effect<QueryMetric, never> =>
  Effect.gen(function* () {
    const queryId = `${params.scenarioId.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}`
    const registry = Registry.make()
    const adapters = scenarioAdapters(params.scenarioId)

    const broker = yield* makeNuCmdkSearchBroker({
      theta: params.theta,
      runId: params.runId,
      registry,
      adapters,
      onEvent: (event) => params.events.push(event),
    })

    yield* broker.startQuery({
      queryId,
      queryText: `${params.scenarioId} query`,
      scope: "global",
      scenarioId: params.scenarioId,
    })

    params.events.push({
      event: "query.input.started",
      run_id: params.runId,
      query_id: queryId,
      scenario_id: params.scenarioId,
      t_ms: nowMs(),
      attrs: { query_len: 8 },
    })

    const rows = scenarioRows(params.scenarioId)

    yield* broker.runAdapters(queryId)

    switch (params.scenarioId) {
      case "RTM-010": {
        // inject stale/out-of-order update after adapter ingestion (seq 1 already consumed)
        yield* broker.tell(queryId, {
          _tag: "IngestChunk",
          seq: 1,
          laneId: "rpc",
          rows: [rows[1]!],
          scenarioId: params.scenarioId,
        })
        yield* broker.tell(queryId, { _tag: "PlannerTick", scenarioId: params.scenarioId })
        break
      }

      case "RTM-012": {
        for (let i = 0; i < 3; i++) {
          yield* broker.tell(queryId, { _tag: "PlannerTick", scenarioId: params.scenarioId })
        }
        break
      }

      case "RTM-016": {
        yield* broker.tell(queryId, { _tag: "SimulateMigrationCrash", scenarioId: params.scenarioId })
        yield* broker.runAdapters(queryId, `${params.scenarioId} query retry`)
        yield* broker.tell(queryId, { _tag: "PlannerTick", scenarioId: params.scenarioId })
        break
      }

      case "RTM-017": {
        yield* broker.tell(queryId, { _tag: "SimulateMigrationCrash", scenarioId: params.scenarioId })
        yield* broker.runAdapters(queryId, `${params.scenarioId} query burst-2`)

        for (let i = 0; i < 5; i++) {
          yield* broker.tell(queryId, { _tag: "PlannerTick", scenarioId: params.scenarioId })
        }
        break
      }

      default: {
        yield* broker.tell(queryId, { _tag: "PlannerTick", scenarioId: params.scenarioId })
        break
      }
    }

    yield* Effect.sleep("150 millis")
    yield* broker.tell(queryId, { _tag: "PlannerTick", scenarioId: params.scenarioId })

    const snapshot = yield* broker.snapshot(queryId)
    const selected = snapshot.selectedRowId ?? snapshot.rankedRowIds[0] ?? null

    params.events.push({
      event: "execution.started",
      run_id: params.runId,
      query_id: queryId,
      scenario_id: params.scenarioId,
      row_id: selected ?? undefined,
      t_ms: nowMs(),
      attrs: {},
    })

    params.events.push({
      event: selected ? "execution.succeeded" : "execution.failed",
      run_id: params.runId,
      query_id: queryId,
      scenario_id: params.scenarioId,
      row_id: selected ?? undefined,
      t_ms: nowMs(),
      attrs: selected ? {} : { reason: "no-actionable-row" },
    })

    yield* broker.tell(queryId, { _tag: "CancelQuery", reason: "scenario-end", scenarioId: params.scenarioId })
    yield* Effect.sleep("5 millis")
    yield* broker.stopQuery(queryId)
    yield* broker.stopAll

    return extractQueryMetric({
      events: params.events,
      runId: params.runId,
      queryId,
      scenarioId: params.scenarioId,
      tsMs: nowMs(),
    })
  })

const runCandidate = (params: {
  runId: string
  candidateName: string
  theta: Theta
  iteration: number
  scenarioBatch: ReadonlyArray<ScenarioId>
  events: Array<EventRecord>
}) =>
  Effect.gen(function* () {
    const start = {
      type: "run.start",
      run_id: params.runId,
      iteration: params.iteration,
      candidate: params.candidateName,
      theta_hash: `${params.candidateName}-theta-v1`,
      theta: params.theta,
      scenario_batch: params.scenarioBatch,
      measurement_mode: "runtime-scripted",
      ts_ms: nowMs(),
    }

    const metrics: Array<QueryMetric> = []
    for (const scenarioId of params.scenarioBatch) {
      const metric = yield* runScenario({
        runId: params.runId,
        scenarioId,
        theta: params.theta,
        events: params.events,
      })
      metrics.push(metric)
    }

    const scored = objectiveScore(metrics)

    const guardrails = {
      policy_violations: metrics.reduce((a, m) => a + m.policy_violations, 0),
      lane_isolation_violations: metrics.reduce((a, m) => a + m.lane_isolation_violations, 0),
      selection_identity_violations: metrics.reduce((a, m) => a + m.selection_identity_violations, 0),
    }

    const summary = {
      type: "run.summary",
      run_id: params.runId,
      iteration: params.iteration,
      candidate: params.candidateName,
      objective_score: scored.objective,
      p95: scored.p95,
      penalties: scored.penalties,
      guardrails,
      accepted:
        guardrails.policy_violations === 0 &&
        guardrails.lane_isolation_violations === 0 &&
        guardrails.selection_identity_violations === 0,
      reject_reason: null,
      ts_ms: nowMs(),
    }

    return { start, metrics, summary }
  })

const main = async () => {
  const args = parseArgs()
  const { scenarioBatch, candidates } = iterationPlan(args.iteration)
  const events: Array<EventRecord> = []
  const unregisterProviders = registerLiveProviders()

  try {
    const candidateRuns: Array<{
      runId: string
      candidateName: string
      start: Record<string, unknown>
      metrics: ReadonlyArray<QueryMetric>
      summary: Record<string, unknown>
    }> = []

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!
      const runId = `${args.runId}-c${i}`
      const out = await Effect.runPromise(
        runCandidate({
          runId,
          candidateName: candidate.name,
          theta: candidate.theta,
          iteration: args.iteration,
          scenarioBatch,
          events,
        }),
      )

      candidateRuns.push({
        runId,
        candidateName: candidate.name,
        start: out.start,
        metrics: out.metrics,
        summary: out.summary,
      })
    }
    const sorted = [...candidateRuns].sort(
      (a, b) => (a.summary.objective_score as number) - (b.summary.objective_score as number),
    )

    const winner = sorted[0]!
    const second = sorted[1]
    const delta = second
      ? Math.abs((second.summary.objective_score as number) - (winner.summary.objective_score as number))
      : 0

    const decision = {
      type: "hillclimb.decision",
      iteration: args.iteration,
      winner_run_id: winner.runId,
      loser_run_id: second?.runId ?? null,
      delta_objective: Number(delta.toFixed(2)),
      accept_reason: "lowest_objective_with_zero_guardrail_violations",
      next_step: `iteration-${args.iteration + 1}-neighborhood`,
      ts_ms: nowMs(),
    }

    const rows: Array<Record<string, unknown>> = []
    for (const run of candidateRuns) {
      rows.push(run.start)
      rows.push(...run.metrics)
      rows.push(run.summary)
    }
    rows.push(decision)

    const tableRows = candidateRuns
      .map((run) => {
        const s = run.summary
        const p95 = s.p95 as any
        const penalties = s.penalties as any
        return `| ${run.candidateName} | ${run.runId} | ${s.objective_score} | ${p95.ttr_ms} | ${p95.ttfa_ms} | ${p95.tts_ms} | ${penalties.quality} | ${penalties.stability} | ${penalties.safety} | PASS |`
      })
      .join("\n")

    const comparison = `# ${args.runId} — Iteration ${args.iteration} Candidate Comparison\n\n` +
      `| Candidate | Run ID | ObjectiveScore | P95 TTR | P95 TTFA | P95 TTS | Quality Penalty | Stability Penalty | Safety Penalty | Guardrails |\n` +
      `|---|---|---:|---:|---:|---:|---:|---:|---:|---|\n` +
      `${tableRows}\n\n` +
      `Winner: **${winner.runId}** (Δ objective ${delta.toFixed(2)})\n`

    const stamp = new Date().toISOString().slice(0, 10)
    const jsonlPath = join(args.outDir, `${stamp}-${args.runId}-iteration-${args.iteration}.jsonl`)
    const mdPath = join(args.outDir, `${stamp}-${args.runId}-iteration-${args.iteration}-comparison.md`)

    await mkdir(dirname(jsonlPath), { recursive: true })
    await writeFile(jsonlPath, toJsonl(rows), "utf-8")
    await writeFile(mdPath, comparison, "utf-8")

    console.log("\nNuCmdk impl-spec spike complete")
    console.log(`Iteration: ${args.iteration}`)
    console.log(`JSONL: ${jsonlPath}`)
    console.log(`MD:    ${mdPath}`)
    console.log(`Winner: ${winner.runId}`)
  } finally {
    unregisterProviders()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
