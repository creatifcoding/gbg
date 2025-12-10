/**
 * Core Module Integration Tests
 *
 * Validates that core exports work together.
 */

import { describe, it, expect } from '@effect/vitest'
import { Effect, Schema, DateTime } from 'effect'
import * as Core from '../index'

describe('Core Module Integration', () => {
  it('exports all identifier schemas', () => {
    expect(Core.AssetId).toBeDefined()
    expect(Core.SiteId).toBeDefined()
    expect(Core.SectorId).toBeDefined()
    expect(Core.ContainerId).toBeDefined()
    expect(Core.CarrierId).toBeDefined()
    expect(Core.PolicyId).toBeDefined()
    expect(Core.PropertyKey).toBeDefined()
    expect(Core.TraitId).toBeDefined()
    expect(Core.IdentityId).toBeDefined()
    expect(Core.Tag).toBeDefined()
    expect(Core.Tags).toBeDefined()
  })

  it('exports all BFO class literals', () => {
    expect(Core.BfoContinuant).toBeDefined()
    expect(Core.BfoMaterialEntity).toBeDefined()
    expect(Core.BfoProcess).toBeDefined()
    expect(Core.BfoContinuantClasses).toBeDefined()
    expect(Core.BfoOccurrentClasses).toBeDefined()
    expect(Core.BfoBaseClasses).toBeDefined()
  })

  it('exports timestamp schemas', () => {
    expect(Core.CreatedAt).toBeDefined()
    expect(Core.UpdatedAt).toBeDefined()
  })

  it('exports Provenance class', () => {
    expect(Core.Provenance).toBeDefined()
    expect(Core.SourceType).toBeDefined()
    expect(Core.Confidence).toBeDefined()
  })

  it.effect('Provenance roundtrip encode/decode', () =>
    Effect.gen(function* () {
      const now = DateTime.unsafeNow()
      const provenance = new Core.Provenance({
        sourceType: 'manual' as Core.SourceType,
        timestamp: now as Core.CreatedAt,
        confidence: 0.95 as Core.Confidence,
      })

      expect(provenance._tag).toBe('Provenance')
      expect(provenance.sourceType).toBe('manual')
      expect(provenance.isHighConfidence()).toBe(true)
      expect(provenance.isAttested()).toBe(false)

      // Encode to JSON
      const encoded = yield* Schema.encode(Core.Provenance)(provenance)
      expect(encoded).toBeDefined()

      // Decode back
      const decoded = yield* Schema.decode(Core.Provenance)(encoded)
      expect(decoded._tag).toBe('Provenance')
      expect(decoded.sourceType).toBe('manual')
    })
  )

  it.effect('BFO class literals are properly branded', () =>
    Effect.gen(function* () {
      const continuant = yield* Schema.decode(Core.BfoContinuant)('continuant')
      expect(continuant).toBe('continuant')

      const material = yield* Schema.decode(Core.BfoMaterialEntity)('material_entity')
      expect(material).toBe('material_entity')

      const process = yield* Schema.decode(Core.BfoProcess)('process')
      expect(process).toBe('process')
    })
  )

  it.effect('BfoContinuantClasses union accepts valid values', () =>
    Effect.gen(function* () {
      const values = [
        'continuant',
        'independent_continuant',
        'material_entity',
        'site',
        'object',
      ]

      for (const value of values) {
        const decoded = yield* Schema.decodeUnknown(Core.BfoContinuantClasses)(value)
        expect(decoded).toBe(value)
      }
    })
  )

  it.effect('BfoContinuantClasses union rejects invalid values', () =>
    Effect.gen(function* () {
      const result = yield* Schema.decodeUnknown(Core.BfoContinuantClasses)('invalid').pipe(
        Effect.either
      )
      expect(result._tag).toBe('Left')
    })
  )
})
