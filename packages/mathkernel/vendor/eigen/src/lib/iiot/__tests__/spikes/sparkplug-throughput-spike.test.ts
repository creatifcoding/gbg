/**
 * Spike 1.4: Throughput
 *
 * Validates that the MQTT broker can sustain 100 msg/sec of DDATA
 * payloads with <1% loss at QoS 0 and p95 latency <50ms.
 *
 * @see Epic 27 (F27.4) — Broker Comparison Spike
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as mqtt from 'mqtt'
import { encodePayload, type UPayload } from '@selfcharters/sparkplug-client'

const BROKER_URL = process.env['MQTT_BROKER']
const SKIP = !BROKER_URL

describe.skipIf(SKIP)('Spike 1.4: Throughput', () => {
  let publisher: mqtt.MqttClient
  let subscriber: mqtt.MqttClient
  const nonce = Date.now()
  const baseTopic = `spBv1.0/throughput-${nonce}/DDATA/edge-01/sensor-01`

  beforeAll(async () => {
    publisher = mqtt.connect(BROKER_URL!, {
      clientId: `spike-tp-pub-${nonce}`,
      clean: true,
    })
    subscriber = mqtt.connect(BROKER_URL!, {
      clientId: `spike-tp-sub-${nonce}`,
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

  it('should sustain 100 msg/sec with <1% loss at QoS 0', async () => {
    const TOTAL_MESSAGES = 1000
    const INTERVAL_MS = 10 // 100 msg/sec
    const MAX_LOSS_PERCENT = 1
    const receivedTimestamps = new Map<number, number>() // seq → receiveTime
    let receivedCount = 0

    // Subscribe
    await new Promise<void>((resolve, reject) => {
      subscriber.subscribe(`${baseTopic}/#`, { qos: 0 }, (err: Error | null) => {
        if (err) reject(err)
        else resolve()
      })
    })

    await new Promise((r) => setTimeout(r, 500))

    subscriber.on('message', (_topic: string, _payload: Buffer) => {
      const receiveTime = performance.now()
      try {
        // Extract seq from topic suffix
        const parts = _topic.split('/')
        const seqStr = parts[parts.length - 1]
        const seq = parseInt(seqStr!, 10)
        if (!isNaN(seq)) {
          receivedTimestamps.set(seq, receiveTime)
          receivedCount++
        }
      } catch {
        // Ignore malformed messages
      }
    })

    // Publish 1000 messages at 10ms intervals
    const sendTimestamps = new Map<number, number>()
    const payload: UPayload = {
      timestamp: Date.now(),
      seq: 0,
      metrics: [
        { name: 'temperature', type: 'Double', value: 72.5 },
        { name: 'pressure', type: 'Double', value: 1013.25 },
      ],
    }
    const encoded = Buffer.from(encodePayload(payload))

    for (let i = 0; i < TOTAL_MESSAGES; i++) {
      const sendTime = performance.now()
      sendTimestamps.set(i, sendTime)
      publisher.publish(`${baseTopic}/${i}`, encoded, { qos: 0 })

      if (i < TOTAL_MESSAGES - 1) {
        await new Promise((r) => setTimeout(r, INTERVAL_MS))
      }
    }

    // Wait for remaining messages to arrive
    await new Promise((r) => setTimeout(r, 2000))

    // Calculate loss
    const lossPercent = ((TOTAL_MESSAGES - receivedCount) / TOTAL_MESSAGES) * 100

    console.log(`[Throughput] Sent: ${TOTAL_MESSAGES}, Received: ${receivedCount}, Loss: ${lossPercent.toFixed(2)}%`)

    expect(lossPercent).toBeLessThan(MAX_LOSS_PERCENT)

    // Calculate latencies for received messages
    const latencies: number[] = []
    for (const [seq, receiveTime] of receivedTimestamps) {
      const sendTime = sendTimestamps.get(seq)
      if (sendTime !== undefined) {
        latencies.push(receiveTime - sendTime)
      }
    }

    if (latencies.length > 0) {
      latencies.sort((a, b) => a - b)
      const p50 = latencies[Math.floor(latencies.length * 0.5)]!
      const p95 = latencies[Math.floor(latencies.length * 0.95)]!
      const p99 = latencies[Math.floor(latencies.length * 0.99)]!

      console.log(`[Throughput] Latency p50: ${p50.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms, p99: ${p99.toFixed(2)}ms`)

      // p95 latency should be under 50ms
      expect(p95).toBeLessThan(50)
    }
  }, 30_000)
})
