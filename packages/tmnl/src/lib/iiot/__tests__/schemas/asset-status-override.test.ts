/**
 * Asset Status Override Tests
 *
 * Verifies that each entity (Enterprise, Site, Area) overrides the generic
 * AssetStatus from BaseAssetFields with its own domain-specific status literal
 * matching the graph states.
 *
 * @module @gbg/tmnl/iiot/__tests__/schemas/asset-status-override
 */

import { describe, it, expect } from 'vitest'
import { Schema, Option, DateTime } from 'effect'
import {
  Enterprise,
  EnterpriseId,
  makeEnterpriseId,
  CreateEnterpriseParams,
  UpdateEnterpriseParams,
} from '../../schemas/assets/enterprise/schema'
import {
  Site,
  SiteId,
  makeSiteId,
  CreateSiteParams,
  UpdateSiteParams,
} from '../../schemas/assets/site/schema'
import {
  Area,
  AreaId,
  makeAreaId,
  CreateAreaParams,
  UpdateAreaParams,
} from '../../schemas/assets/area/schema'
import { HierarchyPath, PathSegment } from '../../schemas/hierarchy'

// =============================================================================
// Test Helpers
// =============================================================================

const makeEnterpriseHierarchyPath = () =>
  HierarchyPath.fromSegments([
    new PathSegment({ level: 'enterprise', id: 'ENT-test', name: Option.none() }),
  ])

const makeSiteHierarchyPath = () =>
  HierarchyPath.fromSegments([
    new PathSegment({ level: 'enterprise', id: 'ENT-test', name: Option.none() }),
    new PathSegment({ level: 'site', id: 'SIT-test', name: Option.none() }),
  ])

const makeAreaHierarchyPath = () =>
  HierarchyPath.fromSegments([
    new PathSegment({ level: 'enterprise', id: 'ENT-test', name: Option.none() }),
    new PathSegment({ level: 'site', id: 'SIT-test', name: Option.none() }),
    new PathSegment({ level: 'area', id: 'ARA-test', name: Option.none() }),
  ])

const baseOptionals = {
  description: Option.none<string>(),
  location: Option.none(),
  updatedAt: Option.none(),
  metadata: {},
  enterpriseId: Option.none(),
  siteId: Option.none(),
  areaId: Option.none(),
  plantId: Option.none(),
  lineId: Option.none(),
  workCellId: Option.none(),
  machineId: Option.none(),
}

// =============================================================================
// Feature: Enterprise accepts graph-specific status values
// =============================================================================

describe('Feature: Enterprise domain-specific status', () => {
  const validStatuses = ['active', 'restructuring', 'merged', 'dissolved'] as const

  describe('Scenario: Enterprise accepts all graph states', () => {
    it.each(validStatuses)(
      'Given status "%s", When creating Enterprise, Then it should succeed',
      (status) => {
        const enterprise = new Enterprise({
          id: 'ENT-test' as EnterpriseId,
          name: 'Test Enterprise',
          status,
          hierarchyPath: makeEnterpriseHierarchyPath(),
          createdAt: DateTime.unsafeNow(),
          ...baseOptionals,
          industry: Option.none(),
          legalName: Option.none(),
          taxId: Option.none(),
          headquarters: Option.none(),
        })
        expect(enterprise.status).toBe(status)
      }
    )
  })

  describe('Scenario: Enterprise rejects non-graph statuses', () => {
    it('Given "inactive" status (not in enterprise graph), When decoding Enterprise, Then it should fail', () => {
      expect(() =>
        Schema.decodeUnknownSync(Enterprise)({
          _tag: 'Enterprise',
          id: 'ENT-test',
          name: 'Test',
          status: 'inactive',
          hierarchyPath: {
            _tag: 'HierarchyPath',
            segments: [{ _tag: 'PathSegment', level: 'enterprise', id: 'ENT-test' }],
            materialized: '/ENT-test',
            depth: 1,
          },
          createdAt: '2025-01-01T00:00:00.000Z',
        })
      ).toThrow()
    })

    it('Given "maintenance" status (not in enterprise graph), When decoding Enterprise, Then it should fail', () => {
      expect(() =>
        Schema.decodeUnknownSync(Enterprise)({
          _tag: 'Enterprise',
          id: 'ENT-test',
          name: 'Test',
          status: 'maintenance',
          hierarchyPath: {
            _tag: 'HierarchyPath',
            segments: [{ _tag: 'PathSegment', level: 'enterprise', id: 'ENT-test' }],
            materialized: '/ENT-test',
            depth: 1,
          },
          createdAt: '2025-01-01T00:00:00.000Z',
        })
      ).toThrow()
    })
  })

  describe('Scenario: Enterprise isOperational with graph states', () => {
    it('Given "active" status, When calling isOperational, Then it should return true', () => {
      const e = new Enterprise({
        id: 'ENT-test' as EnterpriseId,
        name: 'Test',
        status: 'active',
        hierarchyPath: makeEnterpriseHierarchyPath(),
        createdAt: DateTime.unsafeNow(),
        ...baseOptionals,
        industry: Option.none(),
        legalName: Option.none(),
        taxId: Option.none(),
        headquarters: Option.none(),
      })
      expect(e.isOperational()).toBe(true)
    })

    it('Given "restructuring" status, When calling isOperational, Then it should return true', () => {
      const e = new Enterprise({
        id: 'ENT-test' as EnterpriseId,
        name: 'Test',
        status: 'restructuring',
        hierarchyPath: makeEnterpriseHierarchyPath(),
        createdAt: DateTime.unsafeNow(),
        ...baseOptionals,
        industry: Option.none(),
        legalName: Option.none(),
        taxId: Option.none(),
        headquarters: Option.none(),
      })
      expect(e.isOperational()).toBe(true)
    })

    it('Given "merged" status, When calling isOperational, Then it should return false', () => {
      const e = new Enterprise({
        id: 'ENT-test' as EnterpriseId,
        name: 'Test',
        status: 'merged',
        hierarchyPath: makeEnterpriseHierarchyPath(),
        createdAt: DateTime.unsafeNow(),
        ...baseOptionals,
        industry: Option.none(),
        legalName: Option.none(),
        taxId: Option.none(),
        headquarters: Option.none(),
      })
      expect(e.isOperational()).toBe(false)
    })

    it('Given "dissolved" status, When calling isOperational, Then it should return false', () => {
      const e = new Enterprise({
        id: 'ENT-test' as EnterpriseId,
        name: 'Test',
        status: 'dissolved',
        hierarchyPath: makeEnterpriseHierarchyPath(),
        createdAt: DateTime.unsafeNow(),
        ...baseOptionals,
        industry: Option.none(),
        legalName: Option.none(),
        taxId: Option.none(),
        headquarters: Option.none(),
      })
      expect(e.isOperational()).toBe(false)
    })
  })

  describe('Scenario: CreateEnterpriseParams accepts graph statuses', () => {
    it('Given "restructuring" status, When decoding CreateEnterpriseParams, Then it should succeed', () => {
      const params = {
        slug: 'test',
        name: 'Test Enterprise',
        status: 'restructuring',
      }
      const result = Schema.decodeUnknownSync(CreateEnterpriseParams)(params)
      expect(Option.getOrNull(result.status)).toBe('restructuring')
    })
  })

  describe('Scenario: UpdateEnterpriseParams accepts graph statuses', () => {
    it('Given "dissolved" status, When decoding UpdateEnterpriseParams, Then it should succeed', () => {
      const params = {
        id: 'ENT-test',
        status: 'dissolved',
      }
      const result = Schema.decodeUnknownSync(UpdateEnterpriseParams)(params)
      expect(Option.getOrNull(result.status)).toBe('dissolved')
    })
  })
})

// =============================================================================
// Feature: Site accepts graph-specific status values
// =============================================================================

describe('Feature: Site domain-specific status', () => {
  const validStatuses = [
    'planned',
    'under_construction',
    'operational',
    'seasonal_shutdown',
    'closed',
    'decommissioned',
  ] as const

  describe('Scenario: Site accepts all graph states', () => {
    it.each(validStatuses)(
      'Given status "%s", When creating Site, Then it should succeed',
      (status) => {
        const site = new Site({
          id: 'SIT-test' as SiteId,
          name: 'Test Site',
          status,
          enterpriseId: 'ENT-test' as EnterpriseId,
          timezone: 'America/Chicago',
          hierarchyPath: makeSiteHierarchyPath(),
          createdAt: DateTime.unsafeNow(),
          description: Option.none<string>(),
          location: Option.none(),
          updatedAt: Option.none(),
          metadata: {},
          siteId: Option.none(),
          areaId: Option.none(),
          plantId: Option.none(),
          lineId: Option.none(),
          workCellId: Option.none(),
          machineId: Option.none(),
          address: Option.none(),
          city: Option.none(),
          state: Option.none(),
          country: Option.none(),
          postalCode: Option.none(),
        })
        expect(site.status).toBe(status)
      }
    )
  })

  describe('Scenario: Site rejects non-graph statuses', () => {
    it('Given "active" status (not in site graph), When decoding Site, Then it should fail', () => {
      expect(() =>
        Schema.decodeUnknownSync(Site)({
          _tag: 'Site',
          id: 'SIT-test',
          name: 'Test',
          status: 'active',
          enterpriseId: 'ENT-test',
          timezone: 'America/Chicago',
          hierarchyPath: {
            _tag: 'HierarchyPath',
            segments: [
              { _tag: 'PathSegment', level: 'enterprise', id: 'ENT-test' },
              { _tag: 'PathSegment', level: 'site', id: 'SIT-test' },
            ],
            materialized: '/ENT-test/SIT-test',
            depth: 2,
          },
          createdAt: '2025-01-01T00:00:00.000Z',
        })
      ).toThrow()
    })

    it('Given "inactive" status (not in site graph), When decoding Site, Then it should fail', () => {
      expect(() =>
        Schema.decodeUnknownSync(Site)({
          _tag: 'Site',
          id: 'SIT-test',
          name: 'Test',
          status: 'inactive',
          enterpriseId: 'ENT-test',
          timezone: 'America/Chicago',
          hierarchyPath: {
            _tag: 'HierarchyPath',
            segments: [
              { _tag: 'PathSegment', level: 'enterprise', id: 'ENT-test' },
              { _tag: 'PathSegment', level: 'site', id: 'SIT-test' },
            ],
            materialized: '/ENT-test/SIT-test',
            depth: 2,
          },
          createdAt: '2025-01-01T00:00:00.000Z',
        })
      ).toThrow()
    })
  })

  describe('Scenario: Site isOperational with graph states', () => {
    const makeTestSite = (status: string) =>
      new Site({
        id: 'SIT-test' as SiteId,
        name: 'Test',
        status: status as any,
        enterpriseId: 'ENT-test' as EnterpriseId,
        timezone: 'America/Chicago',
        hierarchyPath: makeSiteHierarchyPath(),
        createdAt: DateTime.unsafeNow(),
        description: Option.none<string>(),
        location: Option.none(),
        updatedAt: Option.none(),
        metadata: {},
        siteId: Option.none(),
        areaId: Option.none(),
        plantId: Option.none(),
        lineId: Option.none(),
        workCellId: Option.none(),
        machineId: Option.none(),
        address: Option.none(),
        city: Option.none(),
        state: Option.none(),
        country: Option.none(),
        postalCode: Option.none(),
      })

    it('Given "operational" status, When calling isOperational, Then it should return true', () => {
      expect(makeTestSite('operational').isOperational()).toBe(true)
    })

    it('Given "seasonal_shutdown" status, When calling isOperational, Then it should return true', () => {
      expect(makeTestSite('seasonal_shutdown').isOperational()).toBe(true)
    })

    it('Given "planned" status, When calling isOperational, Then it should return false', () => {
      expect(makeTestSite('planned').isOperational()).toBe(false)
    })

    it('Given "under_construction" status, When calling isOperational, Then it should return false', () => {
      expect(makeTestSite('under_construction').isOperational()).toBe(false)
    })

    it('Given "closed" status, When calling isOperational, Then it should return false', () => {
      expect(makeTestSite('closed').isOperational()).toBe(false)
    })

    it('Given "decommissioned" status, When calling isOperational, Then it should return false', () => {
      expect(makeTestSite('decommissioned').isOperational()).toBe(false)
    })
  })

  describe('Scenario: CreateSiteParams accepts graph statuses', () => {
    it('Given "planned" status, When decoding CreateSiteParams, Then it should succeed', () => {
      const params = {
        slug: 'test',
        name: 'Test Site',
        enterpriseId: 'ENT-test',
        timezone: 'America/Chicago',
        status: 'planned',
      }
      const result = Schema.decodeUnknownSync(CreateSiteParams)(params)
      expect(Option.getOrNull(result.status)).toBe('planned')
    })

    it('Given "under_construction" status, When decoding CreateSiteParams, Then it should succeed', () => {
      const params = {
        slug: 'test',
        name: 'Test Site',
        enterpriseId: 'ENT-test',
        timezone: 'America/Chicago',
        status: 'under_construction',
      }
      const result = Schema.decodeUnknownSync(CreateSiteParams)(params)
      expect(Option.getOrNull(result.status)).toBe('under_construction')
    })
  })

  describe('Scenario: UpdateSiteParams accepts graph statuses', () => {
    it('Given "seasonal_shutdown" status, When decoding UpdateSiteParams, Then it should succeed', () => {
      const params = {
        id: 'SIT-test',
        status: 'seasonal_shutdown',
      }
      const result = Schema.decodeUnknownSync(UpdateSiteParams)(params)
      expect(Option.getOrNull(result.status)).toBe('seasonal_shutdown')
    })
  })
})

// =============================================================================
// Feature: Area accepts graph-specific status values
// =============================================================================

describe('Feature: Area domain-specific status', () => {
  const validStatuses = ['active', 'restricted', 'maintenance', 'inactive', 'decommissioned'] as const

  describe('Scenario: Area accepts all graph states', () => {
    it.each(validStatuses)(
      'Given status "%s", When creating Area, Then it should succeed',
      (status) => {
        const area = new Area({
          id: 'ARA-test' as AreaId,
          name: 'Test Area',
          status,
          enterpriseId: 'ENT-test' as EnterpriseId,
          siteId: 'SIT-test' as SiteId,
          hierarchyPath: makeAreaHierarchyPath(),
          createdAt: DateTime.unsafeNow(),
          description: Option.none<string>(),
          location: Option.none(),
          updatedAt: Option.none(),
          metadata: {},
          areaId: Option.none(),
          plantId: Option.none(),
          lineId: Option.none(),
          workCellId: Option.none(),
          machineId: Option.none(),
          areaType: Option.none(),
          building: Option.none(),
          floor: Option.none(),
          zone: Option.none(),
        })
        expect(area.status).toBe(status)
      }
    )
  })

  describe('Scenario: Area isOperational with graph states', () => {
    const makeTestArea = (status: string) =>
      new Area({
        id: 'ARA-test' as AreaId,
        name: 'Test',
        status: status as any,
        enterpriseId: 'ENT-test' as EnterpriseId,
        siteId: 'SIT-test' as SiteId,
        hierarchyPath: makeAreaHierarchyPath(),
        createdAt: DateTime.unsafeNow(),
        description: Option.none<string>(),
        location: Option.none(),
        updatedAt: Option.none(),
        metadata: {},
        areaId: Option.none(),
        plantId: Option.none(),
        lineId: Option.none(),
        workCellId: Option.none(),
        machineId: Option.none(),
        areaType: Option.none(),
        building: Option.none(),
        floor: Option.none(),
        zone: Option.none(),
      })

    it('Given "active" status, When calling isOperational, Then it should return true', () => {
      expect(makeTestArea('active').isOperational()).toBe(true)
    })

    it('Given "restricted" status, When calling isOperational, Then it should return true', () => {
      expect(makeTestArea('restricted').isOperational()).toBe(true)
    })

    it('Given "maintenance" status, When calling isOperational, Then it should return false', () => {
      expect(makeTestArea('maintenance').isOperational()).toBe(false)
    })

    it('Given "inactive" status, When calling isOperational, Then it should return false', () => {
      expect(makeTestArea('inactive').isOperational()).toBe(false)
    })

    it('Given "decommissioned" status, When calling isOperational, Then it should return false', () => {
      expect(makeTestArea('decommissioned').isOperational()).toBe(false)
    })
  })

  describe('Scenario: CreateAreaParams accepts graph statuses', () => {
    it('Given "restricted" status, When decoding CreateAreaParams, Then it should succeed', () => {
      const params = {
        slug: 'test',
        name: 'Test Area',
        siteId: 'SIT-test',
        status: 'restricted',
      }
      const result = Schema.decodeUnknownSync(CreateAreaParams)(params)
      expect(Option.getOrNull(result.status)).toBe('restricted')
    })
  })

  describe('Scenario: UpdateAreaParams accepts graph statuses', () => {
    it('Given "restricted" status, When decoding UpdateAreaParams, Then it should succeed', () => {
      const params = {
        id: 'ARA-test',
        status: 'restricted',
      }
      const result = Schema.decodeUnknownSync(UpdateAreaParams)(params)
      expect(Option.getOrNull(result.status)).toBe('restricted')
    })
  })
})
