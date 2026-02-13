/**
 * Modbus Adapter Stub
 *
 * Placeholder for the Modbus ingestion adapter.
 * Will be implemented when Modbus integration is prioritized.
 *
 * @module @gbg/tmnl/iiot/adapters/modbus-adapter-stub
 */

import { Effect, Layer } from 'effect'
import { IngestionAdapter } from './ingestion'

/**
 * Stub Modbus adapter that fails with a "not implemented" error.
 *
 * Usage: import to satisfy type requirements in pipeline composition
 * before the real Modbus adapter is built.
 */
export const ModbusAdapterStub: Layer.Layer<IngestionAdapter> = Layer.succeed(
  IngestionAdapter,
  {
    protocol: 'modbus',
    subscribe: Effect.die('Modbus adapter not yet implemented'),
    healthCheck: Effect.die('Modbus adapter not yet implemented'),
  },
)
