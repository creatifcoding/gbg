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

// Cluster - Effect Cluster for distributed search
export * from './cluster'

// Components - Map components with Mapbox integration
export * from './components'

// Persistence - Durable stream storage and PostGIS
export * from './persistence'

// Server - RPC server handlers for SearchClient
export * from './server'

// Workspace - Persistence for workspace state (viewport, layers, filters)
export * from './workspace'

// Machines - XState machines and providers
export * from './machines'

// Animation - Effect-based animation orchestration
export * from './animation'

// Streaming - Real-time data integration
export * from './streaming'
