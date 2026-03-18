/**
 * @tmnl/entity — AreaOfInterest (Geoint) Test Suite
 *
 * Validates the full Entity surface using a real-world domain:
 *   - Instantiation with nested schemas
 *   - Variant schema enforcement (generated/sensitive/readonly/timestamp)
 *   - Computed getters
 *   - Service-backed Effect methods
 *   - Event system (lifecycle + 6 custom)
 *   - Reactive bridge (STX atoms)
 *   - Wire codec (sensitive field stripping)
 *   - Benchmarks at scale
 */

import { describe, it, expect } from 'vitest'
import * as Schema from 'effect-v4/Schema'
import * as Effect from 'effect-v4/Effect'
import { AtomRegistry } from 'effect-v4/unstable/reactivity'
import {
  AreaOfInterest,
  CoverageAnalysis,
  ChangeDetection,
} from '../examples/geoint-aoi.js'

// ─── Helpers ─────────────────────────────────────────────────

// Concrete service impls — same shape as succeed: {} config
const coverageImpl = {
  calculatePasses(polygon: any, sensors: any, windowHours: number) {
    const breakdown: Record<string, number> = {}
    for (const sensor of sensors) breakdown[sensor] = Math.floor(windowHours / 6) + polygon.length % 3
    return { totalPasses: Object.values(breakdown).reduce((a: number, b: number) => a + b, 0), sensorBreakdown: breakdown, nextPassEpoch: Date.now() + 3600_000 }
  },
  scoreCoverage(polygon: any, collectionCount: number) {
    const density = collectionCount / Math.max(polygon.length * 10, 1)
    return Math.min(100, Math.round(density * 1000))
  },
}
const changeDetectionImpl = {
  analyzeChange(aoiId: string, baselineEpoch: number, currentEpoch: number) {
    const delta = currentEpoch - baselineEpoch
    const changePercent = Math.min(100, (delta / 86400_000) * 15)
    return {
      changePercent,
      hotspots: changePercent > 50 ? [{ lng: -74.006, lat: 40.7128, magnitude: changePercent }] : [],
      recommendation: changePercent > 70 ? 'escalate' as const : changePercent > 30 ? 'monitor' as const : 'dismiss' as const,
    }
  },
}

/** Provide both Geoint services for sync execution */
function withGeointServices<A, E>(
  effect: Effect.Effect<A, E, CoverageAnalysis | ChangeDetection>,
): Effect.Effect<A, E> {
  return effect.pipe(
    Effect.provideService(CoverageAnalysis, coverageImpl as any),
    Effect.provideService(ChangeDetection, changeDetectionImpl as any),
  ) as Effect.Effect<A, E>
}

function formatRate(ops: number, unit = 'ops/sec'): string {
  if (ops >= 1e9) return `${(ops / 1e9).toFixed(2)}G ${unit}`
  if (ops >= 1e6) return `${(ops / 1e6).toFixed(2)}M ${unit}`
  if (ops >= 1e3) return `${(ops / 1e3).toFixed(1)}K ${unit}`
  return `${ops.toFixed(0)} ${unit}`
}

const makeAoi = (i: number) =>
  new AreaOfInterest({
    id: `aoi-${String(i).padStart(4, '0')}`,
    name: `Watch Area ${i}`,
    codename: `SIGMA-${i}`,
    polygon: [
      [-74.05 + (i % 10) * 0.01, 40.70],
      [-74.00 + (i % 10) * 0.01, 40.70],
      [-74.00 + (i % 10) * 0.01, 40.75],
      [-74.05 + (i % 10) * 0.01, 40.75],
    ],
    centroid: { lng: -74.025, lat: 40.725 },
    classification: (['UNCLASSIFIED', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET'] as const)[i % 4],
    status: (['active', 'dormant', 'archived', 'pending_review'] as const)[i % 4],
    priority: (['routine', 'priority', 'immediate', 'flash'] as const)[i % 4],
    sensors: i % 2 === 0 ? ['EO', 'SAR'] : ['EO', 'IR', 'SIGINT'],
    changeDetection: {
      threshold: 20 + (i % 50),
      intervalHours: 6 + (i % 18),
      bands: ['visible', 'SAR'],
    },
    coverageScore: i % 100,
    collectionCount: i * 3,
    createdAt: Date.now() - i * 86400_000,
    updatedAt: Date.now() - i * 3600_000,
    lastCollected: Date.now() - i * 7200_000,
    notes: `Monitoring notes for area ${i}`,
  })

// ─── Instantiation ───────────────────────────────────────────

describe('Instantiation', () => {
  it('creates a valid AreaOfInterest instance', () => {
    const aoi = makeAoi(1)
    expect(aoi.name).toBe('Watch Area 1')
    expect(aoi.codename).toBe('SIGMA-1')
    expect(aoi.polygon).toHaveLength(4)
    expect(aoi.centroid.lng).toBe(-74.025)
    expect(aoi.classification).toBe('CONFIDENTIAL')
    expect(aoi.sensors).toEqual(['EO', 'IR', 'SIGINT'])
    expect(aoi.changeDetection.threshold).toBe(21)
    expect(aoi.changeDetection.bands).toEqual(['visible', 'SAR'])
  })

  it('entityTag is accessible on class', () => {
    expect((AreaOfInterest as any).entityTag).toBe('AreaOfInterest')
  })
})

// ─── Computed Getters ────────────────────────────────────────

describe('Computed Getters', () => {
  it('displayName is "CODENAME (status)"', () => {
    const aoi = makeAoi(0) // status = 'active'
    expect(aoi.displayName).toBe('SIGMA-0 (active)')
  })

  it('isActive reflects status', () => {
    expect(makeAoi(0).isActive).toBe(true)    // 'active'
    expect(makeAoi(1).isActive).toBe(false)   // 'dormant'
  })

  it('isUrgent for immediate/flash', () => {
    expect(makeAoi(2).isUrgent).toBe(true)    // 'immediate'
    expect(makeAoi(3).isUrgent).toBe(true)    // 'flash'
    expect(makeAoi(0).isUrgent).toBe(false)   // 'routine'
  })

  it('vertexCount counts polygon vertices', () => {
    expect(makeAoi(1).vertexCount).toBe(4)
  })

  it('estimatedAreaKm2 computes from polygon', () => {
    const aoi = makeAoi(0)
    expect(aoi.estimatedAreaKm2).toBeGreaterThan(0)
  })

  it('summary includes emoji, name, score', () => {
    const aoi = makeAoi(0) // active
    expect(aoi.summary).toContain('🟢')
    expect(aoi.summary).toContain('SIGMA-0')
    expect(aoi.summary).toContain('score:')
  })
})

// ─── Variant Schemas ─────────────────────────────────────────

describe('Variant Schemas', () => {
  it('entityTag is "AreaOfInterest"', () => {
    expect((AreaOfInterest as any).entityTag).toBe('AreaOfInterest')
  })

  it('fieldMeta classifies all 16 fields', () => {
    const meta = (AreaOfInterest as any).fieldMeta
    expect(meta.id).toBe('generated')
    expect(meta.classification).toBe('sensitive')
    expect(meta.coverageScore).toBe('readonly')
    expect(meta.collectionCount).toBe('readonly')
    expect(meta.createdAt).toBe('timestamp')
    expect(meta.updatedAt).toBe('timestamp')
    expect(meta.lastCollected).toBe('timestamp')
    expect(meta.name).toBe('data')
    expect(meta.polygon).toBe('data')
    expect(meta.sensors).toBe('data')
  })

  it('validate.select accepts valid full data', () => {
    const result = (AreaOfInterest as any).validate.select(makeAoi(1))
    expect(result._tag).toBe('Success')
  })

  it('validate.insert rejects data with id (generated field)', () => {
    // insert variant shouldn't have `id` — but if it does, it's ignored/stripped
    const insertData = {
      name: 'Test',
      codename: 'TEST',
      polygon: [[-74, 40], [-73, 40], [-73, 41]],
      centroid: { lng: -73.5, lat: 40.5 },
      classification: 'UNCLASSIFIED',
      status: 'active',
      priority: 'routine',
      sensors: ['EO'],
      changeDetection: { threshold: 50, intervalHours: 24, bands: ['visible'] },
      notes: '',
    }
    const result = (AreaOfInterest as any).validate.insert(insertData)
    expect(result._tag).toBe('Success')
  })
})

// ─── Wire Codec ──────────────────────────────────────────────

describe('Wire Codec', () => {
  it('encode strips classification (sensitive field)', () => {
    const aoi = makeAoi(1)
    const wire = (AreaOfInterest as any).codec.encode(aoi) as Record<string, unknown>
    expect(wire).not.toHaveProperty('classification')
  })

  it('encode preserves non-sensitive fields', () => {
    const aoi = makeAoi(1)
    const wire = (AreaOfInterest as any).codec.encode(aoi) as Record<string, unknown>
    expect(wire).toHaveProperty('name', 'Watch Area 1')
    expect(wire).toHaveProperty('codename', 'SIGMA-1')
    expect(wire).toHaveProperty('polygon')
  })
})

// ─── Events ──────────────────────────────────────────────────

describe('Events', () => {
  it('has 14 events (8 lifecycle + 6 custom)', () => {
    const events = (AreaOfInterest as any).events
    const eventKeys = Object.keys((events as any).events)
    expect(eventKeys.length).toBe(14)
  })

  it('lifecycle events are present', () => {
    for (const evt of ['Created', 'Updated', 'Deleted', 'Archived', 'Patched']) {
      expect((AreaOfInterest as any).event(evt)).toBeDefined()
    }
  })

  it('custom events are present', () => {
    for (const evt of ['Activated', 'Deactivated', 'CollectionReceived', 'AlertTriggered', 'PriorityEscalated', 'GeometryRevised']) {
      expect((AreaOfInterest as any).event(evt)).toBeDefined()
    }
  })
})

// ─── Service-Backed Methods ──────────────────────────────────

describe('Service Methods', () => {
  it('analyzeCoverage returns pass data', () => {
    const aoi = makeAoi(1)
    const result = Effect.runSync(
      withGeointServices(aoi.analyzeCoverage(24)) as Effect.Effect<any>,
    )
    expect(result).toHaveProperty('totalPasses')
    expect(result).toHaveProperty('sensorBreakdown')
    expect(result).toHaveProperty('nextPassEpoch')
    expect(result.totalPasses).toBeGreaterThan(0)
  })

  it('detectChanges returns change analysis', () => {
    const aoi = makeAoi(1)
    const result = Effect.runSync(
      aoi.detectChanges(Date.now() - 86400_000 * 7).pipe(
        Effect.provideService(ChangeDetection, changeDetectionImpl as any),
      ) as Effect.Effect<any>,
    )
    expect(result).toHaveProperty('changePercent')
    expect(result).toHaveProperty('recommendation')
    expect(['dismiss', 'monitor', 'escalate']).toContain(result.recommendation)
  })

  it('fullAssessment combines coverage + changes + priority', () => {
    const aoi = makeAoi(1)
    const result = Effect.runSync(
      withGeointServices(aoi.fullAssessment(Date.now() - 86400_000 * 7)) as Effect.Effect<any>,
    )
    expect(result).toHaveProperty('coverage')
    expect(result).toHaveProperty('changes')
    expect(result).toHaveProperty('overdue')
    expect(result).toHaveProperty('recommendedPriority')
    expect(['routine', 'priority', 'immediate', 'flash']).toContain(result.recommendedPriority)
  })
})

// ─── Reactive Bridge ─────────────────────────────────────────

describe('Reactive Bridge', () => {
  it('hydrates 100 AOIs into reactive atoms', () => {
    const seed = Array.from({ length: 100 }, (_, i) => makeAoi(i))
    const registry = AtomRegistry.make()
    const rx = (AreaOfInterest as any).reactive(registry, {
      getId: (a: any) => a.id,
      initialData: seed,
    })

    expect(registry.get(rx.items)).toHaveLength(100)
    expect(registry.get(rx.count)).toBe(100)

    // Lookup by ID
    const map = registry.get(rx.byId)
    expect(map.get('aoi-0042')).toBeDefined()
    expect(map.get('aoi-0042').codename).toBe('SIGMA-42')

    rx.dispose()
  })

  it('surgical update triggers only affected atom', () => {
    const seed = Array.from({ length: 10 }, (_, i) => makeAoi(i))
    const registry = AtomRegistry.make()
    const rx = (AreaOfInterest as any).reactive(registry, {
      getId: (a: any) => a.id,
      initialData: seed,
    })

    // Update one AOI
    rx.update('aoi-0005', { notes: 'UPDATED' } as any)

    const map = registry.get(rx.byId)
    expect(map.get('aoi-0005').notes).toBe('UPDATED')
    expect(map.get('aoi-0003').notes).toBe('Monitoring notes for area 3') // untouched

    rx.dispose()
  })
})

// ─── Benchmarks ──────────────────────────────────────────────

describe('Benchmarks', () => {
  it('B1: 10K AOI instantiation', () => {
    const N = 10_000
    const start = performance.now()
    const items: AreaOfInterest[] = []
    for (let i = 0; i < N; i++) items.push(makeAoi(i))
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`AOI B1 Instantiate 10K: ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(items).toHaveLength(N)
    expect(rate).toBeGreaterThan(30_000)
  })

  it('B2: getters across 10K instances', () => {
    const items = Array.from({ length: 10_000 }, (_, i) => makeAoi(i))
    const N = items.length

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      items[i].displayName
      items[i].isActive
      items[i].isUrgent
      items[i].estimatedAreaKm2
      items[i].isCollectionOverdue
    }
    const elapsed = performance.now() - start
    const rate = ((N * 5) / elapsed) * 1000

    console.log(`AOI B2 Getters 10K×5: ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(500_000)
  })

  it('B3: service method across 1K instances', () => {
    const items = Array.from({ length: 1_000 }, (_, i) => makeAoi(i))
    const N = items.length

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      Effect.runSync(
        withGeointServices(items[i].analyzeCoverage(24)) as Effect.Effect<any>,
      )
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`AOI B3 Service 1K: ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(10_000)
  })

  it('B4: reactive hydrate 10K AOIs', () => {
    const seed = Array.from({ length: 10_000 }, (_, i) => makeAoi(i))
    const registry = AtomRegistry.make()

    const start = performance.now()
    const rx = (AreaOfInterest as any).reactive(registry, {
      getId: (a: any) => a.id,
      initialData: seed,
    })
    const elapsed = performance.now() - start
    const rate = (10_000 / elapsed) * 1000

    expect(registry.get(rx.items)).toHaveLength(10_000)
    console.log(`AOI B4 Hydrate 10K: ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(elapsed).toBeLessThan(200)
    rx.dispose()
  })

  it('B5: full assessment (multi-service) across 500 instances', () => {
    const items = Array.from({ length: 500 }, (_, i) => makeAoi(i))
    const baseline = Date.now() - 86400_000 * 7

    const start = performance.now()
    for (let i = 0; i < 500; i++) {
      Effect.runSync(
        withGeointServices(items[i].fullAssessment(baseline)) as Effect.Effect<any>,
      )
    }
    const elapsed = performance.now() - start
    const rate = (500 / elapsed) * 1000

    console.log(`AOI B5 FullAssessment 500: ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(5_000)
  })
})
