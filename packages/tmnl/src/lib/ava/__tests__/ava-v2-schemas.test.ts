/**
 * AVA v2 Schema Tests
 *
 * Tests for v2 schemas including ChannelData, ViewStatusEvent, and updated ChannelBinding.
 * Validates Rust ↔ TypeScript alignment.
 *
 * @module
 */

import { describe, it, expect } from '@effect/vitest'
import { Schema, Effect } from 'effect'

import {
  // Channel data types
  ChannelData,
  ChannelDataInline,
  ChannelDataRows,
  ChannelDataAssetRef,
  ChannelDataStreamHandle,
  ChannelDataError,
  ChannelDataPending,
  isHydrated,
  isError,
  isPending,
  isInline,
  isRows,
  isAssetRef,
  isStreamHandle,
  // Status types
  ViewLifecycleStatus,
  ViewStatusEvent,
  InvalidationRequest,
  // Artifacts with ChannelData
  ChannelBinding,
} from '../schemas/v2'

// ============================================================================
// ChannelData Schemas
// ============================================================================

describe('ChannelData', () => {
  describe('ChannelDataInline', () => {
    it.effect('decodes inline JSON value', () =>
      Effect.gen(function* () {
        const input = { type: 'inline' as const, value: { count: 42, name: 'test' } }
        const result = yield* Schema.decode(ChannelDataInline)(input)

        expect(result.type).toBe('inline')
        expect(result.value).toEqual({ count: 42, name: 'test' })
      })
    )
  })

  describe('ChannelDataRows', () => {
    it.effect('decodes tabular row data', () =>
      Effect.gen(function* () {
        const input = {
          type: 'rows' as const,
          value: [
            { id: 1, name: 'row1' },
            { id: 2, name: 'row2' },
          ],
        }
        const result = yield* Schema.decode(ChannelDataRows)(input)

        expect(result.type).toBe('rows')
        expect(result.value).toHaveLength(2)
      })
    )
  })

  describe('ChannelDataAssetRef', () => {
    it.effect('decodes asset reference', () =>
      Effect.gen(function* () {
        const input = {
          type: 'assetRef' as const,
          value: {
            uri: 's3://bucket/model.glb',
            mimeType: 'model/gltf-binary',
            etag: 'abc123',
          },
        }
        const result = yield* Schema.decode(ChannelDataAssetRef)(input)

        expect(result.type).toBe('assetRef')
        expect(result.value.uri).toBe('s3://bucket/model.glb')
        expect(result.value.mimeType).toBe('model/gltf-binary')
      })
    )
  })

  describe('ChannelDataStreamHandle', () => {
    it.effect('decodes stream handle', () =>
      Effect.gen(function* () {
        const input = {
          type: 'streamHandle' as const,
          value: {
            topic: 'tmnl.telemetry.truck-42',
            cursor: 1234,
          },
        }
        const result = yield* Schema.decode(ChannelDataStreamHandle)(input)

        expect(result.type).toBe('streamHandle')
        expect(result.value.topic).toBe('tmnl.telemetry.truck-42')
      })
    )
  })

  describe('ChannelDataError', () => {
    it.effect('decodes error state', () =>
      Effect.gen(function* () {
        const input = {
          type: 'error' as const,
          value: {
            code: 'HYDRATION_FAILED',
            message: 'Database connection timeout',
            retryable: true,
          },
        }
        const result = yield* Schema.decode(ChannelDataError)(input)

        expect(result.type).toBe('error')
        expect(result.value.code).toBe('HYDRATION_FAILED')
        expect(result.value.retryable).toBe(true)
      })
    )
  })

  describe('ChannelDataPending', () => {
    it.effect('decodes pending state', () =>
      Effect.gen(function* () {
        const input = { type: 'pending' as const }
        const result = yield* Schema.decode(ChannelDataPending)(input)

        expect(result.type).toBe('pending')
      })
    )
  })

  describe('ChannelData union', () => {
    it.effect('decodes all variants', () =>
      Effect.gen(function* () {
        const variants = [
          { type: 'inline' as const, value: 42 },
          { type: 'rows' as const, value: [1, 2, 3] },
          { type: 'assetRef' as const, value: { uri: 'https://example.com/asset' } },
          { type: 'streamHandle' as const, value: { topic: 'test' } },
          { type: 'error' as const, value: { code: 'E1', message: 'err', retryable: false } },
          { type: 'pending' as const },
        ]

        for (const input of variants) {
          const result = yield* Schema.decode(ChannelData)(input)
          expect(result.type).toBe(input.type)
        }
      })
    )
  })

  describe('type guards', () => {
    it('isHydrated returns true for data, false for pending/error', () => {
      const inline: ChannelData = { type: 'inline', value: 42 } as any
      const pending: ChannelData = { type: 'pending' } as any
      const error: ChannelData = {
        type: 'error',
        value: { code: 'E1', message: 'err', retryable: false },
      } as any

      expect(isHydrated(inline)).toBe(true)
      expect(isHydrated(pending)).toBe(false)
      expect(isHydrated(error)).toBe(false)
    })

    it('type-specific guards work correctly', () => {
      const inline: ChannelData = { type: 'inline', value: 42 } as any
      const rows: ChannelData = { type: 'rows', value: [] } as any
      const assetRef: ChannelData = {
        type: 'assetRef',
        value: { uri: 'test' },
      } as any
      const streamHandle: ChannelData = {
        type: 'streamHandle',
        value: { topic: 'test' },
      } as any
      const error: ChannelData = {
        type: 'error',
        value: { code: 'E1', message: 'err', retryable: false },
      } as any
      const pending: ChannelData = { type: 'pending' } as any

      expect(isInline(inline)).toBe(true)
      expect(isRows(rows)).toBe(true)
      expect(isAssetRef(assetRef)).toBe(true)
      expect(isStreamHandle(streamHandle)).toBe(true)
      expect(isError(error)).toBe(true)
      expect(isPending(pending)).toBe(true)
    })
  })
})

// ============================================================================
// Status Schemas
// ============================================================================

describe('ViewStatusEvent', () => {
  it.effect('decodes status event from NATS', () =>
    Effect.gen(function* () {
      const input = {
        viewId: 'truck-42',
        status: 'hydrating' as const,
        timestampMs: Date.now(),
        progressPct: 75,
        message: 'Hydrating telemetry channel',
      }

      const result = yield* Schema.decode(ViewStatusEvent)(input)

      expect(result.viewId).toBe('truck-42')
      expect(result.status).toBe('hydrating')
      expect(result.progressPct).toBe(75)
    })
  )

  it.effect('validates lifecycle status enum', () =>
    Effect.gen(function* () {
      const validStatuses = [
        'pending',
        'compiling',
        'hydrating',
        'ready',
        'stale',
        'error',
        'suspended',
        'unmounting',
      ] as const

      for (const status of validStatuses) {
        const result = yield* Schema.decode(ViewLifecycleStatus)(status)
        expect(result).toBe(status)
      }
    })
  )
})

describe('InvalidationRequest', () => {
  it.effect('decodes invalidation command', () =>
    Effect.gen(function* () {
      const input = {
        viewId: 'dashboard-1',
        reason: 'User requested refresh',
        force: true,
      }

      const result = yield* Schema.decode(InvalidationRequest)(input)

      expect(result.viewId).toBe('dashboard-1')
      expect(result.reason).toBe('User requested refresh')
      expect(result.force).toBe(true)
    })
  )
})

// ============================================================================
// ChannelBinding with ChannelData
// ============================================================================

describe('ChannelBinding with data', () => {
  it.effect('decodes channel binding with hydrated data', () =>
    Effect.gen(function* () {
      const input = {
        channelId: 'telemetry',
        name: 'Telemetry Channel',
        role: 'CHANNEL_ROLE_EVENT' as const,
        active: true,
        rowCount: 100,
        lastUpdatedMs: Date.now(),
        data: {
          type: 'rows' as const,
          value: [{ lat: 40.7128, lng: -74.006 }],
        },
      }

      const result = yield* Schema.decode(ChannelBinding)(input)

      expect(result.channelId).toBe('telemetry')
      expect(result.data).toBeDefined()
      expect(result.data!.type).toBe('rows')
    })
  )

  it.effect('decodes channel binding with pending data', () =>
    Effect.gen(function* () {
      const input = {
        channelId: 'geometry',
        name: 'Geometry Channel',
        role: 'CHANNEL_ROLE_STATE' as const,
        active: true,
        data: { type: 'pending' as const },
      }

      const result = yield* Schema.decode(ChannelBinding)(input)

      expect(result.data).toBeDefined()
      expect(result.data!.type).toBe('pending')
    })
  )

  it.effect('decodes channel binding without data (not yet hydrated)', () =>
    Effect.gen(function* () {
      const input = {
        channelId: 'metrics',
        name: 'Metrics Channel',
        role: 'CHANNEL_ROLE_METRIC' as const,
        active: false,
      }

      const result = yield* Schema.decode(ChannelBinding)(input)

      expect(result.data).toBeUndefined()
    })
  )
})

// ============================================================================
// Round-trip Tests (Rust ↔ TypeScript alignment)
// ============================================================================

describe('Rust serde alignment', () => {
  it.effect('encodes ChannelData matching Rust serde adjacently tagged enum', () =>
    Effect.gen(function* () {
      const data: typeof ChannelDataInline.Type = {
        type: 'inline',
        value: { temperature: 72.5 },
      }

      const encoded = yield* Schema.encode(ChannelData)(data)

      // Rust uses adjacently tagged enum: tag = "type", content = "value"
      expect(encoded).toHaveProperty('type', 'inline')
      expect(encoded).toHaveProperty('value')
    })
  )

  it.effect('ViewStatusEvent matches Rust serialization', () =>
    Effect.gen(function* () {
      const event: typeof ViewStatusEvent.Type = {
        viewId: 'test-view' as any, // branded type
        status: 'ready',
        timestampMs: 1704067200000,
        progressPct: 100,
        message: 'View ready',
      }

      const encoded = yield* Schema.encode(ViewStatusEvent)(event)

      // Should match Rust's #[serde(rename_all = "camelCase")]
      expect(encoded).toHaveProperty('viewId')
      expect(encoded).toHaveProperty('status')
      expect(encoded).toHaveProperty('timestampMs')
    })
  )
})
