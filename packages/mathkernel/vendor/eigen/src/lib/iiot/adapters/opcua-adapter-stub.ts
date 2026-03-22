/**
 * OPC-UA Adapter Stub
 *
 * Placeholder for the OPC-UA ingestion adapter.
 * Will be implemented when OPC-UA integration is prioritized.
 *
 * @module @gbg/tmnl/iiot/adapters/opcua-adapter-stub
 */

import { Effect, Layer } from 'effect'
import { IngestionAdapter } from './ingestion'

/**
 * Stub OPC-UA adapter that fails with a "not implemented" error.
 *
 * Usage: import to satisfy type requirements in pipeline composition
 * before the real OPC-UA adapter is built.
 */
export const OpcUaAdapterStub: Layer.Layer<IngestionAdapter> = Layer.succeed(
  IngestionAdapter,
  {
    protocol: 'opcua',
    subscribe: Effect.die('OPC-UA adapter not yet implemented'),
    healthCheck: Effect.die('OPC-UA adapter not yet implemented'),
  },
)
