import type { EventRecord } from "./types"

export interface QueryMetric {
  readonly type: "query.metric"
  readonly run_id: string
  readonly query_id: string
  readonly scenario_id: string
  readonly ttr_ms: number | null
  readonly ttfa_ms: number | null
  readonly tts_ms: number | null
  readonly cancel_latency_ms: number | null
  readonly fallback_ratio: number
  readonly decode_drop_ratio: number
  readonly resolver_deny_ratio: number
  readonly policy_violations: number
  readonly selection_identity_violations: number
  readonly lane_isolation_violations: number
  readonly ranking_oscillation_count: number
  readonly ts_ms: number
}

const percentile = (values: ReadonlyArray<number>, p: number): number => {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx] ?? Number.NaN
}

export const extractQueryMetric = (params: {
  events: ReadonlyArray<EventRecord>
  runId: string
  queryId: string
  scenarioId: string
  tsMs: number
}): QueryMetric => {
  const qev = params.events.filter(
    (e) => e.query_id === params.queryId && e.scenario_id === params.scenarioId,
  )
  const at = (name: string): number | null => qev.find((e) => e.event === name)?.t_ms ?? null

  const started = at("query.input.started")
  const execOk = at("execution.succeeded")
  const firstActionable = at("rows.first_actionable")
  const topStable = at("rows.top1_stable")
  const cancelled = at("query.cancelled")
  const closedAll = at("lane.closed_all")

  const ttr = started !== null && execOk !== null ? execOk - started : null
  const ttfa = started !== null && firstActionable !== null ? firstActionable - started : null
  const tts = started !== null && topStable !== null ? topStable - started : null
  const cancelLatency = cancelled !== null && closedAll !== null ? closedAll - cancelled : null

  const count = (name: string) => qev.filter((e) => e.event === name).length

  const fallback = count("renderer.resolve.fallback")
  const drops = count("renderer.resolve.drop")
  const denies = count("resolver.dispatch.denied")
  const published = Math.max(1, count("rows.first_visible") + count("renderer.resolve.exact") + count("renderer.resolve.compatible"))

  return {
    type: "query.metric",
    run_id: params.runId,
    query_id: params.queryId,
    scenario_id: params.scenarioId,
    ttr_ms: ttr,
    ttfa_ms: ttfa,
    tts_ms: tts,
    cancel_latency_ms: cancelLatency,
    fallback_ratio: fallback / published,
    decode_drop_ratio: drops / published,
    resolver_deny_ratio: denies / published,
    policy_violations: 0,
    selection_identity_violations: 0,
    lane_isolation_violations: 0,
    ranking_oscillation_count: count("ranking.top.changed"),
    ts_ms: params.tsMs,
  }
}

export const objectiveScore = (metrics: ReadonlyArray<QueryMetric>) => {
  const ttr = metrics.map((m) => m.ttr_ms).filter((n): n is number => n !== null)
  const ttfa = metrics.map((m) => m.ttfa_ms).filter((n): n is number => n !== null)
  const tts = metrics.map((m) => m.tts_ms).filter((n): n is number => n !== null)
  const cancel = metrics.map((m) => m.cancel_latency_ms).filter((n): n is number => n !== null)

  const p95TTR = percentile(ttr, 95)
  const p95TTFA = percentile(ttfa, 95)
  const p95TTS = percentile(tts, 95)
  const p95Cancel = percentile(cancel, 95)

  const qualityPenalty = metrics.reduce((acc, m) => {
    let p = acc
    if (m.fallback_ratio > 0.35) p += 50
    if (m.decode_drop_ratio > 0.1) p += 35
    return p
  }, 0)

  const stabilityPenalty = metrics.reduce((acc, m) => acc + m.ranking_oscillation_count * 4, 0)

  const safetyPenalty = metrics.some(
    (m) => m.policy_violations > 0 || m.lane_isolation_violations > 0 || m.selection_identity_violations > 0,
  )
    ? 10000
    : 0

  const objective = p95TTR + 0.35 * p95TTFA + 0.2 * p95TTS + qualityPenalty + stabilityPenalty + safetyPenalty

  return {
    objective: Number(objective.toFixed(2)),
    p95: {
      ttr_ms: p95TTR,
      ttfa_ms: p95TTFA,
      tts_ms: p95TTS,
      cancel_latency_ms: p95Cancel,
    },
    penalties: {
      quality: qualityPenalty,
      stability: stabilityPenalty,
      safety: safetyPenalty,
    },
  }
}
