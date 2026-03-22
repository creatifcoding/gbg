/**
 * Area Entity Schema - BDD Tests
 *
 * Feature: ISA-95 Level 2 Area Entity
 *   As an IIoT system developer
 *   I want an Area schema representing ISA-95 Level 2 (Supervisory Control)
 *   So that I can model production areas within a site
 */

import { describe, it, expect } from 'vitest'
import { Schema, Option, DateTime } from 'effect'
import {
  AreaId,
  makeAreaId,
  Area,
  CreateAreaParams,
  UpdateAreaParams,
} from '../../schemas/assets/area'
import { makeSiteId } from '../../schemas/assets/site'
import { makeEnterpriseId } from '../../schemas/assets/enterprise'
import { HierarchyPath, PathSegment } from '../../schemas/hierarchy'
import { EnterpriseId } from '../../schemas/identifiers'
import { SiteId } from '../../schemas/assets/site'

// =============================================================================
// Test Helpers
// =============================================================================

/** Create a valid HierarchyPath for Area tests */
const makeTestHierarchyPath = (areaSlug: string) =>
  HierarchyPath.fromSegments([
    new PathSegment({ level: 'enterprise', id: 'ENT-test-enterprise', name: Option.none() }),
    new PathSegment({ level: 'site', id: 'SIT-chicago-facility', name: Option.none() }),
    new PathSegment({ level: 'area', id: `ARA-${areaSlug}`, name: Option.none() }),
  ])

/** Base data for Area constructor tests */
const makeBaseAreaData = (overrides: Partial<{
  id: string
  name: string
  status: 'active' | 'inactive' | 'maintenance' | 'decommissioned'
  areaSlug: string
}> = {}) => {
  const slug = overrides.areaSlug ?? 'production-1'
  return {
    id: (overrides.id ?? `ARA-${slug}`) as ReturnType<typeof makeAreaId>,
    name: overrides.name ?? 'Production Area 1',
    status: overrides.status ?? ('active' as const),
    enterpriseId: 'ENT-test-enterprise' as EnterpriseId,
    siteId: 'SIT-chicago-facility' as SiteId,
    hierarchyPath: makeTestHierarchyPath(slug),
    createdAt: DateTime.unsafeNow(),
    // Optional fields
    description: Option.none<string>(),
    location: Option.none(),
    updatedAt: Option.none(),
    metadata: {},
    // Optional parent IDs (Area is at level 2, so these are None)
    areaId: Option.none(),
    plantId: Option.none(),
    lineId: Option.none(),
    workCellId: Option.none(),
    machineId: Option.none(),
    // Area-specific optional fields
    areaType: Option.none(),
    building: Option.none(),
    floor: Option.none(),
    zone: Option.none(),
  }
}

// =============================================================================
// Feature: Area Identifier
// =============================================================================

describe('Feature: Area Identifier', () => {
  describe('Scenario: Valid AreaId pattern', () => {
    it('Given a valid ARA- prefixed string, When decoding, Then it should succeed', () => {
      const result = Schema.decodeUnknownSync(AreaId)('ARA-production-1')
      expect(result).toBe('ARA-production-1')
    })

    it('Given makeAreaId with a slug, When called, Then it should return prefixed AreaId', () => {
      const id = makeAreaId('warehouse-east')
      expect(id).toBe('ARA-warehouse-east')
    })

    it('Given multiple valid slugs, When using makeAreaId, Then all should be properly prefixed', () => {
      expect(makeAreaId('maintenance')).toBe('ARA-maintenance')
      expect(makeAreaId('quality-lab-1')).toBe('ARA-quality-lab-1')
      expect(makeAreaId('shipping-dock')).toBe('ARA-shipping-dock')
    })
  })

  describe('Scenario: Invalid AreaId pattern', () => {
    it('Given string without ARA- prefix, When decoding, Then it should fail', () => {
      expect(() => Schema.decodeUnknownSync(AreaId)('production-1')).toThrow()
    })

    it('Given string with wrong prefix, When decoding, Then it should fail', () => {
      expect(() => Schema.decodeUnknownSync(AreaId)('AREA-production-1')).toThrow()
      expect(() => Schema.decodeUnknownSync(AreaId)('PLT-production-1')).toThrow()
    })

    it('Given non-string value, When decoding, Then it should fail', () => {
      expect(() => Schema.decodeUnknownSync(AreaId)(123)).toThrow()
      expect(() => Schema.decodeUnknownSync(AreaId)(null)).toThrow()
    })
  })
})

// =============================================================================
// Feature: Area Entity
// =============================================================================

describe('Feature: Area Entity', () => {
  describe('Scenario: Valid Area creation', () => {
    it('Given valid area data, When creating Area instance, Then it should succeed', () => {
      const areaData = {
        ...makeBaseAreaData(),
        areaType: Option.some('production' as const),
        building: Option.some('Building A'),
        floor: Option.some('Ground'),
        zone: Option.some('Zone 1'),
        description: Option.some('Main production area for widget assembly'),
      }
      const area = new Area(areaData)

      expect(area._tag).toBe('Area')
      expect(area.id).toBe('ARA-production-1')
      expect(area.name).toBe('Production Area 1')
      expect(area.status).toBe('active')
      expect(area.siteId).toBe('SIT-chicago-facility')
    })

    it('Given minimal required fields, When creating Area, Then optional fields should be Option.none or default', () => {
      const minimalArea = new Area(makeBaseAreaData({ areaSlug: 'minimal', name: 'Minimal Area' }))

      expect(minimalArea.id).toBe('ARA-minimal')
      expect(Option.isNone(minimalArea.areaType)).toBe(true)
      expect(Option.isNone(minimalArea.building)).toBe(true)
    })
  })

  describe('Scenario: Area type validation', () => {
    const areaTypes = ['production', 'warehouse', 'maintenance', 'quality', 'shipping', 'receiving'] as const

    it.each(areaTypes)('Given areaType "%s", When creating Area, Then it should succeed', (areaType) => {
      const area = new Area({
        ...makeBaseAreaData(),
        areaType: Option.some(areaType),
      })
      expect(Option.getOrNull(area.areaType)).toBe(areaType)
    })
  })

  describe('Scenario: Area status validation', () => {
    const statuses = ['active', 'inactive', 'maintenance', 'decommissioned'] as const

    it.each(statuses)('Given status "%s", When creating Area, Then it should succeed', (status) => {
      const area = new Area(makeBaseAreaData({ status }))
      expect(area.status).toBe(status)
    })
  })
})

// =============================================================================
// Feature: Area Methods
// =============================================================================

describe('Feature: Area Methods', () => {
  const createArea = (status: 'active' | 'inactive' | 'maintenance' | 'decommissioned') =>
    new Area(makeBaseAreaData({ status, areaSlug: 'test', name: 'Test Area' }))

  describe('Scenario: getAutomationLevel returns ISA-95 Level 2', () => {
    it('Given an Area, When calling getAutomationLevel, Then it should return 2', () => {
      const area = createArea('active')
      expect(area.getAutomationLevel()).toBe(2)
    })
  })

  describe('Scenario: isOperational checks status', () => {
    it('Given active status, When calling isOperational, Then it should return true', () => {
      expect(createArea('active').isOperational()).toBe(true)
    })

    it('Given inactive status, When calling isOperational, Then it should return false', () => {
      expect(createArea('inactive').isOperational()).toBe(false)
    })

    it('Given maintenance status, When calling isOperational, Then it should return false', () => {
      expect(createArea('maintenance').isOperational()).toBe(false)
    })

    it('Given decommissioned status, When calling isOperational, Then it should return false', () => {
      expect(createArea('decommissioned').isOperational()).toBe(false)
    })
  })

  describe('Scenario: isContainer returns true', () => {
    it('Given an Area, When calling isContainer, Then it should return true', () => {
      const area = createArea('active')
      expect(area.isContainer()).toBe(true)
    })
  })
})

// =============================================================================
// Feature: CreateAreaParams Schema
// =============================================================================

describe('Feature: CreateAreaParams Schema', () => {
  describe('Scenario: Valid create params', () => {
    it('Given valid params with all fields, When decoding, Then it should succeed', () => {
      const params = {
        slug: 'production-1',
        name: 'Production Area 1',
        siteId: 'SIT-chicago-facility',
        areaType: 'production',
        building: 'Building A',
        floor: 'Ground',
        zone: 'Zone 1',
        description: 'Main production area',
      }

      const result = Schema.decodeUnknownSync(CreateAreaParams)(params)
      expect(result.slug).toBe('production-1')
      expect(result.name).toBe('Production Area 1')
      expect(result.siteId).toBe('SIT-chicago-facility')
    })

    it('Given minimal required params, When decoding, Then it should succeed', () => {
      const params = {
        slug: 'minimal',
        name: 'Minimal Area',
        siteId: 'SIT-test',
      }

      const result = Schema.decodeUnknownSync(CreateAreaParams)(params)
      expect(result.slug).toBe('minimal')
    })
  })

  describe('Scenario: Invalid create params', () => {
    it('Given missing required fields, When decoding, Then it should fail', () => {
      expect(() =>
        Schema.decodeUnknownSync(CreateAreaParams)({
          slug: 'test',
          // missing name and siteId
        })
      ).toThrow()
    })

    it('Given invalid slug pattern, When decoding, Then it should fail', () => {
      expect(() =>
        Schema.decodeUnknownSync(CreateAreaParams)({
          slug: 'invalid slug with spaces',
          name: 'Test',
          siteId: 'SIT-test',
        })
      ).toThrow()
    })
  })
})

// =============================================================================
// Feature: UpdateAreaParams Schema
// =============================================================================

describe('Feature: UpdateAreaParams Schema', () => {
  describe('Scenario: Valid update params', () => {
    it('Given valid id and update fields, When decoding, Then it should succeed', () => {
      const params = {
        id: 'ARA-production-1',
        name: 'Updated Production Area',
        status: 'maintenance',
      }

      const result = Schema.decodeUnknownSync(UpdateAreaParams)(params)
      expect(result.id).toBe('ARA-production-1')
      expect(Option.getOrNull(result.name)).toBe('Updated Production Area')
    })

    it('Given only id (no updates), When decoding, Then it should succeed', () => {
      const params = { id: 'ARA-test' }

      const result = Schema.decodeUnknownSync(UpdateAreaParams)(params)
      expect(result.id).toBe('ARA-test')
    })
  })

  describe('Scenario: Invalid update params', () => {
    it('Given invalid AreaId, When decoding, Then it should fail', () => {
      expect(() =>
        Schema.decodeUnknownSync(UpdateAreaParams)({
          id: 'invalid-id',
          name: 'Test',
        })
      ).toThrow()
    })
  })
})
