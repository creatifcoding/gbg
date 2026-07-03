/**
 * Prospect Pipeline — Web Scraper Connector
 *
 * General-purpose HTML scraper for sources without APIs.
 * Uses web search as a proxy — searches for companies in target categories
 * and extracts structured data from result snippets + page content.
 *
 * Targets:
 * - Thomasnet category pages
 * - ENR published lists
 * - Trade show exhibitor pages
 * - ABC/AGC member directories
 * - State contractor license registries
 *
 * Strategy: Use search engine results as a structured proxy
 * rather than parsing unpredictable HTML structures.
 *
 * @module prospects/connectors/web-scraper
 */

import { Effect } from 'effect'
import type { SourceConnectorShape, FetchResult } from './interface'
import { ConnectorError } from './interface'
import { fetchJson } from './_http'
import type { HarvestCompanyRecord } from '../schemas/harvest'
import type { Industry, HarvestSource } from '../schemas/domain'

// =============================================================================
// Scrape Target Definitions
// =============================================================================

export interface ScrapeTarget {
  readonly id: string
  readonly source: HarvestSource
  readonly displayName: string
  readonly searchQueries: ReadonlyArray<string>
  readonly industry: Industry
  readonly tags: ReadonlyArray<string>
}

/**
 * Pre-defined scrape targets — each one becomes a fetchAll query set.
 */
export const SCRAPE_TARGETS: ReadonlyArray<ScrapeTarget> = [
  {
    id: 'thomasnet-conveyor',
    source: 'thomasnet',
    displayName: 'Thomasnet: Conveyor Installation',
    searchQueries: [
      'site:thomasnet.com conveyor installation services',
      'site:thomasnet.com material handling equipment installation',
      'site:thomasnet.com machinery installation contractors',
    ],
    industry: 'construction',
    tags: ['thomasnet', 'conveyor', 'material-handling'],
  },
  {
    id: 'thomasnet-scada',
    source: 'thomasnet',
    displayName: 'Thomasnet: SCADA / Systems Integrators',
    searchQueries: [
      'site:thomasnet.com SCADA systems integrators',
      'site:thomasnet.com industrial automation systems integrators',
      'site:thomasnet.com PLC programming services',
    ],
    industry: 'manufacturing',
    tags: ['thomasnet', 'scada', 'systems-integrator'],
  },
  {
    id: 'enr-top-contractors',
    source: 'enr_list',
    displayName: 'ENR: Top Contractors',
    searchQueries: [
      'ENR top 400 contractors 2025 list company revenue',
      'ENR top 100 construction management firms 2025',
      'Engineering News-Record specialty contractors 2025 ranking',
    ],
    industry: 'construction',
    tags: ['enr', 'top-list', 'ranked'],
  },
  {
    id: 'trade-show-modex',
    source: 'trade_show',
    displayName: 'Trade Shows: MODEX / ProMat / FABTECH',
    searchQueries: [
      'MODEX 2026 exhibitor list material handling company',
      'ProMat 2025 exhibitor list logistics automation',
      'FABTECH 2025 exhibitor list welding fabrication automation',
    ],
    industry: 'logistics',
    tags: ['trade-show', 'exhibitor'],
  },
  {
    id: 'abc-agc-members',
    source: 'abc_directory',
    displayName: 'ABC/AGC: Contractor Associations',
    searchQueries: [
      'Associated Builders Contractors member company directory',
      'Associated General Contractors member directory technology',
      'ABC chapter member electrical mechanical contractor',
    ],
    industry: 'construction',
    tags: ['association', 'member-directory'],
  },
  {
    id: 'water-wastewater-utilities',
    source: 'industry_pub',
    displayName: 'Water/Wastewater: Utilities & Contractors',
    searchQueries: [
      'water wastewater utility SCADA upgrade company 2025 2026',
      'WEFTEC exhibitor list water technology company',
      'municipal water system modernization contractor',
    ],
    industry: 'water_wastewater',
    tags: ['water', 'wastewater', 'utility'],
  },
  {
    id: 'food-bev-automation',
    source: 'industry_pub',
    displayName: 'Food & Beverage: Automation Companies',
    searchQueries: [
      'food beverage manufacturing automation company hiring 2025 2026',
      'dairy processing plant automation contractor',
      'food safety compliance software company mid-market',
    ],
    industry: 'food_beverage',
    tags: ['food', 'beverage', 'automation'],
  },
]

// =============================================================================
// Web Scraper Connector — Effect.Service
//
// Uses SEC EDGAR-style fetchJson against a search proxy.
// Since we can't call Google without API keys, this connector
// fetches HTML from known directory pages and extracts companies.
// =============================================================================

export class WebScraperConnector extends Effect.Service<WebScraperConnector>()(
  'prospects/connectors/WebScraper',
  {
    effect: Effect.gen(function* () {

      /**
       * Fetch a single scrape target by fetching the Thomasnet/directory URL
       * and extracting company names from the HTML.
       */
      const fetchTarget = (target: ScrapeTarget, page: number = 0): Effect.Effect<
        FetchResult, ConnectorError
      > =>
        Effect.gen(function* () {
          // For now, we extract from known Thomasnet category URLs directly
          const records: HarvestCompanyRecord[] = []

          // Thomasnet category pages have a known URL structure
          if (target.source === 'thomasnet') {
            // Fetch the Thomasnet category page HTML
            const categoryUrls: Record<string, string> = {
              'thomasnet-conveyor': 'https://www.thomasnet.com/suppliers/usa/conveyor-installation-services-19241108',
              'thomasnet-scada': 'https://www.thomasnet.com/suppliers/usa/supervisory-control-data-acquisition-scada-systems-70991005',
            }

            const url = categoryUrls[target.id]
            if (url) {
              const html = yield* Effect.tryPromise({
                try: () => fetch(url, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; TMNL-Pipeline/1.0)',
                    'Accept': 'text/html',
                  },
                }).then(r => r.text()),
                catch: (err) => new ConnectorError({
                  sourceId: target.source,
                  message: `Failed to fetch ${url}: ${err}`,
                  retryable: true,
                }),
              })

              // Extract company names from Thomasnet HTML
              // Thomasnet uses data-company attributes and h2 company headings
              const companyMatches = html.matchAll(/<h2[^>]*class="[^"]*profile-card__title[^"]*"[^>]*>([^<]+)<\/h2>/gi)
              for (const match of companyMatches) {
                const name = match[1].trim()
                if (name && name.length > 2 && name.length < 200) {
                  records.push({
                    name,
                    industry: target.industry,
                    tags: [...target.tags],
                    signals: [{
                      type: 'manual_observation' as const,
                      title: `Listed on ${target.displayName}`,
                      description: `Found in Thomasnet category directory`,
                      sourceUrl: url,
                      weight: 1,
                    }],
                  })
                }
              }

              // Fallback: look for any reasonable company-name-like patterns
              if (records.length === 0) {
                const altMatches = html.matchAll(/data-(?:company|supplier)(?:-name)?="([^"]+)"/gi)
                for (const match of altMatches) {
                  const name = match[1].trim()
                  if (name && name.length > 2 && name.length < 200) {
                    records.push({
                      name,
                      industry: target.industry,
                      tags: [...target.tags],
                    })
                  }
                }
              }
            }
          }

          return {
            records,
            totalAvailable: records.length,
            nextPage: null, // Single page per target for now
          }
        })

      const connector: SourceConnectorShape = {
        sourceId: 'thomasnet' as const,
        displayName: 'Web Scraper (Thomasnet, ENR, Trade Shows)',

        fetch: (params) => {
          const target = SCRAPE_TARGETS.find(t => t.id === params.category) ?? SCRAPE_TARGETS[0]
          return fetchTarget(target, params.page ?? 0)
        },

        fetchAll: (params) =>
          Effect.gen(function* () {
            const allRecords: HarvestCompanyRecord[] = []
            const targets = params.category
              ? SCRAPE_TARGETS.filter(t => t.id === params.category)
              : SCRAPE_TARGETS.filter(t => t.source === 'thomasnet') // Start with Thomasnet

            for (const target of targets) {
              yield* Effect.logInfo(`[WebScraper] Fetching target: ${target.displayName}`)
              const result = yield* fetchTarget(target).pipe(
                Effect.catchAll((err) => {
                  return Effect.logWarning(`[WebScraper] Failed: ${target.id} — ${err.message}`).pipe(
                    Effect.map(() => ({ records: [] as HarvestCompanyRecord[], totalAvailable: 0, nextPage: null as number | null }))
                  )
                })
              )
              allRecords.push(...result.records)
              yield* Effect.sleep('2 seconds') // Polite delay between targets
            }

            return { records: allRecords, totalAvailable: allRecords.length, nextPage: null }
          }),

        healthCheck: Effect.gen(function* () {
          const start = Date.now()
          return yield* Effect.tryPromise({
            try: async () => {
              const res = await fetch('https://www.thomasnet.com', {
                method: 'HEAD',
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
              })
              return {
                healthy: res.ok || res.status === 403, // Thomasnet may 403 HEAD but still works for GET
                latencyMs: Date.now() - start,
                lastSuccessAt: new Date().toISOString(),
              }
            },
            catch: (err) => new ConnectorError({ sourceId: 'thomasnet', message: String(err), retryable: true }),
          })
        }),
      }

      return connector
    }),
  }
) {}
