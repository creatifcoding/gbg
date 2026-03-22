/**
 * Spike 1.3: Wildcard Matching
 *
 * Validates that the MQTT broker correctly handles Sparkplug B
 * wildcard subscriptions — receiving DDATA but not NBIRTH on
 * a DDATA-specific wildcard pattern.
 *
 * @see Epic 27 (F27.4) — Broker Comparison Spike
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as mqtt from 'mqtt'

const BROKER_URL = process.env['MQTT_BROKER']
const SKIP = !BROKER_URL

describe.skipIf(SKIP)('Spike 1.3: Wildcard Matching', () => {
  let publisher: mqtt.MqttClient
  let subscriber: mqtt.MqttClient
  const nonce = Date.now()

  beforeAll(async () => {
    publisher = mqtt.connect(BROKER_URL!, {
      clientId: `spike-wc-pub-${nonce}`,
      clean: true,
    })
    subscriber = mqtt.connect(BROKER_URL!, {
      clientId: `spike-wc-sub-${nonce}`,
      clean: true,
    })

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        publisher.on('connect', () => resolve())
        publisher.on('error', reject)
      }),
      new Promise<void>((resolve, reject) => {
        subscriber.on('connect', () => resolve())
        subscriber.on('error', reject)
      }),
    ])
  })

  afterAll(async () => {
    if (publisher) publisher.end(true)
    if (subscriber) subscriber.end(true)
    await new Promise((r) => setTimeout(r, 100))
  })

  it('should receive DDATA on +/DDATA/+/+ wildcard but not NBIRTH', async () => {
    const received: Array<{ topic: string; payload: string }> = []

    // Subscribe to DDATA wildcard: spBv1.0/+/DDATA/+/+
    await new Promise<void>((resolve, reject) => {
      subscriber.subscribe(`spBv1.0/+/DDATA/+/+`, { qos: 0 }, (err: Error | null) => {
        if (err) reject(err)
        else resolve()
      })
    })

    await new Promise((r) => setTimeout(r, 300))

    subscriber.on('message', (topic: string, payload: Buffer) => {
      received.push({ topic, payload: payload.toString() })
    })

    // Publish a DDATA message (5 segments — matches wildcard)
    publisher.publish(
      `spBv1.0/plant-a/DDATA/edge-01/sensor-01`,
      Buffer.from('ddata-payload'),
      { qos: 0 },
    )

    // Publish an NBIRTH message (4 segments — should NOT match)
    publisher.publish(
      `spBv1.0/plant-a/NBIRTH/edge-01`,
      Buffer.from('nbirth-payload'),
      { qos: 0 },
    )

    // Wait for messages to arrive
    await new Promise((r) => setTimeout(r, 1000))

    // DDATA should be received
    const ddataMessages = received.filter((m) =>
      m.topic.includes('DDATA'),
    )
    expect(ddataMessages.length).toBe(1)
    expect(ddataMessages[0]!.payload).toBe('ddata-payload')

    // NBIRTH should NOT be received (4 segments vs 5 in wildcard)
    const nbirthMessages = received.filter((m) =>
      m.topic.includes('NBIRTH'),
    )
    expect(nbirthMessages.length).toBe(0)
  }, 10_000)

  it('should receive all message types on # wildcard', async () => {
    const received: string[] = []
    const groupId = `spike-wc-all-${nonce}`

    await new Promise<void>((resolve, reject) => {
      subscriber.subscribe(`spBv1.0/${groupId}/#`, { qos: 0 }, (err: Error | null) => {
        if (err) reject(err)
        else resolve()
      })
    })

    await new Promise((r) => setTimeout(r, 300))

    subscriber.on('message', (topic: string) => {
      if (topic.includes(groupId)) {
        received.push(topic)
      }
    })

    // Publish various Sparkplug message types
    const topics = [
      `spBv1.0/${groupId}/NBIRTH/edge-01`,
      `spBv1.0/${groupId}/DBIRTH/edge-01/device-01`,
      `spBv1.0/${groupId}/DDATA/edge-01/device-01`,
      `spBv1.0/${groupId}/NDEATH/edge-01`,
    ]

    for (const t of topics) {
      publisher.publish(t, Buffer.from('test'), { qos: 0 })
    }

    await new Promise((r) => setTimeout(r, 1000))

    // All 4 message types should be received
    expect(received.length).toBe(4)
  }, 10_000)
})
