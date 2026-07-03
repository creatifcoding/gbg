/**
 * Prospect Pipeline — Connector Exports
 * @module prospects/connectors
 */

export type { SourceConnectorShape, FetchResult, HealthStatus } from './interface'
export { ConnectorError, ConnectorRateLimitError, ConnectorAuthError, connectorRetryPolicy, connectorTimeout } from './interface'
export { fetchJson, paginateAll } from './_http'
export { JobPostingConnector } from './job-postings'
export { CrunchbaseConnector } from './crunchbase'
export { SECEdgarConnector } from './sec-edgar'
export { USASpendingConnector } from './usa-spending'
export { WebScraperConnector, SCRAPE_TARGETS } from './web-scraper'
export { OpenDataConnector } from './open-data'
export { StateRegistryConnector, STATE_REGISTRY, DEFAULT_QUERIES } from './state-registry'
export type { StateSourceConfig, SearchQuery } from './state-registry'
