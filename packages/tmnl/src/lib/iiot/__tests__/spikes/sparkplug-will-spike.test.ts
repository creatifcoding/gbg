/**
 * Spike 1.1: Will Message Firing
 *
 * Validates that MQTT broker correctly delivers Will (LWT) messages
 * when a client disconnects uncleanly (socket destroyed).
 *
 * This is critical for Sparkplug B NDEATH delivery.
 *
 * @see Epic 27 (F27.4) — Broker Comparison Spike
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as mqtt from 'mqtt'

const BROKER_URL = process.env['MQTT_BROKER']
const SKIP = !BROKER_URL

describe.skipIf(SKIP)('Spike 1.1: Will Message Firing', () => {
  const willTopic = `spike/will/${Date.now()}`
  const willPayload = 'node-died'
  let subscriber: mqtt.MqttClient

  beforeAll(async () => {
    subscriber = mqtt.connect(BROKER_URL!, {
      clientId: `spike-will-sub-${Date.now()}`,
      clean: true,
    })
    await new Promise<void>((resolve, reject) => {
      subscriber.on('connect', () => resolve())
      subscriber.on('error', reject)
    })
  })

  afterAll(async () => {
    if (subscriber) {
      subscriber.end(true)
      await new Promise<void>((r) => subscriber.on('close', r))
    }
  })

  it('should deliver Will message when client disconnects uncleanly', async () => {
    // Subscribe to the Will topic
    await new Promise<void>((resolve, reject) => {
      subscriber.subscribe(willTopic, { qos: 1 }, (err: Error | null) => {
        if (err) reject(err)
        else resolve()
      })
    })

    // Small delay to ensure subscription is active on broker
    await new Promise((r) => setTimeout(r, 200))

    // Connect a client WITH a Will message
    const willClient = mqtt.connect(BROKER_URL!, {
      clientId: `spike-will-pub-${Date.now()}`,
      clean: true,
      will: {
        topic: willTopic,
        payload: Buffer.from(willPayload),
        qos: 1,
        retain: false,
      },
    })

    await new Promise<void>((resolve, reject) => {
      willClient.on('connect', () => resolve())
      willClient.on('error', reject)
    })

    // Wait for connection to stabilize
    await new Promise((r) => setTimeout(r, 500))

    // Kill the client uncleanly (destroy socket, not clean disconnect)
    const receivedWill = new Promise<string>((resolve) => {
      subscriber.on('message', (_topic: string, payload: Buffer) => {
        resolve(payload.toString())
      })
    })

    willClient.stream.destroy()

    // Wait for Will delivery (up to 5 seconds)
    const result = await Promise.race([
      receivedWill,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ])

    expect(result).toBe(willPayload)
  }, 10_000)
})
