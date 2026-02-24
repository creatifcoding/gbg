/**
 * SparkplugProtocol — Topic building, parsing, sequence counters, Will construction.
 *
 * Pure functions + Effect.Ref-based counters for Sparkplug B protocol mechanics.
 * No MQTT dependency — protocol logic only.
 *
 * @module @selfcharters/sparkplug-client/SparkplugProtocol
 * @see Sparkplug 3.0.0 Spec §5 Operational Behavior
 */

import { Effect, Ref } from 'effect'

// =============================================================================
// Sparkplug B message types
// =============================================================================

export type SparkplugMessageType =
  | 'NBIRTH'
  | 'NDEATH'
  | 'NDATA'
  | 'NCMD'
  | 'DBIRTH'
  | 'DDEATH'
  | 'DDATA'
  | 'DCMD'
  | 'STATE'

// =============================================================================
// Topic building and parsing
// =============================================================================

export interface SparkplugTopic {
  readonly version: string
  readonly groupId: string
  readonly messageType: SparkplugMessageType
  readonly edgeNodeId: string
  readonly deviceId?: string
}

/**
 * Build a Sparkplug B topic string.
 *
 * Format: `spBv1.0/{groupId}/{messageType}/{edgeNodeId}[/{deviceId}]`
 *
 * @example
 * buildTopic('spBv1.0', 'plant-a', 'DDATA', 'edge-01', 'sensor-01')
 * // => 'spBv1.0/plant-a/DDATA/edge-01/sensor-01'
 */
export const buildTopic = (
  version: string,
  groupId: string,
  messageType: SparkplugMessageType,
  edgeNodeId: string,
  deviceId?: string,
): string => {
  const base = `${version}/${groupId}/${messageType}/${edgeNodeId}`
  return deviceId ? `${base}/${deviceId}` : base
}

/**
 * Parse a Sparkplug B topic string into its components.
 *
 * Returns null if the topic doesn't match the expected format
 * (minimum 4 segments: version/group/type/edge).
 */
export const parseTopic = (topic: string): SparkplugTopic | null => {
  const segments = topic.split('/')
  if (segments.length < 4) return null

  const [version, groupId, messageType, edgeNodeId, ...rest] = segments

  // Validate message type
  const validTypes: ReadonlyArray<string> = [
    'NBIRTH', 'NDEATH', 'NDATA', 'NCMD',
    'DBIRTH', 'DDEATH', 'DDATA', 'DCMD',
  ]
  if (!validTypes.includes(messageType!)) return null

  return {
    version: version!,
    groupId: groupId!,
    messageType: messageType as SparkplugMessageType,
    edgeNodeId: edgeNodeId!,
    deviceId: rest.length > 0 ? rest.join('/') : undefined,
  }
}

// =============================================================================
// Sequence counters (Effect.Ref)
// =============================================================================

/**
 * Create a sequence counter (0-255, wraps at 256).
 *
 * Used for the `seq` field in BIRTH/DATA payloads.
 * Sparkplug spec: "The seq number MUST be set to zero in NBIRTH
 * and increment by one for each subsequent message, wrapping to zero at 256."
 */
export const makeSeqCounter = () =>
  Effect.gen(function* () {
    const ref = yield* Ref.make(0)
    return {
      /** Get current value and increment (wraps at 256 → 0) */
      next: Effect.gen(function* () {
        const current = yield* Ref.get(ref)
        yield* Ref.set(ref, (current + 1) % 256)
        return current
      }),
      /** Reset to zero (on NBIRTH) */
      reset: Ref.set(ref, 0),
    }
  })

/**
 * Create a birth/death sequence counter (0-255, wraps at 256).
 *
 * Used for the `bdSeq` metric in NBIRTH and NDEATH payloads.
 * The bdSeq in NBIRTH must match the bdSeq in the corresponding NDEATH (Will).
 * Increments on each new session (CONNECT).
 */
export const makeBdSeqCounter = () =>
  Effect.gen(function* () {
    const ref = yield* Ref.make(0)
    return {
      /** Get current value and increment (wraps at 256 → 0) */
      next: Effect.gen(function* () {
        const current = yield* Ref.get(ref)
        yield* Ref.set(ref, (current + 1) % 256)
        return current
      }),
      /** Get current value without incrementing */
      current: Ref.get(ref),
    }
  })

// =============================================================================
// Death payload construction
// =============================================================================

/**
 * UPayload shape for the NDEATH Will message.
 * Contains a single `bdSeq` metric for birth/death correlation.
 */
export interface DeathPayload {
  readonly timestamp: number
  readonly metrics: ReadonlyArray<{
    readonly name: string
    readonly value: number
    readonly type: string
  }>
}

/**
 * Construct an NDEATH payload with the bdSeq metric.
 *
 * @param bdSeq - Birth/death sequence number (must match NBIRTH bdSeq)
 */
export const makeDeathPayload = (bdSeq: number): DeathPayload => ({
  timestamp: Date.now(),
  metrics: [
    {
      name: 'bdSeq',
      value: bdSeq,
      type: 'UInt64',
    },
  ],
})

// =============================================================================
// Will message construction
// =============================================================================

export interface WillMessage {
  readonly topic: string
  readonly payload: DeathPayload
  readonly qos: 0 | 1 | 2
  readonly retain: boolean
}

/**
 * Construct the MQTT Will message for NDEATH.
 *
 * Defaults: QoS 1, retain false (spec-compliant).
 * The upstream sparkplug-client hardcodes QoS 0 — this is the spec violation we fix.
 *
 * @param version - Sparkplug version (e.g., 'spBv1.0')
 * @param groupId - Sparkplug group ID
 * @param edgeNodeId - Edge node identifier
 * @param bdSeq - Birth/death sequence number
 * @param qos - Will QoS (default: 1 per spec)
 * @param retain - Will retain (default: false per spec)
 */
export const makeWillMessage = (
  version: string,
  groupId: string,
  edgeNodeId: string,
  bdSeq: number,
  qos: 0 | 1 | 2 = 1,
  retain: boolean = false,
): WillMessage => ({
  topic: buildTopic(version, groupId, 'NDEATH', edgeNodeId),
  payload: makeDeathPayload(bdSeq),
  qos,
  retain,
})
