/**
 * SIOS Query HttpApiGroups
 *
 * @module sios/http/query-api
 */

import { HttpApiEndpoint, HttpApiGroup } from '@effect/platform'
import { Schema } from 'effect'

const SiosHealthResponse = Schema.Struct({
  status: Schema.Literal('ok'),
  entities: Schema.Literal(8),
  version: Schema.Literal('1.0.0'),
})

const SiosHealthEndpoint = HttpApiEndpoint.get('health', '/health')
  .addSuccess(SiosHealthResponse)

/**
 * Health query group.
 *
 * When prefixed with /api/sios in SiosApi, serves:
 *   GET /api/sios/health
 */
export const SiosHealthQueryGroup = HttpApiGroup.make('sios-health')
  .add(SiosHealthEndpoint)
