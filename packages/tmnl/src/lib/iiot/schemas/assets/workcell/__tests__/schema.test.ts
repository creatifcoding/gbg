/**
 * WorkCell Schema Unit Tests
 *
 * ISA-95 Level 1 - Work Cell / Work Unit
 * Tests for WorkCell entity, identifier, and factory functions.
 *
 * @module @gbg/tmnl/iiot/schemas/assets/workcell/__tests__
 */

import { describe, it, expect } from '@effect/vitest'
import { Effect, Schema, DateTime, Option } from 'effect'
import {
  WorkCellId,
  makeWorkCellId,
  WorkCell,
  CreateWorkCellParams,
} from '../schema'
import { LineId, makeLineId } from '../../line/schema'
import { AssetStatus } from '../../common/types'

describe('WorkCell Schema', () => {
  const now = DateTime.unsafeNow()
  const testLineId = makeLineId('assembly-01')

  // Helper to create valid test data
  const makeTestWorkCell = () =>
    new WorkCell({
      id: makeWorkCellId('welding-station-01'),
      name: 'Welding Station 1' as Schema.Schema.Type<typeof Schema.NonEmptyString>,
      status: 'active' as AssetStatus,
      lineId: testLineId,
      cellType: Option.some('welding'),
      cycleTimeSeconds: Option.some(45),
      position: Option.some(3),
      description: Option.some('Primary welding station for frame assembly'),
      createdAt: now,
      updatedAt: Option.none(),
      metadata: {},
    })

  describe('WorkCellId', () => {
    it.effect('accepts valid WorkCellId pattern', () =>
      Effect.gen(function* () {
        const validIds = [
          'WCL-welding-01',
          'WCL-assembly-a',
          'WCL-packaging-123',
          'WCL-station-1-a',
        ]
        for (const id of validIds) {
          const decoded = yield* Schema.decodeUnknown(WorkCellId)(id)
          expect(decoded).toBe(id)
        }
      })
    )

    it.effect('rejects invalid WorkCellId pattern', () =>
      Effect.gen(function* () {
        const invalidIds = [
          'welding-01', // missing WCL- prefix
          'WCL_welding', // underscore instead of hyphen in prefix
          'WCL-', // empty slug
          'wcl-welding', // lowercase prefix
        ]
        for (const id of invalidIds) {
          const result = yield* Schema.decodeUnknown(WorkCellId)(id).pipe(
            Effect.either
          )
          expect(result._tag).toBe('Left')
        }
      })
    )

    it('makeWorkCellId creates valid id from slug', () => {
      const id = makeWorkCellId('welding-station-01')
      expect(id).toBe('WCL-welding-station-01')
    })
  })

  describe('WorkCell Entity', () => {
    it('creates WorkCell instance with _tag', () => {
      const workCell = makeTestWorkCell()
      expect(workCell._tag).toBe('WorkCell')
      expect(workCell.id).toBe('WCL-welding-station-01')
      expect(workCell.name).toBe('Welding Station 1')
      expect(workCell.lineId).toBe('LIN-assembly-01')
    })

    it('getAutomationLevel returns 1 (ISA-95 Level 1)', () => {
      const workCell = makeTestWorkCell()
      expect(workCell.getAutomationLevel()).toBe(1)
    })

    it('isOperational returns true for active status', () => {
      const workCell = makeTestWorkCell()
      expect(workCell.isOperational()).toBe(true)
    })

    it('isOperational returns true for inactive status', () => {
      const workCell = new WorkCell({
        ...makeTestWorkCell(),
        status: 'inactive' as AssetStatus,
      })
      expect(workCell.isOperational()).toBe(true)
    })

    it('isOperational returns false for maintenance status', () => {
      const workCell = new WorkCell({
        ...makeTestWorkCell(),
        status: 'maintenance' as AssetStatus,
      })
      expect(workCell.isOperational()).toBe(false)
    })

    it('isOperational returns false for decommissioned status', () => {
      const workCell = new WorkCell({
        ...makeTestWorkCell(),
        status: 'decommissioned' as AssetStatus,
      })
      expect(workCell.isOperational()).toBe(false)
    })

    it('isContainer returns true (work cells contain machines)', () => {
      const workCell = makeTestWorkCell()
      expect(workCell.isContainer()).toBe(true)
    })

    it('handles optional fields with Option.none()', () => {
      const workCell = new WorkCell({
        id: makeWorkCellId('minimal-cell'),
        name: 'Minimal Cell' as Schema.Schema.Type<typeof Schema.NonEmptyString>,
        status: 'active' as AssetStatus,
        lineId: testLineId,
        cellType: Option.none(),
        cycleTimeSeconds: Option.none(),
        position: Option.none(),
        description: Option.none(),
        createdAt: now,
        updatedAt: Option.none(),
        metadata: {},
      })
      expect(Option.isNone(workCell.cellType)).toBe(true)
      expect(Option.isNone(workCell.cycleTimeSeconds)).toBe(true)
      expect(Option.isNone(workCell.position)).toBe(true)
    })

    it.effect('encodes and decodes WorkCell', () =>
      Effect.gen(function* () {
        const workCell = makeTestWorkCell()
        const encoded = yield* Schema.encode(WorkCell)(workCell)
        expect(encoded).toBeDefined()
        expect(typeof encoded).toBe('object')

        const decoded = yield* Schema.decode(WorkCell)(encoded)
        expect(decoded._tag).toBe('WorkCell')
        expect(decoded.id).toBe('WCL-welding-station-01')
        expect(decoded.name).toBe('Welding Station 1')
        expect(decoded.lineId).toBe('LIN-assembly-01')
      })
    )
  })

  describe('CreateWorkCellParams', () => {
    it.effect('accepts valid creation params', () =>
      Effect.gen(function* () {
        const params = {
          slug: 'welding-01',
          name: 'Welding Station 1',
          lineId: 'LIN-assembly-01',
          status: 'active',
          cellType: 'welding',
          cycleTimeSeconds: 45,
          position: 3,
          description: 'Primary welding station',
        }

        const decoded = yield* Schema.decodeUnknown(CreateWorkCellParams)(params)
        expect(decoded.slug).toBe('welding-01')
        expect(decoded.name).toBe('Welding Station 1')
        expect(decoded.lineId).toBe('LIN-assembly-01')
        expect(decoded.cellType).toBe('welding')
      })
    )

    it.effect('defaults status to active when not provided', () =>
      Effect.gen(function* () {
        const params = {
          slug: 'welding-01',
          name: 'Welding Station 1',
          lineId: 'LIN-assembly-01',
        }

        const decoded = yield* Schema.decodeUnknown(CreateWorkCellParams)(params)
        expect(decoded.status).toBe('active')
      })
    )

    it.effect('rejects invalid slug pattern', () =>
      Effect.gen(function* () {
        const params = {
          slug: 'invalid_slug!', // invalid characters
          name: 'Test Cell',
          lineId: 'LIN-assembly-01',
        }

        const result = yield* Schema.decodeUnknown(CreateWorkCellParams)(
          params
        ).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )

    it.effect('rejects negative cycleTimeSeconds', () =>
      Effect.gen(function* () {
        const params = {
          slug: 'test-cell',
          name: 'Test Cell',
          lineId: 'LIN-assembly-01',
          cycleTimeSeconds: -5,
        }

        const result = yield* Schema.decodeUnknown(CreateWorkCellParams)(
          params
        ).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )

    it.effect('rejects negative position', () =>
      Effect.gen(function* () {
        const params = {
          slug: 'test-cell',
          name: 'Test Cell',
          lineId: 'LIN-assembly-01',
          position: -1,
        }

        const result = yield* Schema.decodeUnknown(CreateWorkCellParams)(
          params
        ).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )

    it.effect('rejects non-integer position', () =>
      Effect.gen(function* () {
        const params = {
          slug: 'test-cell',
          name: 'Test Cell',
          lineId: 'LIN-assembly-01',
          position: 2.5,
        }

        const result = yield* Schema.decodeUnknown(CreateWorkCellParams)(
          params
        ).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  })
})
