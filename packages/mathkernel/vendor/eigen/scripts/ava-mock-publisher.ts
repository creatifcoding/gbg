#!/usr/bin/env bun
/**
 * AVA Mock NATS Publisher
 *
 * Publishes mock ViewArtifacts and ViewDeltas to NATS for testbed validation.
 *
 * Usage:
 *   bun scripts/ava-mock-publisher.ts
 *
 * NATS Subjects Published:
 *   - tmnl.ava.artifacts.<viewId> - ViewArtifact when subscribe request received
 *   - tmnl.ava.deltas.<viewId>    - ViewDelta every 2 seconds
 *   - tmnl.ava.events.*           - ReconcilerEvents
 *
 * This script bridges the gap between:
 *   - Testbed (expects NATS messages)
 *   - ava-server (provides REST/gRPC only)
 *
 * @see src/components/testbed/AvaV2Testbed.tsx
 * @module
 */

import { connect, StringCodec, type NatsConnection, type Subscription } from 'nats.ws'

// =============================================================================
// Configuration
// =============================================================================

const NATS_WS_URL = process.env.NATS_WS_URL ?? 'ws://localhost:9222'
const SUBJECT_PREFIX = 'tmnl.ava'
const DELTA_INTERVAL_MS = 2000

// =============================================================================
// Mock Data Generators
// =============================================================================

interface ViewArtifact {
  viewId: string
  assetId: string | null
  spec: {
    id: string
    name: string
    description: string
    assemblageId: string
    channels: ChannelSpec[]
    tags: Record<string, string>
    version: number
  }
  channelBindings: ChannelBinding[]
  createdAtMs: number
  version: number
}

interface ChannelSpec {
  id: string
  role: 'STATE' | 'EVENT' | 'METRIC'
  source: { id: string; kind: string; connection: string }
  materialization: string
}

interface ChannelBinding {
  channelId: string
  role: 'STATE' | 'EVENT' | 'METRIC'
  active: boolean
  rowCount: number | null
  lastUpdatedMs: number | null
  data: ChannelData | null
}

type ChannelData =
  | { type: 'inline'; value: unknown }
  | { type: 'rows'; value: unknown[] }
  | { type: 'pending' }

interface ViewDelta {
  viewId: string
  sequence: number
  timestamp: number
  delta: {
    type: 'channelUpdated'
    content: { channelId: string; rowCount: number; timestampMs: number }
  }
}

interface ReconcilerEvent {
  type: 'ViewSubscribed' | 'ViewUnsubscribed' | 'ViewInvalidated' | 'ArtifactPublished'
  viewId: string
  timestamp: number
  details?: Record<string, unknown>
}

let deltaSequence = 0

function createMockArtifact(viewId: string): ViewArtifact {
  return {
    viewId,
    assetId: `asset-${viewId}-${Date.now()}`,
    spec: {
      id: viewId,
      name: `View ${viewId}`,
      description: `Mock view for testing: ${viewId}`,
      assemblageId: 'test-assemblage',
      channels: [
        {
          id: 'state',
          role: 'STATE',
          source: { id: 'mock-db', kind: 'sql', connection: 'sqlite::memory:' },
          materialization: 'cached',
        },
        {
          id: 'events',
          role: 'EVENT',
          source: { id: 'mock-stream', kind: 'stream', connection: 'nats://events' },
          materialization: 'continuous',
        },
      ],
      tags: { mock: 'true', env: 'development' },
      version: 1,
    },
    channelBindings: [
      {
        channelId: 'state',
        role: 'STATE',
        active: true,
        rowCount: Math.floor(Math.random() * 100) + 10,
        lastUpdatedMs: Date.now(),
        data: {
          type: 'rows',
          value: [
            { id: 1, name: 'Item A', value: Math.random() * 100 },
            { id: 2, name: 'Item B', value: Math.random() * 100 },
            { id: 3, name: 'Item C', value: Math.random() * 100 },
          ],
        },
      },
      {
        channelId: 'events',
        role: 'EVENT',
        active: true,
        rowCount: null,
        lastUpdatedMs: Date.now(),
        data: { type: 'pending' },
      },
    ],
    createdAtMs: Date.now(),
    version: 1,
  }
}

function createMockDelta(viewId: string): ViewDelta {
  deltaSequence++
  return {
    viewId,
    sequence: deltaSequence,
    timestamp: Date.now(),
    delta: {
      type: 'channelUpdated',
      content: {
        channelId: 'state',
        rowCount: Math.floor(Math.random() * 100) + 10,
        timestampMs: Date.now(),
      },
    },
  }
}

function createEvent(
  type: ReconcilerEvent['type'],
  viewId: string,
  details?: Record<string, unknown>
): ReconcilerEvent {
  return { type, viewId, timestamp: Date.now(), details }
}

// =============================================================================
// Publisher
// =============================================================================

class AvaMockPublisher {
  private nc: NatsConnection | null = null
  private sc = StringCodec()
  private subscriptions: Subscription[] = []
  private activeViews = new Set<string>()
  private deltaInterval: ReturnType<typeof setInterval> | null = null

  async connect(): Promise<void> {
    console.log(`Connecting to NATS at ${NATS_WS_URL}...`)
    this.nc = await connect({ servers: NATS_WS_URL })
    console.log('✓ Connected to NATS\n')
  }

  async start(): Promise<void> {
    if (!this.nc) throw new Error('Not connected')

    // Subscribe to request channels
    await this.subscribeToRequests()

    // Start periodic delta publishing
    this.startDeltaPublishing()

    console.log('AVA Mock Publisher running.')
    console.log('Waiting for subscribe requests...\n')
  }

  private async subscribeToRequests(): Promise<void> {
    if (!this.nc) return

    // Subscribe to subscribe requests
    const subscribeSub = this.nc.subscribe(`${SUBJECT_PREFIX}.request.subscribe.*`)
    this.subscriptions.push(subscribeSub)
    ;(async () => {
      for await (const msg of subscribeSub) {
        try {
          const data = JSON.parse(this.sc.decode(msg.data))
          const viewId = data.view_id || msg.subject.split('.').pop()
          console.log(`← [SUBSCRIBE] ${viewId}`)
          this.handleSubscribe(viewId)
        } catch (e) {
          console.error('Error processing subscribe:', e)
        }
      }
    })()

    // Subscribe to invalidate requests
    const invalidateSub = this.nc.subscribe(`${SUBJECT_PREFIX}.request.invalidate.*`)
    this.subscriptions.push(invalidateSub)
    ;(async () => {
      for await (const msg of invalidateSub) {
        try {
          const data = JSON.parse(this.sc.decode(msg.data))
          const viewId = data.view_id || msg.subject.split('.').pop()
          console.log(`← [INVALIDATE] ${viewId}`)
          this.handleInvalidate(viewId)
        } catch (e) {
          console.error('Error processing invalidate:', e)
        }
      }
    })()

    // Subscribe to unsubscribe requests
    const unsubscribeSub = this.nc.subscribe(`${SUBJECT_PREFIX}.request.unsubscribe.*`)
    this.subscriptions.push(unsubscribeSub)
    ;(async () => {
      for await (const msg of unsubscribeSub) {
        try {
          const data = JSON.parse(this.sc.decode(msg.data))
          const viewId = data.view_id || msg.subject.split('.').pop()
          console.log(`← [UNSUBSCRIBE] ${viewId}`)
          this.handleUnsubscribe(viewId)
        } catch (e) {
          console.error('Error processing unsubscribe:', e)
        }
      }
    })()

    console.log('Subscribed to request channels:')
    console.log(`  - ${SUBJECT_PREFIX}.request.subscribe.*`)
    console.log(`  - ${SUBJECT_PREFIX}.request.invalidate.*`)
    console.log(`  - ${SUBJECT_PREFIX}.request.unsubscribe.*`)
    console.log()
  }

  private handleSubscribe(viewId: string): void {
    this.activeViews.add(viewId)

    // Publish initial artifact
    const artifact = createMockArtifact(viewId)
    this.publishArtifact(viewId, artifact)

    // Publish subscribe event
    this.publishEvent(createEvent('ViewSubscribed', viewId))
  }

  private handleInvalidate(viewId: string): void {
    if (!this.activeViews.has(viewId)) {
      this.activeViews.add(viewId)
    }

    // Publish fresh artifact
    const artifact = createMockArtifact(viewId)
    this.publishArtifact(viewId, artifact)

    // Publish invalidate event
    this.publishEvent(createEvent('ViewInvalidated', viewId, { reason: 'manual' }))
  }

  private handleUnsubscribe(viewId: string): void {
    this.activeViews.delete(viewId)
    this.publishEvent(createEvent('ViewUnsubscribed', viewId))
  }

  private publishArtifact(viewId: string, artifact: ViewArtifact): void {
    if (!this.nc) return
    const subject = `${SUBJECT_PREFIX}.artifacts.${viewId}`
    this.nc.publish(subject, this.sc.encode(JSON.stringify(artifact)))
    console.log(`→ [ARTIFACT] ${subject}`)
  }

  private publishDelta(viewId: string, delta: ViewDelta): void {
    if (!this.nc) return
    const subject = `${SUBJECT_PREFIX}.deltas.${viewId}`
    this.nc.publish(subject, this.sc.encode(JSON.stringify(delta)))
    console.log(`→ [DELTA] ${subject} seq=${delta.sequence}`)
  }

  private publishEvent(event: ReconcilerEvent): void {
    if (!this.nc) return
    const subject = `${SUBJECT_PREFIX}.events.${event.type}`
    this.nc.publish(subject, this.sc.encode(JSON.stringify(event)))
    console.log(`→ [EVENT] ${subject}`)
  }

  private startDeltaPublishing(): void {
    this.deltaInterval = setInterval(() => {
      for (const viewId of this.activeViews) {
        const delta = createMockDelta(viewId)
        this.publishDelta(viewId, delta)
      }
    }, DELTA_INTERVAL_MS)
  }

  async shutdown(): Promise<void> {
    if (this.deltaInterval) {
      clearInterval(this.deltaInterval)
    }
    for (const sub of this.subscriptions) {
      sub.unsubscribe()
    }
    if (this.nc) {
      await this.nc.drain()
    }
    console.log('\nShutdown complete.')
  }
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const publisher = new AvaMockPublisher()

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...')
    await publisher.shutdown()
    process.exit(0)
  })

  try {
    await publisher.connect()
    await publisher.start()

    // Keep running
    await new Promise(() => {})
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
