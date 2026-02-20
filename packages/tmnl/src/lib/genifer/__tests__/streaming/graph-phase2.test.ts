/**
 * Phase 2 E2E tests — Extended Graph Callbacks
 *
 * Tests: RawComponentData, onComponentPropsComplete, onComponentComplete,
 * completion frontier Φ(t)
 */
import { describe, it, expect } from 'vitest'
import {
  createStreamingGraph,
  type RawComponentData,
  type ComponentIdentification,
} from '../../streaming/graph.js'
import type { JSONToken } from '../../streaming/tokenizer.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestGraph() {
  const identified: ComponentIdentification[] = []
  const propsComplete: RawComponentData[] = []
  const completed: RawComponentData[] = []
  const frontierHistory: ReadonlySet<string>[] = []
  const tokens: JSONToken[] = []

  const graph = createStreamingGraph({
    onComponentIdentified: (id) => identified.push(id),
    onComponentPropsComplete: (data) => propsComplete.push(data),
    onComponentComplete: (data) => completed.push(data),
    onFrontierAdvance: (frontier) => frontierHistory.push(new Set(frontier)),
    onToken: (t) => tokens.push(t),
  })

  return { graph, identified, propsComplete, completed, frontierHistory, tokens }
}

// ---------------------------------------------------------------------------
// RawComponentData (#1887)
// ---------------------------------------------------------------------------

describe('RawComponentData', () => {
  it('accumulates componentType, elementKey, and fields', () => {
    const { graph, completed } = createTestGraph()

    graph.sendChunk('{"type":"Card","key":"c1","props":{"title":"Hello"}}')
    graph.flush()

    expect(completed).toHaveLength(1)
    expect(completed[0].componentType).toBe('Card')
    expect(completed[0].elementKey).toBe('c1')
    expect(completed[0].fields).toMatchObject({
      type: 'Card',
      key: 'c1',
    })
    expect(completed[0].depth).toBe(1)
  })

  it('includes startOffset and endOffset', () => {
    const { graph, completed } = createTestGraph()

    graph.sendChunk('{"type":"Card","key":"c1"}')
    graph.flush()

    expect(completed).toHaveLength(1)
    expect(completed[0].startOffset).toBe(1) // offset of {
    expect(completed[0].endOffset).toBeTypeOf('number')
    expect(completed[0].endOffset!).toBeGreaterThan(completed[0].startOffset)
  })

  it('collects childKeys from nested identified components', () => {
    const { graph, completed } = createTestGraph()

    const json = JSON.stringify({
      type: 'Page',
      key: 'p1',
      children: [
        { type: 'Card', key: 'c1' },
        { type: 'Card', key: 'c2' },
      ],
    })

    graph.sendChunk(json)
    graph.flush()

    // Page completes last
    const page = completed.find((c) => c.componentType === 'Page')
    expect(page).toBeDefined()
    expect(page!.childKeys).toEqual(['c1', 'c2'])
  })
})

// ---------------------------------------------------------------------------
// onComponentPropsComplete (#1888)
// ---------------------------------------------------------------------------

describe('onComponentPropsComplete', () => {
  it('fires when children array starts (props are all seen)', () => {
    const { graph, propsComplete } = createTestGraph()

    const json = JSON.stringify({
      type: 'Page',
      key: 'p1',
      title: 'Dashboard',
      children: [{ type: 'Card', key: 'c1' }],
    })

    graph.sendChunk(json)
    graph.flush()

    const pageProps = propsComplete.find((p) => p.componentType === 'Page')
    expect(pageProps).toBeDefined()
    expect(pageProps!.propsComplete).toBe(true)
    expect(pageProps!.fields).toMatchObject({
      type: 'Page',
      key: 'p1',
      title: 'Dashboard',
    })
  })

  it('fires on ObjectEnd if no children array exists', () => {
    const { graph, propsComplete } = createTestGraph()

    graph.sendChunk('{"type":"Text","key":"t1","text":"hello"}')
    graph.flush()

    expect(propsComplete).toHaveLength(1)
    expect(propsComplete[0].componentType).toBe('Text')
    expect(propsComplete[0].elementKey).toBe('t1')
  })

  it('fires exactly once per component (no double fire)', () => {
    const { graph, propsComplete } = createTestGraph()

    const json = JSON.stringify({
      type: 'Page',
      key: 'p1',
      children: [{ type: 'Card', key: 'c1' }],
    })

    graph.sendChunk(json)
    graph.flush()

    // Page should fire propsComplete once (at children array), not again at ObjectEnd
    const pageEvents = propsComplete.filter((p) => p.componentType === 'Page')
    expect(pageEvents).toHaveLength(1)
  })

  it('fires for leaf components inside chunked stream', () => {
    const { graph, propsComplete } = createTestGraph()

    graph.sendChunk('{"type":"Met')
    graph.sendChunk('ricCard","key":"m1","la')
    graph.sendChunk('bel":"CPU","value":42}')
    graph.flush()

    expect(propsComplete).toHaveLength(1)
    expect(propsComplete[0].componentType).toBe('MetricCard')
    expect(propsComplete[0].elementKey).toBe('m1')
  })
})

// ---------------------------------------------------------------------------
// onComponentComplete (#1889)
// ---------------------------------------------------------------------------

describe('onComponentComplete', () => {
  it('fires on ObjectEnd for identified components', () => {
    const { graph, completed } = createTestGraph()

    graph.sendChunk('{"type":"Card","key":"c1","title":"Hello"}')
    graph.flush()

    expect(completed).toHaveLength(1)
    expect(completed[0].componentType).toBe('Card')
    expect(completed[0].endOffset).toBeTypeOf('number')
  })

  it('fires children before parent (bottom-up order)', () => {
    const { graph, completed } = createTestGraph()

    const json = JSON.stringify({
      type: 'Page',
      key: 'p1',
      children: [
        { type: 'Card', key: 'c1' },
        { type: 'Card', key: 'c2' },
      ],
    })

    graph.sendChunk(json)
    graph.flush()

    expect(completed).toHaveLength(3)
    expect(completed[0].componentType).toBe('Card')
    expect(completed[0].elementKey).toBe('c1')
    expect(completed[1].componentType).toBe('Card')
    expect(completed[1].elementKey).toBe('c2')
    expect(completed[2].componentType).toBe('Page')
    expect(completed[2].elementKey).toBe('p1')
  })

  it('does NOT fire for non-component objects (e.g. props)', () => {
    const { graph, completed } = createTestGraph()

    // props is a nested object but has no type/_tag → not a component
    graph.sendChunk('{"type":"Card","key":"c1","props":{"color":"red","size":42}}')
    graph.flush()

    // Only the Card should fire, not the props object
    expect(completed).toHaveLength(1)
    expect(completed[0].componentType).toBe('Card')
  })

  it('includes all accumulated fields at completion time', () => {
    const { graph, completed } = createTestGraph()

    graph.sendChunk('{"type":"MetricCard","key":"m1","label":"CPU","value":95,"unit":"%"}')
    graph.flush()

    expect(completed[0].fields).toMatchObject({
      type: 'MetricCard',
      key: 'm1',
      label: 'CPU',
      value: 95,
      unit: '%',
    })
  })
})

// ---------------------------------------------------------------------------
// Completion frontier Φ(t) (#1890)
// ---------------------------------------------------------------------------

describe('Completion frontier Φ(t)', () => {
  it('grows monotonically as components complete', () => {
    const { graph, frontierHistory } = createTestGraph()

    const json = JSON.stringify({
      type: 'Page',
      key: 'p1',
      children: [
        { type: 'Card', key: 'c1' },
        { type: 'Card', key: 'c2' },
      ],
    })

    graph.sendChunk(json)
    graph.flush()

    // 3 frontier events: c1 completes, c2 completes, p1 completes
    expect(frontierHistory).toHaveLength(3)
    expect(frontierHistory[0]).toEqual(new Set(['c1']))
    expect(frontierHistory[1]).toEqual(new Set(['c1', 'c2']))
    expect(frontierHistory[2]).toEqual(new Set(['c1', 'c2', 'p1']))
  })

  it('is readable via graph.frontier property', () => {
    const { graph } = createTestGraph()

    graph.sendChunk('{"type":"Card","key":"c1"}')
    graph.flush()

    expect(graph.frontier.has('c1')).toBe(true)
    expect(graph.frontier.size).toBe(1)
  })

  it('resets when graph.reset() is called', () => {
    const { graph } = createTestGraph()

    graph.sendChunk('{"type":"Card","key":"c1"}')
    graph.flush()
    expect(graph.frontier.size).toBe(1)

    graph.reset()
    expect(graph.frontier.size).toBe(0)
  })

  it('does not fire for components without key', () => {
    const { graph, frontierHistory } = createTestGraph()

    graph.sendChunk('{"type":"Card"}') // no key
    graph.flush()

    expect(frontierHistory).toHaveLength(0)
    expect(graph.frontier.size).toBe(0)
  })

  it('handles chunked streaming with progressive frontier growth', () => {
    const { graph, frontierHistory } = createTestGraph()

    // Send first child complete
    graph.sendChunk('{"type":"Page","key":"p1","children":[{"type":"Card","key":"c1"}')
    graph.flush()
    expect(graph.frontier).toEqual(new Set(['c1']))

    // Send second child complete
    graph.sendChunk(',{"type":"Card","key":"c2"}')
    graph.flush()
    expect(graph.frontier).toEqual(new Set(['c1', 'c2']))

    // Close children array and page
    graph.sendChunk(']}')
    graph.flush()
    expect(graph.frontier).toEqual(new Set(['c1', 'c2', 'p1']))
  })
})

// ---------------------------------------------------------------------------
// Integration: Full pipeline with all callbacks
// ---------------------------------------------------------------------------

describe('Phase 2 Integration', () => {
  it('complete pipeline: identify → propsComplete → complete → frontier', () => {
    const { graph, identified, propsComplete, completed, frontierHistory } = createTestGraph()

    const json = JSON.stringify({
      type: 'Dashboard',
      key: 'dash',
      title: 'DevOps',
      children: [
        { type: 'MetricCard', key: 'm1', label: 'CPU', value: 42 },
        { type: 'MetricCard', key: 'm2', label: 'Memory', value: 87 },
      ],
    })

    graph.sendChunk(json)
    graph.flush()

    // Identification: 3 components
    expect(identified).toHaveLength(3)

    // Props complete: 3 components (2 metrics + dashboard)
    expect(propsComplete).toHaveLength(3)

    // Completion: 3 components, children first
    expect(completed).toHaveLength(3)
    expect(completed[0].elementKey).toBe('m1')
    expect(completed[1].elementKey).toBe('m2')
    expect(completed[2].elementKey).toBe('dash')
    expect(completed[2].childKeys).toEqual(['m1', 'm2'])

    // Frontier: 3 events, monotonically growing
    expect(frontierHistory).toHaveLength(3)
    expect(frontierHistory[2]).toEqual(new Set(['m1', 'm2', 'dash']))
  })
})
