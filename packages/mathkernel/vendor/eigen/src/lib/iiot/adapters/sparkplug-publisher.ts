/**
 * SparkplugPublisher — Edge Node Simulator for Testing
 *
 * Simulates a Sparkplug B Edge Node that:
 * 1. Connects to MQTT broker via MqttTransport
 * 2. Publishes NBIRTH with metric definitions (name + alias mapping)
 * 3. Publishes DBIRTH for each device
 * 4. Periodically publishes DDATA with simulated sensor readings
 *
 * Uses @selfcharters/sparkplug-client MqttTransport — no direct mqtt dependency.
 *
 * @module @gbg/tmnl/iiot/adapters/sparkplug-publisher
 * @see Epic 27 (F27.5)
 */

import { Effect, Schedule, Stream, Duration } from 'effect'
import {
  buildTopic,
  encodePayload,
  MqttTransport,
  MqttTransportLive,
  type SparkplugConfig,
  type UPayload,
} from '@selfcharters/sparkplug-client'

// =============================================================================
// Publisher config
// =============================================================================

export interface SparkplugPublisherConfig {
  readonly serverUrl: string
  readonly groupId: string
  readonly edgeNodeId: string
  readonly devices: ReadonlyArray<{
    readonly deviceId: string
    readonly metrics: ReadonlyArray<{
      readonly name: string
      readonly alias: number
      readonly type: string
      readonly minValue?: number
      readonly maxValue?: number
    }>
  }>
  /** Publish interval in ms (default: 1000) */
  readonly intervalMs?: number
}

// =============================================================================
// Default config
// =============================================================================

export const defaultPublisherConfig: SparkplugPublisherConfig = {
  serverUrl: 'mqtt://localhost:1883',
  groupId: 'test-group',
  edgeNodeId: 'edge-01',
  devices: [
    {
      deviceId: 'sensor-01',
      metrics: [
        { name: 'temperature', alias: 1, type: 'Double', minValue: 15, maxValue: 85 },
        { name: 'pressure', alias: 2, type: 'Double', minValue: 900, maxValue: 1100 },
        { name: 'humidity', alias: 3, type: 'Double', minValue: 20, maxValue: 95 },
      ],
    },
    {
      deviceId: 'motor-01',
      metrics: [
        { name: 'rpm', alias: 1, type: 'Int32', minValue: 0, maxValue: 3600 },
        { name: 'running', alias: 2, type: 'Boolean' },
        { name: 'vibration', alias: 3, type: 'Double', minValue: 0, maxValue: 10 },
      ],
    },
  ],
  intervalMs: 1000,
}

// =============================================================================
// Publisher implementation
// =============================================================================

/** Encode and return a Buffer for a UPayload */
const encodeToBuffer = (payload: UPayload): Buffer =>
  Buffer.from(encodePayload(payload))

/**
 * Run a Sparkplug B Edge Node publisher.
 *
 * Returns an Effect that connects via MqttTransport, publishes BIRTH messages,
 * and emits DDATA at the configured interval until interrupted.
 *
 * Must be provided with Scope (for MqttTransport lifecycle).
 */
export const runPublisher = (
  config: SparkplugPublisherConfig = defaultPublisherConfig,
) => {
  const { groupId, edgeNodeId, devices } = config
  const intervalMs = config.intervalMs ?? 1000
  const bdSeq = 0

  // Build SparkplugConfig for MqttTransport
  const sparkplugConfig: SparkplugConfig = {
    _tag: 'SparkplugConfig',
    serverUrl: config.serverUrl,
    groupId,
    edgeNodeId,
    mqtt: { cleanSession: true, keepalive: 65, reconnectPeriod: 1000, connectTimeout: 30000 },
    will: { qos: 1, retain: false },
    publish: { qos: 0, retain: false },
    state: { enabled: false, qos: 1, retain: true },
  }

  return Effect.gen(function* () {
    const transport = yield* MqttTransport
    let seq = 0

    yield* Effect.log(`Publisher connected: ${edgeNodeId}`)

    // Publish helper
    const publish = (topic: string, payload: UPayload) =>
      transport.publish(topic, encodeToBuffer(payload))

    // NBIRTH — edge node birth with all metric definitions
    const nbirthMetrics: Array<{ name: string; alias: number; type: string; value: unknown }> = []
    for (let di = 0; di < devices.length; di++) {
      const device = devices[di]!
      for (const m of device.metrics) {
        nbirthMetrics.push({
          name: `${device.deviceId}/${m.name}`,
          alias: m.alias + (di * 100),
          type: m.type,
          value: m.type === 'Boolean' ? false : 0,
        })
      }
    }
    nbirthMetrics.push({ name: 'bdSeq', alias: 0, type: 'UInt64', value: bdSeq })

    yield* publish(buildTopic('spBv1.0', groupId, 'NBIRTH', edgeNodeId), {
      timestamp: Date.now(),
      seq: seq++,
      metrics: nbirthMetrics,
    })
    yield* Effect.log(`NBIRTH published: ${nbirthMetrics.length} metrics`)

    // DBIRTH — per device
    for (const device of devices) {
      const dbirthMetrics = device.metrics.map((m) => ({
        name: m.name,
        alias: m.alias,
        type: m.type,
        value: m.type === 'Boolean' ? false : 0,
      }))

      yield* publish(
        buildTopic('spBv1.0', groupId, 'DBIRTH', edgeNodeId, device.deviceId),
        { timestamp: Date.now(), seq: seq++, metrics: dbirthMetrics },
      )
      yield* Effect.log(`DBIRTH published: ${device.deviceId}`)
    }

    // Periodic DDATA
    yield* Stream.fromSchedule(Schedule.spaced(Duration.millis(intervalMs))).pipe(
      Stream.mapEffect(() =>
        Effect.gen(function* () {
          for (const device of devices) {
            const dataMetrics = device.metrics.map((m) => {
              if (m.type === 'Boolean') {
                return { name: m.name, type: m.type, value: Math.random() > 0.5 }
              }
              const min = m.minValue ?? 0
              const max = m.maxValue ?? 100
              return {
                name: m.name,
                type: m.type,
                value: min + Math.random() * (max - min),
              }
            })

            yield* publish(
              buildTopic('spBv1.0', groupId, 'DDATA', edgeNodeId, device.deviceId),
              { timestamp: Date.now(), seq: seq++ % 256, metrics: dataMetrics },
            )
          }
        }),
      ),
      Stream.runDrain,
    )
  }).pipe(Effect.provide(MqttTransportLive(sparkplugConfig, bdSeq)))
}
