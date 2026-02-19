import { describe, it, expect } from 'vitest'
import {
  createStreamingGraph,
  type ComponentIdentification,
} from '../../streaming/graph.js'
import type { JSONToken } from '../../streaming/tokenizer.js'

describe('d2ts Streaming JSON Graph', () => {
  it('identifies component type from complete JSON', () => {
    const identified: ComponentIdentification[] = []
    const tokens: JSONToken[] = []

    const graph = createStreamingGraph({
      onComponentIdentified: (id) => identified.push(id),
      onToken: (t) => tokens.push(t),
    })

    graph.sendChunk('{"key":"e1","type":"Grid","columns":3}')

    expect(identified).toHaveLength(1)
    expect(identified[0].componentType).toBe('Grid')
    expect(identified[0].elementKey).toBe('e1')
    expect(tokens.length).toBeGreaterThan(0)
  })

  it('identifies component type from chunked JSON — discriminator fires early', () => {
    const identified: ComponentIdentification[] = []

    const graph = createStreamingGraph({
      onComponentIdentified: (id) => identified.push(id),
    })

    // Chunk 1: just the opening and key
    graph.sendChunk('{"key":"e1","type":"Gri')
    expect(identified).toHaveLength(0) // type string not complete yet

    // Chunk 2: completes the type — discriminator should fire HERE
    graph.sendChunk('d","columns":3,"gap":"1rem"')
    expect(identified).toHaveLength(1)
    expect(identified[0].componentType).toBe('Grid')
    expect(identified[0].elementKey).toBe('e1')

    // Chunk 3: rest of the object — no new identifications
    graph.sendChunk('}')
    expect(identified).toHaveLength(1) // still just one
  })

  it('identifies multiple components in an array', () => {
    const identified: ComponentIdentification[] = []

    const graph = createStreamingGraph({
      onComponentIdentified: (id) => identified.push(id),
    })

    graph.sendChunk(
      '[{"key":"e1","type":"Grid"},{"key":"e2","type":"Text"}]',
    )

    expect(identified).toHaveLength(2)
    expect(identified[0].componentType).toBe('Grid')
    expect(identified[0].elementKey).toBe('e1')
    expect(identified[1].componentType).toBe('Text')
    expect(identified[1].elementKey).toBe('e2')
  })

  it('handles _tag discriminator (Effect.Schema TaggedStruct)', () => {
    const identified: ComponentIdentification[] = []

    const graph = createStreamingGraph({
      onComponentIdentified: (id) => identified.push(id),
    })

    // key comes BEFORE _tag so both are available at discrimination time
    graph.sendChunk('{"key":"m1","_tag":"MorphCard","title":"Hello"}')

    expect(identified).toHaveLength(1)
    expect(identified[0].componentType).toBe('MorphCard')
    expect(identified[0].elementKey).toBe('m1')
  })

  it('handles nested objects without false positives', () => {
    const identified: ComponentIdentification[] = []

    const graph = createStreamingGraph({
      onComponentIdentified: (id) => identified.push(id),
    })

    // The outer object has type="Grid", inner props object has no type
    graph.sendChunk(
      '{"key":"e1","type":"Grid","props":{"columns":3,"gap":"1rem"}}',
    )

    // Should identify Grid once, not be confused by nested props
    expect(identified).toHaveLength(1)
    expect(identified[0].componentType).toBe('Grid')
  })

  it('handles streaming with many small chunks', () => {
    const identified: ComponentIdentification[] = []

    const graph = createStreamingGraph({
      onComponentIdentified: (id) => identified.push(id),
    })

    // Simulate character-by-character streaming
    const json = '{"type":"Card","key":"c1"}'
    for (const ch of json) {
      graph.sendChunk(ch)
    }

    expect(identified).toHaveLength(1)
    expect(identified[0].componentType).toBe('Card')
    // When streaming char-by-char, type fires before key arrives
    // elementKey may or may not be present depending on field order
  })

  it('reset clears state for new parse session', () => {
    const identified: ComponentIdentification[] = []

    const graph = createStreamingGraph({
      onComponentIdentified: (id) => identified.push(id),
    })

    graph.sendChunk('{"type":"Grid","key":"e1"}')
    const countAfterFirst = identified.length
    expect(countAfterFirst).toBe(1)

    graph.reset()
    graph.sendChunk('{"type":"Text","key":"e2"}')
    expect(identified).toHaveLength(countAfterFirst + 1) // one new identification
    expect(identified[identified.length - 1].componentType).toBe('Text')
  })

  it('version counter increments with each chunk', () => {
    const graph = createStreamingGraph({
      onComponentIdentified: () => {},
    })

    expect(graph.version).toBe(0)
    graph.sendChunk('{"a":')
    expect(graph.version).toBe(1)
    graph.sendChunk('1}')
    expect(graph.version).toBe(2)
  })

  it('key-before-type order: identifies when type arrives after key', () => {
    const identified: ComponentIdentification[] = []

    const graph = createStreamingGraph({
      onComponentIdentified: (id) => identified.push(id),
    })

    // key comes before type — both should be captured
    graph.sendChunk('{"key":"k1","type":"Flex"}')

    expect(identified.length).toBeGreaterThanOrEqual(1)
    const last = identified[identified.length - 1]
    expect(last.componentType).toBe('Flex')
    expect(last.elementKey).toBe('k1')
  })
})
