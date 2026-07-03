/**
 * Prospect Pipeline — Open Data Connector (SODA API)
 *
 * Queries state business registries via Socrata Open Data API (SODA).
 * Server-side filtering — no massive CSV downloads.
 * Free, no auth, no rate limits (within reason).
 *
 * Supported states (expandable):
 * - New York: data.ny.gov (700K+ active corporations)
 * - Iowa: data.iowa.gov (326K+ active entities)
 * - Connecticut: data.ct.gov
 * - More states addable by adding to SODA_SOURCES
 *
 * Strategy: For each keyword cluster, query each state's SODA endpoint
 * with a SoQL LIKE filter on the entity name column. Returns JSON directly.
 *
 * @module prospects/connectors/open-data
 */

import { Effect } from 'effect'
import type { SourceConnectorShape, FetchResult } from './interface'
import { ConnectorError } from './interface'
import { fetchJson } from './_http'
import type { HarvestCompanyRecord } from '../schemas/harvest'
import type { Industry } from '../schemas/domain'

// =============================================================================
// SODA Source Registry
// =============================================================================

interface SodaSource {
  readonly id: string
  readonly state: string
  readonly name: string
  /** Socrata resource endpoint (e.g. data.ny.gov/resource/XXXX.json) */
  readonly endpoint: string
  /** Column name for entity/business name */
  readonly nameColumn: string
  /** Column name for entity type */
  readonly typeColumn: string
  /** Column name for city (if available) */
  readonly cityColumn?: string
  /** Column name for state (if available) */
  readonly stateColumn?: string
}

const SODA_SOURCES: ReadonlyArray<SodaSource> = [
  {
    id: 'ny-active-corps',
    state: 'NY',
    name: 'New York Active Corporations',
    endpoint: 'https://data.ny.gov/resource/n9v6-gdp6.json',
    nameColumn: 'current_entity_name',
    typeColumn: 'entity_type',
    cityColumn: 'location_city',
    stateColumn: 'location_state',
  },
  {
    id: 'iowa-active',
    state: 'IA',
    name: 'Iowa Active Business Entities',
    endpoint: 'https://data.iowa.gov/resource/ez5t-3qay.json',
    nameColumn: 'legal_name',
    typeColumn: 'corporation_type',
    cityColumn: 'ho_city',
    stateColumn: 'ho_state',
  },
]

// =============================================================================
// Search Keyword Clusters
// =============================================================================

/**
 * Keywords grouped by intent. Each cluster becomes a SODA LIKE query.
 * Searched against the entity name column.
 */
const KEYWORD_CLUSTERS = [
  // Direct targets — companies we want to sell to
  ['CONVEYOR', 'MATERIAL HANDLING', 'SORTATION'],
  ['AUTOMATION', 'CONTROLS', 'INSTRUMENTATION', 'PLC'],
  ['SCADA', 'TELEMETRY', 'MONITORING'],
  ['FABRICATION', 'WELDING', 'MILLWRIGHT'],
  ['ELECTRICAL CONTRACTOR', 'MECHANICAL CONTRACTOR'],
  ['SOFTWARE', 'TECHNOLOGY', 'DIGITAL', 'PLATFORM'],
  ['WATER TREATMENT', 'WASTEWATER', 'WATER SYSTEM'],
  ['FOOD PROCESSING', 'BEVERAGE', 'DAIRY', 'BAKERY'],
  ['INSULATION', 'RIGGING', 'CRANE'],
  ['ENGINEERING SERVICE', 'SYSTEMS INTEGRAT'],
] as const

// =============================================================================
// Industry Detection
// =============================================================================

const detectIndustry = (name: string, entityType: string): Industry => {
  const lower = (name + ' ' + entityType).toLowerCase()
  if (/conveyor|material handling|warehouse|logistics|freight/.test(lower)) return 'logistics'
  if (/construct|builder|contractor|plumb|electric.*contract|hvac|mechanical.*contract/.test(lower)) return 'construction'
  if (/manufactur|fabricat|machine|tool|die|weld|millwright/.test(lower)) return 'manufacturing'
  if (/water|wastewater|sewer|utility|irrigation/.test(lower)) return 'water_wastewater'
  if (/food|beverage|dairy|bakery|meat|poultry|process/.test(lower)) return 'food_beverage'
  if (/pharma|biotech|medical|health|clinic/.test(lower)) return 'healthcare'
  if (/energy|power|solar|wind|electric.*gen/.test(lower)) return 'energy'
  if (/chemical|coating|adhesive|paint/.test(lower)) return 'chemical'
  if (/farm|agriculture|grain|crop|seed/.test(lower)) return 'agriculture'
  if (/marine|ship|boat|maritime/.test(lower)) return 'maritime'
  if (/mining|quarry|excavat/.test(lower)) return 'mining'
  if (/software|technology|digital|platform|data|analytics|system.*integrat/.test(lower)) return 'other' // tech companies — classify further in enrichment
  return 'other'
}

// =============================================================================
// Open Data Connector — Effect.Service
// =============================================================================

export class OpenDataConnector extends Effect.Service<OpenDataConnector>()(
  'prospects/connectors/OpenData',
  {
    effect: Effect.gen(function* () {
      const sourceId = 'state_license' as const

      /**
       * Query a single SODA source for a keyword cluster.
       * Builds a SoQL $where clause with OR'd LIKE conditions.
       */
      const querySource = (
        source: SodaSource,
        keywords: ReadonlyArray<string>,
        limit: number = 100,
        offset: number = 0,
      ): Effect.Effect<FetchResult, ConnectorError> =>
        Effect.gen(function* () {
          // Build SoQL WHERE clause: name LIKE '%KEYWORD1%' OR name LIKE '%KEYWORD2%'
          const whereClauses = keywords.map(
            (kw) => `${source.nameColumn} like '%${kw}%'`
          )
          const where = whereClauses.join(' OR ')

          const url = `${source.endpoint}?$where=${encodeURIComponent(where)}&$limit=${limit}&$offset=${offset}&$order=${source.nameColumn}`

          const data = yield* fetchJson<Array<Record<string, string>>>(url, sourceId)

          const records: HarvestCompanyRecord[] = data.map((row) => {
            const name = row[source.nameColumn] ?? ''
            const entityType = row[source.typeColumn] ?? ''
            const city = source.cityColumn ? row[source.cityColumn] : undefined
            const state = source.stateColumn ? row[source.stateColumn] : undefined
            const hq = [city, state ?? source.state].filter(Boolean).join(', ')

            return {
              name: name.trim(),
              industry: detectIndustry(name, entityType),
              hq: hq || `${source.state}, USA`,
              description: `${entityType}. State registry: ${source.name}.`,
              tags: ['state-registry', source.state.toLowerCase()],
              signals: [{
                type: 'manual_observation' as const,
                title: `Registered in ${source.state}: ${entityType}`,
                weight: 1,
              }],
            }
          }).filter((r) => r.name.length > 2)

          return {
            records,
            totalAvailable: data.length >= limit ? limit * 10 : data.length, // Estimate
            nextPage: data.length >= limit ? offset + limit : null,
          }
        })

      const connector: SourceConnectorShape = {
        sourceId,
        displayName: 'Open Data (State Business Registries via SODA)',

        fetch: (params) => {
          const source = SODA_SOURCES.find((s) => s.id === params.category) ?? SODA_SOURCES[0]
          const keywords = params.query ? [params.query.toUpperCase()] : KEYWORD_CLUSTERS[0]
          return querySource(source, keywords, params.limit ?? 100, (params.page ?? 0) * (params.limit ?? 100))
        },

        fetchAll: (params) =>
          Effect.gen(function* () {
            const allRecords: HarvestCompanyRecord[] = []
            let totalAvailable = 0
            const maxPerCluster = 200 // Cap per keyword cluster per state

            for (const source of SODA_SOURCES) {
              for (const cluster of KEYWORD_CLUSTERS) {
                yield* Effect.logInfo(
                  `[OpenData] ${source.state}: searching "${cluster.slice(0, 3).join(', ')}..."`
                )

                const result = yield* querySource(source, [...cluster], maxPerCluster).pipe(
                  Effect.catchAll((err) => {
                    return Effect.logWarning(`[OpenData] ${source.state} query failed: ${err.message}`).pipe(
                      Effect.map(() => ({
                        records: [] as HarvestCompanyRecord[],
                        totalAvailable: 0,
                        nextPage: null as number | null,
                      }))
                    )
                  })
                )

                allRecords.push(...result.records)
                totalAvailable += result.totalAvailable

                yield* Effect.sleep('300 millis') // Courtesy delay between queries
              }

              yield* Effect.sleep('1 second') // Between states
            }

            // Dedup by name (same company might match multiple clusters)
            const seen = new Set<string>()
            const deduped = allRecords.filter((r) => {
              const key = r.name.toLowerCase().trim()
              if (seen.has(key)) return false
              seen.add(key)
              return true
            })

            yield* Effect.logInfo(
              `[OpenData] Total: ${deduped.length} unique companies (${allRecords.length} before dedup) from ${SODA_SOURCES.length} states`
            )

            return { records: deduped, totalAvailable, nextPage: null }
          }),

        healthCheck: Effect.gen(function* () {
          const start = Date.now()
          return yield* Effect.tryPromise({
            try: async () => {
              const res = await fetch(`${SODA_SOURCES[0].endpoint}?$limit=1`)
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
