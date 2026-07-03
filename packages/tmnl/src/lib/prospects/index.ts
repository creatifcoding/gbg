/**
 * Prospect Pipeline — Public API
 *
 * CIP-scored prospect discovery and outreach management.
 * Graph of peers: Company, DecisionMaker, Signal, Proposal, Outreach.
 *
 * Entities: Effect Cluster Entity definitions with typed RPCs.
 * RPCs: EntityProxy-derived, mountable as RPC server or HTTP API.
 * Services: CIP scoring, harvest ingestion, repositories.
 * Models: SQLite persistence with JSON column transforms.
 * Schemas: Branded IDs, value objects, domain types.
 *
 * @module prospects
 */

export * from './schemas'
export * from './models'
export * from './services'
export * from './entity'
export * from './rpc'
export * from './api'
