/**
 * IIoT HTTP Health Check
 *
 * Simple health endpoint for liveness probes and monitoring.
 * Used when the server is composed with HttpLayerRouter (dual REST + RPC mode).
 *
 * @module @gbg/tmnl/iiot/http/health
 */

import { HttpServerResponse } from '@effect/platform'
import { Effect } from 'effect'

export const healthCheck = Effect.sync(() =>
  HttpServerResponse.json({ status: 'ok', timestamp: Date.now() })
)
