/**
 * Core Identifier Schema Tests
 *
 * Unit tests for branded identifiers.
 */

import { describe, it, expect } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import {
  AssetId,
  SiteId,
  SectorId,
  ContainerId,
  CarrierId,
  PolicyId,
  PropertyKey,
  TraitId,
  IdentityId,
  Tag,
  Tags,
  EntityId,
} from '../identifiers'

describe('Core Identifiers', () => {
  describe('AssetId', () => {
    it.effect('encodes and decodes string', () =>
      Effect.gen(function* () {
        const raw = 'asset-123'
        const encoded = yield* Schema.encode(AssetId)(raw as AssetId)
        const decoded = yield* Schema.decode(AssetId)(encoded)
        expect(decoded).toBe(raw)
      })
    )

    it.effect('rejects empty string', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(AssetId)('').pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  })

  describe('SiteId', () => {
    it.effect('encodes and decodes string', () =>
      Effect.gen(function* () {
        const raw = 'site-abc'
        const encoded = yield* Schema.encode(SiteId)(raw as SiteId)
        const decoded = yield* Schema.decode(SiteId)(encoded)
        expect(decoded).toBe(raw)
      })
    )
  })

  describe('SectorId', () => {
    it.effect('encodes and decodes string', () =>
      Effect.gen(function* () {
        const raw = 'sector-zone-a'
        const encoded = yield* Schema.encode(SectorId)(raw as SectorId)
        const decoded = yield* Schema.decode(SectorId)(encoded)
        expect(decoded).toBe(raw)
      })
    )
  })

  describe('ContainerId', () => {
    it.effect('encodes and decodes string', () =>
      Effect.gen(function* () {
        const raw = 'container-rack-01'
        const encoded = yield* Schema.encode(ContainerId)(raw as ContainerId)
        const decoded = yield* Schema.decode(ContainerId)(encoded)
        expect(decoded).toBe(raw)
      })
    )
  })

  describe('CarrierId', () => {
    it.effect('encodes and decodes string', () =>
      Effect.gen(function* () {
        const raw = 'carrier-truck-42'
        const encoded = yield* Schema.encode(CarrierId)(raw as CarrierId)
        const decoded = yield* Schema.decode(CarrierId)(encoded)
        expect(decoded).toBe(raw)
      })
    )
  })

  describe('PolicyId', () => {
    it.effect('encodes and decodes string', () =>
      Effect.gen(function* () {
        const raw = 'policy-enrichment-01'
        const encoded = yield* Schema.encode(PolicyId)(raw as PolicyId)
        const decoded = yield* Schema.decode(PolicyId)(encoded)
        expect(decoded).toBe(raw)
      })
    )
  })

  describe('PropertyKey', () => {
    it.effect('encodes and decodes string', () =>
      Effect.gen(function* () {
        const raw = 'serialNumber'
        const encoded = yield* Schema.encode(PropertyKey)(raw as PropertyKey)
        const decoded = yield* Schema.decode(PropertyKey)(encoded)
        expect(decoded).toBe(raw)
      })
    )
  })

  describe('TraitId', () => {
    it.effect('encodes and decodes string', () =>
      Effect.gen(function* () {
        const raw = 'trait-inspectable'
        const encoded = yield* Schema.encode(TraitId)(raw as TraitId)
        const decoded = yield* Schema.decode(TraitId)(encoded)
        expect(decoded).toBe(raw)
      })
    )
  })

  describe('IdentityId', () => {
    it.effect('encodes and decodes string', () =>
      Effect.gen(function* () {
        const raw = 'user-123'
        const encoded = yield* Schema.encode(IdentityId)(raw as IdentityId)
        const decoded = yield* Schema.decode(IdentityId)(encoded)
        expect(decoded).toBe(raw)
      })
    )
  })

  describe('Tag / Tags', () => {
    it.effect('Tag encodes and decodes', () =>
      Effect.gen(function* () {
        const raw = 'high-value'
        const encoded = yield* Schema.encode(Tag)(raw as Tag)
        const decoded = yield* Schema.decode(Tag)(encoded)
        expect(decoded).toBe(raw)
      })
    )

    it.effect('Tags encodes and decodes array', () =>
      Effect.gen(function* () {
        const raw = ['high-value', 'fragile', 'cold-chain'] as Tags
        const encoded = yield* Schema.encode(Tags)(raw)
        const decoded = yield* Schema.decode(Tags)(encoded)
        expect(decoded).toEqual(raw)
      })
    )
  })

  describe('EntityId', () => {
    it.effect('accepts UUID', () =>
      Effect.gen(function* () {
        const uuid = '550e8400-e29b-41d4-a716-446655440000'
        const decoded = yield* Schema.decodeUnknown(EntityId)(uuid)
        expect(decoded).toBe(uuid)
      })
    )

    it.effect('accepts non-empty string', () =>
      Effect.gen(function* () {
        const str = 'custom-id-123'
        const decoded = yield* Schema.decodeUnknown(EntityId)(str)
        expect(decoded).toBe(str)
      })
    )

    it.effect('accepts integer', () =>
      Effect.gen(function* () {
        const num = 42
        const decoded = yield* Schema.decodeUnknown(EntityId)(num)
        expect(decoded).toBe(num)
      })
    )

    it.effect('rejects empty string', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(EntityId)('').pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  })
})
