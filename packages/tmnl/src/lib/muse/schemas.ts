import { Schema } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Muse NDJSON/WebSocket event contract
// ─────────────────────────────────────────────────────────────────────────────

export const MuseCadence = Schema.Literal('raw', 'sample', 'frame', 'summary', 'marker')
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

export const MuseExperimentClockDomain = Schema.Literal(
  'host_time_ns',
  'host_monotonic_ns',
  'wall_clock_iso',
  'lsl_time',
  'media_frame_time',
  'unknown',
)
export type MuseExperimentClockDomain = typeof MuseExperimentClockDomain.Type

export const MuseExpectedSignalClass = Schema.Literal(
  'transport_only',
  'artifact',
  'resting_state',
  'alpha_contrast_candidate',
  'motion_contamination',
  'unknown',
)
export type MuseExpectedSignalClass = typeof MuseExpectedSignalClass.Type

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

export const MuseMarkerKind = Schema.Literal(
  'session_start',
  'session_end',
  'block_start',
  'block_end',
  'cue_onset',
  'cue_offset',
  'annotation',
  'pause',
  'resume',
  'abort',
)
export type MuseMarkerKind = typeof MuseMarkerKind.Type

export const MuseMarkerEvent = Schema.Struct({
  type: Schema.Literal('muse.marker'),
  cadence: Schema.Literal('marker'),
  timestampHostNs: Schema.Number,
  timestampWallIso: Schema.optional(Schema.String),
  sessionId: Schema.String,
  protocolId: Schema.String,
  markerKind: MuseMarkerKind,
  eventCode: Schema.String,
  label: Schema.String,
  blockId: Schema.optional(Schema.String),
  cueId: Schema.optional(Schema.String),
  repetitionIndex: Schema.optional(Schema.Number),
  expectedAction: Schema.optional(Schema.String),
  expectedSignalClass: Schema.optional(MuseExpectedSignalClass),
  clockDomain: MuseExperimentClockDomain,
  source: Schema.Literal('tmnl-conductor', 'manual', 'external', 'unknown'),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export type MuseMarkerEvent = typeof MuseMarkerEvent.Type

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
  MuseMarkerEvent,
  MuseSummaryEvent,
  MuseDecodeErrorEvent,
)
export type MuseEvent = typeof MuseEvent.Type

export const decodeMuseEvent = Schema.decodeUnknownSync(MuseEvent)

export function parseMuseNdjsonLine(line: string): MuseEvent {
  return decodeMuseEvent(JSON.parse(line))
}

// ─────────────────────────────────────────────────────────────────────────────
// Controlled experiment/session manifest contract
// ─────────────────────────────────────────────────────────────────────────────

export const MuseSessionManifestSchemaVersion = Schema.Literal('muse-session-manifest/v1')
export type MuseSessionManifestSchemaVersion = typeof MuseSessionManifestSchemaVersion.Type

export const MuseProtocolBlockKind = Schema.Literal(
  'fit_check',
  'rest',
  'eyes_open',
  'eyes_closed',
  'blink',
  'jaw_clench',
  'head_motion',
  'motion_rest',
  'cognitive_task',
  'calibration',
  'pause',
  'custom',
)
export type MuseProtocolBlockKind = typeof MuseProtocolBlockKind.Type

export const MuseArtifactRole = Schema.Literal(
  'muse_jsonl',
  'muse_samples_csv',
  'markers_jsonl',
  'events_tsv',
  'session_manifest',
  'camera_video',
  'camera_frame_ledger',
  'pose_jsonl',
  'sync_map',
  'first_order_report',
  'feature_table',
  'model_artifact',
  'other',
)
export type MuseArtifactRole = typeof MuseArtifactRole.Type

export const MuseSessionParticipant = Schema.Struct({
  participantId: Schema.String,
  anonymized: Schema.Boolean,
  notes: Schema.optional(Schema.String),
})
export type MuseSessionParticipant = typeof MuseSessionParticipant.Type

export const MuseSessionDevice = Schema.Struct({
  deviceId: Schema.String,
  model: Schema.Literal('Muse 2', 'Muse S', 'Muse S Athena', 'unknown'),
  name: Schema.String,
  address: Schema.String,
  serviceUuid: Schema.String,
  protocol: Schema.Literal('classic-fe8d', 'athena-universal', 'lsl', 'unknown'),
  firmware: Schema.optional(Schema.String),
  channels: Schema.Array(Schema.String),
})
export type MuseSessionDevice = typeof MuseSessionDevice.Type

export const MuseSessionCaptureConfig = Schema.Struct({
  command: Schema.String,
  outputPath: Schema.String,
  csvOutputPath: Schema.optional(Schema.String),
  wsUrl: Schema.optional(Schema.String),
  oscTarget: Schema.optional(Schema.String),
  cadences: Schema.Array(MuseCadence),
  preset: Schema.optional(Schema.String),
  includePpg: Schema.Boolean,
  includeAux: Schema.Boolean,
  eegOnly: Schema.Boolean,
  keepaliveIntervalSec: Schema.Number,
})
export type MuseSessionCaptureConfig = typeof MuseSessionCaptureConfig.Type

export const MuseProtocolCue = Schema.Struct({
  cueId: Schema.String,
  label: Schema.String,
  eventCode: Schema.String,
  onsetSec: Schema.Number,
  durationSec: Schema.optional(Schema.Number),
  repetitionIndex: Schema.optional(Schema.Number),
  expectedAction: Schema.optional(Schema.String),
})
export type MuseProtocolCue = typeof MuseProtocolCue.Type

export const MuseProtocolBlock = Schema.Struct({
  blockId: Schema.String,
  kind: MuseProtocolBlockKind,
  label: Schema.String,
  instructions: Schema.String,
  durationSec: Schema.Number,
  expectedSignalClass: MuseExpectedSignalClass,
  preRestSec: Schema.optional(Schema.Number),
  postRestSec: Schema.optional(Schema.Number),
  cueIntervalSec: Schema.optional(Schema.Number),
  repetitions: Schema.optional(Schema.Number),
  cues: Schema.optional(Schema.Array(MuseProtocolCue)),
  safetyNotes: Schema.optional(Schema.String),
})
export type MuseProtocolBlock = typeof MuseProtocolBlock.Type

export const MuseSessionProtocol = Schema.Struct({
  protocolId: Schema.String,
  title: Schema.String,
  version: Schema.String,
  source: Schema.optional(Schema.String),
  blocks: Schema.Array(MuseProtocolBlock),
})
export type MuseSessionProtocol = typeof MuseSessionProtocol.Type

export const MuseSessionArtifact = Schema.Struct({
  role: MuseArtifactRole,
  path: Schema.String,
  mediaType: Schema.String,
  clockDomain: MuseExperimentClockDomain,
  sha256: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String),
})
export type MuseSessionArtifact = typeof MuseSessionArtifact.Type

export const MuseClockMapping = Schema.Struct({
  sourceClock: MuseExperimentClockDomain,
  targetClock: MuseExperimentClockDomain,
  method: Schema.Literal('same_clock', 'offset_sample', 'linear_fit', 'lsl_clock_offset', 'manual', 'unknown'),
  offsetNs: Schema.optional(Schema.Number),
  slope: Schema.optional(Schema.Number),
  uncertaintyNs: Schema.optional(Schema.Number),
  notes: Schema.optional(Schema.String),
})
export type MuseClockMapping = typeof MuseClockMapping.Type

export const MuseSessionSyncPlan = Schema.Struct({
  primaryClock: MuseExperimentClockDomain,
  timestampHostNsMeaning: Schema.String,
  mappings: Schema.Array(MuseClockMapping),
  droppedFramePolicy: Schema.optional(Schema.String),
  limitations: Schema.Array(Schema.String),
})
export type MuseSessionSyncPlan = typeof MuseSessionSyncPlan.Type

export const MuseSessionEnvironment = Schema.Struct({
  powerLineFrequencyHz: Schema.optional(Schema.Number),
  locationDescription: Schema.optional(Schema.String),
  lightingDescription: Schema.optional(Schema.String),
  posture: Schema.optional(Schema.String),
  fitNotes: Schema.optional(Schema.String),
  contactNotes: Schema.optional(Schema.String),
  operatorNotes: Schema.optional(Schema.String),
})
export type MuseSessionEnvironment = typeof MuseSessionEnvironment.Type

export const MuseSessionSoftware = Schema.Struct({
  tmnlVersion: Schema.optional(Schema.String),
  captureScriptVersion: Schema.optional(Schema.String),
  analyzerScriptVersion: Schema.optional(Schema.String),
  dependencies: Schema.Record({ key: Schema.String, value: Schema.String }),
})
export type MuseSessionSoftware = typeof MuseSessionSoftware.Type

export const MuseSessionManifest = Schema.Struct({
  schemaVersion: MuseSessionManifestSchemaVersion,
  sessionId: Schema.String,
  createdAt: Schema.String,
  taskName: Schema.String,
  purpose: Schema.String,
  interpretationBoundary: Schema.String,
  participant: MuseSessionParticipant,
  device: MuseSessionDevice,
  capture: MuseSessionCaptureConfig,
  protocol: MuseSessionProtocol,
  sync: MuseSessionSyncPlan,
  environment: MuseSessionEnvironment,
  software: MuseSessionSoftware,
  artifacts: Schema.Array(MuseSessionArtifact),
  labelsPath: Schema.optional(Schema.String),
  limitations: Schema.Array(Schema.String),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export type MuseSessionManifest = typeof MuseSessionManifest.Type

export const decodeMuseSessionManifest = Schema.decodeUnknownSync(MuseSessionManifest)
