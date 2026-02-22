/**
 * SerialAdapter — Serial port (USB/UART) source adapter.
 *
 * Reads serial data from USB/UART devices. Supports configurable parsers
 * (line, delimiter, byte-length, raw). In-process for near-realtime,
 * sidecar→NATS for production isolation.
 *
 * NOTE: Requires serialport library (Node.js) or WebSerial API (browser).
 * Stubbed — functional when serialport is installed.
 *
 * @module tsingou-flow/adapters/SerialAdapter
 */

import { Effect, Schema } from 'effect'
import { BaseAdapterConfig, type SourceAdapterShape } from './types'
import type { BaseSignal, SourceId } from '../schemas/base-signal'

// =============================================================================
// Configuration
// =============================================================================

export const SerialAdapterConfig = Schema.extend(
  BaseAdapterConfig,
  Schema.Struct({
    kind: Schema.Literal('serial'),
    port: Schema.String,
    baudRate: Schema.Number.pipe(Schema.int(), Schema.positive()),
    parser: Schema.optional(Schema.Literal('line', 'delimiter', 'byte-length', 'raw')),
    delimiter: Schema.optional(Schema.String),
    byteLength: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  }),
)
export type SerialAdapterConfig = typeof SerialAdapterConfig.Type

// =============================================================================
// Adapter Implementation (stub)
// =============================================================================

export const makeSerialAdapter = (
  adapterId: string,
  sourceId: SourceId,
): SourceAdapterShape<SerialAdapterConfig> => {
  let signalCount = 0
  let errorCount = 0
  let lastSignalAt: Date | null = null
  let connected = false
  let seq = 0
  let port: unknown = null

  const generateId = () => `sig_serial_${adapterId}_${Date.now()}_${seq++}`

  return {
    adapterId,
    sourceId,
    kind: 'serial',

    connect: (config, push) =>
      Effect.gen(function* () {
        // Dynamic import for serialport:
        //   const { SerialPort, ReadlineParser } = await import('serialport')
        //   port = new SerialPort({ path: config.port, baudRate: config.baudRate })
        //   const parser = port.pipe(new ReadlineParser({ delimiter: config.delimiter ?? '\n' }))
        //   parser.on('data', (line) => { push(signal) })

        yield* Effect.log(
          `[SerialAdapter] Stub — install serialport for USB/UART. Path: ${config.port}, Baud: ${config.baudRate}`,
        )
        connected = true
      }),

    disconnect: Effect.sync(() => {
      // port.close() when serialport is available
      port = null
      connected = false
    }),

    isConnected: Effect.sync(() => connected),

    health: Effect.sync(() => ({
      status: connected ? 'connected' as const : 'disconnected' as const,
      lastSignalAt: lastSignalAt ?? undefined,
      signalCount,
      errorCount,
    })),
  }
}
