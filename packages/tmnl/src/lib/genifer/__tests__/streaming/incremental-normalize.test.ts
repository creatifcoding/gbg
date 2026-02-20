/**
 * Phase 3 E2E tests — Incremental Normalizer
 *
 * Tests: normalizeElement, quarantine queue, incremental tree builder,
 * and full streaming→normalize integration.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { Effect, Option, HashMap } from 'effect'
import {
  normalizeElement,
  resetAutoKeyCounter,
  createQuarantineQueue,
  createIncrementalTreeBuilder,
  type QuarantineEntry,
} from '../../core/incremental-normalize.js'
import {
  createStreamingGraph,
  type RawComponentData,
} from '../../streaming/graph.js'
import { UIElement } from '../../core/schemas.js'
import { NormalizeError } from '../../core/normalize.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run<A>(eff: Effect.Effect<A, any>): A {
  return Effect.runSync(eff)
}

function mkRaw(overrides: Partial<RawComponentData> & { componentType: string }): RawComponentData {
  return {
    elementKey: null,
    fields: {},
    childKeys: [],
    propsComplete: true,
    startOffset: 0,
    endOffset: 100,
    depth: 1,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// normalizeElement (#1891)
// ---------------------------------------------------------------------------

describe('normalizeElement', () => {
  beforeEach(() => resetAutoKeyCounter())

  it('converts RawComponentData to UIElement', () => {
    const data = mkRaw({
      componentType: 'Card',
      elementKey: 'c1',
      fields: { type: 'Card', key: 'c1', title: 'Hello', color: 'blue' },
    })

    const el = run(normalizeElement(data))
    expect(el.key).toBe('c1')
    expect(el.type).toBe('Card')
    expect(el.props).toMatchObject({ title: 'Hello', color: 'blue' })
    expect(el.props).not.toHaveProperty('type')
    expect(el.props).not.toHaveProperty('key')
  })

  it('auto-generates key when missing', () => {
    const data = mkRaw({
      componentType: 'MetricCard',
      fields: { type: 'MetricCard', label: 'CPU' },
    })

    const el = run(normalizeElement(data))
    expect(el.key).toMatch(/^metriccard-auto-\d+$/)
    expect(el.type).toBe('MetricCard')
  })

  it('sets parentKey from parameter', () => {
    const data = mkRaw({
      componentType: 'Card',
      elementKey: 'c1',
      fields: { type: 'Card', key: 'c1' },
    })

    const el = run(normalizeElement(data, 'page-1'))
    expect(el.parentKey).toBe('page-1')
  })

  it('carries childKeys from graph into children array', () => {
    const data = mkRaw({
      componentType: 'Page',
      elementKey: 'p1',
      fields: { type: 'Page', key: 'p1' },
      childKeys: ['c1', 'c2', 'c3'],
    })

    const el = run(normalizeElement(data))
    expect(el.children).toEqual(['c1', 'c2', 'c3'])
  })

  it('strips _tag from fields (TaggedStruct discriminator)', () => {
    const data = mkRaw({
      componentType: 'Card',
      elementKey: 'c1',
      fields: { _tag: 'Card', key: 'c1', color: 'red' },
    })

    const el = run(normalizeElement(data))
    expect(el.props).not.toHaveProperty('_tag')
    expect(el.props).toMatchObject({ color: 'red' })
  })

  it('fails for data without componentType', () => {
    const data = mkRaw({ componentType: null as any })

    const exit = Effect.runSyncExit(normalizeElement(data))
    expect(exit._tag).toBe('Failure')
  })
})

// ---------------------------------------------------------------------------
// Quarantine Queue (#1894)
// ---------------------------------------------------------------------------

describe('Quarantine Queue', () => {
  beforeEach(() => resetAutoKeyCounter())

  it('enqueues failed elements', () => {
    const queue = createQuarantineQueue()
    const data = mkRaw({ componentType: null as any })
    const error = new NormalizeError({ stage: 'convert', message: 'no type' })

    queue.enqueue(data, error, 'parent-1')
    expect(queue.size).toBe(1)
    expect(queue.entries[0].parentKey).toBe('parent-1')
    expect(queue.entries[0].attempt).toBe(1)
  })

  it('retries and recovers fixable elements', () => {
    const queue = createQuarantineQueue(3)

    // This one IS fixable — has componentType
    const fixable = mkRaw({
      componentType: 'Card',
      elementKey: 'c1',
      fields: { type: 'Card', key: 'c1' },
    })
    const fakeError = new NormalizeError({ stage: 'convert', message: 'transient' })
    queue.enqueue(fixable, fakeError, null)

    const result = run(queue.retry())
    expect(result.recovered).toHaveLength(1)
    expect(result.recovered[0].key).toBe('c1')
    expect(result.failed).toHaveLength(0)
    expect(queue.size).toBe(0)
  })

  it('respects maxRetries limit', () => {
    const queue = createQuarantineQueue(1) // Only 1 attempt allowed

    const bad = mkRaw({ componentType: null as any })
    const error = new NormalizeError({ stage: 'convert', message: 'unfixable' })
    queue.enqueue(bad, error, null)

    // First retry: attempt=1 >= maxRetries=1 → immediately failed
    const result = run(queue.retry())
    expect(result.recovered).toHaveLength(0)
    expect(result.failed).toHaveLength(1)
  })

  it('clears the queue', () => {
    const queue = createQuarantineQueue()
    queue.enqueue(mkRaw({ componentType: null as any }), new NormalizeError({ stage: 'convert', message: 'x' }), null)
    expect(queue.size).toBe(1)

    queue.clear()
    expect(queue.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Incremental Tree Builder
// ---------------------------------------------------------------------------

describe('IncrementalTreeBuilder', () => {
  beforeEach(() => resetAutoKeyCounter())

  it('builds tree progressively from individual elements', () => {
    const builder = createIncrementalTreeBuilder()

    const card = new UIElement({
      key: 'c1', type: 'Card', props: { title: 'Hello' }, children: [],
    })
    const page = new UIElement({
      key: 'p1', type: 'Page', props: {}, children: ['c1'],
    })

    builder.addElement(card, 3)
    expect(builder.size).toBe(1)

    builder.addElement(page, 1)
    expect(builder.size).toBe(2)
    expect(builder.root).toBe('p1')

    const tree = builder.snapshot()
    expect(tree.root).toBe('p1')
    expect(tree.size).toBe(2)
    expect(Option.isSome(tree.getElement('c1'))).toBe(true)
    expect(Option.isSome(tree.getElement('p1'))).toBe(true)
  })

  it('snapshot returns partial tree during streaming', () => {
    const builder = createIncrementalTreeBuilder()

    const card = new UIElement({
      key: 'c1', type: 'Card', props: {},
    })

    builder.addElement(card, 3)
    const partial = builder.snapshot()
    expect(partial.size).toBe(1)
    expect(partial.root).toBe('c1') // only element = root
  })

  it('clears state for new stream', () => {
    const builder = createIncrementalTreeBuilder()

    const card = new UIElement({
      key: 'c1', type: 'Card', props: {},
    })

    builder.addElement(card, 3)
    builder.clear()

    expect(builder.size).toBe(0)
    expect(builder.root).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Integration: streaming graph → normalizeElement → tree builder
// ---------------------------------------------------------------------------

describe('Phase 3 Integration: graph → normalize → tree', () => {
  beforeEach(() => resetAutoKeyCounter())

  it('full pipeline: streaming JSON → callbacks → normalizeElement → UITree', () => {
    const builder = createIncrementalTreeBuilder()
    const quarantine = createQuarantineQueue()
    const parentMap = new Map<number, string | null>() // depth → parentKey

    const graph = createStreamingGraph({
      onComponentIdentified: () => {},
      onComponentComplete: (data) => {
        const exit = Effect.runSyncExit(normalizeElement(data, parentMap.get(data.depth) ?? null))

        if (exit._tag === 'Success') {
          builder.addElement(exit.value, data.depth)

          // Register this element as parent for future children at depth+1
          // (actually children register parent via ancestor walk in graph)
          parentMap.set(data.depth, exit.value.key)
        } else {
          const err = exit.cause
          quarantine.enqueue(data, new NormalizeError({ stage: 'convert', message: String(err) }), null)
        }
      },
    })

    const json = JSON.stringify({
      type: 'Dashboard',
      key: 'dash',
      title: 'DevOps',
      children: [
        { type: 'MetricCard', key: 'm1', label: 'CPU', value: 42 },
        { type: 'MetricCard', key: 'm2', label: 'Memory', value: 87 },
        { type: 'Section', key: 's1', children: [
          { type: 'Card', key: 'c1', title: 'Logs' },
        ]},
      ],
    })

    // Stream in chunks
    const chunkSize = 30
    for (let i = 0; i < json.length; i += chunkSize) {
      graph.sendChunk(json.slice(i, i + chunkSize))
    }
    graph.flush()

    // Verify tree
    const tree = builder.snapshot()
    expect(tree.size).toBe(5) // dash + m1 + m2 + s1 + c1
    expect(tree.root).toBe('dash')
    expect(quarantine.size).toBe(0)

    // Verify element props
    const m1 = Option.getOrThrow(tree.getElement('m1'))
    expect(m1.type).toBe('MetricCard')
    expect(m1.props).toMatchObject({ label: 'CPU', value: 42 })

    const dash = Option.getOrThrow(tree.getElement('dash'))
    expect(dash.type).toBe('Dashboard')
    expect(dash.children).toContain('m1')
    expect(dash.children).toContain('m2')
    expect(dash.children).toContain('s1')

    const s1 = Option.getOrThrow(tree.getElement('s1'))
    expect(s1.children).toContain('c1')
  })

  it('quarantines elements that fail and retries post-stream', () => {
    const builder = createIncrementalTreeBuilder()
    const quarantine = createQuarantineQueue()

    const graph = createStreamingGraph({
      onComponentIdentified: () => {},
      onComponentComplete: (data) => {
        // Simulate: deliberately fail components with key "bad"
        if (data.elementKey === 'bad') {
          quarantine.enqueue(
            { ...data, componentType: null } as any, // break it
            new NormalizeError({ stage: 'convert', message: 'simulated failure' }),
            null,
          )
          return
        }

        const el = run(normalizeElement(data))
        builder.addElement(el, data.depth)
      },
    })

    const json = JSON.stringify({
      type: 'Page',
      key: 'p1',
      children: [
        { type: 'Card', key: 'good' },
        { type: 'Card', key: 'bad' },
      ],
    })

    graph.sendChunk(json)
    graph.flush()

    expect(builder.size).toBe(2) // p1 + good
    expect(quarantine.size).toBe(1)

    // Retry with fixed data won't help here (componentType is null)
    const result = run(quarantine.retry())
    expect(result.recovered).toHaveLength(0)
    expect(result.failed).toHaveLength(1)
  })
})
