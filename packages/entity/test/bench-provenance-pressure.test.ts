/**
 * @tmnl/entity — Provenance Pressure Benchmarks
 *
 * Before committing to field-level provenance, measure the REAL cost:
 *   - Memory pressure per provenance record
 *   - Storage growth at realistic entity × mutation × field rates
 *   - Write throughput (can we keep up with mutation streams?)
 *   - Query/filter throughput (can we find provenance fast enough?)
 *   - Sync budget (how many records flow through ElectricSQL?)
 *
 * Scenarios model REAL deployment constraints:
 *   - Light:  1K entities, 5 mutations each, 3 fields/mutation
 *   - Medium: 10K entities, 20 mutations, 5 fields/mutation
 *   - Heavy:  50K entities, 50 mutations, 8 fields/mutation
 *   - Burst:  1K entities hit with 100 mutations in 1 second
 *
 * Each provenance record:
 *   { id, entityId, fieldName, sourceId, actor, timestamp, confidence, oldValue, newValue }
 */

import { describe, it, expect } from 'vitest'
import * as Schema from 'effect-v4/Schema'
import { Entity, withMeta, EntityContext } from '../src/index.js'

// ─── Mock Entity (realistic GEOINT AOI) ──────────────────────

class AreaOfInterest extends (Entity.withMeta as typeof withMeta)('AreaOfInterest')({
  name:             Schema.NonEmptyString,
  description:      Schema.String,
  polygonWkt:       Schema.String,
  centroidLat:      Schema.Number,
  centroidLon:      Schema.Number,
  areaSqKm:         Schema.Number,
  priorityTier:     Schema.Literals(['critical', 'high', 'medium', 'low'] as const),
  status:           Schema.Literals(['active', 'monitoring', 'archived', 'pending_review'] as const),
  coverageScore:    Schema.Number,
  changePercent:    Schema.Number,
  lastCollected:    Schema.NullOr(Schema.Number),
  alertThreshold:   Schema.Number,
  revisitInterval:  Schema.Number,
  notes:            Schema.String,
  tags:             Schema.Array(Schema.String),
}) {}

// 15 domain fields + 13 meta = 28 total fields

// ─── Provenance Record (candidate schema) ────────────────────

interface ProvenanceRecord {
  readonly id: string
  readonly entityId: string
  readonly fieldName: string
  readonly sourceId: string
  readonly actor: string
  readonly timestamp: number
  readonly confidence: number
  readonly oldValue: unknown
  readonly newValue: unknown
}

// ─── Helpers ─────────────────────────────────────────────────

function formatRate(ops: number, unit = 'ops/sec'): string {
  if (ops >= 1e9) return `${(ops / 1e9).toFixed(2)}G ${unit}`
  if (ops >= 1e6) return `${(ops / 1e6).toFixed(2)}M ${unit}`
  if (ops >= 1e3) return `${(ops / 1e3).toFixed(1)}K ${unit}`
  return `${ops.toFixed(0)} ${unit}`
}

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`
  return `${bytes} B`
}

const SOURCES = ['analyst', 'sensor-003', 'change-detect-v2', 'osint-feed', 'allied-share', 'api-ingest', 'import-batch']
const ACTORS  = ['agent-007', 'agent-86', 'system', 'ml-pipeline', 'sensor-node-12']

const DOMAIN_FIELDS = [
  'name', 'description', 'polygonWkt', 'centroidLat', 'centroidLon',
  'areaSqKm', 'priorityTier', 'status', 'coverageScore', 'changePercent',
  'lastCollected', 'alertThreshold', 'revisitInterval', 'notes', 'tags',
]

let recordIdCounter = 0

function createProvenanceRecord(
  entityId: string,
  fieldName: string,
): ProvenanceRecord {
  return {
    id: `prov-${++recordIdCounter}`,
    entityId,
    fieldName,
    sourceId: SOURCES[recordIdCounter % SOURCES.length],
    actor: ACTORS[recordIdCounter % ACTORS.length],
    timestamp: Date.now(),
    confidence: 50 + Math.floor(Math.random() * 50),
    oldValue: fieldName === 'coverageScore' ? Math.random() * 100 : `old-${fieldName}`,
    newValue: fieldName === 'coverageScore' ? Math.random() * 100 : `new-${fieldName}`,
  }
}

function simulateMutations(
  entityCount: number,
  mutationsPerEntity: number,
  fieldsPerMutation: number,
): ProvenanceRecord[] {
  const records: ProvenanceRecord[] = []
  for (let e = 0; e < entityCount; e++) {
    const entityId = `entity-${e}`
    for (let m = 0; m < mutationsPerEntity; m++) {
      // Pick random fields for this mutation
      const shuffled = [...DOMAIN_FIELDS].sort(() => Math.random() - 0.5)
      const fields = shuffled.slice(0, fieldsPerMutation)
      for (const field of fields) {
        records.push(createProvenanceRecord(entityId, field))
      }
    }
  }
  return records
}

// ─── Setup ───────────────────────────────────────────────────

EntityContext.set({
  userId: 'agent-007',
  tenantId: 'mi6',
  sourceId: 'analyst',
  classification: 'SECRET',
})

// ─── P1: Single Record Costs ─────────────────────────────────

describe('P1: Single Record Costs', () => {
  it('P1.1: provenance record instantiation rate', () => {
    const N = 100_000
    recordIdCounter = 0
    const start = performance.now()
    const records: ProvenanceRecord[] = []
    for (let i = 0; i < N; i++) {
      records.push(createProvenanceRecord(`entity-${i % 1000}`, DOMAIN_FIELDS[i % 15]))
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`P1.1 Record instantiation: ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(100_000)
  })

  it('P1.2: bytes per record (JSON serialized)', () => {
    const record = createProvenanceRecord('entity-test', 'coverageScore')
    const json = JSON.stringify(record)
    const bytes = new TextEncoder().encode(json).byteLength

    console.log(`P1.2 Single record: ${bytes} bytes → "${json.slice(0, 80)}..."`)

    // Expect ~200-400 bytes per record
    expect(bytes).toBeGreaterThan(100)
    expect(bytes).toBeLessThan(1000)
  })

  it('P1.3: bytes per record with large values (WKT polygon)', () => {
    const largeRecord: ProvenanceRecord = {
      id: 'prov-large',
      entityId: 'entity-001',
      fieldName: 'polygonWkt',
      sourceId: 'sensor-003',
      actor: 'system',
      timestamp: Date.now(),
      confidence: 85,
      oldValue: `POLYGON((${Array.from({ length: 50 }, (_, i) => `${30 + i * 0.1} ${40 + i * 0.1}`).join(', ')}))`,
      newValue: `POLYGON((${Array.from({ length: 50 }, (_, i) => `${30.5 + i * 0.1} ${40.5 + i * 0.1}`).join(', ')}))`,
    }
    const json = JSON.stringify(largeRecord)
    const bytes = new TextEncoder().encode(json).byteLength

    console.log(`P1.3 Large value record: ${bytes} bytes (50-point polygon WKT old+new)`)
    expect(bytes).toBeLessThan(5000)
  })
})

// ─── P2: Scenario Modeling ───────────────────────────────────

describe('P2: Scenario Storage Pressure', () => {
  it('P2.1: LIGHT — 1K entities × 5 mutations × 3 fields', () => {
    recordIdCounter = 0
    const start = performance.now()
    const records = simulateMutations(1_000, 5, 3)
    const elapsed = performance.now() - start

    const totalBytes = records.reduce((sum, r) => sum + new TextEncoder().encode(JSON.stringify(r)).byteLength, 0)
    const avgBytes = totalBytes / records.length
    const rate = (records.length / elapsed) * 1000

    console.log([
      `P2.1 LIGHT SCENARIO`,
      `  Entities:    1,000`,
      `  Mutations:   5 per entity`,
      `  Fields/mut:  3`,
      `  Records:     ${records.length.toLocaleString()}`,
      `  Avg bytes:   ${avgBytes.toFixed(0)} B/record`,
      `  Total size:  ${formatBytes(totalBytes)}`,
      `  Gen time:    ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`,
      `  PG rows:     ${records.length.toLocaleString()} in provenance table`,
    ].join('\n'))

    expect(records).toHaveLength(15_000) // 1K × 5 × 3
  })

  it('P2.2: MEDIUM — 10K entities × 20 mutations × 5 fields', () => {
    recordIdCounter = 0
    const start = performance.now()
    const records = simulateMutations(10_000, 20, 5)
    const elapsed = performance.now() - start

    // Sample 1000 records for byte measurement
    const sampleBytes = records.slice(0, 1000).reduce(
      (sum, r) => sum + new TextEncoder().encode(JSON.stringify(r)).byteLength, 0
    )
    const avgBytes = sampleBytes / 1000
    const totalBytes = avgBytes * records.length
    const rate = (records.length / elapsed) * 1000

    console.log([
      `P2.2 MEDIUM SCENARIO`,
      `  Entities:    10,000`,
      `  Mutations:   20 per entity`,
      `  Fields/mut:  5`,
      `  Records:     ${records.length.toLocaleString()}`,
      `  Avg bytes:   ${avgBytes.toFixed(0)} B/record`,
      `  Total size:  ${formatBytes(totalBytes)}`,
      `  Gen time:    ${elapsed.toFixed(0)}ms → ${formatRate(rate)}`,
      `  PG rows:     ${records.length.toLocaleString()} in provenance table`,
      `  Daily @1K mutations/hr: ${formatBytes(avgBytes * 5 * 1000 * 24)} / day`,
    ].join('\n'))

    expect(records).toHaveLength(1_000_000)
  })

  it('P2.3: HEAVY — projected from 1K sample (50K × 50 × 8 = 20M records)', () => {
    // P2.2 OOM'd at 20M records (4GB heap). Measure a 1K-entity sample and project.
    recordIdCounter = 0
    const sampleEntities = 1_000
    const start = performance.now()
    const records = simulateMutations(sampleEntities, 50, 8)
    const elapsed = performance.now() - start

    const sampleBytes = records.slice(0, 1000).reduce(
      (sum, r) => sum + new TextEncoder().encode(JSON.stringify(r)).byteLength, 0
    )
    const avgBytes = sampleBytes / 1000
    const sampleTotalBytes = avgBytes * records.length
    const rate = (records.length / elapsed) * 1000

    // Project to full 50K
    const projectedRecords = 50_000 * 50 * 8
    const projectedBytes = avgBytes * projectedRecords
    const projectedGenTime = projectedRecords / rate

    console.log([
      `P2.3 HEAVY SCENARIO (projected from ${sampleEntities.toLocaleString()} entity sample)`,
      `  ── Sample ──`,
      `  Entities:    ${sampleEntities.toLocaleString()}`,
      `  Records:     ${records.length.toLocaleString()}`,
      `  Total size:  ${formatBytes(sampleTotalBytes)}`,
      `  Gen rate:    ${formatRate(rate)}`,
      `  ── Projected (50K entities × 50 mut × 8 fields) ──`,
      `  Records:     ${projectedRecords.toLocaleString()}`,
      `  Total size:  ${formatBytes(projectedBytes)}`,
      `  Gen time:    ${projectedGenTime.toFixed(1)}s`,
      `  PG rows:     ${projectedRecords.toLocaleString()} in provenance table`,
      `  ⚠️ JS heap:   OOM at ~4GB with 20M records in memory`,
      `  ⚠️ Conclusion: CANNOT hold full provenance in-memory. Must stream/paginate.`,
    ].join('\n'))

    expect(records).toHaveLength(400_000) // 1K × 50 × 8
  })
})

// ─── P3: Write Throughput ────────────────────────────────────

describe('P3: Write Throughput Pressure', () => {
  it('P3.1: sustained provenance writes (simulating PG INSERT rate)', () => {
    // Simulate the JS-side cost of building provenance records
    // before they hit the wire. This is the ceiling.
    const N = 500_000
    recordIdCounter = 0
    const records: ProvenanceRecord[] = new Array(N)

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      records[i] = createProvenanceRecord(`entity-${i % 10_000}`, DOMAIN_FIELDS[i % 15])
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log([
      `P3.1 Sustained writes`,
      `  Records:   ${N.toLocaleString()}`,
      `  Time:      ${elapsed.toFixed(0)}ms`,
      `  Rate:      ${formatRate(rate)}`,
      `  Note:      This is JS-side ceiling. PG INSERT will be slower.`,
    ].join('\n'))

    expect(rate).toBeGreaterThan(200_000)
  })

  it('P3.2: burst — 100 entities × 20 mutations × 5 fields (projected to 1K)', () => {
    recordIdCounter = 0
    const fieldsPerMutation = 5
    const sampleEntities = 100
    const start = performance.now()
    const records = simulateMutations(sampleEntities, 20, fieldsPerMutation)
    const elapsed = performance.now() - start

    const recordsPerSec = (records.length / elapsed) * 1000
    const projectedRecords = 1_000 * 100 * 5
    const projectedFlush50k = projectedRecords / 50_000
    const projectedFlush10k = projectedRecords / 10_000

    console.log([
      `P3.2 BURST SCENARIO (sampled → projected)`,
      `  Sample:       ${records.length.toLocaleString()} records in ${elapsed.toFixed(0)}ms`,
      `  Rate:         ${formatRate(recordsPerSec)}`,
      `  ── Projected: 1K entities × 100 mutations × 5 fields ──`,
      `  Records:      ${projectedRecords.toLocaleString()}`,
      `  If PG INSERTs at 50K/s: ${projectedFlush50k.toFixed(1)}s to flush`,
      `  If PG INSERTs at 10K/s: ${projectedFlush10k.toFixed(1)}s to flush`,
      `  If batched (100/INSERT): ${(projectedRecords / 100).toLocaleString()} batches`,
    ].join('\n'))

    expect(records).toHaveLength(10_000)
  })
})

// ─── P4: Query/Filter Throughput ─────────────────────────────

describe('P4: Query Simulation', () => {
  const POOL_SIZE = 200_000
  let pool: ProvenanceRecord[] = []

  it('P4.0: build query pool (200K records)', () => {
    recordIdCounter = 0
    pool = simulateMutations(5_000, 8, 5) // 5K × 8 × 5 = 200K
    expect(pool).toHaveLength(POOL_SIZE)
  })

  it('P4.1: filter by entityId (linear scan, simulates unindexed)', () => {
    const targetId = 'entity-42'
    const start = performance.now()
    const matches = pool.filter(r => r.entityId === targetId)
    const elapsed = performance.now() - start
    const scanRate = (POOL_SIZE / elapsed) * 1000

    console.log([
      `P4.1 Filter by entityId (${POOL_SIZE.toLocaleString()} records)`,
      `  Matches:   ${matches.length}`,
      `  Time:      ${elapsed.toFixed(2)}ms`,
      `  Scan rate: ${formatRate(scanRate)}`,
      `  Note:      PG with btree index = <1ms. This measures JS-side filtering.`,
    ].join('\n'))

    expect(matches.length).toBeGreaterThan(0)
    expect(scanRate).toBeGreaterThan(10_000_000) // >10M/s filter
  })

  it('P4.2: filter by entityId + fieldName', () => {
    const targetId = 'entity-42'
    const targetField = 'coverageScore'
    const start = performance.now()
    const matches = pool.filter(r => r.entityId === targetId && r.fieldName === targetField)
    const elapsed = performance.now() - start
    const scanRate = (POOL_SIZE / elapsed) * 1000

    console.log([
      `P4.2 Filter by entityId + fieldName`,
      `  Matches:   ${matches.length}`,
      `  Time:      ${elapsed.toFixed(2)}ms`,
      `  Scan rate: ${formatRate(scanRate)}`,
    ].join('\n'))

    expect(scanRate).toBeGreaterThan(5_000_000)
  })

  it('P4.3: group by sourceId (who contributed what)', () => {
    const targetId = 'entity-42'
    const entityRecords = pool.filter(r => r.entityId === targetId)

    const start = performance.now()
    const bySource: Record<string, string[]> = {}
    for (const r of entityRecords) {
      if (!bySource[r.sourceId]) bySource[r.sourceId] = []
      if (!bySource[r.sourceId].includes(r.fieldName)) {
        bySource[r.sourceId].push(r.fieldName)
      }
    }
    const elapsed = performance.now() - start

    console.log([
      `P4.3 Group by sourceId for entity-42`,
      `  Records:   ${entityRecords.length}`,
      `  Sources:   ${Object.keys(bySource).length}`,
      `  Time:      ${elapsed.toFixed(2)}ms`,
      `  Breakdown: ${Object.entries(bySource).map(([s, f]) => `${s}→${f.length} fields`).join(', ')}`,
    ].join('\n'))

    expect(Object.keys(bySource).length).toBeGreaterThan(0)
  })

  it('P4.4: find latest value per field (materialized view simulation)', () => {
    const targetId = 'entity-100'
    const entityRecords = pool.filter(r => r.entityId === targetId)

    const start = performance.now()
    const latest: Record<string, ProvenanceRecord> = {}
    for (const r of entityRecords) {
      if (!latest[r.fieldName] || r.timestamp >= latest[r.fieldName].timestamp) {
        latest[r.fieldName] = r
      }
    }
    const elapsed = performance.now() - start

    console.log([
      `P4.4 Latest value per field for entity-100`,
      `  Records scanned: ${entityRecords.length}`,
      `  Fields resolved:  ${Object.keys(latest).length}`,
      `  Time:            ${elapsed.toFixed(2)}ms`,
    ].join('\n'))

    expect(Object.keys(latest).length).toBeGreaterThan(0)
  })
})

// ─── P5: Sync Budget ─────────────────────────────────────────

describe('P5: ElectricSQL Sync Budget', () => {
  it('P5.1: sync payload size for single entity provenance', () => {
    recordIdCounter = 0
    // Realistic: 1 entity, 20 mutations, 5 fields each = 100 records
    const records = simulateMutations(1, 20, 5)
    const payload = JSON.stringify(records)
    const bytes = new TextEncoder().encode(payload).byteLength

    console.log([
      `P5.1 Sync payload: 1 entity, 20 mutations, 5 fields/mut`,
      `  Records: ${records.length}`,
      `  Payload: ${formatBytes(bytes)}`,
      `  Note:    This is what Electric Shape streams when a client opens an AOI detail view.`,
    ].join('\n'))

    expect(records).toHaveLength(100)
  })

  it('P5.2: sync payload for dashboard (50 entities, latest provenance only)', () => {
    recordIdCounter = 0
    // Dashboard shows 50 entities, but only needs latest source attribution per field
    const fullRecords = simulateMutations(50, 20, 5) // 5000 records total

    // Simulate "latest only" — 1 record per field per entity
    const latest = new Map<string, ProvenanceRecord>()
    for (const r of fullRecords) {
      const key = `${r.entityId}:${r.fieldName}`
      const existing = latest.get(key)
      if (!existing || r.timestamp >= existing.timestamp) {
        latest.set(key, r)
      }
    }

    const latestRecords = Array.from(latest.values())
    const fullBytes = new TextEncoder().encode(JSON.stringify(fullRecords)).byteLength
    const latestBytes = new TextEncoder().encode(JSON.stringify(latestRecords)).byteLength

    console.log([
      `P5.2 Dashboard sync: 50 entities`,
      `  Full provenance:   ${fullRecords.length} records → ${formatBytes(fullBytes)}`,
      `  Latest-only:       ${latestRecords.length} records → ${formatBytes(latestBytes)}`,
      `  Reduction:         ${((1 - latestRecords.length / fullRecords.length) * 100).toFixed(0)}% fewer records`,
      `  Note:              Materialized view or WHERE clause on latest timestamp`,
    ].join('\n'))

    expect(latestRecords.length).toBeLessThan(fullRecords.length)
  })

  it('P5.3: worst-case sync storm — 1K entities mutated simultaneously', () => {
    recordIdCounter = 0
    const records = simulateMutations(1_000, 1, 5) // 1 mutation each, 5 fields
    const bytes = new TextEncoder().encode(JSON.stringify(records)).byteLength

    console.log([
      `P5.3 Sync storm: 1K entities × 1 mutation × 5 fields`,
      `  Records:     ${records.length.toLocaleString()}`,
      `  Payload:     ${formatBytes(bytes)}`,
      `  At 1MB/s:    ${(bytes / 1_000_000).toFixed(2)}s to sync`,
      `  At 10MB/s:   ${(bytes / 10_000_000 * 1000).toFixed(0)}ms to sync`,
      `  Note:        Each mutation generates ${5} provenance records over the wire`,
    ].join('\n'))

    expect(records).toHaveLength(5_000)
  })
})

// ─── P6: Cost Comparison ─────────────────────────────────────

describe('P6: Cost Comparison — Provenance vs No Provenance', () => {
  it('P6.1: entity-only mutation cost (no provenance)', () => {
    const N = 10_000
    const entities: any[] = Array.from({ length: N }, (_, i) =>
      (AreaOfInterest as any).create({
        name: `AOI ${i}`,
        description: 'Test area',
        polygonWkt: 'POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))',
        centroidLat: 38.9,
        centroidLon: -77.0,
        areaSqKm: 100,
        priorityTier: 'high',
        status: 'active',
        coverageScore: 0,
        changePercent: 0,
        lastCollected: null,
        alertThreshold: 50,
        revisitInterval: 24,
        notes: '',
        tags: ['test'],
      })
    )

    // Simulate mutation: just update 5 fields
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      // Simulating a "mutation" — create new entity with updated fields
      const e = entities[i]
      const _updated = { ...e, coverageScore: 85, changePercent: 12.5, status: 'monitoring', updatedAt: Date.now(), mutationCount: 1 }
    }
    const elapsed = performance.now() - start
    const mutRate = (N / elapsed) * 1000

    console.log([
      `P6.1 Entity mutation only (no provenance)`,
      `  Entities:  ${N.toLocaleString()}`,
      `  Time:      ${elapsed.toFixed(1)}ms`,
      `  Rate:      ${formatRate(mutRate)}`,
    ].join('\n'))

    expect(mutRate).toBeGreaterThan(100_000)
  })

  it('P6.2: entity mutation + field-level provenance generation', () => {
    const N = 10_000
    recordIdCounter = 0
    const changedFields = ['coverageScore', 'changePercent', 'status', 'updatedAt', 'notes']

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      // Provenance overhead: create 5 records per mutation
      for (const field of changedFields) {
        createProvenanceRecord(`entity-${i}`, field)
      }
    }
    const elapsed = performance.now() - start
    const mutRate = (N / elapsed) * 1000
    const provenanceRecords = N * changedFields.length

    console.log([
      `P6.2 Entity mutation + provenance (5 fields)`,
      `  Entities:     ${N.toLocaleString()}`,
      `  Prov records: ${provenanceRecords.toLocaleString()}`,
      `  Time:         ${elapsed.toFixed(1)}ms`,
      `  Rate:         ${formatRate(mutRate)} (entity mutations/s)`,
      `  Overhead:     ${(elapsed / N * 1000).toFixed(1)}µs per entity mutation`,
    ].join('\n'))

    expect(mutRate).toBeGreaterThan(50_000)
  })

  it('P6.3: overhead ratio summary', () => {
    // Run both paths and compare
    const N = 50_000
    const changedFields = ['coverageScore', 'changePercent', 'status']
    recordIdCounter = 0

    // Path A: mutation only
    const startA = performance.now()
    for (let i = 0; i < N; i++) {
      const _updated = { coverageScore: 85, changePercent: 12.5, status: 'monitoring' }
    }
    const elapsedA = performance.now() - startA

    // Path B: mutation + provenance
    const startB = performance.now()
    for (let i = 0; i < N; i++) {
      const _updated = { coverageScore: 85, changePercent: 12.5, status: 'monitoring' }
      for (const field of changedFields) {
        createProvenanceRecord(`entity-${i}`, field)
      }
    }
    const elapsedB = performance.now() - startB

    const overheadMs = elapsedB - elapsedA
    const overheadRatio = elapsedB / Math.max(elapsedA, 0.001)

    console.log([
      `P6.3 OVERHEAD RATIO`,
      `  50K mutations × 3 fields`,
      `  Without provenance: ${elapsedA.toFixed(1)}ms`,
      `  With provenance:    ${elapsedB.toFixed(1)}ms`,
      `  Overhead:           ${overheadMs.toFixed(1)}ms (+${(overheadRatio).toFixed(1)}x)`,
      `  Per mutation:       ${(overheadMs / N * 1000).toFixed(1)}µs added`,
      ``,
      `  ┌──────────────────────────────────────┐`,
      `  │ VERDICT: Is the cost acceptable?      │`,
      `  │ <100µs/mut = fine for most apps       │`,
      `  │ >1ms/mut  = batching required         │`,
      `  │ >10ms/mut = provenance is too heavy   │`,
      `  └──────────────────────────────────────┘`,
    ].join('\n'))

    // The overhead should be measurable but manageable
    expect(overheadMs).toBeLessThan(5000) // sanity
  })
})
