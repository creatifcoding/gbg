/**
 * Prospect Pipeline — Cluster Configuration
 *
 * Dev: TestRunner.layer (in-memory, zero dependencies beyond PG for SQL)
 * Prod: BunClusterHttp.layer (HTTP transport, SQL storage)
 *
 * Mirrors IIoT http/cluster.ts
 *
 * @module prospects/cluster/cluster
 */

import { TestRunner } from '@effect/cluster'
import { BunClusterHttp } from '@effect/platform-bun'

export const ClusterDev = TestRunner.layer

export const ClusterProd = BunClusterHttp.layer({
  transport: 'http',
  storage: 'sql',
  serialization: 'msgpack',
})
