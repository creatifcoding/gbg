#!/usr/bin/env bun
/**
 * Sparkplug B Test Publisher CLI
 *
 * Usage:
 *   MQTT_BROKER=mqtt://localhost:1883 bun run scripts/sparkplug-publish.ts
 *
 * Simulates a Sparkplug B Edge Node publishing sensor data.
 * Publishes NBIRTH, DBIRTH, then periodic DDATA until interrupted.
 *
 * @see src/lib/iiot/adapters/sparkplug-publisher.ts
 */

import { Effect } from 'effect'
import {
  runPublisher,
  defaultPublisherConfig,
  type SparkplugPublisherConfig,
} from '../src/lib/iiot/adapters/sparkplug-publisher'

const brokerUrl = process.env['MQTT_BROKER'] ?? 'mqtt://localhost:1883'
const intervalMs = parseInt(process.env['INTERVAL_MS'] ?? '1000', 10)

const config: SparkplugPublisherConfig = {
  ...defaultPublisherConfig,
  serverUrl: brokerUrl,
  intervalMs,
}

console.log(`Starting Sparkplug B publisher...`)
console.log(`  Broker: ${brokerUrl}`)
console.log(`  Group:  ${config.groupId}`)
console.log(`  Edge:   ${config.edgeNodeId}`)
console.log(`  Devices: ${config.devices.map((d) => d.deviceId).join(', ')}`)
console.log(`  Interval: ${intervalMs}ms`)
console.log(`  Press Ctrl+C to stop\n`)

Effect.runPromise(
  runPublisher(config).pipe(Effect.scoped),
).catch((err) => {
  console.error('Publisher error:', err)
  process.exit(1)
})
