/**
 * @tmnl/entity Walkthrough — AreaOfInterest (Geoint Domain)
 *
 * A persistent geographic watch area used in geospatial intelligence.
 * Exercises every Entity feature:
 *
 *   ✓ Entity.generated   — server-assigned UUID
 *   ✓ Entity.timestamp   — createdAt, updatedAt, lastCollected
 *   ✓ Entity.sensitive   — classification markings (never over wire)
 *   ✓ Entity.readonly    — server-computed coverage score
 *   ✓ Schema.Literals    — status enum, priority tier
 *   ✓ Schema.Array       — polygon coordinates, sensor types
 *   ✓ Schema.Struct      — nested centroid, change detection config
 *   ✓ Computed getters   — derived properties from fields
 *   ✓ Service methods    — Effect.gen programs that yield* services
 *   ✓ Custom events      — domain-specific lifecycle beyond CRUD
 *   ✓ Reactive bridge    — STX atoms for React consumption
 *
 * @module
 */

import * as Schema from 'effect-v4/Schema'
import * as Effect from 'effect-v4/Effect'
import { ServiceMap } from 'effect-v4'
import { Entity } from '../src/entity.js'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 1: Define sub-schemas (reusable building blocks)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// Effect Schema gives us composable types. Define domain-specific
// schemas for coordinates, geometry, and configuration objects.
// These are reusable across multiple entities.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** A single geographic coordinate: [longitude, latitude] */
const Coordinate = Schema.Tuple([Schema.Number, Schema.Number])

/** A geographic point (for centroids, POIs) */
const GeoPoint = Schema.Struct({
  lng: Schema.Number,
  lat: Schema.Number,
})

/** Change detection configuration — thresholds and intervals */
const ChangeDetectionConfig = Schema.Struct({
  /** Minimum % change to trigger alert (0-100) */
  threshold: Schema.Number,
  /** Re-collection interval in hours */
  intervalHours: Schema.Number,
  /** Which spectral bands to monitor */
  bands: Schema.Array(Schema.Literals(['visible', 'infrared', 'SAR', 'multispectral', 'hyperspectral'] as const)),
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 2: Define the Effect services the entity will depend on
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// Service-backed methods use Effect.gen to yield* services.
// This gives us:
//   - Dependency injection (swap real/mock at the Layer level)
//   - Testability (provide test impls in test Layer)
//   - Observability (Effect.withSpan for tracing)
//   - Error handling (typed errors via Effect.fail)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * CoverageAnalysis — computes sensor coverage metrics for an AOI.
 *
 * In production: calls satellite tasking API, queries orbital mechanics.
 * In tests: returns deterministic mock data.
 */
export class CoverageAnalysis extends ServiceMap.Service<CoverageAnalysis>()('geoint/CoverageAnalysis', {
  succeed: {
    /**
     * Calculate how many sensor passes cover this AOI in the next N hours.
     */
    calculatePasses(polygon: readonly (readonly [number, number])[], sensors: readonly string[], windowHours: number): {
      totalPasses: number
      sensorBreakdown: Record<string, number>
      nextPassEpoch: number
    } {
      // Production: orbital mechanics + sensor FOV intersection
      // Benchmark: deterministic calculation
      const breakdown: Record<string, number> = {}
      for (const sensor of sensors) {
        breakdown[sensor] = Math.floor(windowHours / 6) + polygon.length % 3
      }
      return {
        totalPasses: Object.values(breakdown).reduce((a, b) => a + b, 0),
        sensorBreakdown: breakdown,
        nextPassEpoch: Date.now() + 3600_000,
      }
    },

    /**
     * Score 0-100: how well is this AOI covered by available sensors?
     */
    scoreCoverage(polygon: readonly (readonly [number, number])[], collectionCount: number): number {
      const area = polygon.length * 10 // simplified
      const density = collectionCount / Math.max(area, 1)
      return Math.min(100, Math.round(density * 1000))
    },
  },
}) {}

/**
 * ChangeDetection — analyzes imagery deltas for an AOI.
 */
export class ChangeDetection extends ServiceMap.Service<ChangeDetection>()('geoint/ChangeDetection', {
  succeed: {
    /**
     * Compare two collection epochs and score change magnitude.
     */
    analyzeChange(aoiId: string, baselineEpoch: number, currentEpoch: number): {
      changePercent: number
      hotspots: Array<{ lng: number; lat: number; magnitude: number }>
      recommendation: 'dismiss' | 'monitor' | 'escalate'
    } {
      const delta = currentEpoch - baselineEpoch
      const changePercent = Math.min(100, (delta / 86400_000) * 15)
      return {
        changePercent,
        hotspots: changePercent > 50
          ? [{ lng: -74.006, lat: 40.7128, magnitude: changePercent }]
          : [],
        recommendation: changePercent > 70 ? 'escalate' : changePercent > 30 ? 'monitor' : 'dismiss',
      }
    },
  },
}) {}

// ── Concrete impls for sync provideService ──
// The `succeed:` config objects ARE the service shapes.
// For provideService, we pass them directly.

const coverageImpl = {
  calculatePasses: (CoverageAnalysis as any).prototype?.calculatePasses
    ?? function(polygon: any, sensors: any, windowHours: number) {
      const breakdown: Record<string, number> = {}
      for (const sensor of sensors) {
        breakdown[sensor] = Math.floor(windowHours / 6) + polygon.length % 3
      }
      return {
        totalPasses: Object.values(breakdown).reduce((a: number, b: number) => a + b, 0),
        sensorBreakdown: breakdown,
        nextPassEpoch: Date.now() + 3600_000,
      }
    },
  scoreCoverage: function(polygon: any, collectionCount: number) {
    const area = polygon.length * 10
    const density = collectionCount / Math.max(area, 1)
    return Math.min(100, Math.round(density * 1000))
  },
}

const changeDetectionImpl = {
  analyzeChange: function(aoiId: string, baselineEpoch: number, currentEpoch: number) {
    const delta = currentEpoch - baselineEpoch
    const changePercent = Math.min(100, (delta / 86400_000) * 15)
    return {
      changePercent,
      hotspots: changePercent > 50
        ? [{ lng: -74.006, lat: 40.7128, magnitude: changePercent }]
        : [],
      recommendation: changePercent > 70 ? 'escalate' as const : changePercent > 30 ? 'monitor' as const : 'dismiss' as const,
    }
  },
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 3: Define the Entity
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// Entity('Tag')(fields, config) produces:
//   - A Model.Class with .select, .insert, .update, .json variants
//   - 8 standard lifecycle events + custom events
//   - Validators, codec, fieldMeta
//   - .reactive() factory for STX atom bridge
//   - .createHooks() factory for React hooks
//
// You extend the returned class to add getters and methods.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class AreaOfInterest extends Entity('AreaOfInterest')({
  // ── Identity ──
  //
  // Entity.generated() → excluded from insert variant.
  // The server/database assigns the ID, the client never sends it.
  id: Entity.generated(Schema.String),

  // ── Core Fields ──
  //
  // Plain Schema fields → present in ALL variants (select, insert, update, json).
  // Schema.NonEmptyString adds runtime validation: rejects "" on decode.
  name:     Schema.NonEmptyString,
  codename: Schema.String,

  // ── Geometry ──
  //
  // Schema.Array + Schema.Tuple → typed array of [lng, lat] pairs.
  // At least 3 points to form a polygon (enforced by business logic, not schema).
  polygon:  Schema.Array(Coordinate),
  centroid: GeoPoint,

  // ── Classification ──
  //
  // Entity.sensitive() → excluded from json/jsonCreate/jsonUpdate.
  // Classification markings NEVER cross the wire boundary.
  // Server reads/writes them, but API responses strip them.
  classification: Entity.sensitive(
    Schema.Literals(['UNCLASSIFIED', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET'] as const),
  ),

  // ── Enums ──
  //
  // Schema.Literals → union type + runtime validator.
  // No raw TypeScript unions — the schema IS the type AND the validator.
  status: Schema.Literals(['active', 'dormant', 'archived', 'pending_review'] as const),
  priority: Schema.Literals(['routine', 'priority', 'immediate', 'flash'] as const),

  // ── Multi-Sensor Tracking ──
  //
  // Which sensor types are authorized to collect on this AOI.
  sensors: Schema.Array(Schema.Literals(['EO', 'IR', 'SAR', 'SIGINT', 'MASINT'] as const)),

  // ── Monitoring Config ──
  //
  // Nested struct — Schema.Struct composes naturally inside Entity fields.
  changeDetection: ChangeDetectionConfig,

  // ── Metrics ──
  //
  // Entity.readonly() → excluded from insert AND update variants.
  // Only the server can set these — they're computed values.
  coverageScore:   Entity.readonly(Schema.Number),
  collectionCount: Entity.readonly(Schema.Number),

  // ── Temporal ──
  //
  // Entity.timestamp() → present everywhere, optional on insert/update.
  // Infrastructure auto-sets; consumers can override for imports.
  createdAt:     Entity.timestamp(),
  updatedAt:     Entity.timestamp(),
  lastCollected: Entity.timestamp(),

  // ── Free-form ──
  notes: Schema.String,

}, {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 4: Custom Domain Events
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //
  // Beyond the 8 standard lifecycle events (Created, Updated, Deleted,
  // Restored, Archived, Patched, BulkCreated, BulkDeleted), define
  // domain-specific events with typed payload schemas.
  //
  // These become:
  //   AreaOfInterest.Activated
  //   AreaOfInterest.Deactivated
  //   AreaOfInterest.CollectionReceived
  //   AreaOfInterest.AlertTriggered
  //   AreaOfInterest.PriorityEscalated
  //   AreaOfInterest.GeometryRevised
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  events: {
    Activated:          { activatedBy: Schema.String },
    Deactivated:        { reason: Schema.String },
    CollectionReceived: { sensorType: Schema.String, imageId: Schema.String, cloudCover: Schema.Number },
    AlertTriggered:     { changePercent: Schema.Number, recommendation: Schema.String },
    PriorityEscalated:  { from: Schema.String, to: Schema.String, justification: Schema.String },
    GeometryRevised:    { previousVertexCount: Schema.Number, newVertexCount: Schema.Number },
  },
}) {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 5: Computed Getters (pure, no service deps)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //
  // Getters are plain TypeScript — they run at native speed
  // (177M/s for arithmetic, 11M/s for string concat).
  // No Effect overhead. Use for derived display values.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** Human-readable display: "CODENAME (status)" */
  get displayName(): string {
    return `${this.codename.toUpperCase()} (${this.status})`
  }

  /** Is this AOI actively being monitored? */
  get isActive(): boolean {
    return this.status === 'active'
  }

  /** Does this AOI need immediate attention? */
  get isUrgent(): boolean {
    return this.priority === 'immediate' || this.priority === 'flash'
  }

  /** Number of vertices in the polygon boundary */
  get vertexCount(): number {
    return this.polygon.length
  }

  /** Area estimate in sq km (simplified shoelace) */
  get estimatedAreaKm2(): number {
    if (this.polygon.length < 3) return 0
    let area = 0
    const n = this.polygon.length
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      area += this.polygon[i][0] * this.polygon[j][1]
      area -= this.polygon[j][0] * this.polygon[i][1]
    }
    // Convert degrees² to rough km² (at mid-latitudes: ~111km/degree)
    return Math.abs(area / 2) * 111 * 111
  }

  /** Hours since last collection */
  get hoursSinceCollection(): number {
    return (Date.now() - this.lastCollected) / 3_600_000
  }

  /** Is collection overdue based on changeDetection interval? */
  get isCollectionOverdue(): boolean {
    return this.hoursSinceCollection > this.changeDetection.intervalHours
  }

  /** Summary line for list views */
  get summary(): string {
    const urgency = this.isUrgent ? '🔴' : this.isActive ? '🟢' : '⚪'
    const overdue = this.isCollectionOverdue ? ' ⚠️ OVERDUE' : ''
    return `${urgency} ${this.displayName} — ${this.vertexCount} vertices, score: ${this.coverageScore}${overdue}`
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 6: Service-Backed Methods (Effect programs)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //
  // Methods return Effect.Effect<Result, Error, ServiceDeps>.
  // They yield* into services for business logic.
  //
  // At call site: Effect.runSync(Effect.provideService(...))
  // or provide via Layer in a managed runtime.
  //
  // Overhead: ~3µs per Effect.gen call (from benchmarks).
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** Analyze sensor coverage for the next N hours */
  analyzeCoverage(windowHours = 24): Effect.Effect<
    { totalPasses: number; sensorBreakdown: Record<string, number>; nextPassEpoch: number },
    never,
    CoverageAnalysis
  > {
    return Effect.gen(function*(this: AreaOfInterest) {
      const coverage = yield* CoverageAnalysis
      return coverage.calculatePasses(this.polygon, this.sensors, windowHours)
    }.bind(this))
  }

  /** Run change detection analysis against a baseline epoch */
  detectChanges(baselineEpoch: number): Effect.Effect<
    { changePercent: number; hotspots: Array<{ lng: number; lat: number; magnitude: number }>; recommendation: string },
    never,
    ChangeDetection
  > {
    return Effect.gen(function*(this: AreaOfInterest) {
      const cd = yield* ChangeDetection
      return cd.analyzeChange(this.id, baselineEpoch, Date.now())
    }.bind(this))
  }

  /** Full assessment: coverage + change detection + priority recommendation */
  fullAssessment(baselineEpoch: number): Effect.Effect<
    {
      coverage: { totalPasses: number; score: number }
      changes: { changePercent: number; recommendation: string }
      overdue: boolean
      recommendedPriority: 'routine' | 'priority' | 'immediate' | 'flash'
    },
    never,
    CoverageAnalysis | ChangeDetection
  > {
    return Effect.gen(function*(this: AreaOfInterest) {
      const coverageSvc = yield* CoverageAnalysis
      const changeSvc = yield* ChangeDetection

      const passes = coverageSvc.calculatePasses(this.polygon, this.sensors, 24)
      const score = coverageSvc.scoreCoverage(this.polygon, this.collectionCount)
      const changes = changeSvc.analyzeChange(this.id, baselineEpoch, Date.now())

      // Priority recommendation logic
      let recommendedPriority: 'routine' | 'priority' | 'immediate' | 'flash' = 'routine'
      if (changes.recommendation === 'escalate') recommendedPriority = 'immediate'
      else if (changes.recommendation === 'monitor') recommendedPriority = 'priority'
      if (this.isCollectionOverdue && recommendedPriority === 'routine') recommendedPriority = 'priority'

      return {
        coverage: { totalPasses: passes.totalPasses, score },
        changes: { changePercent: changes.changePercent, recommendation: changes.recommendation },
        overdue: this.isCollectionOverdue,
        recommendedPriority,
      }
    }.bind(this))
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 7: What the Entity Factory Produced
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// From that single class definition, you now have:
//
// SCHEMAS (6 variants):
//   AreaOfInterest.select      — full read shape (all 16 fields)
//   AreaOfInterest.insert      — write shape (no id, no coverageScore/collectionCount, timestamps optional)
//   AreaOfInterest.update      — mutation shape (no readonly fields, timestamps optional)
//   AreaOfInterest.json        — wire format (no classification — it's sensitive)
//   AreaOfInterest.jsonCreate  — API create (no id, no classification, no readonly)
//   AreaOfInterest.jsonUpdate  — API update (no classification, no readonly)
//
// EVENTS (14 total):
//   8 lifecycle:  AreaOfInterest.Created, .Updated, .Deleted, .Restored, .Archived, .Patched, .BulkCreated, .BulkDeleted
//   6 custom:     AreaOfInterest.Activated, .Deactivated, .CollectionReceived, .AlertTriggered, .PriorityEscalated, .GeometryRevised
//
// VALIDATORS (safe decode for each variant):
//   AreaOfInterest.validate.select(data)  → { _tag: 'Ok', value } | { _tag: 'Err', issues }
//   AreaOfInterest.validate.insert(data)  → ...
//
// CODEC (wire encode/decode):
//   AreaOfInterest.codec.encode(instance)     → JSON-safe object (classification stripped)
//   AreaOfInterest.codec.decode(wire)         → validated instance
//   AreaOfInterest.codec.encodeArray(items)   → batch encode
//
// FIELD METADATA:
//   AreaOfInterest.fieldMeta  → { id: 'generated', classification: 'sensitive', coverageScore: 'readonly', ... }
//
// REACTIVE BRIDGE:
//   const rx = AreaOfInterest.reactive(registry, { getId: (a) => a.id, initialData: seed })
//   rx.items     — Atom<AreaOfInterest[]>
//   rx.count     — Atom<number>
//   rx.byId      — Atom<Map<string, AreaOfInterest>>
//   rx.item(key) — Atom<AreaOfInterest | undefined>  (family atom — surgical updates)
//   rx.insert(aoi)
//   rx.update(key, partial)
//   rx.remove(key)
//
// GETTERS (native speed):
//   aoi.displayName, aoi.isActive, aoi.isUrgent, aoi.estimatedAreaKm2, etc.
//
// SERVICE METHODS (Effect programs):
//   aoi.analyzeCoverage(24)     → Effect<CoverageResult, never, CoverageAnalysis>
//   aoi.detectChanges(epoch)    → Effect<ChangeResult, never, ChangeDetection>
//   aoi.fullAssessment(epoch)   → Effect<Assessment, never, CoverageAnalysis | ChangeDetection>
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 8: Usage Examples
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── Construct an instance ──
export const exampleAoi = new AreaOfInterest({
  id: 'aoi-001',
  name: 'Port Facility Alpha',
  codename: 'TRIDENT',
  polygon: [[-74.05, 40.70], [-74.00, 40.70], [-74.00, 40.75], [-74.05, 40.75]],
  centroid: { lng: -74.025, lat: 40.725 },
  classification: 'SECRET',
  status: 'active',
  priority: 'priority',
  sensors: ['EO', 'SAR', 'SIGINT'],
  changeDetection: {
    threshold: 25,
    intervalHours: 12,
    bands: ['visible', 'SAR'],
  },
  coverageScore: 72,
  collectionCount: 48,
  createdAt: Date.now() - 86400_000 * 30,
  updatedAt: Date.now() - 3600_000,
  lastCollected: Date.now() - 86400_000,
  notes: 'Monitor for vessel traffic anomalies',
})

// ── Use getters ──
console.log(exampleAoi.displayName)       // "TRIDENT (active)"
console.log(exampleAoi.isActive)          // true
console.log(exampleAoi.isUrgent)          // false
console.log(exampleAoi.vertexCount)       // 4
console.log(exampleAoi.isCollectionOverdue) // depends on lastCollected
console.log(exampleAoi.summary)           // "🟢 TRIDENT (active) — 4 vertices, score: 72"

// ── Use service method ──
const assessment = exampleAoi.fullAssessment(Date.now() - 86400_000 * 7)
const result = Effect.runSync(
  assessment.pipe(
    Effect.provideService(CoverageAnalysis, coverageImpl as any),
    Effect.provideService(ChangeDetection, changeDetectionImpl as any),
  ) as Effect.Effect<any>,
)
console.log(result)
// { coverage: { totalPasses: ..., score: ... }, changes: { ... }, overdue: true/false, recommendedPriority: '...' }

// ── Validate unknown data ──
const validated = AreaOfInterest.validate.insert({
  name: 'New Watch Area',
  codename: 'SENTRY',
  polygon: [[-73.9, 40.7], [-73.8, 40.7], [-73.8, 40.8]],
  centroid: { lng: -73.85, lat: 40.75 },
  classification: 'CONFIDENTIAL',
  status: 'pending_review',
  priority: 'routine',
  sensors: ['EO'],
  changeDetection: { threshold: 50, intervalHours: 24, bands: ['visible'] },
  notes: '',
})
console.log(validated._tag) // 'Ok' or 'Err'

// ── Encode for wire (classification stripped!) ──
const wire = AreaOfInterest.codec.encode(exampleAoi)
console.log('classification' in (wire as any)) // false — sensitive field stripped

// ── Field metadata for STX/debug ──
console.log(AreaOfInterest.fieldMeta)
// {
//   id: 'generated',
//   name: 'data',
//   codename: 'data',
//   polygon: 'data',
//   centroid: 'data',
//   classification: 'sensitive',   ← never on wire
//   status: 'data',
//   priority: 'data',
//   sensors: 'data',
//   changeDetection: 'data',
//   coverageScore: 'readonly',     ← server-only
//   collectionCount: 'readonly',   ← server-only
//   createdAt: 'timestamp',        ← auto-managed
//   updatedAt: 'timestamp',
//   lastCollected: 'timestamp',
//   notes: 'data',
// }
