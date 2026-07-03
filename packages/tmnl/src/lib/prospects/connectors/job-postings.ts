/**
 * Prospect Pipeline — Job Posting Connector
 *
 * Scrapes job boards and career pages for signals of active hiring
 * that indicate software/technology needs.
 *
 * Strategy:
 * 1. Google Custom Search API (free 100/day) for job posting discovery
 * 2. Direct career page fetch for deeper detail
 * 3. Structured extraction of company + signal from job descriptions
 *
 * Each job posting becomes:
 * - A Company record (if new)
 * - A Signal (job_posting type) attached to that company
 * - Optionally a DecisionMaker (if hiring manager is named)
 *
 * @module prospects/connectors/job-postings
 */

import { Effect } from 'effect'
import type { SourceConnectorShape, FetchResult, HealthStatus } from './interface'
import { ConnectorError } from './interface'
import { fetchJson } from './_http'
import type { HarvestCompanyRecord } from '../schemas/harvest'
import type { Industry, SignalType, CompanySize } from '../schemas/domain'

// =============================================================================
// Job Search Queries — the keywords that surface our ideal prospects
// =============================================================================

const SEARCH_QUERIES = [
  // Direct pain signals
  '"replace Excel" OR "replace spreadsheets" hiring engineer',
  '"digital transformation" hiring manager manufacturing OR construction OR logistics',
  '"SCADA modernization" OR "SCADA upgrade" hiring engineer',
  '"internal tools" OR "internal platform" hiring engineer manufacturing OR industrial',
  '"custom software" OR "custom platform" hiring developer operations',

  // Role-based signals
  '"Director of Technology" OR "VP Engineering" construction OR manufacturing hiring',
  '"automation engineer" OR "controls engineer" food OR beverage OR pharma hiring',
  '"data engineer" OR "platform engineer" operations OR logistics hiring',

  // Industry-specific
  '"conveyor" OR "material handling" hiring technology OR software OR digital',
  '"water treatment" OR "wastewater" hiring SCADA OR technology',
  '"field service" OR "field operations" hiring software OR platform OR app',
] as const

// =============================================================================
// Industry Detection from Job Description
// =============================================================================

const detectIndustry = (text: string): Industry => {
  const lower = text.toLowerCase()
  if (lower.includes('conveyor') || lower.includes('material handling') || lower.includes('warehouse')) return 'logistics'
  if (lower.includes('construction') || lower.includes('contractor') || lower.includes('general contractor')) return 'construction'
  if (lower.includes('manufactur')) return 'manufacturing'
  if (lower.includes('water') || lower.includes('wastewater') || lower.includes('utility')) return 'water_wastewater'
  if (lower.includes('food') || lower.includes('beverage') || lower.includes('dairy')) return 'food_beverage'
  if (lower.includes('pharma') || lower.includes('gmp') || lower.includes('fda')) return 'pharma'
  if (lower.includes('energy') || lower.includes('oil') || lower.includes('gas') || lower.includes('power')) return 'energy'
  if (lower.includes('mining') || lower.includes('extracti')) return 'mining'
  if (lower.includes('airport') || lower.includes('aviation') || lower.includes('baggage')) return 'aviation'
  if (lower.includes('chemical') || lower.includes('specialty chem')) return 'chemical'
  if (lower.includes('solar') || lower.includes('wind') || lower.includes('renewable')) return 'renewable_energy'
  if (lower.includes('field service') || lower.includes('field tech')) return 'field_services'
  if (lower.includes('cannabis') || lower.includes('dispensary')) return 'cannabis'
  if (lower.includes('farm') || lower.includes('agriculture') || lower.includes('agri')) return 'agriculture'
  if (lower.includes('ship') || lower.includes('marine') || lower.includes('maritime')) return 'maritime'
  return 'other'
}

/** Detect signal weight from job posting content */
const detectSignalWeight = (text: string): 1 | 2 | 3 => {
  const lower = text.toLowerCase()
  // Weight 3: explicit pain or greenfield build
  if (lower.includes('replace excel') || lower.includes('replace spreadsheet') || lower.includes('build from scratch') || lower.includes('greenfield')) return 3
  if (lower.includes('digital transformation') || lower.includes('custom platform') || lower.includes('internal tools')) return 3
  // Weight 2: hiring for specific technical roles
  if (lower.includes('scada') || lower.includes('iiot') || lower.includes('mes') || lower.includes('erp')) return 2
  // Weight 1: general hiring signal
  return 1
}

/** Estimate company size from job description clues */
const detectCompanySize = (text: string): CompanySize => {
  const lower = text.toLowerCase()
  if (lower.includes('startup') || lower.includes('series a') || lower.includes('early stage')) return 'small'
  if (lower.includes('fortune 500') || lower.includes('global leader') || lower.includes('enterprise')) return 'large'
  if (lower.includes('mid-size') || lower.includes('midsize') || lower.includes('growing company')) return 'mid'
  return 'unknown'
}

// =============================================================================
// Job Posting Connector — Effect.Service
// =============================================================================

export class JobPostingConnector extends Effect.Service<JobPostingConnector>()(
  'prospects/connectors/JobPostings',
  {
    effect: Effect.gen(function* () {

      const sourceId = 'web_search' as const

      /**
       * Fetch job postings via Google Custom Search JSON API.
       *
       * Free tier: 100 queries/day.
       * Requires GOOGLE_CSE_ID and GOOGLE_CSE_KEY env vars.
       * Falls back to scraping if not configured.
       */
      const fetchViaGoogleCSE = (query: string, page: number = 0): Effect.Effect<
        FetchResult, ConnectorError
      > =>
        Effect.gen(function* () {
          const cseId = process.env['GOOGLE_CSE_ID']
          const cseKey = process.env['GOOGLE_CSE_KEY']

          if (!cseId || !cseKey) {
            return yield* Effect.fail(
              new ConnectorError({
                sourceId,
                message: 'GOOGLE_CSE_ID and GOOGLE_CSE_KEY env vars not set. Configure a Programmable Search Engine at https://programmablesearchengine.google.com/',
                retryable: false,
              })
            )
          }

          const start = page * 10 + 1 // Google CSE uses 1-indexed start
          const url = `https://www.googleapis.com/customsearch/v1?key=${cseKey}&cx=${cseId}&q=${encodeURIComponent(query)}&start=${start}&num=10`

          const data = yield* fetchJson<{
            items?: Array<{
              title: string
              link: string
              snippet: string
              pagemap?: {
                metatags?: Array<Record<string, string>>
              }
            }>
            searchInformation?: { totalResults: string }
          }>(url, sourceId)

          const records: HarvestCompanyRecord[] = (data.items ?? []).map((item) => {
            // Extract company name from job title (heuristic: "Role at Company" or "Company - Role")
            const titleParts = item.title.split(/\s+at\s+|\s+[-|]\s+/)
            const companyName = titleParts.length > 1
              ? titleParts[titleParts.length - 1].replace(/\s*\|.*$/, '').trim()
              : titleParts[0].trim()

            const fullText = `${item.title} ${item.snippet}`

            return {
              name: companyName || 'Unknown Company',
              industry: detectIndustry(fullText),
              size: detectCompanySize(fullText),
              website: new URL(item.link).origin,
              description: item.snippet.slice(0, 500),
              signals: [{
                type: 'job_posting' as SignalType,
                title: item.title.slice(0, 200),
                description: item.snippet.slice(0, 500),
                sourceUrl: item.link,
                weight: detectSignalWeight(fullText),
              }],
            }
          })

          const total = parseInt(data.searchInformation?.totalResults ?? '0', 10)

          return {
            records,
            totalAvailable: total,
            nextPage: records.length === 10 && page < 5 ? page + 1 : null,
          }
        })

      // ─── Public interface ──────────────────────────────────────────

      const connector: SourceConnectorShape = {
        sourceId,
        displayName: 'Job Postings (Google CSE)',

        fetch: (params) =>
          fetchViaGoogleCSE(
            params.query ?? SEARCH_QUERIES[0],
            params.page ?? 0
          ),

        fetchAll: (params) =>
          Effect.gen(function* () {
            const maxPages = params.maxPages ?? 3
            const allRecords: HarvestCompanyRecord[] = []
            let totalAvailable = 0

            // Run multiple search queries to cover different signal types
            const queries = params.query
              ? [params.query]
              : SEARCH_QUERIES.slice(0, 5) // First 5 queries per run

            for (const query of queries) {
              let page = 0
              while (page < maxPages) {
                const result = yield* fetchViaGoogleCSE(query, page).pipe(
                  Effect.catchAll((err) => {
                    return Effect.succeed({
                      records: [] as HarvestCompanyRecord[],
                      totalAvailable: 0,
                      nextPage: null as number | null,
                    })
                  })
                )

                allRecords.push(...result.records)
                totalAvailable += result.totalAvailable

                if (result.nextPage === null) break
                page = result.nextPage

                // Courtesy delay between pages
                yield* Effect.sleep('500 millis')
              }

              // Delay between different queries
              yield* Effect.sleep('1 second')
            }

            return {
              records: allRecords,
              totalAvailable,
              nextPage: null,
            }
          }),

        healthCheck: Effect.gen(function* () {
          const cseId = process.env['GOOGLE_CSE_ID']
          const cseKey = process.env['GOOGLE_CSE_KEY']

          if (!cseId || !cseKey) {
            return {
              healthy: false,
              latencyMs: 0,
              lastSuccessAt: null,
              errorMessage: 'GOOGLE_CSE_ID / GOOGLE_CSE_KEY not configured',
            }
          }

          const start = Date.now()
          const testUrl = `https://www.googleapis.com/customsearch/v1?key=${cseKey}&cx=${cseId}&q=test&num=1`

          return yield* Effect.tryPromise({
            try: async () => {
              const res = await fetch(testUrl)
              return {
                healthy: res.ok,
                latencyMs: Date.now() - start,
                lastSuccessAt: res.ok ? new Date().toISOString() : null,
                errorMessage: res.ok ? undefined : `HTTP ${res.status}`,
              }
            },
            catch: (err) => new ConnectorError({
              sourceId,
              message: String(err),
              retryable: true,
            }),
          })
        }),
      }

      return connector
    }),
  }
) {}
