/**
 * Prospect Pipeline — USASpending.gov Connector
 *
 * Federal contract awards — who's winning government software/SCADA/automation contracts.
 * FREE, no auth, no API key. Structured JSON responses with dollar amounts.
 *
 * Surfaces companies winning federal contracts in our target areas.
 * These companies have proven budget, proven capability, and may need subcontractors.
 *
 * @module prospects/connectors/usa-spending
 */

import { Effect } from 'effect'
import type { SourceConnectorShape, FetchResult } from './interface'
import { ConnectorError } from './interface'
import { fetchJson } from './_http'
import type { HarvestCompanyRecord } from '../schemas/harvest'
import type { SignalType } from '../schemas/domain'

// =============================================================================
// Search Keywords — federal contracts in our target areas
// =============================================================================

const KEYWORD_SETS = [
  ['SCADA', 'supervisory control'],
  ['digital transformation', 'modernization'],
  ['custom software', 'software development'],
  ['automation', 'industrial controls'],
  ['conveyor', 'material handling'],
  ['water treatment', 'wastewater'],
  ['building management', 'BMS', 'energy management'],
] as const

// =============================================================================
// USASpending API Types
// =============================================================================

interface USASpendingResult {
  page_metadata: { total: number; page: number; hasNext: boolean }
  results: Array<{
    'Award ID': string
    'Recipient Name': string
    'Award Amount': number
    'Description': string
    'Start Date': string
    'Period of Performance Current End Date': string
    'Awarding Agency': string
    'Awarding Sub Agency': string
    'recipient_id': string
  }>
}

// =============================================================================
// USASpending Connector — Effect.Service
// =============================================================================

export class USASpendingConnector extends Effect.Service<USASpendingConnector>()(
  'prospects/connectors/USASpending',
  {
    effect: Effect.gen(function* () {
      const sourceId = 'sam_gov' as const // closest HarvestSource enum value

      const fetchAwards = (
        keywords: ReadonlyArray<string>,
        page: number,
        limit: number,
        since?: string,
      ): Effect.Effect<FetchResult, ConnectorError> =>
        Effect.gen(function* () {
          const url = 'https://api.usaspending.gov/api/v2/search/spending_by_award/'

          const body = JSON.stringify({
            filters: {
              keywords: [...keywords],
              time_period: [{
                start_date: since ?? '2025-01-01',
                end_date: new Date().toISOString().split('T')[0],
              }],
              award_type_codes: ['A', 'B', 'C', 'D'], // Contracts only
            },
            fields: [
              'Award ID', 'Recipient Name', 'Award Amount', 'Description',
              'Start Date', 'Period of Performance Current End Date',
              'Awarding Agency', 'Awarding Sub Agency', 'recipient_id',
            ],
            limit,
            page: page + 1, // USASpending is 1-indexed
            sort: 'Award Amount',
            order: 'desc',
          })

          const data = yield* fetchJson<USASpendingResult>(url, sourceId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          })

          // Deduplicate by recipient name
          const companyMap = new Map<string, {
            name: string
            awards: Array<{ id: string; amount: number; desc: string; agency: string; start: string }>
          }>()

          for (const award of data.results) {
            const name = award['Recipient Name']
            if (!name || name === 'MULTIPLE RECIPIENTS') continue

            const existing = companyMap.get(name) ?? { name, awards: [] }
            existing.awards.push({
              id: award['Award ID'],
              amount: award['Award Amount'],
              desc: award['Description'],
              agency: award['Awarding Agency'],
              start: award['Start Date'],
            })
            companyMap.set(name, existing)
          }

          const records: HarvestCompanyRecord[] = Array.from(companyMap.values()).map((company) => {
            const totalAwardValue = company.awards.reduce((sum, a) => sum + a.amount, 0)
            const topAward = company.awards.sort((a, b) => b.amount - a.amount)[0]

            return {
              name: company.name,
              industry: 'other' as const, // Will be enriched
              size: totalAwardValue > 50_000_000 ? 'large' as const
                : totalAwardValue > 5_000_000 ? 'mid' as const
                : totalAwardValue > 500_000 ? 'mid_small' as const
                : 'small' as const,
              revenue: `$${(totalAwardValue / 1_000_000).toFixed(1)}M (federal awards)`,
              description: `Federal contractor. ${company.awards.length} award(s) totaling $${(totalAwardValue / 1_000_000).toFixed(1)}M. Top agency: ${topAward.agency}.`,
              tags: ['federal-contractor', 'government'],
              signals: [{
                type: 'rfp' as SignalType,
                title: `$${(topAward.amount / 1_000_000).toFixed(1)}M federal award: ${topAward.desc.slice(0, 100)}`,
                description: `Agency: ${topAward.agency}. ${company.awards.length} total awards. Started ${topAward.start}.`,
                sourceUrl: `https://www.usaspending.gov/search/?hash=&filters=${encodeURIComponent(JSON.stringify({ keyword: keywords[0] }))}`,
                weight: topAward.amount > 5_000_000 ? 3 : 2,
              }],
            }
          })

          return {
            records,
            totalAvailable: data.page_metadata.total,
            nextPage: data.page_metadata.hasNext ? page + 1 : null,
          }
        })

      const connector: SourceConnectorShape = {
        sourceId,
        displayName: 'USASpending.gov (Federal Awards)',

        fetch: (params) =>
          fetchAwards(
            params.query ? [params.query] : KEYWORD_SETS[0],
            params.page ?? 0,
            params.limit ?? 25,
            params.since,
          ),

        fetchAll: (params) =>
          Effect.gen(function* () {
            const maxPages = params.maxPages ?? 3
            const allRecords: HarvestCompanyRecord[] = []
            let totalAvailable = 0

            for (const keywords of KEYWORD_SETS) {
              let page = 0
              while (page < maxPages) {
                const result = yield* fetchAwards(keywords, page, 25, params.since).pipe(
                  Effect.catchAll(() =>
                    Effect.succeed({ records: [] as HarvestCompanyRecord[], totalAvailable: 0, nextPage: null as number | null })
                  )
                )

                allRecords.push(...result.records)
                totalAvailable = Math.max(totalAvailable, result.totalAvailable)

                if (result.nextPage === null) break
                page = result.nextPage

                yield* Effect.sleep('300 millis')
              }

              yield* Effect.sleep('500 millis') // Between keyword sets
            }

            return { records: allRecords, totalAvailable, nextPage: null }
          }),

        healthCheck: Effect.gen(function* () {
          const start = Date.now()
          return yield* Effect.tryPromise({
            try: async () => {
              const res = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  filters: { keywords: ['test'], time_period: [{ start_date: '2025-01-01', end_date: '2025-01-02' }], award_type_codes: ['A'] },
                  fields: ['Award ID'],
                  limit: 1, page: 1,
                }),
              })
              return {
                healthy: res.ok,
                latencyMs: Date.now() - start,
                lastSuccessAt: res.ok ? new Date().toISOString() : null,
              }
            },
            catch: (err) => new ConnectorError({ sourceId, message: String(err), retryable: true }),
          })
        }),
      }

      return connector
    }),
  }
) {}
