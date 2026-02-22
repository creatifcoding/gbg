import { Schema } from 'effect'
import {
  type DiscoveredPatternEvent,
  Pattern,
  type Pattern as PatternType,
} from '../schema.ts'

export type MergeSourceClass = 'curated' | 'manual' | 'ast' | 'semantic' | 'tool' | 'hook' | 'unknown'

export interface MergeEvidence {
  readonly discoveries: number
  readonly avgConfidence: number
  readonly uniqueFiles: number
}

export interface MergeCandidate {
  readonly pattern: PatternType
  readonly source: MergeSourceClass
  readonly sourceRank: number
  readonly score: number
  readonly evidence: MergeEvidence
}

export interface MergeConflictPreview {
  readonly canonicalKey: string
  readonly winnerPatternId: string
  readonly contenderPatternId: string
  readonly reason: string
}

export interface MergeGroupPreview {
  readonly canonicalKey: string
  readonly winner: MergeCandidate
  readonly mergedPattern: PatternType
  readonly candidates: ReadonlyArray<MergeCandidate>
  readonly reason: 'single_candidate' | 'winner_curated' | 'winner_score'
  readonly conflicts: ReadonlyArray<MergeConflictPreview>
}

const decodePattern = Schema.decodeUnknownSync(Pattern)

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const slugify = (value: string): string =>
  normalizeText(value).replace(/\s+/g, '-').slice(0, 100)

const dedupeByJson = <A>(values: ReadonlyArray<A>): ReadonlyArray<A> => {
  const seen = new Set<string>()
  const out: Array<A> = []
  for (const value of values) {
    const key = JSON.stringify(value)
    if (!seen.has(key)) {
      seen.add(key)
      out.push(value)
    }
  }
  return out
}

const dedupeByKey = <A>(values: ReadonlyArray<A>, getKey: (value: A) => string): ReadonlyArray<A> => {
  const seen = new Set<string>()
  const out: Array<A> = []
  for (const value of values) {
    const key = getKey(value)
    if (!seen.has(key)) {
      seen.add(key)
      out.push(value)
    }
  }
  return out
}

export const classifyPatternSource = (pattern: PatternType): MergeSourceClass => {
  if (pattern.tags.includes('curated')) return 'curated'
  if (pattern.tags.includes('ast')) return 'ast'
  if (pattern.tags.includes('semantic')) return 'semantic'

  for (const provenance of pattern.provenance) {
    if (provenance._tag === 'ManualProvenance') return 'manual'
    if (provenance._tag === 'CodeProvenance') return 'ast'
  }

  return 'unknown'
}

export const sourceRank = (source: MergeSourceClass): number => {
  switch (source) {
    case 'curated':
      return 5
    case 'manual':
      return 4
    case 'ast':
      return 3
    case 'semantic':
      return 2
    case 'tool':
      return 2
    case 'hook':
      return 2
    default:
      return 1
  }
}

const baseScoreFromRank = (rank: number): number => rank / 5

export const scoreCandidate = (
  source: MergeSourceClass,
  evidence: MergeEvidence,
): number => {
  const rank = sourceRank(source)
  const base = baseScoreFromRank(rank)
  const confidenceBonus = Math.min(0.25, evidence.avgConfidence * 0.25)
  const occurrenceBonus = Math.min(0.15, evidence.discoveries * 0.01)
  const spreadBonus = Math.min(0.1, evidence.uniqueFiles * 0.02)
  return Number((base + confidenceBonus + occurrenceBonus + spreadBonus).toFixed(6))
}

export const canonicalKeyOf = (pattern: PatternType): string => {
  const domain = pattern.allowedContexts[0]?.domain
  const root = `${pattern.kind}:${slugify(pattern.title)}`
  return domain ? `${root}@${slugify(domain)}` : root
}

const materiallyDifferent = (left: string, right: string): boolean => {
  const a = normalizeText(left)
  const b = normalizeText(right)
  if (a.length < 16 || b.length < 16) return a !== b
  return a !== b
}

export const mergePatterns = (
  winner: PatternType,
  candidates: ReadonlyArray<PatternType>,
  canonicalKey: string,
): PatternType => {
  const now = new Date().toISOString()

  const merged = {
    ...winner,
    tags: dedupeByKey(candidates.flatMap((p) => p.tags), (tag) => tag),
    allowedContexts: dedupeByJson(candidates.flatMap((p) => p.allowedContexts)),
    antiPatterns: dedupeByKey(candidates.flatMap((p) => p.antiPatterns), (item) => item.antiPatternId),
    variants: dedupeByKey(candidates.flatMap((p) => p.variants), (item) => item.variantId),
    provenance: dedupeByJson(candidates.flatMap((p) => p.provenance)),
    updatedAt: now,
    metadata: {
      ...winner.metadata,
      canonicalKey,
      mergedFrom: String(candidates.length),
      mergedAt: now,
    },
  }

  return decodePattern(merged)
}

export const buildMergeGroup = (
  canonicalKey: string,
  patterns: ReadonlyArray<PatternType>,
  evidenceByPatternId: ReadonlyMap<string, MergeEvidence>,
): MergeGroupPreview => {
  const candidates = patterns
    .map((pattern) => {
      const source = classifyPatternSource(pattern)
      const evidence = evidenceByPatternId.get(pattern.patternId) ?? {
        discoveries: 0,
        avgConfidence: 0,
        uniqueFiles: 0,
      }

      return {
        pattern,
        source,
        sourceRank: sourceRank(source),
        score: scoreCandidate(source, evidence),
        evidence,
      } satisfies MergeCandidate
    })
    .sort((a, b) => {
      if (b.sourceRank !== a.sourceRank) return b.sourceRank - a.sourceRank
      if (b.score !== a.score) return b.score - a.score
      return b.pattern.updatedAt.localeCompare(a.pattern.updatedAt)
    })

  const winner = candidates[0]!
  const mergedPattern = mergePatterns(winner.pattern, candidates.map((c) => c.pattern), canonicalKey)

  const reason: MergeGroupPreview['reason'] = candidates.length === 1
    ? 'single_candidate'
    : winner.source === 'curated'
      ? 'winner_curated'
      : 'winner_score'

  const conflicts: Array<MergeConflictPreview> = []
  for (const contender of candidates.slice(1)) {
    const highPriority = winner.sourceRank >= 4 && contender.sourceRank >= 4
    const diverged = materiallyDifferent(winner.pattern.summary, contender.pattern.summary)
      || materiallyDifferent(winner.pattern.description, contender.pattern.description)

    if (highPriority && diverged) {
      conflicts.push({
        canonicalKey,
        winnerPatternId: winner.pattern.patternId,
        contenderPatternId: contender.pattern.patternId,
        reason: 'High-priority candidates diverge materially in summary/description',
      })
    }
  }

  return {
    canonicalKey,
    winner,
    mergedPattern,
    candidates,
    reason,
    conflicts,
  }
}

export const groupPatternsByCanonicalKey = (
  patterns: ReadonlyArray<PatternType>,
): ReadonlyMap<string, ReadonlyArray<PatternType>> => {
  const grouped = new Map<string, Array<PatternType>>()

  for (const pattern of patterns) {
    const key = canonicalKeyOf(pattern)
    const existing = grouped.get(key)
    if (existing) {
      existing.push(pattern)
    } else {
      grouped.set(key, [pattern])
    }
  }

  return grouped
}

export const summarizeEvidence = (
  discoveries: ReadonlyArray<DiscoveredPatternEvent>,
): ReadonlyMap<string, MergeEvidence> => {
  const grouped = new Map<string, { confidenceTotal: number; count: number; files: Set<string> }>()

  for (const event of discoveries) {
    const current = grouped.get(event.patternId)
    if (current) {
      current.count += 1
      current.confidenceTotal += event.metadata.confidence
      if (event.metadata.filePath) current.files.add(event.metadata.filePath)
    } else {
      grouped.set(event.patternId, {
        confidenceTotal: event.metadata.confidence,
        count: 1,
        files: new Set(event.metadata.filePath ? [event.metadata.filePath] : []),
      })
    }
  }

  const out = new Map<string, MergeEvidence>()
  for (const [patternId, agg] of grouped.entries()) {
    out.set(patternId, {
      discoveries: agg.count,
      avgConfidence: agg.count > 0 ? agg.confidenceTotal / agg.count : 0,
      uniqueFiles: agg.files.size,
    })
  }

  return out
}
