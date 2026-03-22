/**
 * Search RPC Server
 *
 * WebSocket RPC server for GEOINT search operations.
 * Uses the existing SearchRpcServerLayer which directly implements
 * SearchClient handlers with external API integration.
 *
 * For Effect Cluster deployment (Docker/Kubernetes), see:
 *   src/lib/geoint/cluster/SearchEntity.ts       - Entity definition
 *   src/lib/geoint/cluster/SearchEntityHandlers.ts - Sharded handlers
 *
 * Usage: bun run search:server
 *
 * Environment Variables:
 *   SEARCH_SERVER_PORT (default: 8080)
 *   SEARCH_SERVER_HOST (default: 127.0.0.1)
 *   OPENSKY_USERNAME (optional: for authenticated API access)
 *   OPENSKY_PASSWORD (optional: for authenticated API access)
 *
 * @see beads:tmnl-0mudi RPC Server Bridge
 */

import { Effect, Layer } from 'effect'
import { HttpLayerRouter } from '@effect/platform'
import { BunHttpServer, BunContext, BunRuntime } from '@effect/platform-bun'
import { SearchRpcServerLayer } from '../src/lib/geoint/server/SearchRpcServer'

// =============================================================================
// Configuration
// =============================================================================

const PORT = parseInt(process.env.SEARCH_SERVER_PORT ?? '8081', 10)
const HOST = process.env.SEARCH_SERVER_HOST ?? '127.0.0.1'

// =============================================================================
// Server Layer
// =============================================================================

/**
 * Full server layer stack
 *
 * Uses HttpLayerRouter.serve() pattern for proper WebSocket integration:
 *
 * 1. SearchRpcServerLayer - Provides RPC handlers + WebSocket protocol
 *    via RpcServer.layerProtocolWebsocketRouter at /geoint/search
 * 2. HttpLayerRouter.serve() - Serves all registered routes
 * 3. BunHttpServer - HTTP/WebSocket transport with upgrade handling
 *
 * The RpcServer.layerProtocolWebsocketRouter adds the WebSocket endpoint
 * to the HttpLayerRouter, which is then served by BunHttpServer.
 */
const ServerLive = HttpLayerRouter.serve(SearchRpcServerLayer).pipe(
  Layer.provide(BunHttpServer.layer({ port: PORT, hostname: HOST })),
  Layer.provide(BunContext.layer)
)

// =============================================================================
// Startup Banner
// =============================================================================

const printBanner = Effect.sync(() => {
  const hasOpenSkyAuth = !!process.env.OPENSKY_USERNAME
  const wsUrl = `ws://${HOST}:${PORT}/geoint/search`

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║               GEOINT SEARCH RPC SERVER (Effect)                ║
╠═══════════════════════════════════════════════════════════════╣
║  Port:           ${String(PORT).padEnd(44)}║
║  Host:           ${HOST.padEnd(44)}║
║  WebSocket:      ${wsUrl.slice(0, 44).padEnd(44)}║
║  OpenSky Auth:   ${(hasOpenSkyAuth ? 'Configured' : 'Anonymous').padEnd(44)}║
╚═══════════════════════════════════════════════════════════════╝

📡 WebSocket RPC Endpoint:
   ${wsUrl}

   Methods:
   • search(query)           - Multi-source search
   • streamSearch(query)     - Streaming search results
   • searchNearby(params)    - Radius-based search
   • searchInBounds(params)  - Bounds-based search
   • queryOpenSky(params)    - Direct OpenSky API
   • queryOverpass(params)   - Direct Overpass API
   • saveSearch(params)      - Save search query
   • listSavedSearches()     - List saved searches
   • executeSavedSearch(id)  - Execute saved search
   • getSearchHistory()      - Get search history

🌐 Data Sources:
   • OpenSky Network  - Live ADS-B flight data
   • Overpass API     - OpenStreetMap POIs
   • PostGIS Tracks   - Internal track positions (if configured)
   • PostGIS Features - Static vector features (if configured)
   • Planet Labs      - Satellite imagery (if configured)
   • Sentinel Hub     - Copernicus data (if configured)
   • Open-Meteo       - Weather data

🔧 For Effect Cluster (Docker/K8s) deployment:
   See src/lib/geoint/cluster/ for sharded entity handlers.
   EntityProxy.toRpcGroup(SearchEntity) for cluster RPC exposure.

🔗 Client Connection:
   import { SearchClient } from './lib/geoint/clients'

   const client = yield* SearchClient
   const results = yield* client('search', query)
`)
})

// =============================================================================
// Main
// =============================================================================

const main = Effect.gen(function* () {
  yield* printBanner
  yield* Effect.log(`Starting GEOINT search server on http://${HOST}:${PORT}`)
  yield* Layer.launch(ServerLive)
})

// =============================================================================
// Run
// =============================================================================

BunRuntime.runMain(main)
