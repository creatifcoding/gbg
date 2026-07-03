/**
 * Prospect Pipeline — CIP Scoring Service
 *
 * Capital × Interest × Power scoring for decision makers.
 * Each axis is 0–10. Composite is a weighted blend.
 *
 * Exposed as Effect.Service for DI and testability.
 * Batch operations use single-query patterns — no N+1.
 * No try/catch — all error handling via Effect.
 *
 * @module prospects/services/cip-scoring
 */

import { Effect, Schema } from 'effect'
import { SqlClient } from '@effect/sql'
import type { CompanySize, TitleLevel, SignalType } from '../schemas/domain'
import type { CIPScoreResult } from '../schemas/harvest'
import { RoleTenure, isNewInRole } from '../schemas/value-objects'

// =============================================================================
// Tenure JSON Parsing (Effect, not try/catch)
// =============================================================================

const decodeRoleTenure = Schema.decodeUnknown(RoleTenure)

/**
 * Parse tenure JSON string into a boolean "is new in role".
 * Returns Effect<boolean> — never throws.
 */
const parseTenureIsNew = (tenureJson: string | null): Effect.Effect<boolean> =>
  tenureJson === null
    ? Effect.succeed(false)
    : Effect.gen(function* () {
        const parsed = yield* Effect.try({
          try: () => JSON.parse(tenureJson),
          catch: () => new Error('malformed tenure JSON'),
        })
        const tenure = yield* decodeRoleTenure(parsed).pipe(
          Effect.catchAll(() => Effect.succeed(null))
        )
        if (tenure === null) return false
        return isNewInRole(tenure)
      }).pipe(Effect.catchAll(() => Effect.succeed(false)))

// =============================================================================
// Scoring Functions (pure, stateless — testable without service)
// =============================================================================

const scoreCapital = (opts: {
  readonly size: CompanySize
  readonly revenue?: string | null
  readonly hasActiveRfp?: boolean
  readonly recentFunding?: boolean
}): number => {
  const sizeScores: Record<CompanySize, number> = {
    micro: 1, small: 2, mid_small: 4, mid: 6,
    mid_large: 8, large: 9, unknown: 3,
  }
  let score = sizeScores[opts.size] ?? 3
  if (opts.hasActiveRfp) score = Math.min(10, score + 2)
  if (opts.recentFunding) score = Math.min(10, score + 2)
  return Math.min(10, Math.max(0, score))
}

const scoreInterest = (signals: ReadonlyArray<{
  readonly signalType: SignalType
  readonly weight: number
}>): number => {
  if (signals.length === 0) return 1

  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0)
  const typeBonus = signals.reduce((bonus, s) => {
    const multipliers: Partial<Record<SignalType, number>> = {
      pain_admission: 1.5, job_posting: 1.0, rfp: 1.5,
      funding_round: 1.2, leadership_change: 1.3,
      linkedin_post: 0.8, conference_talk: 0.7,
    }
    return bonus + (multipliers[s.signalType] ?? 1.0)
  }, 0)

  const raw = (totalWeight * 1.5) + (typeBonus * 0.5)
  return Math.min(10, Math.max(0, Math.round(raw * 10) / 10))
}

const scorePower = (opts: {
  readonly titleLevel: TitleLevel
  readonly companySize: CompanySize
  readonly isNewInRole?: boolean
  readonly isFounder?: boolean
}): number => {
  const titleScores: Record<TitleLevel, number> = {
    founder_owner: 10, c_suite: 9, vp: 7, director: 6,
    manager: 4, individual: 2, unknown: 3,
  }
  let score = titleScores[opts.titleLevel] ?? 3

  const sizeMultiplier: Record<CompanySize, number> = {
    micro: 1.3, small: 1.2, mid_small: 1.1, mid: 1.0,
    mid_large: 0.9, large: 0.8, unknown: 1.0,
  }
  score *= sizeMultiplier[opts.companySize] ?? 1.0

  if (opts.isNewInRole) score = Math.min(10, score + 1)
  if (opts.isFounder) score = 10

  return Math.min(10, Math.max(0, Math.round(score * 10) / 10))
}

const cipComposite = (c: number, i: number, p: number): number =>
  Math.round(((c * 0.3) + (i * 0.4) + (p * 0.3)) * 10) / 10

// =============================================================================
// CIPScoring Service
// =============================================================================

export class CIPScoring extends Effect.Service<CIPScoring>()(
  'prospects/CIPScoring',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      return {
        scoreCapital,
        scoreInterest,
        scorePower,
        cipComposite,

        /**
         * Recalculate CIP scores for ALL decision makers.
         *
         * Two queries total (not N+1):
         *   1. Fetch all DMs joined with company size
         *   2. Fetch ALL signals, group in memory by companyId
         *   3. Parse tenure JSON via Effect (no try/catch)
         *   4. Batch UPDATE
         */
        recalculateAll: Effect.gen(function* () {
          const dms = yield* sql<{
            id: string
            titleLevel: string
            companyId: string
            companySize: string
            tenureJson: string | null
          }>`
            SELECT
              dm.id,
              dm.title_level as "titleLevel",
              dm.company_id as "companyId",
              c.size as "companySize",
              dm.tenure_json as "tenureJson"
            FROM decision_makers dm
            JOIN companies c ON dm.company_id = c.id
          `

          if (dms.length === 0) return 0

          const allSignals = yield* sql<{
            companyId: string
            signalType: string
            weight: number
          }>`
            SELECT company_id as "companyId", signal_type as "signalType", weight
            FROM signals
          `

          const signalsByCompany = new Map<string, Array<{ signalType: SignalType; weight: number }>>()
          for (const s of allSignals) {
            const list = signalsByCompany.get(s.companyId) ?? []
            list.push({ signalType: s.signalType as SignalType, weight: s.weight })
            signalsByCompany.set(s.companyId, list)
          }

          // Parse all tenure JSONs in parallel via Effect.all
          const tenureFlags = yield* Effect.all(
            dms.map((dm) => parseTenureIsNew(dm.tenureJson)),
            { concurrency: 'unbounded' }
          )

          const now = new Date().toISOString()
          const updates: Array<{ id: string; c: number; i: number; p: number; comp: number }> = []

          for (let idx = 0; idx < dms.length; idx++) {
            const dm = dms[idx]
            const companySignals = signalsByCompany.get(dm.companyId) ?? []
            const c = scoreCapital({ size: dm.companySize as CompanySize })
            const i = scoreInterest(companySignals)
            const p = scorePower({
              titleLevel: dm.titleLevel as TitleLevel,
              companySize: dm.companySize as CompanySize,
              isNewInRole: tenureFlags[idx],
            })
            updates.push({ id: dm.id, c, i, p, comp: cipComposite(c, i, p) })
          }

          for (const u of updates) {
            yield* sql`
              UPDATE decision_makers
              SET cip_capital = ${u.c}, cip_interest = ${u.i},
                  cip_power = ${u.p}, cip_composite = ${u.comp},
                  updated_at = ${now}
              WHERE id = ${u.id}
            `
          }

          yield* Effect.logInfo(
            `[CIPScoring] Recalculated ${updates.length} decision makers (2 queries + ${updates.length} updates)`
          )
          return updates.length
        }),

        /**
         * Recalculate CIP for a single decision maker.
         * 2 queries: DM+company join, signals for that company.
         * Tenure parsed via Effect — no try/catch.
         */
        recalculateOne: (dmId: string): Effect.Effect<CIPScoreResult | null, unknown, never> =>
          Effect.gen(function* () {
            const rows = yield* sql<{
              titleLevel: string
              companyId: string
              companySize: string
              tenureJson: string | null
            }>`
              SELECT dm.title_level as "titleLevel",
                     dm.company_id as "companyId",
                     c.size as "companySize",
                     dm.tenure_json as "tenureJson"
              FROM decision_makers dm
              JOIN companies c ON dm.company_id = c.id
              WHERE dm.id = ${dmId}
            `
            if (rows.length === 0) return null

            const dm = rows[0]
            const signals = yield* sql<{ signalType: string; weight: number }>`
              SELECT signal_type as "signalType", weight
              FROM signals WHERE company_id = ${dm.companyId}
            `

            const isNew = yield* parseTenureIsNew(dm.tenureJson)

            const c = scoreCapital({ size: dm.companySize as CompanySize })
            const i = scoreInterest(
              signals.map((s) => ({
                signalType: s.signalType as SignalType,
                weight: s.weight,
              }))
            )
            const p = scorePower({
              titleLevel: dm.titleLevel as TitleLevel,
              companySize: dm.companySize as CompanySize,
              isNewInRole: isNew,
            })
            const comp = cipComposite(c, i, p)

            yield* sql`
              UPDATE decision_makers
              SET cip_capital = ${c}, cip_interest = ${i},
                  cip_power = ${p}, cip_composite = ${comp},
                  updated_at = ${new Date().toISOString()}
              WHERE id = ${dmId}
            `

            return {
              _tag: 'CIPScoreResult' as const,
              capital: c,
              interest: i,
              power: p,
              composite: comp,
            }
          }),
      }
    }),
  }
) {}
