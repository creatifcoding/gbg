/**
 * Remediation Batch 2 Tests
 *
 * #1741 — Tokenizer error surfacing
 * #1744 — Tool schema adapter roundtrip
 * #1752 — CatalogService copy-on-write isolation
 * #1756 — TreeCache LRU
 */

import { describe, it, expect, vi } from 'vitest'
import { createTokenizer } from '../streaming/tokenizer'
import {
  GeniferToolCall,
  GeniferToolResult,
  toPiAiToolCall,
  fromPiAiToolCall,
  toPiAiToolResult,
  fromPiAiToolResult,
} from '../core/tools'
import { makeCatalogComponents, type DomainCatalog } from '../core/CatalogService'
import { TreeCache, generateCacheKey } from '../react/tree-cache'
import { UITree, UIElement } from '../core/schemas'

// =============================================================================
// #1741 — Tokenizer error surfacing
// =============================================================================

describe('Tokenizer error surfacing (#1741)', () => {
  it('calls onError for invalid literals', () => {
    const errors: string[] = []
    const tok = createTokenizer({ onError: (msg) => errors.push(msg) })

    // Feed a chunk with an invalid literal (not true/false/null/number)
    tok.feed('{"x": undefined}')

    expect(errors.length).toBeGreaterThanOrEqual(1)
    expect(errors[0]).toContain('Invalid literal')
  })

  it('calls onError for structural underflow (stray closing brace)', () => {
    const errors: string[] = []
    const tok = createTokenizer({ onError: (msg) => errors.push(msg) })

    // Stray } at depth 0
    tok.feed('}')

    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('underflow')
  })

  it('calls onError for structural underflow (stray closing bracket)', () => {
    const errors: string[] = []
    const tok = createTokenizer({ onError: (msg) => errors.push(msg) })

    tok.feed(']')

    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('underflow')
  })

  it('does not error on valid JSON', () => {
    const errors: string[] = []
    const tok = createTokenizer({ onError: (msg) => errors.push(msg) })

    tok.feed('{"a": 1, "b": true, "c": null, "d": [1, 2]}')

    expect(errors).toHaveLength(0)
  })

  it('works without onError callback (backward compatible)', () => {
    const tok = createTokenizer() // No options
    // Should not throw
    expect(() => tok.feed('}')).not.toThrow()
  })
})

// =============================================================================
// #1744 — Tool schema adapter roundtrip
// =============================================================================

describe('Tool schema adapters (#1744)', () => {
  const geniferCall = new GeniferToolCall({
    id: 'call-1',
    name: 'search',
    args: { query: 'hello', limit: 10 },
    state: 'pending',
    timestamp: 1700000000,
    source: 'llm',
  })

  const geniferResult = new GeniferToolResult({
    callId: 'call-1',
    toolName: 'search',
    content: 'Found 3 results',
    isError: false,
    data: { count: 3 },
    timestamp: 1700000001,
  })

  it('toPiAiToolCall produces correct shape', () => {
    const piCall = toPiAiToolCall(geniferCall)

    expect(piCall.type).toBe('toolCall')
    expect(piCall.id).toBe('call-1')
    expect(piCall.name).toBe('search')
    expect(piCall.arguments).toEqual({ query: 'hello', limit: 10 })
  })

  it('fromPiAiToolCall roundtrips', () => {
    const piCall = toPiAiToolCall(geniferCall)
    const roundtripped = fromPiAiToolCall(piCall, { state: 'pending', source: 'llm' })

    expect(roundtripped.id).toBe(geniferCall.id)
    expect(roundtripped.name).toBe(geniferCall.name)
    expect(roundtripped.args).toEqual(geniferCall.args)
    expect(roundtripped.state).toBe('pending')
    expect(roundtripped.source).toBe('llm')
  })

  it('toPiAiToolResult produces correct shape', () => {
    const piResult = toPiAiToolResult(geniferResult)

    expect(piResult.role).toBe('toolResult')
    expect(piResult.toolCallId).toBe('call-1')
    expect(piResult.toolName).toBe('search')
    expect(piResult.content).toEqual([{ type: 'text', text: 'Found 3 results' }])
    expect(piResult.isError).toBe(false)
    expect(piResult.details).toEqual({ count: 3 })
  })

  it('fromPiAiToolResult roundtrips', () => {
    const piResult = toPiAiToolResult(geniferResult)
    const roundtripped = fromPiAiToolResult(piResult)

    expect(roundtripped.callId).toBe(geniferResult.callId)
    expect(roundtripped.toolName).toBe(geniferResult.toolName)
    expect(roundtripped.content).toBe(geniferResult.content)
    expect(roundtripped.isError).toBe(geniferResult.isError)
    expect(roundtripped.data).toEqual(geniferResult.data)
  })

  it('fromPiAiToolResult flattens multi-part content', () => {
    const result = fromPiAiToolResult({
      role: 'toolResult',
      toolCallId: 'x',
      toolName: 'foo',
      content: [
        { type: 'text', text: 'part 1' },
        { type: 'text', text: ' part 2' },
      ],
      isError: false,
      timestamp: 0,
    })

    expect(result.content).toBe('part 1 part 2')
  })
})

// =============================================================================
// #1752 — CatalogService copy-on-write
// =============================================================================

describe('CatalogService copy-on-write (#1752)', () => {
  const makeTestCatalog = (name: string, types: string[]): DomainCatalog => ({
    name,
    components: Object.fromEntries(
      types.map((t) => [
        t,
        {
          schema: {} as any,
          renderer: () => null,
          description: `${t} component`,
          hasChildren: false,
          defaultEntrance: { property: 'opacity' as const, easing: 'out-cubic' as const, duration: 'normal' as const },
        },
      ]),
    ),
  })

  it('register() does not mutate previous snapshot', () => {
    const catalog = makeCatalogComponents()

    // Take a snapshot before register
    const before = catalog.renderers

    // Register a new domain
    catalog.register(makeTestCatalog('layout', ['Grid', 'VStack']))

    // Old snapshot should still be empty
    expect(before.size).toBe(0)

    // New snapshot has the registered types
    expect(catalog.renderers.size).toBe(2)
    expect(catalog.renderers.has('Grid')).toBe(true)
  })

  it('second register() does not mutate first snapshot', () => {
    const catalog = makeCatalogComponents()

    catalog.register(makeTestCatalog('layout', ['Grid']))
    const afterFirst = catalog.renderers

    catalog.register(makeTestCatalog('ui', ['Button']))
    const afterSecond = catalog.renderers

    // First snapshot only has Grid
    expect(afterFirst.size).toBe(1)
    expect(afterFirst.has('Grid')).toBe(true)
    expect(afterFirst.has('Button')).toBe(false)

    // Second snapshot has both
    expect(afterSecond.size).toBe(2)
    expect(afterSecond.has('Grid')).toBe(true)
    expect(afterSecond.has('Button')).toBe(true)
  })

  it('schemas snapshot is also COW-isolated', () => {
    const catalog = makeCatalogComponents()

    const empty = catalog.schemas
    catalog.register(makeTestCatalog('x', ['Foo']))
    const withFoo = catalog.schemas

    expect(empty.size).toBe(0)
    expect(withFoo.size).toBe(1)
    expect(withFoo.has('Foo')).toBe(true)
  })

  it('initialCatalogs are merged at creation', () => {
    const catalog = makeCatalogComponents([
      makeTestCatalog('a', ['X']),
      makeTestCatalog('b', ['Y']),
    ])

    expect(catalog.renderers.size).toBe(2)
    expect(catalog.renderers.has('X')).toBe(true)
    expect(catalog.renderers.has('Y')).toBe(true)
  })

  it('generatePrompt reads latest snapshot', () => {
    const catalog = makeCatalogComponents()
    catalog.register(makeTestCatalog('test', ['MyWidget']))

    const prompt = catalog.generatePrompt()
    expect(prompt).toContain('MyWidget')
  })
})

// =============================================================================
// #1756 — TreeCache LRU
// =============================================================================

describe('TreeCache (#1756)', () => {
  const makeTree = (rootType: string): UITree =>
    new UITree({
      root: 'r',
      elements: {
        r: new UIElement({
          key: 'r',
          type: rootType,
          props: {},
        }),
      },
    })

  it('stores and retrieves by key', () => {
    const cache = new TreeCache()
    const key = generateCacheKey('hello world', 'gpt-4')
    const tree = makeTree('Grid')

    cache.set(key, tree)
    expect(cache.get(key)).toBe(tree)
  })

  it('returns undefined for missing keys', () => {
    const cache = new TreeCache()
    expect(cache.get('nonexistent')).toBeUndefined()
  })

  it('evicts entries past TTL', () => {
    const cache = new TreeCache({ ttlMs: 1 }) // 1ms TTL
    const key = generateCacheKey('test')
    cache.set(key, makeTree('X'))

    // Wait just a bit for TTL to expire
    const start = Date.now()
    while (Date.now() - start < 5) { /* busy wait */ }

    expect(cache.get(key)).toBeUndefined()
  })

  it('evicts oldest when at capacity', () => {
    const cache = new TreeCache({ maxEntries: 2 })

    cache.set('a', makeTree('A'))
    cache.set('b', makeTree('B'))
    cache.set('c', makeTree('C')) // Should evict 'a'

    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBeDefined()
    expect(cache.get('c')).toBeDefined()
    expect(cache.size).toBe(2)
  })

  it('clear() empties the cache', () => {
    const cache = new TreeCache()
    cache.set('x', makeTree('X'))
    cache.set('y', makeTree('Y'))

    cache.clear()
    expect(cache.size).toBe(0)
  })

  it('has() returns false for stale entries', () => {
    const cache = new TreeCache({ ttlMs: 1 })
    cache.set('k', makeTree('K'))

    const start = Date.now()
    while (Date.now() - start < 5) { /* busy wait */ }

    expect(cache.has('k')).toBe(false)
  })

  it('evictStale() removes expired entries', () => {
    const cache = new TreeCache({ ttlMs: 1 })
    cache.set('a', makeTree('A'))
    cache.set('b', makeTree('B'))

    const start = Date.now()
    while (Date.now() - start < 5) { /* busy wait */ }

    const evicted = cache.evictStale()
    expect(evicted).toBe(2)
    expect(cache.size).toBe(0)
  })

  it('generateCacheKey is deterministic', () => {
    const k1 = generateCacheKey('hello', 'gpt-4', 'ctx')
    const k2 = generateCacheKey('hello', 'gpt-4', 'ctx')
    const k3 = generateCacheKey('different', 'gpt-4', 'ctx')

    expect(k1).toBe(k2)
    expect(k1).not.toBe(k3)
  })
})
