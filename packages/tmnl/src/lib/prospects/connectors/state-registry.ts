/**
 * Prospect Pipeline — State Business Registry Connector (SODA API)
 *
 * Queries state business registries via Socrata Open Data API.
 * Server-side SoQL filtering — no CSV downloads.
 * Free, no auth, no hard rate limits.
 *
 * KEY DESIGN:
 * - State sources are DATA, not code. Add a state = add a row.
 * - Search keywords are PARAMETERIZED, not hardcoded.
 * - Every harvested record carries provenance annotations linking
 *   back to the source, query, and dataset.
 *
 * @module prospects/connectors/state-registry
 */

import { Effect, Schema } from 'effect'
import type { SourceConnectorShape, FetchResult } from './interface'
import { ConnectorError } from './interface'
import { fetchJson } from './_http'
import type { HarvestCompanyRecord } from '../schemas/harvest'
import type { Industry } from '../schemas/domain'

// =============================================================================
// State Source Configuration — DATA, not code
// =============================================================================

/**
 * Schema for a single state data source.
 * Adding a state = adding one of these to the registry.
 */
export const StateSourceConfig = Schema.Struct({
  /** Short identifier (e.g., 'ny', 'ia', 'co') */
  id: Schema.String,
  /** Full state name */
  state: Schema.String,
  /** 2-letter code */
  stateCode: Schema.String,
  /** Socrata domain (e.g., 'data.ny.gov') */
  domain: Schema.String,
  /** Socrata dataset resource ID (e.g., 'n9v6-gdp6') */
  datasetId: Schema.String,
  /** Column containing the business/entity name */
  nameColumn: Schema.String,
  /** Column containing entity type (LLC, Corp, etc.) */
  typeColumn: Schema.optional(Schema.String),
  /** Column containing city */
  cityColumn: Schema.optional(Schema.String),
  /** Column containing state */
  stateColumn: Schema.optional(Schema.String),
  /** Column containing status (active, dissolved, etc.) */
  statusColumn: Schema.optional(Schema.String),
  /** Column containing filing/formation date */
  dateColumn: Schema.optional(Schema.String),
  /** Approximate total record count (for progress reporting) */
  estimatedRecords: Schema.optional(Schema.Number),
})
export type StateSourceConfig = typeof StateSourceConfig.Type

// =============================================================================
// The Registry — all 50 states (populated as verified)
// =============================================================================

/**
 * All verified state sources.
 * See docs/STATE_REGISTRY_FINDINGS.md for discovery methodology.
 *
 * 10 states verified via systematic probe of all 50 state Socrata portals.
 * ~4.3M total entities across all datasets.
 */
export const STATE_REGISTRY: ReadonlyArray<StateSourceConfig> = [
  // ─── Tier 1: Large states with rich schemas ────────────────────────
  {
    id: 'ny', state: 'New York', stateCode: 'NY',
    domain: 'data.ny.gov', datasetId: 'n9v6-gdp6',
    nameColumn: 'current_entity_name', typeColumn: 'entity_type',
    cityColumn: 'location_city', stateColumn: 'location_state',
    dateColumn: 'initial_dos_filing_date',
    estimatedRecords: 700_000,
  },
  {
    id: 'co', state: 'Colorado', stateCode: 'CO',
    domain: 'data.colorado.gov', datasetId: '4ykn-tg5h',
    nameColumn: 'entityname', typeColumn: 'entitytype',
    cityColumn: 'principalcity', stateColumn: 'principalstate',
    statusColumn: 'entitystatus',
    estimatedRecords: 1_200_000,
  },
  {
    id: 'or', state: 'Oregon', stateCode: 'OR',
    domain: 'data.oregon.gov', datasetId: 'tckn-sxa6',
    nameColumn: 'business_name', typeColumn: 'entity_type',
    cityColumn: 'city', stateColumn: 'state',
    // No statusColumn — dataset doesn't have one
    estimatedRecords: 500_000,
  },
  {
    id: 'wa', state: 'Washington', stateCode: 'WA',
    domain: 'data.wa.gov', datasetId: '5t5b-7yy4',
    nameColumn: 'businessname', typeColumn: undefined,
    cityColumn: 'city',
    estimatedRecords: 500_000,
  },
  {
    id: 'pa', state: 'Pennsylvania', stateCode: 'PA',
    domain: 'data.pa.gov', datasetId: 'xvd7-5r2c',
    nameColumn: 'business_name', typeColumn: 'typeofbusinessregistration',
    cityColumn: 'city',
    estimatedRecords: 400_000,
  },
  // ─── Tier 2: Medium states ─────────────────────────────────────────
  {
    id: 'ia', state: 'Iowa', stateCode: 'IA',
    domain: 'mydata.iowa.gov', datasetId: 'ez5t-3qay',
    nameColumn: 'legal_name', typeColumn: 'corporation_type',
    cityColumn: 'ho_city', stateColumn: 'ho_state',
    dateColumn: 'effective_date',
    estimatedRecords: 326_000,
  },
  {
    id: 'ct-master', state: 'Connecticut', stateCode: 'CT',
    domain: 'data.ct.gov', datasetId: 'n7gp-d28j',
    nameColumn: 'name',
    statusColumn: 'status',
    estimatedRecords: 300_000,
  },
  {
    id: 'de', state: 'Delaware', stateCode: 'DE',
    domain: 'data.delaware.gov', datasetId: '5zy2-grhr',
    nameColumn: 'business_name', typeColumn: 'category',
    cityColumn: 'city',
    estimatedRecords: 200_000,
  },
  // ─── Tier 3: Specialty datasets ────────────────────────────────────
  {
    id: 'wa-contractors', state: 'Washington (Contractors)', stateCode: 'WA',
    domain: 'data.wa.gov', datasetId: '4xk5-x9j6',
    nameColumn: 'businessname', typeColumn: 'contractorlicensetypecodedesc',
    estimatedRecords: 100_000,
  },
  {
    id: 'la-city', state: 'Los Angeles (City)', stateCode: 'CA',
    domain: 'data.lacity.org', datasetId: '6rrh-rzua',
    nameColumn: 'business_name',
    cityColumn: 'city',
    estimatedRecords: 500_000,
  },
]

// =============================================================================
// Search Query Schema — parameterized, not hardcoded
// =============================================================================

/**
 * A named search query with keywords and metadata.
 * These drive what we search for in each state registry.
 * The keywords themselves become provenance annotations.
 */
export const SearchQuery = Schema.Struct({
  /** Query identifier for provenance tracking */
  id: Schema.String,
  /** Human-readable description */
  label: Schema.String,
  /** Keywords to search via SoQL LIKE */
  keywords: Schema.Array(Schema.String),
  /** Industry hint for classification */
  industryHint: Schema.optional(Schema.String),
  /** Tags attached to harvested records */
  tags: Schema.optional(Schema.Array(Schema.String)),
})
export type SearchQuery = typeof SearchQuery.Type

/**
 * Default search queries. Override or extend via the API.
 */
export const DEFAULT_QUERIES: ReadonlyArray<SearchQuery> = [
  {
    id: 'conveyor-mh',
    label: 'Conveyor & Material Handling',
    keywords: ['CONVEYOR', 'MATERIAL HANDLING', 'SORTATION'],
    industryHint: 'logistics',
    tags: ['conveyor', 'material-handling'],
  },
  {
    id: 'automation-controls',
    label: 'Automation & Controls',
    keywords: ['AUTOMATION', 'CONTROLS', 'INSTRUMENTATION', 'PLC'],
    industryHint: 'manufacturing',
    tags: ['automation', 'controls'],
  },
  {
    id: 'scada-monitoring',
    label: 'SCADA & Monitoring',
    keywords: ['SCADA', 'TELEMETRY', 'MONITORING SYSTEM'],
    industryHint: 'energy',
    tags: ['scada', 'telemetry'],
  },
  {
    id: 'fabrication',
    label: 'Fabrication & Welding',
    keywords: ['FABRICATION', 'WELDING', 'MILLWRIGHT', 'STEEL ERECTION'],
    industryHint: 'manufacturing',
    tags: ['fabrication', 'welding'],
  },
  {
    id: 'mech-elec-contractor',
    label: 'Mechanical & Electrical Contractors',
    keywords: ['ELECTRICAL CONTRACTOR', 'MECHANICAL CONTRACTOR', 'PLUMBING CONTRACTOR'],
    industryHint: 'construction',
    tags: ['contractor', 'mep'],
  },
  {
    id: 'software-tech',
    label: 'Software & Technology',
    keywords: ['SOFTWARE', 'TECHNOLOGY SOLUTIONS', 'DIGITAL SERVICES', 'SYSTEMS INTEGRAT'],
    industryHint: 'other',
    tags: ['software', 'technology'],
  },
  {
    id: 'water-wastewater',
    label: 'Water & Wastewater',
    keywords: ['WATER TREATMENT', 'WASTEWATER', 'WATER SYSTEM', 'WATER UTILITY'],
    industryHint: 'water_wastewater',
    tags: ['water', 'wastewater'],
  },
  {
    id: 'food-bev',
    label: 'Food & Beverage Processing',
    keywords: ['FOOD PROCESSING', 'BEVERAGE', 'DAIRY', 'BAKERY', 'MEAT PROCESSING'],
    industryHint: 'food_beverage',
    tags: ['food', 'beverage'],
  },
  {
    id: 'specialty-trade',
    label: 'Specialty Trade',
    keywords: ['INSULATION', 'RIGGING', 'CRANE', 'SCAFFOLDING'],
    industryHint: 'construction',
    tags: ['specialty-trade'],
  },
  {
    id: 'engineering',
    label: 'Engineering Services',
    keywords: ['ENGINEERING SERVICE', 'CONSULTING ENGINEER', 'DESIGN BUILD'],
    industryHint: 'construction',
    tags: ['engineering'],
  },
]

// =============================================================================
// Industry Detection
// =============================================================================

const detectIndustry = (name: string, entityType: string, hint?: string): Industry => {
  if (hint && hint !== 'other') return hint as Industry

  const lower = (name + ' ' + entityType).toLowerCase()
  if (/conveyor|material handling|warehouse|logistics|freight/.test(lower)) return 'logistics'
  if (/construct|builder|contractor|plumb|electric.*contract|hvac|mechanical.*contract/.test(lower)) return 'construction'
  if (/manufactur|fabricat|machine|tool|die|weld|millwright/.test(lower)) return 'manufacturing'
  if (/water|wastewater|sewer|utility|irrigation/.test(lower)) return 'water_wastewater'
  if (/food|beverage|dairy|bakery|meat|poultry/.test(lower)) return 'food_beverage'
  if (/pharma|biotech|medical|health/.test(lower)) return 'healthcare'
  if (/energy|power|solar|wind/.test(lower)) return 'energy'
  if (/chemical|coating|adhesive/.test(lower)) return 'chemical'
  if (/farm|agriculture|grain/.test(lower)) return 'agriculture'
  if (/marine|ship|boat/.test(lower)) return 'maritime'
  if (/mining|quarry/.test(lower)) return 'mining'
  return 'other'
}

// =============================================================================
// Provenance Annotation — links back to source + query
// =============================================================================

interface HarvestProvenance {
  readonly sourceState: string
  readonly sourceDataset: string
  readonly sourceDomain: string
  readonly queryId: string
  readonly queryLabel: string
  readonly matchedKeyword: string
  readonly harvestedAt: string
}

// =============================================================================
// State Registry Connector — Effect.Service
// =============================================================================

export class StateRegistryConnector extends Effect.Service<StateRegistryConnector>()(
  'prospects/connectors/StateRegistry',
  {
    effect: Effect.gen(function* () {
      const sourceId = 'state_license' as const

      /**
       * Query a single state for a single search query.
       * Returns records with full provenance annotations.
       */
      const queryState = (
        state: StateSourceConfig,
        query: SearchQuery,
        limit: number = 200,
        offset: number = 0,
      ): Effect.Effect<FetchResult, ConnectorError> =>
        Effect.gen(function* () {
          const whereClauses = query.keywords.map(
            (kw) => `${state.nameColumn} like '%${kw}%'`
          )

          // Add status filter if column exists (exclude dissolved)
          let statusFilter = ''
          if (state.statusColumn) {
            statusFilter = ` AND (${state.statusColumn} not like '%Dissolved%' AND ${state.statusColumn} not like '%Inactive%' AND ${state.statusColumn} not like '%Revoked%')`
          }

          const where = `(${whereClauses.join(' OR ')})${statusFilter}`
          const url = `https://${state.domain}/resource/${state.datasetId}.json?$where=${encodeURIComponent(where)}&$limit=${limit}&$offset=${offset}&$order=${state.nameColumn}`

          const data = yield* fetchJson<Array<Record<string, string>>>(url, sourceId)

          const now = new Date().toISOString()
          const records: HarvestCompanyRecord[] = data.map((row) => {
            const name = (row[state.nameColumn] ?? '').trim()
            if (!name || name.length < 3) return null

            const entityType = state.typeColumn ? (row[state.typeColumn] ?? '') : ''
            const city = state.cityColumn ? row[state.cityColumn] : undefined
            const rowState = state.stateColumn ? row[state.stateColumn] : state.stateCode
            const hq = [city, rowState].filter(Boolean).join(', ')

            const provenance: HarvestProvenance = {
              sourceState: state.stateCode,
              sourceDataset: state.datasetId,
              sourceDomain: state.domain,
              queryId: query.id,
              queryLabel: query.label,
              matchedKeyword: query.keywords.find(kw =>
                name.toUpperCase().includes(kw)
              ) ?? query.keywords[0],
              harvestedAt: now,
            }

            return {
              name,
              industry: detectIndustry(name, entityType, query.industryHint),
              hq: hq || `${state.stateCode}, USA`,
              description: [
                entityType || undefined,
                `Registry: ${state.state}`,
              ].filter(Boolean).join('. '),
              tags: [
                'state-registry',
                state.stateCode.toLowerCase(),
                ...(query.tags ?? []),
              ],
              notes: JSON.stringify(provenance),
              signals: [{
                type: 'manual_observation' as const,
                title: `${state.state} registry: ${query.label}`,
                description: `Matched "${provenance.matchedKeyword}" in ${state.state} business registry (${state.domain}/${state.datasetId})`,
                weight: 1,
              }],
            } satisfies HarvestCompanyRecord
          }).filter((r): r is HarvestCompanyRecord => r !== null)

          return {
            records,
            totalAvailable: data.length >= limit ? limit * 5 : data.length,
            nextPage: data.length >= limit ? offset + limit : null,
          }
        })

      // ─── Public interface ──────────────────────────────────────────

      const connector: SourceConnectorShape = {
        sourceId,
        displayName: 'State Business Registries (SODA API)',

        /**
         * Single fetch — one state, one query.
         * @param params.category — state id (e.g., 'ny', 'co')
         * @param params.query — raw keyword or query id
         */
        fetch: (params) => {
          const state = STATE_REGISTRY.find((s) => s.id === params.category) ?? STATE_REGISTRY[0]
          const query = params.query
            ? DEFAULT_QUERIES.find((q) => q.id === params.query) ??
              { id: 'custom', label: params.query, keywords: [params.query.toUpperCase()], tags: ['custom'] }
            : DEFAULT_QUERIES[0]
          return queryState(state, query, params.limit ?? 200, (params.page ?? 0) * (params.limit ?? 200))
        },

        /**
         * Full sweep — all states × all queries.
         *
         * Parallelization strategy:
         * - States run with concurrency 3 (each hits a DIFFERENT Socrata domain)
         * - Queries within a state run serially (same domain, be polite)
         * - 100ms delay between queries on same domain
         *
         * @param params.maxPages — max records per query per state (default 200)
         */
        fetchAll: (params) =>
          Effect.gen(function* () {
            const maxPerQuery = params.maxPages ?? 200
            const queries = params.query
              ? [DEFAULT_QUERIES.find((q) => q.id === params.query) ??
                 { id: 'custom', label: params.query, keywords: [params.query.toUpperCase()], tags: ['custom'] }]
              : DEFAULT_QUERIES

            yield* Effect.logInfo(
              `[StateRegistry] Sweeping ${STATE_REGISTRY.length} states × ${queries.length} queries (concurrency: 5 states)`
            )

            // Harvest one state (serial queries within)
            const harvestOneState = (state: StateSourceConfig) =>
              Effect.gen(function* () {
                const stateRecords: HarvestCompanyRecord[] = []
                let stateTotal = 0

                yield* Effect.logInfo(`[StateRegistry] ▶ ${state.state} (${state.stateCode})`)

                for (const query of queries) {
                  const result = yield* queryState(state, query, maxPerQuery).pipe(
                    Effect.catchAll((err) =>
                      Effect.logWarning(`[StateRegistry] ${state.stateCode}/${query.id} failed: ${err.message}`).pipe(
                        Effect.map(() => ({ records: [] as HarvestCompanyRecord[], totalAvailable: 0, nextPage: null as number | null }))
                      )
                    )
                  )
                  stateRecords.push(...result.records)
                  stateTotal += result.totalAvailable
                  yield* Effect.sleep('100 millis') // Polite delay between queries on same domain
                }

                yield* Effect.logInfo(
                  `[StateRegistry] ✓ ${state.stateCode}: ${stateRecords.length} records`
                )
                return { records: stateRecords, totalAvailable: stateTotal }
              })

            // Run states with bounded parallelism — 3 concurrent (different domains)
            const stateResults = yield* Effect.forEach(
              STATE_REGISTRY,
              harvestOneState,
              { concurrency: 5 }
            )

            // Flatten + dedup
            const allRecords = stateResults.flatMap((r) => r.records)
            const totalAvailable = stateResults.reduce((sum, r) => sum + r.totalAvailable, 0)

            const seen = new Set<string>()
            const deduped = allRecords.filter((r) => {
              const key = r.name.toLowerCase().trim()
              if (seen.has(key)) return false
              seen.add(key)
              return true
            })

            yield* Effect.logInfo(
              `[StateRegistry] Total: ${deduped.length} unique (${allRecords.length} raw) from ${STATE_REGISTRY.length} states`
            )

            return { records: deduped, totalAvailable, nextPage: null }
          }),

        healthCheck: Effect.gen(function* () {
          const start = Date.now()
          const source = STATE_REGISTRY[0]
          return yield* Effect.tryPromise({
            try: async () => {
              const res = await fetch(`https://${source.domain}/resource/${source.datasetId}.json?$limit=1`)
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
