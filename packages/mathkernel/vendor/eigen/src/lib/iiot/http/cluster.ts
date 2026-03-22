/**
 * IIoT Cluster Configuration
 *
 * Provides dev and prod cluster layers for the HTTP server.
 *
 * - **ClusterDev**: In-memory cluster via TestRunner (zero dependencies)
 * - **ClusterProd**: Bun-native HTTP cluster via BunClusterHttp (requires SqlClient)
 *
 * @module @gbg/tmnl/iiot/http/cluster
 */

import { TestRunner } from '@effect/cluster'
import { BunClusterHttp } from '@effect/platform-bun'

// =============================================================================
// Dev Cluster — In-Memory, Zero Dependencies
// =============================================================================

/**
 * In-memory cluster layer for local development.
 *
 * Uses TestRunner which provides:
 * - In-memory MessageStorage
 * - In-memory RunnerStorage
 * - No external infrastructure required
 *
 * Suitable for `bun run` / `tauri:dev` workflows.
 */
export const ClusterDev = TestRunner.layer

// =============================================================================
// Prod Cluster — Bun HTTP Transport with SQL Storage
// =============================================================================

/**
 * Production cluster layer using Bun-native HTTP transport.
 *
 * Uses BunClusterHttp which provides:
 * - HTTP-based runner communication
 * - SQL-backed storage (requires SqlClient)
 * - msgpack serialization for efficient wire format
 *
 * Requires SqlClient to be provided (e.g. via @effect/sql-pg).
 *
 * @example
 * ```typescript
 * import { SqlClient } from '@effect/sql'
 * import { PgClient } from '@effect/sql-pg'
 *
 * const server = IIoTHttpServerProd.pipe(
 *   Layer.provide(ClusterProd),
 *   Layer.provide(PgClient.layer({ /* connection config *\/ }))
 * )
 * ```
 */
export const ClusterProd = BunClusterHttp.layer({
  transport: 'http',
  storage: 'sql',
  serialization: 'msgpack'
})
