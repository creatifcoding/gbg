/**
 * GeniferBlock Schema Tests
 *
 * TDD tests for the GeniferBlockV3 schema and related utilities.
 */

import { describe, it, expect } from 'vitest'
import { Schema } from 'effect'

// These imports will fail until we implement them
import {
  GeniferBlockV3,
  isGeniferBlock,
  createGeniferBlock,
  SemanticRegionEntry,
  type GeniferBlockV3 as GeniferBlockV3Type,
} from '../genifer-block'

describe('GeniferBlockV3 Schema', () => {
  // ==========================================================================
  // Schema Structure Tests
  // ==========================================================================

  describe('schema structure', () => {
    it('should be a tagged struct with _tag "genifer"', () => {
      const block = createGeniferBlock()
      expect(block._tag).toBe('genifer')
    })

    it('should have required id field', () => {
      const block = createGeniferBlock()
      expect(block.id).toBeDefined()
      expect(typeof block.id).toBe('string')
      expect(block.id.length).toBeGreaterThan(0)
    })

    it('should have required timestamp field as Date', () => {
      const block = createGeniferBlock()
      expect(block.timestamp).toBeInstanceOf(Date)
    })

    it('should have uiTree field (initially null)', () => {
      const block = createGeniferBlock()
      expect(block.uiTree).toBeNull()
    })

    it('should have patches array (initially empty)', () => {
      const block = createGeniferBlock()
      expect(Array.isArray(block.patches)).toBe(true)
      expect(block.patches.length).toBe(0)
    })

    it('should have isStreaming boolean (initially false)', () => {
      const block = createGeniferBlock()
      expect(typeof block.isStreaming).toBe('boolean')
      expect(block.isStreaming).toBe(false)
    })

    it('should have semanticRegions array (initially empty)', () => {
      const block = createGeniferBlock()
      expect(Array.isArray(block.semanticRegions)).toBe(true)
      expect(block.semanticRegions.length).toBe(0)
    })
  })

  // ==========================================================================
  // Factory Function Tests
  // ==========================================================================

  describe('createGeniferBlock factory', () => {
    it('should generate unique IDs', () => {
      const block1 = createGeniferBlock()
      const block2 = createGeniferBlock()
      expect(block1.id).not.toBe(block2.id)
    })

    it('should accept initial uiTree', () => {
      const mockTree = {
        root: 'root-element',
        elements: {
          'root-element': {
            key: 'root-element',
            type: 'Container',
            props: {},
            children: [],
            parentKey: null,
          },
        },
      }
      const block = createGeniferBlock(mockTree)
      expect(block.uiTree).toEqual(mockTree)
    })

    it('should allow setting isStreaming on creation', () => {
      const block = createGeniferBlock(null, true)
      expect(block.isStreaming).toBe(true)
    })
  })

  // ==========================================================================
  // Type Guard Tests
  // ==========================================================================

  describe('isGeniferBlock type guard', () => {
    it('should return true for GeniferBlock', () => {
      const block = createGeniferBlock()
      expect(isGeniferBlock(block)).toBe(true)
    })

    it('should return false for AIResponseBlock', () => {
      const aiBlock = {
        _tag: 'ai-response' as const,
        id: 'test',
        prompt: 'test',
        streamRef: { requestId: 'r1', modelId: 'm1', provider: 'p1' },
        createdAt: new Date(),
      }
      expect(isGeniferBlock(aiBlock)).toBe(false)
    })

    it('should return false for CommandBlock', () => {
      const cmdBlock = {
        _tag: 'command' as const,
        id: 'test',
        command: 'ls',
        cwd: '/',
        ptyId: null,
        output: '',
        exitCode: null,
        startTime: new Date(),
        endTime: null,
      }
      expect(isGeniferBlock(cmdBlock)).toBe(false)
    })
  })

  // ==========================================================================
  // Schema Validation Tests
  // ==========================================================================

  describe('schema validation', () => {
    it('should encode/decode correctly', () => {
      const block = createGeniferBlock()
      const encoded = Schema.encodeSync(GeniferBlockV3)(block)
      expect(encoded._tag).toBe('genifer')

      const decoded = Schema.decodeSync(GeniferBlockV3)(encoded)
      expect(decoded._tag).toBe('genifer')
      expect(decoded.id).toBe(block.id)
    })

    it('should reject invalid _tag', () => {
      const invalidBlock = {
        _tag: 'invalid',
        id: 'test',
        timestamp: new Date(),
        uiTree: null,
        patches: [],
        isStreaming: false,
        semanticRegions: [],
      }
      expect(() => Schema.decodeUnknownSync(GeniferBlockV3)(invalidBlock)).toThrow()
    })
  })

  // ==========================================================================
  // SemanticRegionEntry Tests
  // ==========================================================================

  describe('SemanticRegionEntry schema', () => {
    it('should have required id and label fields', () => {
      const region = {
        id: 'chart-region',
        label: 'Sales Chart',
      }
      const decoded = Schema.decodeSync(SemanticRegionEntry)(region)
      expect(decoded.id).toBe('chart-region')
      expect(decoded.label).toBe('Sales Chart')
    })

    it('should accept optional type field', () => {
      const region = {
        id: 'chart-region',
        label: 'Sales Chart',
        type: 'chart',
      }
      const decoded = Schema.decodeSync(SemanticRegionEntry)(region)
      expect(decoded.type).toBe('chart')
    })

    it('should accept optional elementKey field', () => {
      const region = {
        id: 'chart-region',
        label: 'Sales Chart',
        elementKey: 'sales-chart-element',
      }
      const decoded = Schema.decodeSync(SemanticRegionEntry)(region)
      expect(decoded.elementKey).toBe('sales-chart-element')
    })
  })
})
