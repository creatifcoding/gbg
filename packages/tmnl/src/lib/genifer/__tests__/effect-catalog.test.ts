/**
 * Phase 0 Spike: Effect Schema → genifer Catalog Integration
 *
 * This test validates whether Effect Schema can work with genifer's
 * Zod-based catalog system via the effectToZodLike adapter.
 *
 * Success criteria:
 * 1. Can create a catalog with Effect-backed schemas ✓
 * 2. Runtime validation works (validateElement, validateTree) ✓
 * 3. TypeScript inference works (compile-time type safety) ✓
 * 4. Schema composition works (discriminatedUnion) ✓
 */

import { describe, it, expect } from 'vitest'
import { Schema } from 'effect'
// Import from submodule - will need proper path alias for production
import { createCatalog } from '../../../../../../submodules/json-render/packages/core/src'
import { effectToZodLike, zodLikeStruct } from '../effect-adapter'

// ─── Test Schemas ───────────────────────────────────────────────────────────

const CardProps = Schema.Struct({
  title: Schema.String,
  subtitle: Schema.optional(Schema.String),
})

const MetricProps = Schema.Struct({
  label: Schema.String,
  value: Schema.Union(Schema.String, Schema.Number),
  unit: Schema.optional(Schema.String),
})

const TextProps = Schema.Struct({
  content: Schema.String,
})

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Effect Schema → genifer Catalog', () => {
  describe('Adapter: effectToZodLike', () => {
    it('should implement parse() correctly', () => {
      const zodLike = effectToZodLike(CardProps)

      const result = zodLike.parse({ title: 'Test' })
      expect(result).toEqual({ title: 'Test' })
    })

    it('should throw on invalid input in parse()', () => {
      const zodLike = effectToZodLike(CardProps)

      expect(() => zodLike.parse({ title: 123 })).toThrow()
      expect(() => zodLike.parse({})).toThrow()
    })

    it('should implement safeParse() correctly', () => {
      const zodLike = effectToZodLike(CardProps)

      const success = zodLike.safeParse({ title: 'Test', subtitle: 'Sub' })
      expect(success.success).toBe(true)
      expect(success.data).toEqual({ title: 'Test', subtitle: 'Sub' })

      const failure = zodLike.safeParse({ title: 123 })
      expect(failure.success).toBe(false)
      expect(failure.error).toBeDefined()
    })

    it('should handle optional fields', () => {
      const zodLike = effectToZodLike(CardProps)

      // With optional field
      const withOptional = zodLike.parse({ title: 'Test', subtitle: 'Sub' })
      expect(withOptional.subtitle).toBe('Sub')

      // Without optional field
      const withoutOptional = zodLike.parse({ title: 'Test' })
      expect(withoutOptional.subtitle).toBeUndefined()
    })

    it('should handle union types', () => {
      const zodLike = effectToZodLike(MetricProps)

      // String value
      const withString = zodLike.parse({ label: 'Count', value: 'N/A' })
      expect(withString.value).toBe('N/A')

      // Number value
      const withNumber = zodLike.parse({ label: 'Count', value: 42 })
      expect(withNumber.value).toBe(42)
    })
  })

  describe('Catalog Creation', () => {
    it('should create a catalog with Effect-backed schemas', () => {
      // This is the critical test - can we pass effectToZodLike to createCatalog?
      const catalog = createCatalog({
        name: 'EffectTestCatalog',
        components: {
          Card: {
            props: effectToZodLike(CardProps),
            hasChildren: true,
            description: 'A card container',
          },
          Metric: {
            props: effectToZodLike(MetricProps),
            description: 'A metric display',
          },
          Text: {
            props: effectToZodLike(TextProps),
            description: 'Text content',
          },
        },
      })

      expect(catalog.name).toBe('EffectTestCatalog')
      expect(catalog.componentNames).toContain('Card')
      expect(catalog.componentNames).toContain('Metric')
      expect(catalog.componentNames).toContain('Text')
      expect(catalog.hasComponent('Card')).toBe(true)
      expect(catalog.hasComponent('Unknown')).toBe(false)
    })

    it('should validate elements correctly', () => {
      const catalog = createCatalog({
        name: 'ValidationTest',
        components: {
          Card: {
            props: effectToZodLike(CardProps),
            hasChildren: true,
          },
        },
      })

      // Valid element
      const validResult = catalog.validateElement({
        key: 'card-1',
        type: 'Card',
        props: { title: 'Test Card' },
      })
      expect(validResult.success).toBe(true)
      expect(validResult.data?.type).toBe('Card')

      // Invalid props
      const invalidProps = catalog.validateElement({
        key: 'card-2',
        type: 'Card',
        props: { title: 123 }, // Should be string
      })
      expect(invalidProps.success).toBe(false)

      // Missing required field
      const missingField = catalog.validateElement({
        key: 'card-3',
        type: 'Card',
        props: {}, // Missing title
      })
      expect(missingField.success).toBe(false)
    })

    it('should validate full UI trees', () => {
      const catalog = createCatalog({
        name: 'TreeTest',
        components: {
          Card: {
            props: effectToZodLike(CardProps),
            hasChildren: true,
          },
          Text: {
            props: effectToZodLike(TextProps),
          },
        },
      })

      // Valid tree
      const validTree = {
        root: 'card-1',
        elements: {
          'card-1': {
            key: 'card-1',
            type: 'Card',
            props: { title: 'My Card' },
            children: ['text-1'],
          },
          'text-1': {
            key: 'text-1',
            type: 'Text',
            props: { content: 'Hello world' },
          },
        },
      }

      const result = catalog.validateTree(validTree)
      expect(result.success).toBe(true)

      // Invalid tree (bad props)
      const invalidTree = {
        root: 'card-1',
        elements: {
          'card-1': {
            key: 'card-1',
            type: 'Card',
            props: { title: 42 }, // Invalid
          },
        },
      }

      const invalidResult = catalog.validateTree(invalidTree)
      expect(invalidResult.success).toBe(false)
    })
  })

  describe('Schema Composition (discriminatedUnion)', () => {
    it('should work with multiple component types', () => {
      // genifer creates a discriminatedUnion on "type" field
      // This tests whether our adapter survives that composition
      const catalog = createCatalog({
        name: 'CompositionTest',
        components: {
          Card: {
            props: effectToZodLike(CardProps),
            hasChildren: true,
          },
          Metric: {
            props: effectToZodLike(MetricProps),
          },
          Text: {
            props: effectToZodLike(TextProps),
          },
        },
      })

      // Each type should validate correctly
      const cardElement = {
        key: 'card-1',
        type: 'Card',
        props: { title: 'Card Title' },
      }
      expect(catalog.validateElement(cardElement).success).toBe(true)

      const metricElement = {
        key: 'metric-1',
        type: 'Metric',
        props: { label: 'Count', value: 100 },
      }
      expect(catalog.validateElement(metricElement).success).toBe(true)

      const textElement = {
        key: 'text-1',
        type: 'Text',
        props: { content: 'Hello' },
      }
      expect(catalog.validateElement(textElement).success).toBe(true)
    })
  })

  describe('Helper: zodLikeStruct', () => {
    it('should create struct and convert in one step', () => {
      const zodLike = zodLikeStruct({
        name: Schema.String,
        age: Schema.Number,
      })

      const result = zodLike.parse({ name: 'Alice', age: 30 })
      expect(result).toEqual({ name: 'Alice', age: 30 })
    })
  })
})
