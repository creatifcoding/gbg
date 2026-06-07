import { Schema } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Muse NDJSON/WebSocket event contract
// ─────────────────────────────────────────────────────────────────────────────

export const MuseCadence = Schema.Literal('raw', 'sample', 'frame', 'summary')
export type MuseCadence = typeof MuseCadence.Type

export const MuseSensor = Schema.Literal(
  'eeg',
  'acc',
  'gyro',
  'ppg',
  'telemetry',
  'control',
  'unknown',
)
export type MuseSensor = typeof MuseSensor.Type

export const MuseSampleUnit = Schema.Literal('uV', 'g', 'dps', 'raw24', 'mixed', 'json', 'raw')
export type MuseSampleUnit = typeof MuseSampleUnit.Type

export const MuseCaptureStartEvent = Schema.Struct({
  type: Schema.Literal('muse.capture_start'),
  cadence: Schema.Literal('summary'),
  timestampHostNs: Schema.Number,
  address: Schema.String,
  notifyUuids: Schema.Array(Schema.String),
  cadences: Schema.Array(MuseCadence),
  queueSize: Schema.Number,
})
export type MuseCaptureStartEvent = typeof MuseCaptureStartEvent.Type

export const MuseScanStartEvent = Schema.Struct({
  type: Schema.Literal('muse.scan_start'),
  cadence: Schema.Literal('summary'),
  timestampHostNs: Schema.Number,
  address: Schema.String,
  timeoutSec: Schema.Number,
})
export type MuseScanStartEvent = typeof MuseScanStartEvent.Type

export const MuseScanHitEvent = Schema.Struct({
  type: Schema.Literal('muse.scan_hit'),
  cadence: Schema.Literal('summary'),
  timestampHostNs: Schema.Number,
  address: Schema.String,
  name: Schema.NullOr(Schema.String),
})
export type MuseScanHitEvent = typeof MuseScanHitEvent.Type

export const MuseScanMissEvent = Schema.Struct({
  type: Schema.Literal('muse.scan_miss'),
  cadence: Schema.Literal('summary'),
  timestampHostNs: Schema.Number,
  address: Schema.String,
  message: Schema.String,
})
export type MuseScanMissEvent = typeof MuseScanMissEvent.Type

export const MuseConnectedEvent = Schema.Struct({
  type: Schema.Literal('muse.connected'),
  cadence: Schema.Literal('summary'),
  timestampHostNs: Schema.Number,
  address: Schema.String,
})
export type MuseConnectedEvent = typeof MuseConnectedEvent.Type

export const MuseCaptureStopEvent = Schema.Struct({
  type: Schema.Literal('muse.capture_stop'),
  cadence: Schema.Literal('summary'),
  timestampHostNs: Schema.Number,
  address: Schema.String,
})
export type MuseCaptureStopEvent = typeof MuseCaptureStopEvent.Type

export const MuseWsListeningEvent = Schema.Struct({
  type: Schema.Literal('muse.ws_listening'),
  cadence: Schema.Literal('summary'),
  timestampHostNs: Schema.Number,
  url: Schema.String,
})
export type MuseWsListeningEvent = typeof MuseWsListeningEvent.Type

export const MuseKeepaliveEvent = Schema.Struct({
  type: Schema.Literal('muse.keepalive'),
  cadence: Schema.Literal('summary'),
  timestampHostNs: Schema.Number,
  command: Schema.Literal('k'),
  payloadHex: Schema.Literal('026b0a'),
})
export type MuseKeepaliveEvent = typeof MuseKeepaliveEvent.Type

export const MusePacketEvent = Schema.Struct({
  type: Schema.Literal('muse.packet'),
  cadence: Schema.Literal('raw'),
  timestampHostNs: Schema.Number,
  uuid: Schema.String,
  sensor: MuseSensor,
  channel: Schema.String,
  byteLength: Schema.Number,
  payloadHex: Schema.String,
})
export type MusePacketEvent = typeof MusePacketEvent.Type

export const MuseTelemetryValues = Schema.Struct({
  battery: Schema.Number,
  batteryRaw: Schema.Number,
  fuelGauge: Schema.Number,
  fuelRaw: Schema.Number,
  adcVolt: Schema.Number,
  temperature: Schema.Number,
})
export type MuseTelemetryValues = typeof MuseTelemetryValues.Type

export const MuseSamplesEvent = Schema.Struct({
  type: Schema.Literal('muse.samples'),
  cadence: Schema.Literal('sample'),
  timestampHostNs: Schema.Number,
  uuid: Schema.String,
  sensor: MuseSensor,
  channel: Schema.String,
  unit: MuseSampleUnit,
  sampleRate: Schema.Number,
  sequence: Schema.NullOr(Schema.Number),
  samples: Schema.optional(Schema.Array(Schema.Union(Schema.Number, Schema.Array(Schema.Number)))),
  values: Schema.optional(MuseTelemetryValues),
})
export type MuseSamplesEvent = typeof MuseSamplesEvent.Type

export const MuseFrameStream = Schema.Struct({
  sensor: MuseSensor,
  channel: Schema.String,
  unit: Schema.optional(MuseSampleUnit),
  sampleRate: Schema.optional(Schema.Number),
  sequence: Schema.NullOr(Schema.Number),
  samples: Schema.optional(Schema.Array(Schema.Union(Schema.Number, Schema.Array(Schema.Number)))),
  values: Schema.optional(MuseTelemetryValues),
  timestampHostNs: Schema.Number,
})
export type MuseFrameStream = typeof MuseFrameStream.Type

export const MuseFrameEvent = Schema.Struct({
  type: Schema.Literal('muse.frame'),
  cadence: Schema.Literal('frame'),
  timestampHostNs: Schema.Number,
  frameHz: Schema.Number,
  streams: Schema.Record({ key: Schema.String, value: MuseFrameStream }),
})
export type MuseFrameEvent = typeof MuseFrameEvent.Type

export const MuseSummaryEvent = Schema.Struct({
  type: Schema.Literal('muse.summary'),
  cadence: Schema.Literal('summary'),
  timestampHostNs: Schema.Number,
  elapsedSec: Schema.Number,
  packetsSeen: Schema.Number,
  packetsDropped: Schema.Number,
  packetsDecoded: Schema.Number,
  decodeErrors: Schema.Number,
  eventsEmitted: Schema.Number,
  packetsPerSec: Schema.Number,
  eventsPerSec: Schema.Number,
  queueSize: Schema.Number,
  queueMax: Schema.Number,
  bySensor: Schema.Record({ key: Schema.String, value: Schema.Number }),
  byChannel: Schema.Record({ key: Schema.String, value: Schema.Number }),
  sequenceGaps: Schema.Record({ key: Schema.String, value: Schema.Number }),
})
export type MuseSummaryEvent = typeof MuseSummaryEvent.Type

export const MuseDecodeErrorEvent = Schema.Struct({
  type: Schema.Literal('muse.decode_error'),
  cadence: Schema.Literal('summary'),
  timestampHostNs: Schema.Number,
  uuid: Schema.String,
  channel: Schema.String,
  error: Schema.String,
  payloadHex: Schema.String,
})
export type MuseDecodeErrorEvent = typeof MuseDecodeErrorEvent.Type

export const MuseEvent = Schema.Union(
  MuseCaptureStartEvent,
  MuseScanStartEvent,
  MuseScanHitEvent,
  MuseScanMissEvent,
  MuseConnectedEvent,
  MuseCaptureStopEvent,
  MuseWsListeningEvent,
  MuseKeepaliveEvent,
  MusePacketEvent,
  MuseSamplesEvent,
  MuseFrameEvent,
  MuseSummaryEvent,
  MuseDecodeErrorEvent,
)
export type MuseEvent = typeof MuseEvent.Type

export const decodeMuseEvent = Schema.decodeUnknownSync(MuseEvent)

export function parseMuseNdjsonLine(line: string): MuseEvent {
  return decodeMuseEvent(JSON.parse(line))
}
