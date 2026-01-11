/**
 * ECS - Canonical Entity System
 *
 * Coordination layer for multi-source entity fusion.
 * Provides ONLY the primitives for identity, provenance, and fusion.
 * Domain modules define their own entity schemas and traits.
 *
 * ECS provides:
 * - EntityId: Type-prefixed UUID generation
 * - Provenance: Multi-source lineage with confidence scoring
 * - Staleness: TTL-based freshness tracking
 * - Fusion: Merge same entity from multiple sources
 *
 * Domain modules (GEOINT, etc.) provide:
 * - Domain entities (FlightEntity, PoiEntity, etc.)
 * - Domain-specific traits (position, kinetic, callsign, etc.)
 *
 * Sync via ElectricSQL:
 * - Postgres (source of truth) → Electric → Local SQLite → React
 * - Writes: Effect services → Postgres → Electric syncs out
 *
 * @module ecs
 */

// Core schemas (identity, provenance, primitives)
export * from './schemas'

// Services (EntityIdService, etc.)
export * from './services'

// Persistence (migrations)
export * from './persistence'

// Base entity (coordination primitives)
export * from './entities'

// Electric sync (real-time Postgres → client)
export * from './electric'
