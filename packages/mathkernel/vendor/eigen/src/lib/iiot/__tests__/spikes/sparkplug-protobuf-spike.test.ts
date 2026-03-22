/**
 * Spike 1.2: Protobuf Roundtrip
 *
 * Validates that sparkplug-payload protobuf encoding survives
 * MQTT publish/subscribe through the broker without corruption.
 *
 * @see Epic 27 (F27.4) — Broker Comparison Spike
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as mqtt from 'mqtt'
import { encodePayload, decodePayload, type UPayload } from '@selfcharters/sparkplug-client'

const BROKER_URL = process.env['MQTT_BROKER']
const SKIP = !BROKER_URL

describe.skipIf(SKIP)('Spike 1.2: Protobuf Roundtrip', () => {
  let publisher: mqtt.MqttClient
  let subscriber: mqtt.MqttClient
  const testTopic = `spike/protobuf/${Date.now()}`

  beforeAll(async () => {
    publisher = mqtt.connect(BROKER_URL!, {
      clientId: `spike-proto-pub-${Date.now()}`,
      clean: true,
    })
    subscriber = mqtt.connect(BROKER_URL!, {
      clientId: `spike-proto-sub-${Date.now()}`,
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

  it('should preserve protobuf payload through MQTT roundtrip', async () => {
    const originalPayload: UPayload = {
      timestamp: Date.now(),
      seq: 42,
      metrics: [
        { name: 'temperature', type: 'Double', value: 72.5 },
        { name: 'pressure', type: 'Double', value: 1013.25 },
        { name: 'running', type: 'Boolean', value: true },
        { name: 'label', type: 'String', value: 'motor-01' },
        { name: 'count', type: 'Int32', value: 1234 },
      ],
    }

    // Subscribe first
    await new Promise<void>((resolve, reject) => {
      subscriber.subscribe(testTopic, { qos: 0 }, (err: Error | null) => {
        if (err) reject(err)
        else resolve()
      })
    })

    await new Promise((r) => setTimeout(r, 200))

    // Encode payload
    const encoded = encodePayload(originalPayload)
    const encodedBuffer = Buffer.from(encoded)

    // Set up receive promise
    const received = new Promise<Buffer>((resolve) => {
      subscriber.on('message', (_topic: string, payload: Buffer) => {
        resolve(payload)
      })
    })

    // Publish encoded protobuf
    publisher.publish(testTopic, encodedBuffer, { qos: 0 })

    // Wait for receipt
    const receivedPayload = await Promise.race([
      received,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ])

    expect(receivedPayload).not.toBeNull()

    // Decode and compare
    const decoded = decodePayload(receivedPayload as Buffer)

    expect(decoded.seq).toBe(42)
    expect(decoded.metrics).toBeDefined()
    expect(decoded.metrics!.length).toBe(5)

    // Verify individual metrics
    const tempMetric = decoded.metrics!.find((m: any) => m.name === 'temperature')
    expect(tempMetric).toBeDefined()
    expect(Number(tempMetric!.value)).toBeCloseTo(72.5, 1)

    const boolMetric = decoded.metrics!.find((m: any) => m.name === 'running')
    expect(boolMetric).toBeDefined()
    expect(boolMetric!.value).toBe(true)

    const strMetric = decoded.metrics!.find((m: any) => m.name === 'label')
    expect(strMetric).toBeDefined()
    expect(strMetric!.value).toBe('motor-01')
  }, 10_000)

  it('should preserve binary payload byte-identical', async () => {
    const payload: UPayload = {
      timestamp: Date.now(),
      seq: 1,
      metrics: [
        { name: 'sensor', type: 'Double', value: 99.9 },
      ],
    }

    const encoded = encodePayload(payload)
    const originalBytes = Buffer.from(encoded)
    const byteTopic = `${testTopic}/bytes`

    await new Promise<void>((resolve, reject) => {
      subscriber.subscribe(byteTopic, { qos: 0 }, (err: Error | null) => {
        if (err) reject(err)
        else resolve()
      })
    })

    await new Promise((r) => setTimeout(r, 200))

    const received = new Promise<Buffer>((resolve) => {
      subscriber.on('message', (topic: string, payload: Buffer) => {
        if (topic === byteTopic) resolve(payload)
      })
    })

    publisher.publish(byteTopic, originalBytes, { qos: 0 })

    const receivedBytes = await Promise.race([
      received,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ])

    expect(receivedBytes).not.toBeNull()
    expect(Buffer.compare(originalBytes, receivedBytes as Buffer)).toBe(0)
  }, 10_000)
})
