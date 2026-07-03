/**
 * Prospect Pipeline — SEC EDGAR Connector
 *
 * Surfaces public companies mentioning digital transformation,
 * SCADA, custom software, etc. in their SEC filings.
 *
 * A company writing about "digital transformation" or "SCADA modernization"
 * in their 10-K is an executive-level commitment to spend — in writing,
 * filed with the SEC. Strongest capital signal possible.
 *
 * Free, no auth. Rate limit: 10 req/sec.
 * Uses EDGAR Full-Text Search System (EFTS).
 *
 * @module prospects/connectors/sec-edgar
 */

import { Effect } from 'effect'
import type { SourceConnectorShape, FetchResult } from './interface'
import { ConnectorError } from './interface'
import { fetchJson } from './_http'
import type { HarvestCompanyRecord } from '../schemas/harvest'
import type { SignalType } from '../schemas/domain'

// =============================================================================
// EDGAR Search Queries — what reveals spending intent
// =============================================================================

const EDGAR_QUERIES = [
  '"digital transformation" AND ("capital expenditure" OR "investment")',
  '"SCADA" AND ("modernization" OR "upgrade" OR "replacement")',
  '"custom software" OR "custom platform" OR "internal platform"',
  '"automation" AND ("manufacturing" OR "production") AND "investment"',
  '"IoT" OR "IIoT" AND ("implementation" OR "deployment")',
] as const

// =============================================================================
// EDGAR API Types
// =============================================================================

interface EdgarSearchResult {
  hits: {
    total: { value: number }
    hits: Array<{
      _source: {
        file_date: string
        display_names: string[]
        file_num: string[]
        file_type: string
        form: string
        biz_locations?: string[]
        biz_states?: string[]
        sics?: string[]
        ciks: string[]
        adsh: string
      }
      _id: string
      highlight?: Record<string, string[]>
    }>
  }
}

// =============================================================================
// SEC EDGAR Connector — Effect.Service
// =============================================================================

export class SECEdgarConnector extends Effect.Service<SECEdgarConnector>()(
  'prospects/connectors/SECEdgar',
  {
    effect: Effect.gen(function* () {
      const sourceId = 'sec_edgar' as const

      const fetchEdgar = (
        query: string,
        page: number,
        limit: number,
        since?: string,
      ): Effect.Effect<FetchResult, ConnectorError> =>
        Effect.gen(function* () {
          const params = new URLSearchParams({
            q: query,
            dateRange: 'custom',
            startdt: since ?? '2025-01-01',
            enddt: new Date().toISOString().split('T')[0],
            forms: '10-K,10-Q,8-K',
            from: String(page * limit),
            size: String(limit),
          })

          const url = `https://efts.sec.gov/LATEST/search-index?${params.toString()}`

          const data = yield* fetchJson<EdgarSearchResult>(url, sourceId, {
            headers: {
              // SEC requires a User-Agent with contact info
              'User-Agent': 'TMNL-ProspectPipeline/1.0 (contact@example.com)',
            },
          })

          // Deduplicate by company name (same company may have multiple filings)
          const companyMap = new Map<string, {
            name: string
            location: string | null
            state: string | null
            cik: string
            filings: Array<{ type: string; date: string; id: string }>
          }>()

          for (const hit of data.hits.hits) {
            const displayName = hit._source.display_names?.[0]
            if (!displayName) continue

            // Extract clean company name from "XBP Europe Holdings, Inc.  (XBP, XBPEW)  (CIK 0001839530)"
            const cleanName = displayName.replace(/\s*\(.*$/, '').trim()
            if (!cleanName) continue

            const existing = companyMap.get(cleanName) ?? {
              name: cleanName,
              location: hit._source.biz_locations?.[0] ?? null,
              state: hit._source.biz_states?.[0] ?? null,
              cik: hit._source.ciks[0],
              filings: [],
            }
            existing.filings.push({
              type: hit._source.form,
              date: hit._source.file_date,
              id: hit._id,
            })
            companyMap.set(cleanName, existing)
          }

          const records: HarvestCompanyRecord[] = Array.from(companyMap.values()).map((company) => {
            const latestFiling = company.filings.sort((a, b) =>
              b.date.localeCompare(a.date)
            )[0]

            return {
              name: company.name,
              industry: 'other' as const,
              hq: company.location ?? (company.state ? `${company.state}, USA` : undefined),
              size: 'unknown' as const,
              description: `Public company (CIK ${company.cik}). SEC filing mentions search terms.`,
              tags: ['sec-filing', latestFiling.type.toLowerCase(), `cik-${company.cik}`],
              signals: [{
                type: 'manual_observation' as SignalType,
                title: `SEC ${latestFiling.type} mentions "${query.slice(0, 50)}"`,
                description: `Filed ${latestFiling.date}. ${company.filings.length} matching filing(s).`,
                sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${company.cik}&type=10-K&dateb=&owner=include&count=10`,
                weight: 3,
              }],
            }
          })

          return {
            records,
            totalAvailable: data.hits.total.value,
            nextPage: (page + 1) * limit < data.hits.total.value ? page + 1 : null,
          }
        })

      const connector: SourceConnectorShape = {
        sourceId,
        displayName: 'SEC EDGAR Full-Text Search',

        fetch: (params) =>
          fetchEdgar(
            params.query ?? EDGAR_QUERIES[0],
            params.page ?? 0,
            params.limit ?? 20,
            params.since
          ),

        fetchAll: (params) =>
          Effect.gen(function* () {
            const maxPages = params.maxPages ?? 3
            const allRecords: HarvestCompanyRecord[] = []
            let totalAvailable = 0

            const queries = params.query ? [params.query] : EDGAR_QUERIES

            for (const query of queries) {
              let page = 0
              while (page < maxPages) {
                const result = yield* fetchEdgar(query, page, 20, params.since).pipe(
                  Effect.catchAll(() =>
                    Effect.succeed({
                      records: [] as HarvestCompanyRecord[],
                      totalAvailable: 0,
                      nextPage: null as number | null,
                    })
                  )
                )

                allRecords.push(...result.records)
                totalAvailable = Math.max(totalAvailable, result.totalAvailable)

                if (result.nextPage === null) break
                page = result.nextPage

                yield* Effect.sleep('200 millis') // 10 req/sec → 100ms min, we use 200ms
              }

              yield* Effect.sleep('500 millis')
            }

            return { records: allRecords, totalAvailable, nextPage: null }
          }),

        healthCheck: Effect.gen(function* () {
          const start = Date.now()
          return yield* Effect.tryPromise({
            try: async () => {
              const res = await fetch(
                'https://efts.sec.gov/LATEST/search-index?q=test&size=1',
                { headers: { 'User-Agent': 'TMNL-ProspectPipeline/1.0 (contact@example.com)' } }
              )
              return {
                healthy: res.ok,
                latencyMs: Date.now() - start,
                lastSuccessAt: res.ok ? new Date().toISOString() : null,
                errorMessage: res.ok ? undefined : `HTTP ${res.status}`,
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
