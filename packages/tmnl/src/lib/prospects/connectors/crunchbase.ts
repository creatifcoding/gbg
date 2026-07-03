/**
 * Prospect Pipeline — Crunchbase Connector
 *
 * Surfaces recently funded companies in target industries.
 * Series A/B with 50-500 employees = cash on hand + building = need dev capacity.
 *
 * Free tier: 200 requests/month via api.crunchbase.com/v4
 * Requires CRUNCHBASE_API_KEY env var (free registration).
 *
 * @module prospects/connectors/crunchbase
 */

import { Effect } from 'effect'
import type { SourceConnectorShape, FetchResult } from './interface'
import { ConnectorError } from './interface'
import { fetchJson } from './_http'
import type { HarvestCompanyRecord } from '../schemas/harvest'
import type { Industry, CompanySize, SignalType } from '../schemas/domain'

// =============================================================================
// Crunchbase Category → Industry Mapping
// =============================================================================

const categoryToIndustry = (categories: string[]): Industry => {
  const joined = categories.join(' ').toLowerCase()
  if (joined.includes('manufactur')) return 'manufacturing'
  if (joined.includes('construction')) return 'construction'
  if (joined.includes('logistics') || joined.includes('supply chain') || joined.includes('warehouse')) return 'logistics'
  if (joined.includes('energy') || joined.includes('oil') || joined.includes('gas')) return 'energy'
  if (joined.includes('water') || joined.includes('waste')) return 'water_wastewater'
  if (joined.includes('food') || joined.includes('beverage')) return 'food_beverage'
  if (joined.includes('pharma') || joined.includes('biotech') || joined.includes('life science')) return 'pharma'
  if (joined.includes('mining')) return 'mining'
  if (joined.includes('aviation') || joined.includes('aerospace')) return 'aviation'
  if (joined.includes('chemical')) return 'chemical'
  if (joined.includes('renewable') || joined.includes('solar') || joined.includes('wind') || joined.includes('cleantech')) return 'renewable_energy'
  if (joined.includes('cannabis') || joined.includes('hemp')) return 'cannabis'
  if (joined.includes('agriculture') || joined.includes('agtech') || joined.includes('farm')) return 'agriculture'
  if (joined.includes('maritime') || joined.includes('marine') || joined.includes('ship')) return 'maritime'
  if (joined.includes('health') || joined.includes('medical')) return 'healthcare'
  if (joined.includes('field service')) return 'field_services'
  return 'other'
}

const employeeToSize = (range: string | null): CompanySize => {
  if (!range) return 'unknown'
  const lower = range.toLowerCase()
  if (lower.includes('1-10')) return 'micro'
  if (lower.includes('11-50')) return 'small'
  if (lower.includes('51-100') || lower.includes('101-250')) return 'mid_small'
  if (lower.includes('251-500') || lower.includes('501-1000')) return 'mid'
  if (lower.includes('1001-5000')) return 'mid_large'
  if (lower.includes('5001') || lower.includes('10001')) return 'large'
  return 'unknown'
}

// =============================================================================
// Crunchbase API Types
// =============================================================================

interface CrunchbaseOrg {
  properties: {
    identifier: { value: string; permalink: string }
    short_description?: string
    categories?: Array<{ value: string }>
    location_identifiers?: Array<{ value: string; location_type: string }>
    num_employees_enum?: string
    revenue_range?: string
    founded_on?: string
    website?: { value: string }
    linkedin?: { value: string }
    last_funding_type?: string
    last_funding_at?: string
    funding_total?: { value_usd: number }
    num_funding_rounds?: number
  }
}

interface CrunchbaseSearchResponse {
  count: number
  entities: CrunchbaseOrg[]
}

// =============================================================================
// Crunchbase Connector — Effect.Service
// =============================================================================

export class CrunchbaseConnector extends Effect.Service<CrunchbaseConnector>()(
  'prospects/connectors/Crunchbase',
  {
    effect: Effect.gen(function* () {
      const sourceId = 'crunchbase' as const
      const apiKey = process.env['CRUNCHBASE_API_KEY']

      const fetchPage = (
        query: string,
        page: number,
        limit: number
      ): Effect.Effect<FetchResult, ConnectorError> =>
        Effect.gen(function* () {
          if (!apiKey) {
            return yield* Effect.fail(
              new ConnectorError({
                sourceId,
                message: 'CRUNCHBASE_API_KEY not set. Register free at crunchbase.com/api',
                retryable: false,
              })
            )
          }

          const url = 'https://api.crunchbase.com/api/v4/searches/organizations'
          const body = JSON.stringify({
            field_ids: [
              'identifier', 'short_description', 'categories',
              'location_identifiers', 'num_employees_enum', 'revenue_range',
              'founded_on', 'website', 'linkedin',
              'last_funding_type', 'last_funding_at', 'funding_total',
              'num_funding_rounds',
            ],
            order: [{ field_id: 'last_funding_at', sort: 'desc' }],
            query,
            limit,
            after_id: page > 0 ? String(page * limit) : undefined,
          })

          const data = yield* fetchJson<CrunchbaseSearchResponse>(url, sourceId, {
            method: 'POST',
            headers: {
              'X-cb-user-key': apiKey,
              'Content-Type': 'application/json',
            },
            body,
          })

          const records: HarvestCompanyRecord[] = data.entities.map((org) => {
            const props = org.properties
            const categories = (props.categories ?? []).map((c) => c.value)
            const location = (props.location_identifiers ?? []).find((l) => l.location_type === 'city')

            const signals: HarvestCompanyRecord['signals'] = []

            // Funding signal
            if (props.last_funding_at && props.funding_total?.value_usd) {
              signals.push({
                type: 'funding_round' as SignalType,
                title: `${props.last_funding_type ?? 'Funding'}: $${(props.funding_total.value_usd / 1_000_000).toFixed(1)}M`,
                description: `${props.num_funding_rounds ?? 0} rounds total. Last funded ${props.last_funding_at}.`,
                weight: props.funding_total.value_usd > 10_000_000 ? 3 : 2,
              })
            }

            return {
              name: props.identifier.value,
              industry: categoryToIndustry(categories),
              hq: location?.value,
              size: employeeToSize(props.num_employees_enum ?? null),
              revenue: props.revenue_range ?? undefined,
              website: props.website?.value,
              linkedinUrl: props.linkedin?.value,
              description: props.short_description ?? undefined,
              tags: categories.length > 0 ? categories : undefined,
              signals: signals.length > 0 ? signals : undefined,
            }
          })

          return {
            records,
            totalAvailable: data.count,
            nextPage: records.length === limit ? page + 1 : null,
          }
        })

      const connector: SourceConnectorShape = {
        sourceId,
        displayName: 'Crunchbase (Free Tier)',

        fetch: (params) =>
          fetchPage(
            params.query ?? 'manufacturing OR construction OR logistics OR industrial',
            params.page ?? 0,
            params.limit ?? 25
          ),

        fetchAll: (params) =>
          Effect.gen(function* () {
            const maxPages = params.maxPages ?? 4 // 4 pages × 25 = 100 results = 4 API calls
            const allRecords: HarvestCompanyRecord[] = []
            let totalAvailable = 0
            let page = 0

            while (page < maxPages) {
              const result = yield* fetchPage(
                params.query ?? 'manufacturing OR construction OR logistics OR industrial',
                page,
                25
              ).pipe(Effect.catchAll(() =>
                Effect.succeed({ records: [] as HarvestCompanyRecord[], totalAvailable: 0, nextPage: null as number | null })
              ))

              allRecords.push(...result.records)
              totalAvailable = result.totalAvailable

              if (result.nextPage === null) break
              page = result.nextPage

              yield* Effect.sleep('1 second') // Rate limit courtesy
            }

            return { records: allRecords, totalAvailable, nextPage: null }
          }),

        healthCheck: Effect.gen(function* () {
          if (!apiKey) {
            return {
              healthy: false,
              latencyMs: 0,
              lastSuccessAt: null,
              errorMessage: 'CRUNCHBASE_API_KEY not configured',
            }
          }

          const start = Date.now()
          return yield* Effect.tryPromise({
            try: async () => {
              const res = await fetch('https://api.crunchbase.com/api/v4/searches/organizations', {
                method: 'POST',
                headers: { 'X-cb-user-key': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ field_ids: ['identifier'], limit: 1, query: 'test' }),
              })
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
