/**
 * LineState Service Tests
 *
 * Tests for the LineState service with in-memory implementation.
 * Follows TDD approach - tests written first.
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Effect, Option, DateTime } from 'effect'
import { LineState, LineStateInMemory, LineStateNotFoundError } from '../LineState'
import { Line, makeLineId, CreateLineParams } from '../../schemas/assets/line'
import { HierarchyPath, PathSegment } from '../../schemas/hierarchy'
import type { PlantId, EnterpriseId, SiteId } from '../../schemas/identifiers'

describe('LineState', () => {
  // Test helpers
  const testPlantId = 'PLT-test-plant' as PlantId
  const testEnterpriseId = 'ENT-test' as EnterpriseId
  const testSiteId = 'SIT-test' as SiteId

  const makeTestCreateParams = (
    slug: string,
    overrides?: Partial<CreateLineParams>
  ): CreateLineParams => ({
    slug,
    name: `Test Line ${slug}`,
    plantId: testPlantId,
    status: 'active',
    capacity: 100,
    lineType: 'assembly',
    operatingHoursPerDay: 16,
    ...overrides,
  })

  const makeTestLine = (
    slug: string,
    overrides?: Partial<Line>
  ): Effect.Effect<Line, never, never> =>
    DateTime.now.pipe(
      Effect.map((now) =>
        new Line({
          id: makeLineId(slug),
          name: `Test Line ${slug}`,
          status: 'active',
          hierarchyPath: HierarchyPath.fromSegments([
            new PathSegment({ level: 'enterprise', id: testEnterpriseId, name: Option.none() }),
            new PathSegment({ level: 'site', id: testSiteId, name: Option.none() }),
            new PathSegment({ level: 'plant', id: testPlantId, name: Option.none() }),
            new PathSegment({ level: 'line', id: makeLineId(slug), name: Option.some(`Test Line ${slug}`) }),
          ]),
          enterpriseId: Option.some(testEnterpriseId),
          siteId: Option.some(testSiteId),
          plantId: Option.some(testPlantId),
          areaId: Option.none(),
          lineId: Option.none(),
          workCellId: Option.none(),
          machineId: Option.none(),
          createdAt: now,
          updatedAt: Option.none(),
          description: Option.none(),
          location: Option.none(),
          metadata: {},
          capacity: Option.some(100),
          lineType: Option.some('assembly'),
          operatingHoursPerDay: Option.some(16),
          ...overrides,
        })
      )
    )

  describe('create', () => {
    it.concurrent('should create a new line with generated ID', async () => {
      const program = Effect.gen(function* () {
        const state = yield* LineState
        const params = makeTestCreateParams('assembly-1')
        const line = yield* state.create(params)

        expect(line.name).toBe('Test Line assembly-1')
        expect(line.status).toBe('active')
        expect(Option.getOrNull(line.plantId)).toBe(testPlantId)
        expect(Option.getOrNull(line.capacity)).toBe(100)
        expect(Option.getOrNull(line.lineType)).toBe('assembly')
        expect(line.id).toMatch(/^LIN-/)

        return line
      }).pipe(Effect.provide(LineStateInMemory))

      await Effect.runPromise(program)
    })

    it.concurrent('should use default status when not provided', async () => {
      const program = Effect.gen(function* () {
        const state = yield* LineState
        const params = makeTestCreateParams('assembly-2', { status: undefined })
        const line = yield* state.create(params)

        expect(line.status).toBe('active')
        return line
      }).pipe(Effect.provide(LineStateInMemory))

      await Effect.runPromise(program)
    })
  })

  describe('get', () => {
    it.concurrent('should retrieve an existing line', async () => {
      const program = Effect.gen(function* () {
        const state = yield* LineState
        const params = makeTestCreateParams('get-test')
        const created = yield* state.create(params)
        const retrieved = yield* state.get(created.id)

        expect(retrieved.id).toBe(created.id)
        expect(retrieved.name).toBe(created.name)
      }).pipe(Effect.provide(LineStateInMemory))

      await Effect.runPromise(program)
    })

    it.concurrent('should fail with LineStateNotFoundError for non-existent line', async () => {
      const program = Effect.gen(function* () {
        const state = yield* LineState
        const result = yield* state.get(makeLineId('non-existent')).pipe(
          Effect.either
        )

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(LineStateNotFoundError)
        }
      }).pipe(Effect.provide(LineStateInMemory))

      await Effect.runPromise(program)
    })
  })

  describe('set', () => {
    it.concurrent('should update an existing line', async () => {
      const program = Effect.gen(function* () {
        const state = yield* LineState
        const params = makeTestCreateParams('set-test')
        const created = yield* state.create(params)

        const updated = new Line({
          ...created,
          name: 'Updated Line Name',
          status: 'maintenance',
        })
        yield* state.set(updated)

        const retrieved = yield* state.get(created.id)
        expect(retrieved.name).toBe('Updated Line Name')
        expect(retrieved.status).toBe('maintenance')
      }).pipe(Effect.provide(LineStateInMemory))

      await Effect.runPromise(program)
    })

    it.concurrent('should insert a new line if it does not exist', async () => {
      const program = Effect.gen(function* () {
        const state = yield* LineState
        const line = yield* makeTestLine('new-line')

        yield* state.set(line)
        const retrieved = yield* state.get(line.id)

        expect(retrieved.id).toBe(line.id)
        expect(retrieved.name).toBe(line.name)
      }).pipe(Effect.provide(LineStateInMemory))

      await Effect.runPromise(program)
    })
  })

  describe('list', () => {
    it.concurrent('should list all lines when no filter is provided', async () => {
      const program = Effect.gen(function* () {
        const state = yield* LineState
        yield* state.create(makeTestCreateParams('list-1'))
        yield* state.create(makeTestCreateParams('list-2'))
        yield* state.create(makeTestCreateParams('list-3'))

        const lines = yield* state.list({})
        expect(lines.length).toBeGreaterThanOrEqual(3)
      }).pipe(Effect.provide(LineStateInMemory))

      await Effect.runPromise(program)
    })

    it.concurrent('should filter by plantId', async () => {
      const program = Effect.gen(function* () {
        const state = yield* LineState
        const otherPlantId = 'PLT-other-plant' as PlantId

        yield* state.create(makeTestCreateParams('plant-filter-1', { plantId: testPlantId }))
        yield* state.create(makeTestCreateParams('plant-filter-2', { plantId: otherPlantId }))

        const lines = yield* state.list({ plantId: testPlantId })

        for (const line of lines) {
          expect(Option.getOrNull(line.plantId)).toBe(testPlantId)
        }
      }).pipe(Effect.provide(LineStateInMemory))

      await Effect.runPromise(program)
    })

    it.concurrent('should filter by status', async () => {
      const program = Effect.gen(function* () {
        const state = yield* LineState
        yield* state.create(makeTestCreateParams('status-1', { status: 'active' }))
        yield* state.create(makeTestCreateParams('status-2', { status: 'maintenance' }))

        const lines = yield* state.list({ status: 'active' })

        for (const line of lines) {
          expect(line.status).toBe('active')
        }
      }).pipe(Effect.provide(LineStateInMemory))

      await Effect.runPromise(program)
    })

    it.concurrent('should apply pagination', async () => {
      const program = Effect.gen(function* () {
        const state = yield* LineState
        yield* state.create(makeTestCreateParams('page-1'))
        yield* state.create(makeTestCreateParams('page-2'))
        yield* state.create(makeTestCreateParams('page-3'))
        yield* state.create(makeTestCreateParams('page-4'))

        const firstPage = yield* state.list({ limit: 2 })
        expect(firstPage.length).toBeLessThanOrEqual(2)

        const secondPage = yield* state.list({ limit: 2, offset: 2 })
        expect(secondPage.length).toBeLessThanOrEqual(2)
      }).pipe(Effect.provide(LineStateInMemory))

      await Effect.runPromise(program)
    })
  })

  describe('delete', () => {
    it.concurrent('should delete an existing line', async () => {
      const program = Effect.gen(function* () {
        const state = yield* LineState
        const created = yield* state.create(makeTestCreateParams('delete-test'))

        const deleted = yield* state.delete(created.id)
        expect(deleted).toBe(true)

        const exists = yield* state.exists(created.id)
        expect(exists).toBe(false)
      }).pipe(Effect.provide(LineStateInMemory))

      await Effect.runPromise(program)
    })

    it.concurrent('should return false for non-existent line', async () => {
      const program = Effect.gen(function* () {
        const state = yield* LineState
        const deleted = yield* state.delete(makeLineId('non-existent-delete'))
        expect(deleted).toBe(false)
      }).pipe(Effect.provide(LineStateInMemory))

      await Effect.runPromise(program)
    })
  })

  describe('exists', () => {
    it.concurrent('should return true for existing line', async () => {
      const program = Effect.gen(function* () {
        const state = yield* LineState
        const created = yield* state.create(makeTestCreateParams('exists-test'))

        const exists = yield* state.exists(created.id)
        expect(exists).toBe(true)
      }).pipe(Effect.provide(LineStateInMemory))

      await Effect.runPromise(program)
    })

    it.concurrent('should return false for non-existent line', async () => {
      const program = Effect.gen(function* () {
        const state = yield* LineState
        const exists = yield* state.exists(makeLineId('non-existent-exists'))
        expect(exists).toBe(false)
      }).pipe(Effect.provide(LineStateInMemory))

      await Effect.runPromise(program)
    })
  })

  describe('count', () => {
    it.concurrent('should count all lines when no filter is provided', async () => {
      const program = Effect.gen(function* () {
        const state = yield* LineState
        const initialCount = yield* state.count({})

        yield* state.create(makeTestCreateParams('count-1'))
        yield* state.create(makeTestCreateParams('count-2'))

        const finalCount = yield* state.count({})
        expect(finalCount).toBe(initialCount + 2)
      }).pipe(Effect.provide(LineStateInMemory))

      await Effect.runPromise(program)
    })

    it.concurrent('should count with filter', async () => {
      const program = Effect.gen(function* () {
        const state = yield* LineState
        const filterPlantId = 'PLT-count-filter' as PlantId

        yield* state.create(makeTestCreateParams('count-filter-1', { plantId: filterPlantId }))
        yield* state.create(makeTestCreateParams('count-filter-2', { plantId: filterPlantId }))
        yield* state.create(makeTestCreateParams('count-filter-3', { plantId: testPlantId }))

        const count = yield* state.count({ plantId: filterPlantId })
        expect(count).toBe(2)
      }).pipe(Effect.provide(LineStateInMemory))

      await Effect.runPromise(program)
    })
  })
})
