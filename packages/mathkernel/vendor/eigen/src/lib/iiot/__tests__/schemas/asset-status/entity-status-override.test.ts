/**
 * Entity-Specific Status Override Tests
 *
 * Validates that Plant, Line, and WorkCell each define their own status
 * literal matching their domain state-graph, overriding the generic AssetStatus.
 *
 * TDD: These tests are written BEFORE implementation changes.
 *
 * @module @gbg/tmnl/iiot/__tests__/schemas/asset-status/entity-status-override
 */

import { describe, it, expect } from '@effect/vitest'
import { Effect, Schema, DateTime, Option } from 'effect'

// ── Plant imports ──────────────────────────────────────────────────────────
import {
  Plant,
  PlantId,
  makePlantId,
  CreatePlantParams,
  UpdatePlantParams,
} from '../../../schemas/assets/plant/schema'
import type { PlantStatus } from '../../../schemas/assets/plant/schema'

// ── Line imports ───────────────────────────────────────────────────────────
import {
  Line,
  LineId,
  makeLineId,
  CreateLineParams,
} from '../../../schemas/assets/line/schema'
import type { LineStatus } from '../../../schemas/assets/line/schema'

// ── WorkCell imports ───────────────────────────────────────────────────────
import {
  WorkCell,
  WorkCellId,
  makeWorkCellId,
  CreateWorkCellParams,
} from '../../../schemas/assets/workcell/schema'
import type { WorkCellStatus } from '../../../schemas/assets/workcell/schema'

// ── Shared helpers ─────────────────────────────────────────────────────────
import { HierarchyPath, PathSegment } from '../../../schemas/hierarchy'

const now = DateTime.unsafeNow()

const makeHierarchyPath = (segments: Array<{ level: string; id: string }>) =>
  HierarchyPath.fromSegments(
    segments.map(
      (s) => new PathSegment({ level: s.level as any, id: s.id, name: Option.none() })
    )
  )

// =============================================================================
// PLANT STATUS TESTS
// =============================================================================

describe('PlantStatus override', () => {
  const PLANT_GRAPH_STATES = [
    'commissioning',
    'operational',
    'scheduled_shutdown',
    'emergency_shutdown',
    'maintenance_shutdown',
    'decommissioned',
  ] as const

  const plantPath = makeHierarchyPath([
    { level: 'enterprise', id: 'ENT-test' },
    { level: 'site', id: 'SIT-test' },
    { level: 'plant', id: 'PLT-test' },
  ])

  const makePlant = (status: string) =>
    new Plant({
      id: makePlantId('test-plant'),
      name: 'Test Plant' as any,
      status: status as any,
      hierarchyPath: plantPath,
      timezone: 'UTC',
      siteCode: Option.none(),
      enterpriseId: Option.none(),
      siteId: Option.none(),
      areaId: Option.none(),
      plantId: Option.none(),
      lineId: Option.none(),
      workCellId: Option.none(),
      machineId: Option.none(),
      location: Option.none(),
      description: Option.none(),
      createdAt: now,
      updatedAt: Option.none(),
      metadata: {},
    })

  describe('Schema literal accepts graph states', () => {
    for (const state of PLANT_GRAPH_STATES) {
      it(`accepts '${state}'`, () => {
        const plant = makePlant(state)
        expect(plant.status).toBe(state)
      })
    }
  })

  describe('Schema literal rejects old generic states', () => {
    // 'active' and 'inactive' are NOT in the plant graph
    it.effect('rejects "active" (not a plant graph state)', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(
          Schema.Literal(...PLANT_GRAPH_STATES)
        )('active').pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )

    it.effect('rejects "inactive" (not a plant graph state)', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(
          Schema.Literal(...PLANT_GRAPH_STATES)
        )('inactive').pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  })

  describe('isOperational uses domain states', () => {
    it('returns true for "operational"', () => {
      expect(makePlant('operational').isOperational()).toBe(true)
    })

    it('returns false for "commissioning"', () => {
      expect(makePlant('commissioning').isOperational()).toBe(false)
    })

    it('returns false for "scheduled_shutdown"', () => {
      expect(makePlant('scheduled_shutdown').isOperational()).toBe(false)
    })

    it('returns false for "decommissioned"', () => {
      expect(makePlant('decommissioned').isOperational()).toBe(false)
    })
  })

  describe('CreatePlantParams uses PlantStatus', () => {
    it.effect('accepts "commissioning" as status', () =>
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeUnknown(CreatePlantParams)({
          slug: 'test-plant',
          name: 'Test',
          timezone: 'UTC',
          status: 'commissioning',
        })
        expect(decoded.status).toSatisfy(
          (s: any) => s === 'commissioning' || Option.isSome(s)
        )
      })
    )

    it.effect('rejects "active" as status (not a plant graph state)', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(CreatePlantParams)({
          slug: 'test-plant',
          name: 'Test',
          timezone: 'UTC',
          status: 'active',
        }).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  })

  describe('UpdatePlantParams uses PlantStatus', () => {
    it.effect('accepts "operational" as status', () =>
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeUnknown(UpdatePlantParams)({
          id: 'PLT-test-plant',
          status: 'operational',
        })
        expect(decoded).toBeDefined()
      })
    )

    it.effect('rejects "active" as status', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(UpdatePlantParams)({
          id: 'PLT-test-plant',
          status: 'active',
        }).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  })
})

// =============================================================================
// LINE STATUS TESTS
// =============================================================================

describe('LineStatus override', () => {
  const LINE_GRAPH_STATES = [
    'idle',
    'running',
    'changeover',
    'starved',
    'blocked',
    'maintenance',
    'decommissioned',
  ] as const

  const linePath = makeHierarchyPath([
    { level: 'enterprise', id: 'ENT-test' },
    { level: 'site', id: 'SIT-test' },
    { level: 'plant', id: 'PLT-test' },
    { level: 'line', id: 'LIN-test' },
  ])

  const testPlantId = makePlantId('test-plant')

  const makeLine = (status: string) =>
    new Line({
      id: makeLineId('test-line'),
      name: 'Test Line' as any,
      status: status as any,
      hierarchyPath: linePath,
      capacity: Option.none(),
      lineType: Option.none(),
      operatingHoursPerDay: Option.none(),
      enterpriseId: Option.none(),
      siteId: Option.none(),
      areaId: Option.none(),
      plantId: Option.some(testPlantId),
      lineId: Option.none(),
      workCellId: Option.none(),
      machineId: Option.none(),
      location: Option.none(),
      description: Option.none(),
      createdAt: now,
      updatedAt: Option.none(),
      metadata: {},
    })

  describe('Schema literal accepts graph states', () => {
    for (const state of LINE_GRAPH_STATES) {
      it(`accepts '${state}'`, () => {
        const line = makeLine(state)
        expect(line.status).toBe(state)
      })
    }
  })

  describe('isOperational uses domain states', () => {
    it('returns true for "idle"', () => {
      expect(makeLine('idle').isOperational()).toBe(true)
    })

    it('returns true for "running"', () => {
      expect(makeLine('running').isOperational()).toBe(true)
    })

    it('returns true for "changeover"', () => {
      expect(makeLine('changeover').isOperational()).toBe(true)
    })

    it('returns false for "starved"', () => {
      expect(makeLine('starved').isOperational()).toBe(false)
    })

    it('returns false for "blocked"', () => {
      expect(makeLine('blocked').isOperational()).toBe(false)
    })

    it('returns false for "maintenance"', () => {
      expect(makeLine('maintenance').isOperational()).toBe(false)
    })

    it('returns false for "decommissioned"', () => {
      expect(makeLine('decommissioned').isOperational()).toBe(false)
    })
  })

  describe('CreateLineParams uses LineStatus', () => {
    it.effect('defaults status to "idle" (not "active")', () =>
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeUnknown(CreateLineParams)({
          slug: 'test-line',
          name: 'Test Line',
          plantId: 'PLT-test-plant',
        })
        expect(decoded.status).toBe('idle')
      })
    )

    it.effect('rejects "active" as status (not a line graph state)', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(CreateLineParams)({
          slug: 'test-line',
          name: 'Test Line',
          plantId: 'PLT-test-plant',
          status: 'active',
        }).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  })
})

// =============================================================================
// WORKCELL STATUS TESTS
// =============================================================================

describe('WorkCellStatus override', () => {
  const WORKCELL_GRAPH_STATES = [
    'idle',
    'setup',
    'running',
    'blocked',
    'faulted',
    'maintenance',
    'decommissioned',
  ] as const

  const workCellPath = makeHierarchyPath([
    { level: 'enterprise', id: 'ENT-test' },
    { level: 'site', id: 'SIT-test' },
    { level: 'plant', id: 'PLT-test' },
    { level: 'line', id: 'LIN-test' },
    { level: 'workcell', id: 'WCL-test' },
  ])

  const testLineId = makeLineId('test-line')

  const makeWC = (status: string) =>
    new WorkCell({
      id: makeWorkCellId('test-wc'),
      name: 'Test WorkCell' as any,
      status: status as any,
      hierarchyPath: workCellPath,
      cellType: Option.none(),
      cycleTimeSeconds: Option.none(),
      position: Option.none(),
      enterpriseId: Option.none(),
      siteId: Option.none(),
      areaId: Option.none(),
      plantId: Option.none(),
      lineId: Option.some(testLineId),
      workCellId: Option.none(),
      machineId: Option.none(),
      location: Option.none(),
      description: Option.none(),
      createdAt: now,
      updatedAt: Option.none(),
      metadata: {},
    })

  describe('Schema literal accepts graph states', () => {
    for (const state of WORKCELL_GRAPH_STATES) {
      it(`accepts '${state}'`, () => {
        const wc = makeWC(state)
        expect(wc.status).toBe(state)
      })
    }
  })

  describe('isOperational uses domain states', () => {
    it('returns true for "idle"', () => {
      expect(makeWC('idle').isOperational()).toBe(true)
    })

    it('returns true for "setup"', () => {
      expect(makeWC('setup').isOperational()).toBe(true)
    })

    it('returns true for "running"', () => {
      expect(makeWC('running').isOperational()).toBe(true)
    })

    it('returns false for "blocked"', () => {
      expect(makeWC('blocked').isOperational()).toBe(false)
    })

    it('returns false for "faulted"', () => {
      expect(makeWC('faulted').isOperational()).toBe(false)
    })

    it('returns false for "maintenance"', () => {
      expect(makeWC('maintenance').isOperational()).toBe(false)
    })

    it('returns false for "decommissioned"', () => {
      expect(makeWC('decommissioned').isOperational()).toBe(false)
    })
  })

  describe('CreateWorkCellParams uses WorkCellStatus', () => {
    it.effect('defaults status to "idle" (not "active")', () =>
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeUnknown(CreateWorkCellParams)({
          slug: 'test-wc',
          name: 'Test WorkCell',
          lineId: 'LIN-test-line',
        })
        expect(decoded.status).toBe('idle')
      })
    )

    it.effect('rejects "active" as status (not a workcell graph state)', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(CreateWorkCellParams)({
          slug: 'test-wc',
          name: 'Test WorkCell',
          lineId: 'LIN-test-line',
          status: 'active',
        }).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  })
})
