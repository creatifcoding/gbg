/**
 * @tmnl/entity — Core Benchmarks
 *
 * Performance validation for Entity creation, validation, codec,
 * reactive bridge, and field introspection at production scale.
 *
 * B1: Entity instantiation throughput
 * B2: Schema validation throughput (insert/select/update variants)
 * B3: Wire codec encode/decode throughput
 * B4: Reactive bridge — mass hydration + mutation
 * B5: Field metadata lookup
 * B6: Mixed workload — create + validate + mutate realistic scenario
 */

import { describe, it, expect } from 'vitest'
import * as Schema from 'effect-v4/Schema'
import { AtomRegistry } from 'effect-v4/unstable/reactivity'
import { Entity } from '../src/entity.js'

// ─── Test Entity ─────────────────────────────────────────────

class Task extends Entity('Task')({
  id:        Entity.generated(Schema.Number),
  title:     Schema.NonEmptyString,
  status:    Schema.Literals(['todo', 'doing', 'done'] as const),
  priority:  Schema.Number,
  score:     Entity.readonly(Schema.Number),
  secret:    Entity.sensitive(Schema.String),
  createdAt: Entity.timestamp(),
  updatedAt: Entity.timestamp(),
}) {}

function formatRate(ops: number, unit = 'ops/sec'): string {
  if (ops >= 1e9) return `${(ops / 1e9).toFixed(2)}G ${unit}`
  if (ops >= 1e6) return `${(ops / 1e6).toFixed(2)}M ${unit}`
  if (ops >= 1e3) return `${(ops / 1e3).toFixed(1)}K ${unit}`
  return `${ops.toFixed(0)} ${unit}`
}

const makeSeed = (i: number) => new Task({
  id: i,
  title: `Task ${i}`,
  status: (['todo', 'doing', 'done'] as const)[i % 3],
  priority: i % 5,
  score: i * 10,
  secret: `secret-${i}`,
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

// ─── B1: Entity Instantiation ────────────────────────────────

describe('B1: Entity Instantiation', () => {
  it('10K instances — raw construction', () => {
    const N = 10_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      makeSeed(i)
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B1 Instantiation: ${N.toLocaleString()} entities in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(50_000) // > 50K creates/sec
  })

  it('100K instances — sustained throughput', () => {
    const N = 100_000
    const start = performance.now()
    const items: any[] = []
    for (let i = 0; i < N; i++) {
      items.push(makeSeed(i))
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B1 Sustained: ${N.toLocaleString()} entities in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(30_000) // > 30K sustained with GC pressure
    expect(items).toHaveLength(N)
  })
})

// ─── B2: Schema Validation Throughput ────────────────────────

describe('B2: Schema Validation', () => {
  it('insert variant — 10K validations', () => {
    const N = 10_000
    const data = { title: 'Valid Task', status: 'todo', priority: 3, secret: 'abc' }

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      Task.validate.insert(data)
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B2 Insert: ${N.toLocaleString()} validations in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(10_000) // > 10K validations/sec
  })

  it('select variant — 10K validations', () => {
    const N = 10_000
    const data = makeSeed(0)

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      Task.validate.select(data)
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B2 Select: ${N.toLocaleString()} validations in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(10_000)
  })

  it('rejection throughput — 10K invalid', () => {
    const N = 10_000
    const bad = { title: '', status: 'invalid', priority: 'nope' }

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      Task.validate.insert(bad)
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B2 Reject: ${N.toLocaleString()} rejections in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(5_000) // Rejection should be fast too
  })
})

// ─── B3: Wire Codec ──────────────────────────────────────────

describe('B3: Wire Codec', () => {
  it('encode 10K entities', () => {
    const N = 10_000
    const entity = makeSeed(42)

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      Task.codec.encode(entity)
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B3 Encode: ${N.toLocaleString()} in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(10_000)
  })

  it('decode 10K entities', () => {
    const N = 10_000
    const encoded = Task.codec.encode(makeSeed(42))

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      Task.codec.decode(encoded)
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B3 Decode: ${N.toLocaleString()} in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(10_000)
  })

  it('roundtrip 10K encode→decode', () => {
    const N = 10_000
    const entity = makeSeed(42)

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      Task.codec.decode(Task.codec.encode(entity))
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B3 Roundtrip: ${N.toLocaleString()} in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(5_000)
  })
})

// ─── B4: Reactive Bridge ─────────────────────────────────────

describe('B4: Reactive Bridge', () => {
  it('hydrate 10K items into reactive atoms', () => {
    const N = 10_000
    const seed = Array.from({ length: N }, (_, i) => makeSeed(i))
    const registry = AtomRegistry.make()

    const start = performance.now()
    const rx = Task.reactive(registry, { getId: (t: any) => t.id, initialData: seed })
    const elapsed = performance.now() - start

    const items = registry.get(rx.items)
    expect(items).toHaveLength(N)

    console.log(`B4 Hydrate: ${N.toLocaleString()} items in ${elapsed.toFixed(1)}ms → ${formatRate((N / elapsed) * 1000)}`)
    expect(elapsed).toBeLessThan(1000) // < 1s for 10K
    rx.dispose()
  })

  it('100 sequential inserts into reactive bridge', () => {
    const N = 100
    const registry = AtomRegistry.make()
    const rx = Task.reactive(registry, { getId: (t: any) => t.id, initialData: [] })

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      rx.insert({ title: `Task ${i}`, status: 'todo', priority: 1, secret: 'x' })
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    expect(registry.get(rx.items)).toHaveLength(N)
    console.log(`B4 Insert: ${N} inserts in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(500) // Validated inserts are slower
    rx.dispose()
  })

  it('1K updates — byId lookup + mutate', () => {
    const N = 1_000
    const seed = Array.from({ length: 100 }, (_, i) => makeSeed(i))
    const registry = AtomRegistry.make()
    const rx = Task.reactive(registry, { getId: (t: any) => t.id, initialData: seed })

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      rx.update(i % 100, { title: `Updated-${i}` })
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B4 Update: ${N.toLocaleString()} updates in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(5_000)
    rx.dispose()
  })

  it('byId atom read throughput — 100K reads', () => {
    const seed = Array.from({ length: 1_000 }, (_, i) => makeSeed(i))
    const registry = AtomRegistry.make()
    const rx = Task.reactive(registry, { getId: (t: any) => t.id, initialData: seed })

    const N = 100_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      const map = registry.get(rx.byId)
      map.get(i % 1_000)
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B4 ById Read: ${N.toLocaleString()} reads in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(500_000)
    rx.dispose()
  })

  it('item family atom — 10K lookups across 1K items', () => {
    const seed = Array.from({ length: 1_000 }, (_, i) => makeSeed(i))
    const registry = AtomRegistry.make()
    const rx = Task.reactive(registry, { getId: (t: any) => t.id, initialData: seed })

    const N = 10_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      const atom = rx.item(i % 1_000)
      registry.get(atom)
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B4 Family: ${N.toLocaleString()} lookups in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(50_000)
    rx.dispose()
  })
})

// ─── B5: Field Metadata ──────────────────────────────────────

describe('B5: Field Metadata', () => {
  it('fieldMeta lookup — 1M reads', () => {
    const N = 1_000_000
    const fields = Object.keys(Task.fieldMeta)
    const fieldCount = fields.length

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      const _ = Task.fieldMeta[fields[i % fieldCount]]
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B5 FieldMeta: ${formatRate(rate)} lookups`)
    expect(rate).toBeGreaterThan(10_000_000) // Plain object access — blazing
  })

  it('entityTag access — 1M reads', () => {
    const N = 1_000_000

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      const _ = Task.entityTag
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B5 EntityTag: ${formatRate(rate)} reads`)
    expect(rate).toBeGreaterThan(50_000_000)
  })
})

// ─── B6: Mixed Workload ──────────────────────────────────────

describe('B6: Mixed Workload — Realistic Scenario', () => {
  it('1000 ticks: read + validate + mutate + lookup', () => {
    const registry = AtomRegistry.make()
    const seed = Array.from({ length: 100 }, (_, i) => makeSeed(i))
    const rx = Task.reactive(registry, { getId: (t: any) => t.id, initialData: seed })

    const TICKS = 1_000
    const start = performance.now()

    for (let t = 0; t < TICKS; t++) {
      // 10 reads via byId
      for (let r = 0; r < 10; r++) {
        registry.get(rx.byId).get((t * 10 + r) % 100)
      }
      // 1 validated insert attempt
      rx.insert({ title: `Tick ${t}`, status: 'todo', priority: t % 5, secret: 'x' })
      // 2 updates
      rx.update(t % 100, { priority: t })
      rx.update((t + 50) % 100, { status: (['todo', 'doing', 'done'] as const)[t % 3] })
      // 1 count read
      registry.get(rx.count)
      // 1 fieldMeta check
      Task.fieldMeta['score']
    }

    const elapsed = performance.now() - start
    const totalOps = TICKS * (10 + 1 + 2 + 1 + 1) // 15 ops per tick
    const rate = (totalOps / elapsed) * 1000

    console.log(`B6 Mixed: ${TICKS} ticks × 15 ops = ${totalOps.toLocaleString()} ops in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(10_000)
    rx.dispose()
  })
})
