/**
 * SIOS Query Endpoint Handlers
 *
 * @module sios/http/query-handlers
 */

import { HttpApiBuilder } from '@effect/platform'
import { Effect } from 'effect'
import { SiosApi } from './api'

export const QueryHandlers = HttpApiBuilder.group(
  SiosApi,
  'sios-health',
  (handlers) =>
    handlers.handle('health', () =>
      Effect.succeed({
        status: 'ok' as const,
        entities: 8 as const,
        version: '1.0.0' as const,
      })
    )
)
