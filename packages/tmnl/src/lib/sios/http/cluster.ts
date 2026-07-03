/**
 * SIOS Cluster Configuration
 *
 * Provides dev and prod cluster layers for the HTTP server.
 *
 * - ClusterDev: In-memory cluster via TestRunner (zero dependencies)
 * - ClusterProd: Bun-native HTTP cluster via BunClusterHttp (requires SqlClient)
 *
 * @module sios/http/cluster
 */

import { TestRunner } from '@effect/cluster'
import { BunClusterHttp } from '@effect/platform-bun'

// =============================================================================
// Dev Cluster — In-Memory, Zero Dependencies
// =============================================================================

/**
 * In-memory cluster layer for local development.
 *
 * TestRunner.layer provides in-memory cluster services,
 * including sharding + sharding config defaults.
 */
export const ClusterDev = TestRunner.layer

// =============================================================================
// Prod Cluster — Bun HTTP Transport with SQL Storage
// =============================================================================

export const ClusterProd = BunClusterHttp.layer({
  transport: 'http',
  storage: 'sql',
  serialization: 'msgpack',
})
