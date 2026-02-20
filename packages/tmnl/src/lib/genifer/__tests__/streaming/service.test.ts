/**
 * StreamingJsonService Integration Tests
 *
 * Validates the full pipeline:
 *   string chunks → tokenizer → d2ts graph → service atoms → identifications
 *
 * Uses Registry.make() for isolated atom state per test.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as Registry from '@effect-atom/atom/Registry'
import { Option } from 'effect'
import {
  createStreamingJsonService,
  identifiedComponentsAtom,
  isParsingAtom,
  tokensAtom,
  partialFieldsAtom,
  streamingErrorAtom,
  chunkCountAtom,
  type StreamingJsonServiceShape,
} from '../../streaming/service.js'

describe('StreamingJsonService', () => {
  let service: StreamingJsonServiceShape
  let r: Registry.Registry

  beforeEach(() => {
    r = Registry.make()
    service = createStreamingJsonService(r)
    service.reset()
  })

  // ─────────────────────────────────────────────────────────
  // H1: Component identified before full JSON arrives
  // ─────────────────────────────────────────────────────────

  it('identifies component from partial stream (type before other fields)', () => {
    service.feedChunk('{"type": "MorphCard"')

    const identified = r.get(identifiedComponentsAtom)
    expect(identified).toHaveLength(1)
    expect(identified[0].componentType).toBe('MorphCard')

    expect(r.get(isParsingAtom)).toBe(true)
  })

  it('identifies component using _tag discriminator', () => {
    service.feedChunk('{"_tag": "DataGrid"')

    const identified = r.get(identifiedComponentsAtom)
    expect(identified).toHaveLength(1)
    expect(identified[0].componentType).toBe('DataGrid')
  })

  // ─────────────────────────────────────────────────────────
  // H2: Props populated as they stream in
  // ─────────────────────────────────────────────────────────

  it('accumulates partial fields as props stream in', () => {
    service.feedChunk('{"type": "MorphCard", "title": "Hello"')

    const fields = r.get(partialFieldsAtom)
    let foundTitle = false
    for (const [, record] of fields) {
      if (record['title'] === 'Hello') foundTitle = true
    }
    expect(foundTitle).toBe(true)
  })

  it('updates partial fields as more props arrive', () => {
    service.feedChunk('{"type": "MorphCard", ')
    service.feedChunk('"title": "Hello", ')
    service.feedChunk('"subtitle": "World"')

    const fields = r.get(partialFieldsAtom)
    let found = false
    for (const [, record] of fields) {
      if (record['title'] === 'Hello' && record['subtitle'] === 'World') {
        found = true
      }
    }
    expect(found).toBe(true)
  })

  // ─────────────────────────────────────────────────────────
  // H3: Multiple components in array handled
  // ─────────────────────────────────────────────────────────

  it('identifies multiple components in an array stream', () => {
    service.feedChunk('[{"type": "Heading", "text": "Hi"}, {"type": "Paragraph"')

    const identified = r.get(identifiedComponentsAtom)
    expect(identified.length).toBeGreaterThanOrEqual(2)

    const types = identified.map((c) => c.componentType)
    expect(types).toContain('Heading')
    expect(types).toContain('Paragraph')
  })

  // ─────────────────────────────────────────────────────────
  // H4: Chunk counting and version monotonicity
  // ─────────────────────────────────────────────────────────

  it('tracks chunk count', () => {
    service.feedChunk('{"type"')
    service.feedChunk(': "A"}')

    expect(r.get(chunkCountAtom)).toBe(2)
  })

  it('version increases monotonically', () => {
    service.feedChunk('{"type": "A"}')
    const v1 = service.version
    service.feedChunk('{"type": "B"}')
    const v2 = service.version

    expect(v2).toBeGreaterThan(v1)
  })

  // ─────────────────────────────────────────────────────────
  // H5: Reset clears all state
  // ─────────────────────────────────────────────────────────

  it('reset clears all atoms', () => {
    service.feedChunk('{"type": "MorphCard"}')
    expect(r.get(identifiedComponentsAtom).length).toBeGreaterThan(0)

    service.reset()

    expect(r.get(identifiedComponentsAtom)).toEqual([])
    expect(r.get(tokensAtom)).toEqual([])
    expect(r.get(isParsingAtom)).toBe(false)
    expect(r.get(chunkCountAtom)).toBe(0)
    expect(Option.isNone(r.get(streamingErrorAtom))).toBe(true)
  })

  it('reset allows a new stream to be started', () => {
    service.feedChunk('{"type": "A"}')
    service.reset()
    service.feedChunk('{"type": "B"}')

    const identified = r.get(identifiedComponentsAtom)
    expect(identified).toHaveLength(1)
    expect(identified[0].componentType).toBe('B')
  })

  // ─────────────────────────────────────────────────────────
  // H6: Token history tracks emissions
  // ─────────────────────────────────────────────────────────

  it('populates token history', () => {
    service.feedChunk('{"type": "X"}')

    const tokens = r.get(tokensAtom)
    expect(tokens.length).toBeGreaterThan(0)

    const tags = tokens.map((t) => t._tag)
    expect(tags).toContain('ObjectStart')
    expect(tags).toContain('Key')
    expect(tags).toContain('String')
    expect(tags).toContain('ObjectEnd')
  })

  // ─────────────────────────────────────────────────────────
  // H7: Flush finalizes parsing
  // ─────────────────────────────────────────────────────────

  it('flush marks parsing as complete', () => {
    service.feedChunk('{"type": "A"')
    expect(r.get(isParsingAtom)).toBe(true)

    service.flush()
    expect(r.get(isParsingAtom)).toBe(false)
  })

  // ─────────────────────────────────────────────────────────
  // H8: End-to-end SSE simulation
  // ─────────────────────────────────────────────────────────

  it('end-to-end SSE simulation: chunked → identified → props available', () => {
    const sseChunks = [
      '{"type": ',
      '"StatusCard",',
      ' "title": "System Health",',
      ' "status": "operational",',
      ' "metrics": {"cpu": 42, "mem": 78}}',
    ]

    for (const chunk of sseChunks) {
      service.feedChunk(chunk)
    }
    service.flush()

    const identified = r.get(identifiedComponentsAtom)
    expect(identified).toHaveLength(1)
    expect(identified[0].componentType).toBe('StatusCard')

    expect(r.get(isParsingAtom)).toBe(false)
    expect(r.get(chunkCountAtom)).toBe(5)
  })
})
