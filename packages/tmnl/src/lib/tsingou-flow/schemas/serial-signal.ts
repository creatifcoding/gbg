/**
 * Serial Signal Schema
 *
 * Source: USB/UART serial port (serialport lib, WebSerial API, or sidecar)
 * Covers: Raw bytes, parsed frames, sensor data, Arduino/ESP32 output
 *
 * @module tsingou-flow/schemas/serial-signal
 */

import { Schema } from 'effect'
import { BaseSignal } from './base-signal'

// =============================================================================
// Serial Payload
// =============================================================================

export const SerialParserType = Schema.Literal(
  'line',        // Newline-delimited
  'delimiter',   // Custom delimiter
  'byte-length', // Fixed byte count
  'ready',       // Ready pattern match
  'raw',         // No parsing
)
export type SerialParserType = typeof SerialParserType.Type

export const SerialPayload = Schema.Struct({
  /** Serial port path (e.g. "/dev/ttyUSB0", "COM3") */
  port: Schema.String,

  /** Baud rate */
  baudRate: Schema.Number.pipe(Schema.int(), Schema.positive()),

  /** Raw bytes received */
  raw: Schema.Uint8ArrayFromSelf,

  /** Parser-decoded output (user-defined transform) */
  parsed: Schema.optional(Schema.Unknown),

  /** Which parser type was used */
  parserType: Schema.optional(SerialParserType),

  /** Delimiter used (for delimiter parser) */
  delimiter: Schema.optional(Schema.String),

  /** USB device info (when available) */
  vendorId: Schema.optional(Schema.String),
  productId: Schema.optional(Schema.String),
  manufacturer: Schema.optional(Schema.String),
})
export type SerialPayload = typeof SerialPayload.Type

// =============================================================================
// SerialSignal
// =============================================================================

export const SerialSignal = Schema.extend(
  BaseSignal,
  Schema.Struct({
    kind: Schema.Literal('serial'),
    payload: SerialPayload,
  }),
)
export type SerialSignal = typeof SerialSignal.Type
