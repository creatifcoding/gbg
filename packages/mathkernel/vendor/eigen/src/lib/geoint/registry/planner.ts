import { Context, Effect, Layer, Schema } from 'effect'
import type {
  CanonicalIntelSource,
  PlannerStrategy,
  QueryConstraintV1,
  RegistryQueryPlanV1,
  SourceRegistryEntry,
} from './schemas'
import {
  RegistryQueryPlanV1 as RegistryQueryPlanV1Schema,
} from './schemas'
import { listSourceRegistry } from './sourceRegistry'

export const SourceHealthState = Schema.Literal('healthy', 'degraded', 'down')
export type SourceHealthState = typeof SourceHealthState.Type

export const SourceHealthSignal = Schema.Struct({
  state: SourceHealthState,
  score: Schema.Number.pipe(Schema.between(0, 1)),
})
export type SourceHealthSignal = typeof SourceHealthSignal.Type

export type SourceHealthMap = Partial<Record<CanonicalIntelSource, SourceHealthSignal>>

export interface RegistryPlannerRequest {
  readonly queryId: string
  readonly text?: string
  readonly bbox?: readonly [number, number, number, number]
  readonly requestedSources?: ReadonlyArray<CanonicalIntelSource>
  readonly strategy?: PlannerStrategy
  readonly constraints?: QueryConstraintV1
  readonly health?: SourceHealthMap
  readonly now?: Date
}

export class RegistryPlannerError extends Schema.TaggedError<RegistryPlannerError>()(
  'RegistryPlannerError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

interface Candidate {
  readonly entry: SourceRegistryEntry
  readonly score: number
  readonly rationale: string
}

const decodePlan = Schema.decodeUnknownSync(RegistryQueryPlanV1Schema)

const roleMultiplier = (role: SourceRegistryEntry['role']): number => {
  switch (role) {
    case 'trigger':
      return 1
    case 'context':
      return 0.9
    case 'archive':
      return 0.8
  }
}

const strategyBonus = (
  strategy: PlannerStrategy,
  entry: SourceRegistryEntry
): number => {
  const caps = entry.capabilities

  switch (strategy) {
    case 'latency-first': {
      const latencyNorm = Math.max(0, 1 - caps.defaultTtlSeconds / 900)
      return latencyNorm * 20
    }
    case 'coverage-first': {
      let coverage = 0
      if (caps.supportsBBox) coverage += 1
      if (caps.supportsIntersects) coverage += 1
      if (caps.supportsCollections) coverage += 0.5
      if (caps.supportsFilter) coverage += 0.5
      return coverage * 8
    }
    case 'trust-first': {
      let trust = 0
      if (caps.supportsFilter) trust += 1
      if (caps.supportsDatetime) trust += 0.5
      if (caps.provider === 'stac') trust += 1
      return trust * 8
    }
  }
}

const isCompatibleWithConstraints = (
  entry: SourceRegistryEntry,
  constraints: QueryConstraintV1 | undefined
): string | undefined => {
  if (!constraints) return undefined

  if (
    constraints.filterLanguage &&
    !entry.capabilities.supportedFilterLangs.includes(constraints.filterLanguage)
  ) {
    return `missing filter language support: ${constraints.filterLanguage}`
  }

  if (constraints.requiresStreaming && entry.capabilities.provider !== 'stream') {
    return 'streaming required'
  }

  if (constraints.requiresTemporalOrdering && !entry.capabilities.supportsDatetime) {
    return 'temporal ordering required'
  }

  return undefined
}

const rankCandidate = (
  entry: SourceRegistryEntry,
  strategy: PlannerStrategy,
  health: SourceHealthMap | undefined
): Candidate => {
  const signal = health?.[entry.canonicalSource]
  const healthScore = signal?.score ?? 1
  const degradedMultiplier = signal?.state === 'degraded' ? 0.75 : 1

  const rawScore =
    (entry.priority + entry.weight * 100) *
      roleMultiplier(entry.role) *
      degradedMultiplier +
    strategyBonus(strategy, entry) +
    healthScore * 10

  const rationale = [
    `priority=${entry.priority}`,
    `weight=${entry.weight.toFixed(2)}`,
    `role=${entry.role}`,
    `provider=${entry.capabilities.provider}`,
    `strategy=${strategy}`,
    signal ? `health=${signal.state}:${signal.score.toFixed(2)}` : 'health=default:1.00',
  ].join(', ')

  return {
    entry,
    score: rawScore,
    rationale,
  }
}

const buildPlan = (request: RegistryPlannerRequest): RegistryQueryPlanV1 => {
  const now = request.now ?? new Date()
  const strategy = request.strategy ?? 'latency-first'
  const requested = request.requestedSources ?? []
  const requestedSet = requested.length > 0 ? new Set(requested) : undefined

  const selectedCandidates: Candidate[] = []
  const rejected: Array<{ sourceId: string; canonicalSource: CanonicalIntelSource; reason: string }> = []

  for (const entry of listSourceRegistry()) {
    if (!entry.enabled) {
      rejected.push({
        sourceId: String(entry.sourceId),
        canonicalSource: entry.canonicalSource,
        reason: 'source disabled',
      })
      continue
    }

    if (requestedSet && !requestedSet.has(entry.canonicalSource)) {
      rejected.push({
        sourceId: String(entry.sourceId),
        canonicalSource: entry.canonicalSource,
        reason: 'not requested by caller',
      })
      continue
    }

    const incompatibility = isCompatibleWithConstraints(entry, request.constraints)
    if (incompatibility) {
      rejected.push({
        sourceId: String(entry.sourceId),
        canonicalSource: entry.canonicalSource,
        reason: incompatibility,
      })
      continue
    }

    const healthSignal = request.health?.[entry.canonicalSource]
    if (healthSignal?.state === 'down') {
      rejected.push({
        sourceId: String(entry.sourceId),
        canonicalSource: entry.canonicalSource,
        reason: 'source health down',
      })
      continue
    }

    selectedCandidates.push(rankCandidate(entry, strategy, request.health))
  }

  selectedCandidates.sort((a, b) => b.score - a.score)

  const maxSources = request.constraints?.maxSources ?? selectedCandidates.length
  const selected = selectedCandidates.slice(0, maxSources)

  for (const candidate of selectedCandidates.slice(maxSources)) {
    rejected.push({
      sourceId: String(candidate.entry.sourceId),
      canonicalSource: candidate.entry.canonicalSource,
      reason: `ranked below maxSources=${maxSources}`,
    })
  }

  const encodedPlan = {
    _tag: 'RegistryQueryPlanV1',
    version: 'geoint.registry.v1',
    planId: `plan-${request.queryId}-${now.getTime()}`,
    generatedAt: now.toISOString(),
    intent: {
      _tag: 'PlannerIntentV1',
      version: 'geoint.registry.v1',
      queryId: request.queryId,
      requestedAt: now.toISOString(),
      text: request.text,
      bbox: request.bbox,
      requestedSources: requested.length > 0
        ? requested
        : selected.map((candidate) => candidate.entry.canonicalSource),
      constraints: request.constraints
        ? {
            _tag: 'QueryConstraintV1',
            filterLanguage: request.constraints.filterLanguage,
            requiresStreaming: request.constraints.requiresStreaming,
            requiresTemporalOrdering: request.constraints.requiresTemporalOrdering,
            maxSources: request.constraints.maxSources,
          }
        : undefined,
    },
    decision: {
      _tag: 'PlanDecisionV1',
      strategy,
      selected: selected.map((candidate, index) => ({
        _tag: 'SourceAttemptV1',
        sourceId: String(candidate.entry.sourceId),
        canonicalSource: candidate.entry.canonicalSource,
        role: candidate.entry.role,
        provider: candidate.entry.capabilities.provider,
        priority: candidate.entry.priority,
        weight: candidate.entry.weight,
        rank: index,
        rationale: candidate.rationale,
        fallbackOf: index > 0 ? String(selected[index - 1]?.entry.sourceId) : undefined,
      })),
      rejected: rejected.map((item) => ({
        _tag: 'SourceRejectionV1',
        sourceId: item.sourceId,
        canonicalSource: item.canonicalSource,
        reason: item.reason,
      })),
    },
  }

  return decodePlan(encodedPlan)
}

export interface RegistryPlanner {
  readonly plan: (request: RegistryPlannerRequest) => Effect.Effect<RegistryQueryPlanV1, RegistryPlannerError>
}

export class RegistryPlannerTag extends Context.Tag('tmnl/geoint/RegistryPlanner')<
  RegistryPlannerTag,
  RegistryPlanner
>() {}

export const RegistryPlannerLive = Layer.succeed(
  RegistryPlannerTag,
  RegistryPlannerTag.of({
    plan: (request) =>
      Effect.try({
        try: () => buildPlan(request),
        catch: (cause) =>
          new RegistryPlannerError({
            message: 'Failed to build registry query plan',
            cause,
          }),
      }),
  })
)

export const planRegistryQuery = (
  request: RegistryPlannerRequest
): Effect.Effect<RegistryQueryPlanV1, RegistryPlannerError, RegistryPlannerTag> =>
  Effect.flatMap(RegistryPlannerTag, (planner) => planner.plan(request))
