/**
 * @tmnl/entity — Metadata Envelope + .create() Tests
 *
 * Validates:
 *   - EntityMetaFields has exactly 12 fields
 *   - Entity.withMeta injects all 12 into domain entities
 *   - Field kinds are correct
 *   - new() requires all fields (deserialization path)
 *   - .create() requires only domain fields (auto-fills meta)
 *   - .create() reads from EntityContext for identity/tenancy
 *   - .create() overrides work (caller wins)
 *   - entityId is a valid UUID v4
 *   - Wire codec strips classification
 *   - Benchmarks: .create() vs new() overhead
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as Schema from 'effect-v4/Schema'
import { AtomRegistry } from 'effect-v4/unstable/reactivity'
import {
  Entity,
  withMeta,
  EntityMetaFields,
  META_FIELD_NAMES,
  META_FIELD_COUNT,
  Classification,
  EntityContext,
  ProvenanceRef,
  ProvenanceSummary,
  ProvenanceRecord,
  buildProvenanceRefs,
} from '../src/index.js'

// ─── Test Entity ─────────────────────────────────────────────

class Task extends (Entity.withMeta as typeof withMeta)('Task')({
  title:     Schema.NonEmptyString,
  completed: Schema.Boolean,
  priority:  Schema.Literals(['low', 'medium', 'high'] as const),
}) {
  get isHighPriority() { return this.priority === 'high' }
}

// ─── Helpers ─────────────────────────────────────────────────

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function formatRate(ops: number, unit = 'ops/sec'): string {
  if (ops >= 1e9) return `${(ops / 1e9).toFixed(2)}G ${unit}`
  if (ops >= 1e6) return `${(ops / 1e6).toFixed(2)}M ${unit}`
  if (ops >= 1e3) return `${(ops / 1e3).toFixed(1)}K ${unit}`
  return `${ops.toFixed(0)} ${unit}`
}

// ─── Context Setup ───────────────────────────────────────────

beforeEach(() => {
  EntityContext.set({
    userId:         'agent-007',
    tenantId:       'mi6',
    sourceId:       'api',
    classification: 'SECRET',
  })
})

afterEach(() => {
  EntityContext.reset()
})

// ─── Envelope Structure ──────────────────────────────────────

describe('EntityMetaFields', () => {
  it('has exactly 13 base fields', () => {
    expect(META_FIELD_COUNT).toBe(13)
    expect(META_FIELD_NAMES).toHaveLength(13)
  })

  it('contains all expected field names', () => {
    const expected = [
      'entityId', 'createdAt', 'updatedAt', 'deletedAt', 'archivedAt',
      'version', 'mutationCount', 'createdBy', 'updatedBy', 'ownerId',
      'tenantId', 'sourceIds', 'classification',
    ]
    for (const name of expected) {
      expect(META_FIELD_NAMES).toContain(name)
    }
  })

  it('Classification validates all 6 levels', () => {
    for (const level of ['UNCLASSIFIED', 'CUI', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET', 'TOP_SECRET_SCI']) {
      expect(() => Schema.decodeUnknownSync(Classification)(level)).not.toThrow()
    }
  })

  it('Classification rejects invalid values', () => {
    expect(() => Schema.decodeUnknownSync(Classification)('PUBLIC')).toThrow()
  })
})

// ─── withMeta Field Injection ────────────────────────────────

describe('Entity.withMeta', () => {
  it('produces 13 meta + 3 domain = 16 fields', () => {
    const meta = (Task as any).fieldMeta as Record<string, string>
    expect(Object.keys(meta)).toHaveLength(16)
  })

  it('metadata field kinds are correct', () => {
    const meta = (Task as any).fieldMeta as Record<string, string>
    expect(meta.entityId).toBe('generated')
    expect(meta.createdAt).toBe('timestamp')
    expect(meta.updatedAt).toBe('timestamp')
    expect(meta.deletedAt).toBe('readonly')
    expect(meta.archivedAt).toBe('readonly')
    expect(meta.version).toBe('readonly')
    expect(meta.mutationCount).toBe('readonly')
    expect(meta.createdBy).toBe('data')
    expect(meta.updatedBy).toBe('data')
    expect(meta.ownerId).toBe('data')
    expect(meta.tenantId).toBe('data')
    expect(meta.sourceIds).toBe('readonly')
    expect(meta.classification).toBe('sensitive')
  })

  it('domain field kinds are "data"', () => {
    const meta = (Task as any).fieldMeta as Record<string, string>
    expect(meta.title).toBe('data')
    expect(meta.completed).toBe('data')
    expect(meta.priority).toBe('data')
  })

  it('entityTag is correct', () => {
    expect((Task as any).entityTag).toBe('Task')
  })
})

// ─── .create() — Smart Constructor ──────────────────────────

describe('.create()', () => {
  it('only requires domain fields', () => {
    const t = (Task as any).create({
      title: 'Buy milk',
      completed: false,
      priority: 'low',
    })
    expect(t.title).toBe('Buy milk')
    expect(t.completed).toBe(false)
    expect(t.priority).toBe('low')
  })

  it('generates a valid UUID v4 entityId', () => {
    const t = (Task as any).create({ title: 'Test', completed: false, priority: 'low' })
    expect(t.entityId).toMatch(UUID_V4_RE)
  })

  it('generates unique entityIds', () => {
    const t1 = (Task as any).create({ title: 'A', completed: false, priority: 'low' })
    const t2 = (Task as any).create({ title: 'B', completed: false, priority: 'low' })
    expect(t1.entityId).not.toBe(t2.entityId)
  })

  it('sets createdAt and updatedAt to ~now', () => {
    const before = Date.now()
    const t = (Task as any).create({ title: 'Test', completed: false, priority: 'low' })
    const after = Date.now()

    expect(t.createdAt).toBeGreaterThanOrEqual(before)
    expect(t.createdAt).toBeLessThanOrEqual(after)
    expect(t.updatedAt).toBe(t.createdAt)
  })

  it('sets deletedAt and archivedAt to null', () => {
    const t = (Task as any).create({ title: 'Test', completed: false, priority: 'low' })
    expect(t.deletedAt).toBeNull()
    expect(t.archivedAt).toBeNull()
  })

  it('sets version to 0 and mutationCount to 0', () => {
    const t = (Task as any).create({ title: 'Test', completed: false, priority: 'low' })
    expect(t.version).toBe(0)
    expect(t.mutationCount).toBe(0)
  })

  it('reads createdBy/updatedBy/ownerId from EntityContext.userId', () => {
    const t = (Task as any).create({ title: 'Test', completed: false, priority: 'low' })
    expect(t.createdBy).toBe('agent-007')
    expect(t.updatedBy).toBe('agent-007')
    expect(t.ownerId).toBe('agent-007')
  })

  it('reads tenantId from EntityContext', () => {
    const t = (Task as any).create({ title: 'Test', completed: false, priority: 'low' })
    expect(t.tenantId).toBe('mi6')
  })

  it('initializes sourceIds from EntityContext.sourceId', () => {
    const t = (Task as any).create({ title: 'Test', completed: false, priority: 'low' })
    expect(t.sourceIds).toEqual(['api'])
  })

  it('reads classification from EntityContext', () => {
    const t = (Task as any).create({ title: 'Test', completed: false, priority: 'low' })
    expect(t.classification).toBe('SECRET')
  })

  it('reflects EntityContext changes between calls', () => {
    const t1 = (Task as any).create({ title: 'A', completed: false, priority: 'low' })
    expect(t1.tenantId).toBe('mi6')

    EntityContext.set({ tenantId: 'cia', userId: 'agent-86', sourceId: 'humint' })

    const t2 = (Task as any).create({ title: 'B', completed: false, priority: 'low' })
    expect(t2.tenantId).toBe('cia')
    expect(t2.createdBy).toBe('agent-86')
    // t1 unchanged
    expect(t1.tenantId).toBe('mi6')
  })
})

// ─── .create() — Overrides ──────────────────────────────────

describe('.create() overrides', () => {
  it('caller can override entityId', () => {
    const t = (Task as any).create({
      title: 'Override ID',
      completed: false,
      priority: 'low',
      entityId: 'custom-id-001',
    })
    expect(t.entityId).toBe('custom-id-001')
  })

  it('caller can override createdAt (historical import)', () => {
    const historical = 1609459200000 // 2021-01-01
    const t = (Task as any).create({
      title: 'Historical',
      completed: true,
      priority: 'high',
      createdAt: historical,
    })
    expect(t.createdAt).toBe(historical)
  })

  it('caller can override classification', () => {
    const t = (Task as any).create({
      title: 'Top Secret',
      completed: false,
      priority: 'high',
      classification: 'TOP_SECRET',
    })
    expect(t.classification).toBe('TOP_SECRET')
  })

  it('caller can override tenantId', () => {
    const t = (Task as any).create({
      title: 'Cross-tenant',
      completed: false,
      priority: 'low',
      tenantId: 'other-org',
    })
    expect(t.tenantId).toBe('other-org')
  })

  it('caller can override sourceIds (multi-source import)', () => {
    const t = (Task as any).create({
      title: 'Multi-source',
      completed: false,
      priority: 'low',
      sourceIds: ['sensor-003', 'analyst', 'import-batch-42'],
    })
    expect(t.sourceIds).toEqual(['sensor-003', 'analyst', 'import-batch-42'])
  })

  it('caller can override version (migration)', () => {
    const t = (Task as any).create({
      title: 'Migrated',
      completed: false,
      priority: 'low',
      version: 42,
    })
    expect(t.version).toBe(42)
  })
})

// ─── new() — Full Constructor ────────────────────────────────

describe('new() full constructor', () => {
  it('requires all fields (deserialization path)', () => {
    const now = Date.now()
    const t = new Task({
      entityId: 'deser-001',
      title: 'From DB',
      completed: true,
      priority: 'medium',
      createdAt: now - 86400_000,
      updatedAt: now,
      deletedAt: null,
      archivedAt: null,
      version: 7,
      mutationCount: 12,
      createdBy: 'system',
      updatedBy: 'admin',
      ownerId: 'user-1',
      tenantId: 'tenant-1',
      sourceIds: ['import', 'analyst'],
      classification: 'CONFIDENTIAL',
    })
    expect(t.entityId).toBe('deser-001')
    expect(t.version).toBe(7)
    expect(t.mutationCount).toBe(12)
    expect(t.sourceIds).toEqual(['import', 'analyst'])
    expect(t.createdBy).toBe('system')
    expect(t.updatedBy).toBe('admin')
  })
})

// ─── Wire Codec ──────────────────────────────────────────────

describe('Wire Codec with .create()', () => {
  it('encode strips classification', () => {
    const t = (Task as any).create({ title: 'Test', completed: false, priority: 'low' })
    const wire = (Task as any).codec.encode(t) as Record<string, unknown>
    expect(wire).not.toHaveProperty('classification')
  })

  it('encode preserves all non-sensitive meta fields', () => {
    const t = (Task as any).create({ title: 'Test', completed: false, priority: 'low' })
    const wire = (Task as any).codec.encode(t) as Record<string, unknown>
    expect(wire).toHaveProperty('entityId')
    expect(wire).toHaveProperty('createdAt')
    expect(wire).toHaveProperty('updatedAt')
    expect(wire).toHaveProperty('deletedAt', null)
    expect(wire).toHaveProperty('archivedAt', null)
    expect(wire).toHaveProperty('version', 0)
    expect(wire).toHaveProperty('mutationCount', 0)
    expect(wire).toHaveProperty('sourceIds')
    expect((wire as any).sourceIds).toEqual(['api'])
    expect(wire).toHaveProperty('createdBy', 'agent-007')
    expect(wire).toHaveProperty('tenantId', 'mi6')
  })
})

// ─── EntityContext ───────────────────────────────────────────

describe('EntityContext', () => {
  it('.get() returns a copy (mutation-safe)', () => {
    const ctx = EntityContext.get()
    ctx.userId = 'MUTATED'
    expect(EntityContext.get().userId).toBe('agent-007') // unchanged
  })

  it('.set() merges partially', () => {
    EntityContext.set({ sourceId: 'sensor-feed' })
    const ctx = EntityContext.get()
    expect(ctx.sourceId).toBe('sensor-feed')
    expect(ctx.userId).toBe('agent-007') // other fields preserved
  })

  it('.reset() restores defaults', () => {
    EntityContext.reset()
    const ctx = EntityContext.get()
    expect(ctx.userId).toBe('')
    expect(ctx.tenantId).toBe('')
    expect(ctx.sourceId).toBe('system')
    expect(ctx.classification).toBe('UNCLASSIFIED')
  })
})

// ─── Domain Override ─────────────────────────────────────────

describe('Domain Override', () => {
  it('domain field with same name as meta field overrides it', () => {
    class Versioned extends (Entity.withMeta as typeof withMeta)('Versioned')({
      version: Schema.String,
      name: Schema.String,
    }) {}
    const meta = (Versioned as any).fieldMeta as Record<string, string>
    expect(meta.version).toBe('data')
  })
})

// ─── Events ──────────────────────────────────────────────────

describe('Events with withMeta', () => {
  class Order extends (Entity.withMeta as typeof withMeta)('Order')({
    total: Schema.Number,
    status: Schema.Literals(['pending', 'shipped'] as const),
  }, {
    events: { Shipped: { trackingNumber: Schema.String } },
  }) {}

  it('has 8 lifecycle + 1 custom = 9 events', () => {
    expect(Object.keys((Order as any).events.events)).toHaveLength(9)
  })

  it('.create() works with custom events entity', () => {
    const o = (Order as any).create({ total: 99.99, status: 'pending' })
    expect(o.total).toBe(99.99)
    expect(o.entityId).toMatch(UUID_V4_RE)
    expect(o.classification).toBe('SECRET') // from context
  })
})

// ─── Reactive Bridge ─────────────────────────────────────────

describe('Reactive Bridge with .create()', () => {
  it('hydrates 100 .create()d entities into atoms', () => {
    const seed = Array.from({ length: 100 }, (_, i) =>
      (Task as any).create({ title: `Task ${i}`, completed: false, priority: 'low' })
    )
    const registry = AtomRegistry.make()
    const rx = (Task as any).reactive(registry, {
      getId: (t: any) => t.entityId,
      initialData: seed,
    })
    expect(registry.get(rx.items)).toHaveLength(100)
    expect(registry.get(rx.count)).toBe(100)
    rx.dispose()
  })
})

// ─── Entity.tracked() ────────────────────────────────────────

describe('Entity.tracked()', () => {
  class TrackedAOI extends (Entity.withMeta as typeof withMeta)('TrackedAOI')({
    name:          Schema.NonEmptyString,
    polygonWkt:    Entity.tracked(Schema.String),
    centroidLat:   Entity.tracked(Schema.Number),
    centroidLon:   Entity.tracked(Schema.Number),
    coverageScore: Entity.tracked(Schema.Number),
    status:        Schema.Literals(['active', 'archived'] as const),
    notes:         Schema.String,
  }) {}

  it('marks tracked fields in fieldMeta', () => {
    const meta = (TrackedAOI as any).fieldMeta as Record<string, string>
    expect(meta.polygonWkt).toBe('tracked')
    expect(meta.centroidLat).toBe('tracked')
    expect(meta.centroidLon).toBe('tracked')
    expect(meta.coverageScore).toBe('tracked')
  })

  it('non-tracked domain fields are "data"', () => {
    const meta = (TrackedAOI as any).fieldMeta as Record<string, string>
    expect(meta.name).toBe('data')
    expect(meta.status).toBe('data')
    expect(meta.notes).toBe('data')
  })

  it('exposes TRACKED_FIELDS static array', () => {
    const tracked = (TrackedAOI as any).TRACKED_FIELDS as string[]
    expect(tracked).toEqual(['polygonWkt', 'centroidLat', 'centroidLon', 'coverageScore'])
  })

  it('entity with no tracked fields has empty TRACKED_FIELDS', () => {
    const tracked = (Task as any).TRACKED_FIELDS as string[]
    expect(tracked).toEqual([])
  })

  it('tracked fields are present in all variants (data behavior)', () => {
    const aoi = (TrackedAOI as any).create({
      name: 'Test AOI',
      polygonWkt: 'POLYGON((0 0, 1 0, 1 1, 0 0))',
      centroidLat: 38.9,
      centroidLon: -77.0,
      coverageScore: 85,
      status: 'active',
      notes: '',
    })
    expect(aoi.polygonWkt).toBe('POLYGON((0 0, 1 0, 1 1, 0 0))')
    expect(aoi.coverageScore).toBe(85)

    // Wire encode includes tracked fields
    const wire = (TrackedAOI as any).codec.encode(aoi) as Record<string, unknown>
    expect(wire).toHaveProperty('polygonWkt')
    expect(wire).toHaveProperty('coverageScore', 85)
  })
})

// ─── Provenance Dereferencing Schema ─────────────────────────

describe('Provenance Schemas', () => {
  it('ProvenanceRef validates', () => {
    const ref = Schema.decodeUnknownSync(ProvenanceRef)({
      entityId: 'entity-42',
      fieldName: 'polygonWkt',
    })
    expect(ref.entityId).toBe('entity-42')
    expect(ref.fieldName).toBe('polygonWkt')
  })

  it('ProvenanceSummary validates', () => {
    const summary = Schema.decodeUnknownSync(ProvenanceSummary)({
      fieldName: 'coverageScore',
      sourceId: 'sensor-003',
      actor: 'ml-pipeline',
      confidence: 92,
      timestamp: Date.now(),
      sourceCount: 3,
    })
    expect(summary.confidence).toBe(92)
    expect(summary.sourceCount).toBe(3)
  })

  it('ProvenanceRecord validates', () => {
    const record = Schema.decodeUnknownSync(ProvenanceRecord)({
      id: 'prov-001',
      entityId: 'entity-42',
      fieldName: 'polygonWkt',
      sourceId: 'analyst',
      actor: 'agent-007',
      timestamp: Date.now(),
      confidence: 95,
      oldValue: null,
      newValue: 'POLYGON((0 0, 1 0, 1 1, 0 0))',
    })
    expect(record.fieldName).toBe('polygonWkt')
    expect(record.confidence).toBe(95)
  })

  it('buildProvenanceRefs creates refs for tracked fields', () => {
    const refs = buildProvenanceRefs('entity-42', ['polygonWkt', 'centroidLat', 'coverageScore'])
    expect(refs).toHaveLength(3)
    expect(refs[0]).toEqual({ entityId: 'entity-42', fieldName: 'polygonWkt' })
    expect(refs[2]).toEqual({ entityId: 'entity-42', fieldName: 'coverageScore' })
  })

  it('buildProvenanceRefs returns empty for no tracked fields', () => {
    const refs = buildProvenanceRefs('entity-42', [])
    expect(refs).toHaveLength(0)
  })
})

// ─── Benchmarks ──────────────────────────────────────────────

describe('Benchmarks', () => {
  it('B1: .create() 10K (3 domain fields, 13 auto-filled)', () => {
    const N = 10_000
    const start = performance.now()
    const items: any[] = []
    for (let i = 0; i < N; i++) {
      items.push((Task as any).create({
        title: `Task ${i}`,
        completed: i % 3 === 0,
        priority: (['low', 'medium', 'high'] as const)[i % 3],
      }))
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`Meta B1 .create() 10K: ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(items).toHaveLength(N)
    expect(rate).toBeGreaterThan(20_000)
  })

  it('B2: new() 10K (all 16 fields explicit)', () => {
    const now = Date.now()
    const N = 10_000
    const start = performance.now()
    const items: any[] = []
    for (let i = 0; i < N; i++) {
      items.push(new Task({
        entityId: `task-${i}`,
        title: `Task ${i}`,
        completed: i % 3 === 0,
        priority: (['low', 'medium', 'high'] as const)[i % 3],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        archivedAt: null,
        version: 0,
        mutationCount: 0,
        createdBy: 'user',
        updatedBy: 'user',
        ownerId: 'user',
        tenantId: 'tenant',
        sourceIds: ['system'],
        classification: 'UNCLASSIFIED',
      }))
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`Meta B2 new() 10K:     ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(items).toHaveLength(N)
    expect(rate).toBeGreaterThan(30_000)
  })

  it('B3: wire encode 10K .create()d entities', () => {
    const items = Array.from({ length: 10_000 }, (_, i) =>
      (Task as any).create({ title: `Task ${i}`, completed: false, priority: 'low' })
    )
    const start = performance.now()
    for (let i = 0; i < 10_000; i++) {
      ;(Task as any).codec.encode(items[i])
    }
    const elapsed = performance.now() - start
    const rate = (10_000 / elapsed) * 1000

    console.log(`Meta B3 encode 10K:    ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(20_000)
  })

  it('B4: .create() 1K with EntityContext switch mid-stream', () => {
    const N = 1_000
    const items: any[] = []
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      if (i === 500) EntityContext.set({ tenantId: 'switched-org', userId: 'new-agent' })
      items.push((Task as any).create({
        title: `Task ${i}`,
        completed: false,
        priority: 'low',
      }))
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`Meta B4 ctx-switch 1K: ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(items[0].tenantId).toBe('mi6')
    expect(items[999].tenantId).toBe('switched-org')
    expect(items[999].createdBy).toBe('new-agent')
  })
})
