/**
 * SiteState Service Tests
 *
 * Tests for the SiteState service with in-memory implementation.
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Effect, Option } from 'effect'
import { SiteState, SiteStateInMemory, SiteStateNotFoundError } from '../SiteState'
import type { CreateSiteParams } from '../../schemas/assets/site'
import type { EnterpriseId } from '../../schemas/identifiers'

describe('SiteState', () => {
  const testEnterpriseId = 'ENT-test-corp' as EnterpriseId

  const makeTestParams = (slug: string): CreateSiteParams => ({
    slug,
    name: `Test Site ${slug}`,
    enterpriseId: testEnterpriseId,
    timezone: 'America/Chicago',
    status: Option.none(),
    location: Option.none(),
    description: undefined,
    metadata: Option.none(),
    address: undefined,
    city: undefined,
    state: undefined,
    country: undefined,
    postalCode: undefined,
  })

  describe('create', () => {
    it.concurrent('should create a site with generated ID', async () => {
      const program = Effect.gen(function* () {
        const state = yield* SiteState
        const params = makeTestParams('chicago-main')
        const site = yield* state.create(params)

        expect(site.id).toMatch(/^SIT-/)
        expect(site.name).toBe('Test Site chicago-main')
        expect(site.enterpriseId).toBe(testEnterpriseId)
        expect(site.timezone).toBe('America/Chicago')
        expect(site.status).toBe('active')
        expect(site._tag).toBe('Site')

        return site
      })

      await Effect.runPromise(Effect.provide(program, SiteStateInMemory))
    })

    it.concurrent('should allow creating multiple sites', async () => {
      const program = Effect.gen(function* () {
        const state = yield* SiteState
        const site1 = yield* state.create(makeTestParams('site-1'))
        const site2 = yield* state.create(makeTestParams('site-2'))

        expect(site1.id).not.toBe(site2.id)
        expect(site1.name).toBe('Test Site site-1')
        expect(site2.name).toBe('Test Site site-2')
      })

      await Effect.runPromise(Effect.provide(program, SiteStateInMemory))
    })
  })

  describe('get', () => {
    it.concurrent('should retrieve a created site', async () => {
      const program = Effect.gen(function* () {
        const state = yield* SiteState
        const created = yield* state.create(makeTestParams('get-test'))
        const retrieved = yield* state.get(created.id)

        expect(retrieved.id).toBe(created.id)
        expect(retrieved.name).toBe(created.name)
      })

      await Effect.runPromise(Effect.provide(program, SiteStateInMemory))
    })

    it.concurrent('should fail for non-existent site', async () => {
      const program = Effect.gen(function* () {
        const state = yield* SiteState
        const result = yield* state.get('SIT-does-not-exist' as any).pipe(
          Effect.either
        )

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(SiteStateNotFoundError)
        }
      })

      await Effect.runPromise(Effect.provide(program, SiteStateInMemory))
    })
  })

  describe('set', () => {
    it.concurrent('should update an existing site', async () => {
      const program = Effect.gen(function* () {
        const state = yield* SiteState
        const created = yield* state.create(makeTestParams('update-test'))

        // Create an updated version
        const updated = new (created.constructor as any)({
          ...created,
          name: 'Updated Site Name',
        })

        yield* state.set(updated)

        const retrieved = yield* state.get(created.id)
        expect(retrieved.name).toBe('Updated Site Name')
      })

      await Effect.runPromise(Effect.provide(program, SiteStateInMemory))
    })
  })

  describe('list', () => {
    it.concurrent('should list all sites', async () => {
      const program = Effect.gen(function* () {
        const state = yield* SiteState
        yield* state.create(makeTestParams('list-1'))
        yield* state.create(makeTestParams('list-2'))
        yield* state.create(makeTestParams('list-3'))

        const sites = yield* state.list({})
        expect(sites.length).toBeGreaterThanOrEqual(3)
      })

      await Effect.runPromise(Effect.provide(program, SiteStateInMemory))
    })

    it.concurrent('should filter by enterpriseId', async () => {
      const program = Effect.gen(function* () {
        const state = yield* SiteState
        const otherEnterprise = 'ENT-other-corp' as EnterpriseId

        yield* state.create(makeTestParams('filter-1'))
        yield* state.create({
          ...makeTestParams('filter-2'),
          enterpriseId: otherEnterprise,
        })

        const sites = yield* state.list({ enterpriseId: testEnterpriseId })
        const siteIds = sites.map(s => s.id)

        // Should only contain sites from testEnterpriseId
        for (const site of sites) {
          expect(site.enterpriseId).toBe(testEnterpriseId)
        }
      })

      await Effect.runPromise(Effect.provide(program, SiteStateInMemory))
    })

    it.concurrent('should apply pagination', async () => {
      const program = Effect.gen(function* () {
        const state = yield* SiteState
        yield* state.create(makeTestParams('page-1'))
        yield* state.create(makeTestParams('page-2'))
        yield* state.create(makeTestParams('page-3'))

        const page1 = yield* state.list({ limit: 2 })
        expect(page1.length).toBeLessThanOrEqual(2)

        const page2 = yield* state.list({ limit: 2, offset: 2 })
        // Should get remaining sites (if any)
      })

      await Effect.runPromise(Effect.provide(program, SiteStateInMemory))
    })
  })

  describe('delete', () => {
    it.concurrent('should delete an existing site', async () => {
      const program = Effect.gen(function* () {
        const state = yield* SiteState
        const created = yield* state.create(makeTestParams('delete-test'))

        const deleted = yield* state.delete(created.id)
        expect(deleted).toBe(true)

        const exists = yield* state.exists(created.id)
        expect(exists).toBe(false)
      })

      await Effect.runPromise(Effect.provide(program, SiteStateInMemory))
    })

    it.concurrent('should return false for non-existent site', async () => {
      const program = Effect.gen(function* () {
        const state = yield* SiteState
        const deleted = yield* state.delete('SIT-nonexistent' as any)
        expect(deleted).toBe(false)
      })

      await Effect.runPromise(Effect.provide(program, SiteStateInMemory))
    })
  })

  describe('exists', () => {
    it.concurrent('should return true for existing site', async () => {
      const program = Effect.gen(function* () {
        const state = yield* SiteState
        const created = yield* state.create(makeTestParams('exists-test'))

        const exists = yield* state.exists(created.id)
        expect(exists).toBe(true)
      })

      await Effect.runPromise(Effect.provide(program, SiteStateInMemory))
    })

    it.concurrent('should return false for non-existent site', async () => {
      const program = Effect.gen(function* () {
        const state = yield* SiteState
        const exists = yield* state.exists('SIT-fake-id' as any)
        expect(exists).toBe(false)
      })

      await Effect.runPromise(Effect.provide(program, SiteStateInMemory))
    })
  })

  describe('count', () => {
    it.concurrent('should count sites matching filter', async () => {
      const program = Effect.gen(function* () {
        const state = yield* SiteState
        yield* state.create(makeTestParams('count-1'))
        yield* state.create(makeTestParams('count-2'))

        const count = yield* state.count({})
        expect(count).toBeGreaterThanOrEqual(2)
      })

      await Effect.runPromise(Effect.provide(program, SiteStateInMemory))
    })
  })
})
