// =============================================================================
// GEOINT - Geospatial Intelligence Library
// =============================================================================
//
// Provides GEOINT capabilities for TMNL including ALLINT COP:
// - Track intelligence (IntelClient)
// - Vector features (FeatureClient)
// - Tile and imagery (GeospatialClient)
// - ALLINT Search (SearchClient, SearchService)
// - External APIs (OpenSky, Overpass)
// - PostGIS persistence
// - Effect Cluster distributed search
//
// @see beads:tmnl-j5pyc ALLINT COP Search System
// =============================================================================

// Schemas - Domain types with Effect Schema
export * from './schemas'

// Clients - AtomRpc.Tag RPC clients
export * from './clients'

// Services - Effect services with atom properties
export * from './services'

// Layers - Deck.gl layer factories
export * from './layers'

// API - HttpApi definitions and external API clients
export * from './api'

// NOTE: Server-only modules NOT exported from barrel to prevent browser bundle contamination
// ─────────────────────────────────────────────────────────────────────────────
// These modules use @effect/sql-pg and other Node.js-only dependencies.
// Import them directly when needed in server-side code:
//
//   import { ... } from '@/lib/geoint/cluster'        // Effect Cluster nodes
//   import { ... } from '@/lib/geoint/persistence'    // PostGIS + Materializers
//   import { ... } from '@/lib/geoint/server'         // RPC handlers
//   import { ... } from '@/lib/geoint/ingestion'      // Data ingesters
//
// See: assets/documents/GEOINT_VERTICAL_SLICE_ARCHITECTURE.md
// ─────────────────────────────────────────────────────────────────────────────

// Components - Map components with Mapbox integration (browser-safe)
export * from './components'

// Workspace - Persistence for workspace state (viewport, layers, filters)
export * from './workspace'

// Machines - XState machines and providers
export * from './machines'

// Animation - Effect-based animation orchestration
export * from './animation'

// Streaming - Real-time data integration
export * from './streaming'

// Harness - tool/runtime orchestration service
export * from './harness'
