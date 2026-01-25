/**
 * Ingestion RPC Server
 *
 * WebSocket RPC server for GEOINT ingestion operations.
 * Handles on-demand data ingestion: flights, POI, weather, imagery.
 *
 * For Effect Cluster deployment (Docker/Kubernetes), see:
 *   src/lib/geoint/cluster/IngestionEntity.ts       - Entity definition
 *   src/lib/geoint/cluster/IngestionEntityHandlers.ts - Sharded handlers
 *
 * Usage: bun run ingestion:server
 *
 * Environment Variables:
 *   INGESTION_SERVER_PORT (default: 8082)
 *   INGESTION_SERVER_HOST (default: 127.0.0.1)
 *   OPENSKY_USERNAME (optional: for authenticated API access)
 *   OPENSKY_PASSWORD (optional: for authenticated API access)
 *   DURABLE_STREAMS_URL (optional: for event publishing)
 *
 * @see beads:tmnl-vertical-slice ECS Vertical Slice Integration
 */

import { Effect, Layer } from 'effect'
import { HttpLayerRouter } from '@effect/platform'
import { BunHttpServer, BunContext, BunRuntime } from '@effect/platform-bun'
import { IngestionRpcServerLayer } from '../src/lib/geoint/server/IngestionRpcServer'

// =============================================================================
// Configuration
// =============================================================================

const PORT = parseInt(process.env.INGESTION_SERVER_PORT ?? '8082', 10)
const HOST = process.env.INGESTION_SERVER_HOST ?? '127.0.0.1'

// =============================================================================
// Server Layer
// =============================================================================

/**
 * Full server layer stack
 *
 * Uses HttpLayerRouter.serve() pattern for proper WebSocket integration:
 *
 * 1. IngestionRpcServerLayer - Provides RPC handlers + WebSocket protocol
 *    via RpcServer.layerProtocolWebsocketRouter at /geoint/ingestion
 * 2. HttpLayerRouter.serve() - Serves all registered routes
 * 3. BunHttpServer - HTTP/WebSocket transport with upgrade handling
 *
 * The RpcServer.layerProtocolWebsocketRouter adds the WebSocket endpoint
 * to the HttpLayerRouter, which is then served by BunHttpServer.
 */
const ServerLive = HttpLayerRouter.serve(IngestionRpcServerLayer).pipe(
  Layer.provide(BunHttpServer.layer({ port: PORT, hostname: HOST })),
  Layer.provide(BunContext.layer)
)

// =============================================================================
// Startup Banner
// =============================================================================

const printBanner = Effect.sync(() => {
  const hasOpenSkyAuth = !!process.env.OPENSKY_USERNAME
  const hasDurableStreams = !!process.env.DURABLE_STREAMS_URL
  const wsUrl = `ws://${HOST}:${PORT}/geoint/ingestion`

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║             GEOINT INGESTION RPC SERVER (Effect)              ║
╠═══════════════════════════════════════════════════════════════╣
║  Port:             ${String(PORT).padEnd(42)}║
║  Host:             ${HOST.padEnd(42)}║
║  WebSocket:        ${wsUrl.slice(0, 42).padEnd(42)}║
║  OpenSky Auth:     ${(hasOpenSkyAuth ? 'Configured' : 'Anonymous').padEnd(42)}║
║  DurableStreams:   ${(hasDurableStreams ? 'Configured' : 'Disabled').padEnd(42)}║
╚═══════════════════════════════════════════════════════════════╝

📡 WebSocket RPC Endpoint:
   ${wsUrl}

   Methods:
   • ingestFlightByIcao(icao24, source)     - Single flight ingestion
   • ingestFlightsByRegion(region, bounds)  - Regional flight ingestion
   • ingestPoiByRegion(region, bounds)      - POI ingestion (Overpass)
   • ingestWeatherByGrid(grid, bounds)      - Weather grid ingestion
   • ingestWeatherByPoint(lat, lon)         - Weather point ingestion
   • ingestImageryByRegion(region, bounds)  - Satellite imagery ingestion
   • startIngestion()                       - Start background orchestrator
   • stopIngestion()                        - Stop background orchestrator
   • getIngestionStatus()                   - Get orchestrator status
   • startIngester(name)                    - Start specific ingester
   • stopIngester(name)                     - Stop specific ingester

🌐 Data Sources:
   • OpenSky Network  - Live ADS-B flight data
   • ADSB.lol         - Alternative flight data (faster single-aircraft)
   • Overpass API     - OpenStreetMap POIs
   • Open-Meteo       - Weather observations and forecasts
   • Planet Labs      - High-resolution satellite imagery
   • Sentinel Hub     - Copernicus/Sentinel imagery

📊 Data Flow:
   External APIs → Ingesters → PostgreSQL → DurableStreams → Electric → Atoms → UI

🔧 For Effect Cluster (Docker/K8s) deployment:
   See src/lib/geoint/cluster/ for sharded entity handlers.
   EntityProxy.toRpcGroup(IngestionEntity) for cluster RPC exposure.

🔗 Client Connection:
   import { IngestionClient } from './lib/geoint/clients'

   const client = yield* IngestionClient
   const result = yield* client('ingestFlightByIcao', { icao24: 'abc123', source: 'adsb_lol' })
`)
})

// =============================================================================
// Main
// =============================================================================

const main = Effect.gen(function* () {
  yield* printBanner
  yield* Effect.log(`Starting GEOINT ingestion server on http://${HOST}:${PORT}`)
  yield* Layer.launch(ServerLive)
})

// =============================================================================
// Run
// =============================================================================

BunRuntime.runMain(main)
