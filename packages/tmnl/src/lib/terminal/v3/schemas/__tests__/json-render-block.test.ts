/**
 * JsonRenderBlock Schema Tests
 *
 * TDD tests for the JsonRenderBlockV3 schema and related utilities.
 */

import { describe, it, expect } from 'vitest'
import { Schema } from 'effect'

// These imports will fail until we implement them
import {
  JsonRenderBlockV3,
  isJsonRenderBlock,
  createJsonRenderBlock,
  SemanticRegionEntry,
  type JsonRenderBlockV3 as JsonRenderBlockV3Type,
} from '../json-render-block'

describe('JsonRenderBlockV3 Schema', () => {
  // ==========================================================================
  // Schema Structure Tests
  // ==========================================================================

  describe('schema structure', () => {
    it('should be a tagged struct with _tag "json-render"', () => {
      const block = createJsonRenderBlock()
      expect(block._tag).toBe('json-render')
    })

    it('should have required id field', () => {
      const block = createJsonRenderBlock()
      expect(block.id).toBeDefined()
      expect(typeof block.id).toBe('string')
      expect(block.id.length).toBeGreaterThan(0)
    })

    it('should have required timestamp field as Date', () => {
      const block = createJsonRenderBlock()
      expect(block.timestamp).toBeInstanceOf(Date)
    })

    it('should have uiTree field (initially null)', () => {
      const block = createJsonRenderBlock()
      expect(block.uiTree).toBeNull()
    })

    it('should have patches array (initially empty)', () => {
      const block = createJsonRenderBlock()
      expect(Array.isArray(block.patches)).toBe(true)
      expect(block.patches.length).toBe(0)
    })

    it('should have isStreaming boolean (initially false)', () => {
      const block = createJsonRenderBlock()
      expect(typeof block.isStreaming).toBe('boolean')
      expect(block.isStreaming).toBe(false)
    })

    it('should have semanticRegions array (initially empty)', () => {
      const block = createJsonRenderBlock()
      expect(Array.isArray(block.semanticRegions)).toBe(true)
      expect(block.semanticRegions.length).toBe(0)
    })
  })

  // ==========================================================================
  // Factory Function Tests
  // ==========================================================================

  describe('createJsonRenderBlock factory', () => {
    it('should generate unique IDs', () => {
      const block1 = createJsonRenderBlock()
      const block2 = createJsonRenderBlock()
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
      const block = createJsonRenderBlock(mockTree)
      expect(block.uiTree).toEqual(mockTree)
    })

    it('should allow setting isStreaming on creation', () => {
      const block = createJsonRenderBlock(null, true)
      expect(block.isStreaming).toBe(true)
    })
  })

  // ==========================================================================
  // Type Guard Tests
  // ==========================================================================

  describe('isJsonRenderBlock type guard', () => {
    it('should return true for JsonRenderBlock', () => {
      const block = createJsonRenderBlock()
      expect(isJsonRenderBlock(block)).toBe(true)
    })

    it('should return false for AIResponseBlock', () => {
      const aiBlock = {
        _tag: 'ai-response' as const,
        id: 'test',
        prompt: 'test',
        streamRef: { requestId: 'r1', modelId: 'm1', provider: 'p1' },
        createdAt: new Date(),
      }
      expect(isJsonRenderBlock(aiBlock)).toBe(false)
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
      expect(isJsonRenderBlock(cmdBlock)).toBe(false)
    })
  })

  // ==========================================================================
  // Schema Validation Tests
  // ==========================================================================

  describe('schema validation', () => {
    it('should encode/decode correctly', () => {
      const block = createJsonRenderBlock()
      const encoded = Schema.encodeSync(JsonRenderBlockV3)(block)
      expect(encoded._tag).toBe('json-render')

      const decoded = Schema.decodeSync(JsonRenderBlockV3)(encoded)
      expect(decoded._tag).toBe('json-render')
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
      expect(() => Schema.decodeUnknownSync(JsonRenderBlockV3)(invalidBlock)).toThrow()
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
