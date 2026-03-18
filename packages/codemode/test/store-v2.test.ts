/**
 * RLM Store v2 — Full Integration Tests
 *
 * Tests the complete v2 stack:
 *   §1  Deep Search (FlexSearch + FTS5 hybrid)
 *   §2  Fluent Builders
 *   §3  Collection Factory
 *   §4  Domain Factory
 *   §5  Pipeline Factory
 *   §6  Edge Cases
 *
 * Runtime-aware: auto-detects bun vs node and injects the correct
 * SqlClient backend via the DI seam. Run under either:
 *   bunx vitest run src/lib/metaskill/__tests__/store-v2.test.ts
 *   bun test src/lib/metaskill/__tests__/store-v2.test.ts   (bun:sqlite)
 *
 * Uses :memory: SQLite for isolation. No filesystem side effects.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createStoreApi } from '../src/store/api.js'
import { createFactoryApi } from '../src/store/factories.js'
import type { StoreApi } from '../src/store/api.js'
import type { FactoryApi } from '../src/store/factories.js'

// ── Runtime-aware Layer injection ───────────────────────────────
// The whole point of Layer<SqlClient> as DI seam:
// same tests, different backend, zero code changes above the adapter.

const isBun = typeof globalThis.Bun !== 'undefined'

async function makeLayer() {
  if (isBun) {
    const { layer } = await import('../src/adapters/sqlite-bun.js')
    return layer({ filename: ':memory:' })
  } else {
    const { layer } = await import('../src/adapters/sqlite-node.js')
    return layer({ filename: ':memory:' })
  }
}

let store: StoreApi
let factory: FactoryApi

beforeAll(async () => {
  const storeLayer = await makeLayer()
  const factoryLayer = await makeLayer()
  store = createStoreApi(storeLayer)
  factory = createFactoryApi(factoryLayer)
  console.log(`[store-v2] Runtime: ${isBun ? 'bun:sqlite' : 'node:sqlite'}`)
})

afterAll(async () => {
  await store.dispose()
  await factory.dispose()
})

// ═══════════════════════════════════════════════════════════════
// §1  Deep Search
// ═══════════════════════════════════════════════════════════════

describe('§1 Deep Search', () => {
  beforeAll(async () => {
    await store.put('effect.api', 'schema-truth', {
      _meta: { summary: 'Effect v4 Schema API truth table' },
      exists: { 'Schema.Union': true, 'Schema.TaggedStruct': true, 'Schema.Literal': true },
      removed: { 'Schema.filter': 'use .check(makeFilter(fn))', 'Schema.transform': 'use decodeTo' },
      signatures: {
        'Schema.Union': { args: 'array', example: 'Schema.Union([A, B])', crash: 'members.map is not a function' },
        'Schema.Record': { args: 'positional', example: 'Schema.Record(K, V)' },
      },
    }, ['effect', 'v4', 'schema'])

    await store.put('effect.gotchas', 'v4-gotchas', {
      _meta: { summary: 'Effect v4 gotchas ranked by severity' },
      gotchas: [
        { id: 'union-variadic-crash', severity: 'high', fix: 'Schema.Union([A, B]) — array syntax' },
        { id: 'record-object-crash', severity: 'high', fix: 'Schema.Record(K, V) — positional args' },
        { id: 'sqlclient-make-location', severity: 'high', fix: 'import { make } from module, not SqlClient.make' },
        { id: 'catchall-renamed', severity: 'medium', fix: 'Effect.catch not Effect.catchAll' },
      ],
    }, ['effect', 'gotchas'])

    await store.put('effect.patterns', 'dual-facade', {
      _meta: { summary: 'Dual API facade — Effect internally, async externally' },
      pattern: 'createApi(sqlLayer) → ManagedRuntime.make → plain async',
      useCases: ['eval sandbox', 'React hooks'],
      code: 'const run = <A>(e: Effect.Effect<A>) => runtime.runPromise(e)',
    }, ['effect', 'patterns'])

    await store.put('osint.intel', 'forte10-report', {
      _meta: { summary: 'FORTE10 ISR platform over Black Sea' },
      aircraft: 'RQ-4B Global Hawk',
      callsign: 'FORTE10',
      altitude: '55000ft',
      region: 'Black Sea',
      assessment: 'Elevated ISR activity consistent with pre-strike reconnaissance',
    }, ['osint', 'isr', 'forte'])

    await store.put('research.notes', 'flexsearch-eval', {
      _meta: { summary: 'FlexSearch evaluation for RLM deep search' },
      library: 'flexsearch',
      version: '0.8.212',
      verdict: 'Selected — already in project, works in Node 24, indexes nested JSON via flatten',
      alternatives: { minisearch: 'slower', 'fuse.js': 'fuzzy only, slow at scale', lunr: 'abandoned' },
    }, ['research', 'search', 'flexsearch'])
  })

  // ── Nested data searches ──────────────────────────────────

  it('finds "Union" in nested signatures object', async () => {
    const r = await store.search('Union')
    expect(r.length).toBeGreaterThanOrEqual(2)
  })

  it('finds "variadic" in gotcha fix text', async () => {
    const r = await store.search('variadic')
    expect(r.length).toBeGreaterThanOrEqual(1)
  })

  it('finds "positional" in gotcha fix text', async () => {
    const r = await store.search('positional')
    expect(r.length).toBeGreaterThanOrEqual(1)
  })

  it('finds "ManagedRuntime" in pattern code', async () => {
    const r = await store.search('ManagedRuntime')
    expect(r.length).toBeGreaterThanOrEqual(1)
  })

  it('finds "makeFilter" in removed APIs', async () => {
    const r = await store.search('makeFilter')
    expect(r.length).toBeGreaterThanOrEqual(1)
  })

  it('finds "catchAll" in gotcha entry', async () => {
    const r = await store.search('catchAll')
    expect(r.length).toBeGreaterThanOrEqual(1)
  })

  it('finds "runPromise" in code snippet', async () => {
    const r = await store.search('runPromise')
    expect(r.length).toBeGreaterThanOrEqual(1)
  })

  it('finds "FORTE10" in OSINT data', async () => {
    const r = await store.search('FORTE10')
    expect(r.length).toBe(1)
    expect(r[0].collection).toBe('osint.intel')
  })

  it('finds "reconnaissance" in assessment field', async () => {
    const r = await store.search('reconnaissance')
    expect(r.length).toBe(1)
  })

  it('finds multi-word "Global Hawk"', async () => {
    const r = await store.search('Global Hawk')
    expect(r.length).toBeGreaterThanOrEqual(1)
  })

  it('finds "lunr" in nested alternatives object', async () => {
    const r = await store.search('lunr')
    expect(r.length).toBe(1)
    expect(r[0].collection).toBe('research.notes')
  })

  // ── Summary field (weighted higher) ───────────────────────

  it('finds "gotchas" via summary with high weight', async () => {
    const r = await store.search('gotchas')
    expect(r.length).toBeGreaterThanOrEqual(1)
    expect((r[0] as any).matchedFields).toContain('summary')
  })

  it('finds "truth table" via summary', async () => {
    const r = await store.search('truth table')
    expect(r.length).toBeGreaterThanOrEqual(1)
  })

  // ── Tag searches ──────────────────────────────────────────

  it('finds "effect" across 3+ objects via tags+content', async () => {
    const r = await store.search('effect')
    expect(r.length).toBeGreaterThanOrEqual(3)
  })

  it('finds "forte" via tag', async () => {
    const r = await store.search('forte')
    expect(r.length).toBeGreaterThanOrEqual(1)
  })

  // ── Namespace filtering ───────────────────────────────────

  it('filters by namespace effect.api*', async () => {
    const r = await store.search('Union', 'effect.api*')
    expect(r.length).toBeGreaterThanOrEqual(1)
    expect(r.every((h: any) => h.collection === 'effect.api')).toBe(true)
  })

  it('returns 0 for Union in osint* namespace', async () => {
    const r = await store.search('Union', 'osint*')
    expect(r.length).toBe(0)
  })

  // ── Result shape ──────────────────────────────────────────

  it('results have score field', async () => {
    const r = await store.search('FORTE10')
    expect(typeof (r[0] as any)?.score).toBe('number')
  })

  it('results have matchedFields array', async () => {
    const r = await store.search('FORTE10')
    expect(Array.isArray((r[0] as any)?.matchedFields)).toBe(true)
  })

  // ── Live notify ───────────────────────────────────────────

  it('put makes object immediately searchable', async () => {
    await store.put('test.live', 'canary', {
      _meta: { summary: 'Live test' },
      magic: 'XYZZY_UNIQUE_TOKEN_12345',
    }, ['test'])
    const r = await store.search('XYZZY_UNIQUE_TOKEN_12345')
    expect(r.length).toBe(1)
  })

  it('delete removes object from search index', async () => {
    await store.put('test.live', 'del-canary', {
      _meta: { summary: 'Delete test' },
      magic: 'DELETE_CANARY_VALUE',
    }, ['test'])
    const r1 = await store.search('DELETE_CANARY_VALUE')
    expect(r1.length).toBe(1)

    await store.delete('test.live', 'del-canary')
    const r2 = await store.search('DELETE_CANARY_VALUE')
    expect(r2.length).toBe(0)
  })

  it('putNow makes temporal object immediately searchable', async () => {
    await store.putNow('test.live', 'temporal', {
      _meta: { summary: 'Temporal test' },
      value: 'TEMPORAL_CANARY_VALUE',
    }, ['test'])
    const r = await store.search('TEMPORAL_CANARY_VALUE')
    expect(r.length).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════
// §2  Fluent Builders
// ═══════════════════════════════════════════════════════════════

describe('§2 Fluent Builders', () => {
  it('from().entries() returns stored objects', async () => {
    const r = await store.from('effect.api').entries()
    expect(r.length).toBeGreaterThanOrEqual(1)
  })

  it('from().keys() returns key strings', async () => {
    const r = await store.from('effect.gotchas').keys()
    expect(r.length).toBeGreaterThanOrEqual(1)
    expect(typeof r[0]).toBe('string')
  })

  it('from().count() returns a number', async () => {
    const r = await store.from('effect.api').count()
    expect(typeof r).toBe('number')
    expect(r).toBeGreaterThanOrEqual(1)
  })
})

// ═══════════════════════════════════════════════════════════════
// §3  Collection Factory
// ═══════════════════════════════════════════════════════════════

describe('§3 Collection Factory', () => {
  it('put and get round-trip', async () => {
    const col = factory.collection('research.lib', {
      defaultTags: ['research'],
      required: ['summary'],
    })
    await col.put('effect-v4', {
      _meta: { summary: 'Effect v4 evaluation' },
      breaking: ['Schema.Struct', 'ServiceMap'],
      recommendation: 'Adopt with caution',
    })
    const data = await col.get('effect-v4')
    expect(data).not.toBeNull()
    expect((data as any)._meta).toBeUndefined()
  })

  it('count returns correct number', async () => {
    const col = factory.collection('test.count', { defaultTags: ['test'] })
    await col.put('a', { _meta: { summary: 'a' } })
    await col.put('b', { _meta: { summary: 'b' } })
    const count = await col.count()
    expect(count).toBe(2)
  })

  it('temporal collection uses capture for put', async () => {
    const col = factory.collection('test.temporal', {
      temporal: true,
      defaultTags: ['test'],
    })
    const result = await col.put('prefix', { _meta: { summary: 'temporal' } })
    expect(result.key).toContain('prefix--')
  })
})

// ═══════════════════════════════════════════════════════════════
// §4  Domain Factory
// ═══════════════════════════════════════════════════════════════

describe('§4 Domain Factory', () => {
  it('creates domain with sub-collections', async () => {
    const dom = await factory.domain('osint', {
      scans: { temporal: true, tags: ['live'] },
      intel: { tags: ['analysis'] },
      reports: { tags: ['final'] },
    }, ['osint'])

    expect(dom.subs()).toEqual(['scans', 'intel', 'reports'])
  })

  it('sub-collection capture works', async () => {
    const dom = await factory.domain('dom-test', {
      items: { temporal: true },
    })
    const result = await dom.sub('items').capture('scan', {
      _meta: { summary: 'scan result' },
    })
    expect(result.key).toContain('scan--')
  })

  it('tracks events across sub-collections', async () => {
    const dom = await factory.domain('dom-events', {
      a: { tags: ['x'] },
      b: { tags: ['y'] },
    })

    await dom.sub('a').put('k1', { _meta: { summary: 'a1' } })
    await dom.sub('b').put('k2', { _meta: { summary: 'b1' } })

    const events = await dom.events()
    expect(events.length).toBe(2)
    expect(events.map(e => e._tag)).toContain('CollectionPut')
  })
})

// ═══════════════════════════════════════════════════════════════
// §5  Pipeline Factory
// ═══════════════════════════════════════════════════════════════

describe('§5 Pipeline Factory', () => {
  it('defines pipeline and starts a run', async () => {
    const pipe = await factory.pipeline.define('sigint', ['ingest', 'analyze', 'report'])
    const run = await pipe.start('run-001')
    expect(run.id).toBe('run-001')
  })

  it('stage emit and input chain', async () => {
    const pipe = await factory.pipeline.define('chain-test', ['a', 'b'])
    const run = await pipe.start('chain-run')

    await run.stage('a').emit({
      _meta: { summary: 'Stage A output' },
      payload: 'from-a',
    })

    const input = await run.stage('b').input()
    expect(input).not.toBeNull()
  })

  it('first stage has no input', async () => {
    const pipe = await factory.pipeline.define('first-test', ['x', 'y'])
    const run = await pipe.start('first-run')

    const input = await run.stage('x').input()
    expect(input).toBeNull()
  })

  it('tracks events across stages', async () => {
    const pipe = await factory.pipeline.define('event-test', ['a', 'b', 'c'])
    const run = await pipe.start('event-run')

    await run.stage('a').emit({ _meta: { summary: 'a' } })
    await run.stage('b').emit({ _meta: { summary: 'b' } })
    await run.stage('c').emit({ _meta: { summary: 'c' } })

    const events = await run.events()
    expect(events.length).toBe(3)
    expect(events.map((e: any) => e.stage)).toEqual(['a', 'b', 'c'])
  })
})

// ═══════════════════════════════════════════════════════════════
// §6  Edge Cases
// ═══════════════════════════════════════════════════════════════

describe('§6 Edge Cases', () => {
  it('empty string search returns empty', async () => {
    const r = await store.search('')
    expect(r.length).toBe(0)
  })

  it('nonexistent term returns empty', async () => {
    const r = await store.search('ZZZZNONEXISTENT')
    expect(r.length).toBe(0)
  })

  it('finds value nested 5 levels deep', async () => {
    await store.put('test.deep', 'nested', {
      _meta: { summary: 'Deep nesting test' },
      level1: { level2: { level3: { level4: { level5: { target: 'DEEP_NEEDLE_12345' } } } } },
    })
    const r = await store.search('DEEP_NEEDLE_12345')
    expect(r.length).toBe(1)
  })

  it('finds item inside an array', async () => {
    await store.put('test.arrays', 'arr', {
      _meta: { summary: 'Array test' },
      items: ['alpha', 'bravo', 'ARRAY_ITEM_CANARY', 'delta'],
    })
    const r = await store.search('ARRAY_ITEM_CANARY')
    expect(r.length).toBe(1)
  })

  it('finds JSON key names (not just values)', async () => {
    await store.put('test.keys', 'keynames', {
      _meta: { summary: 'Key name test' },
      UNIQUE_FIELD_NAME_XYZ: 'some value',
    })
    const r = await store.search('UNIQUE_FIELD_NAME_XYZ')
    expect(r.length).toBe(1)
  })

  it('handles special characters in search', async () => {
    await store.put('test.special', 'chars', {
      _meta: { summary: 'Special chars test' },
      path: '/home/user/.config/tmnl',
      selector: '#app > .container',
    })
    const r = await store.search('tmnl')
    expect(r.length).toBeGreaterThanOrEqual(1)
  })
})
