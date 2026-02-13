/**
 * Site Entity Schema Tests
 *
 * ISA-95 Level 3 (MES/MOM scope - geographic).
 * Site is a physical location containing one or more plants.
 *
 * @module @gbg/tmnl/iiot/schemas/assets/site
 */

import { describe, it, expect } from 'vitest'
import { Schema, Option, DateTime } from 'effect'
import {
  Site,
  SiteId,
  makeSiteId,
  CreateSiteParams,
  UpdateSiteParams,
} from '../../schemas/assets/site/schema'
import { EnterpriseId, makeEnterpriseId } from '../../schemas/assets/enterprise/schema'

// =============================================================================
// Feature: Site Identifier
// =============================================================================

describe('Feature: SiteId Branded Identifier', () => {
  describe('Scenario: Valid SiteId encoding', () => {
    it('Given a valid SIT-prefixed string, When decoding as SiteId, Then it should succeed', () => {
      const result = Schema.decodeUnknownSync(SiteId)('SIT-chicago-main')
      expect(result).toBe('SIT-chicago-main')
    })

    it('Given a SIT- prefix with alphanumeric slug, When decoding, Then it should succeed', () => {
      const validIds = ['SIT-abc', 'SIT-site-123', 'SIT-A1-B2-C3']
      validIds.forEach((id) => {
        expect(Schema.decodeUnknownSync(SiteId)(id)).toBe(id)
      })
    })
  })

  describe('Scenario: Invalid SiteId encoding', () => {
    it('Given a string without SIT- prefix, When decoding as SiteId, Then it should fail', () => {
      expect(() => Schema.decodeUnknownSync(SiteId)('chicago-main')).toThrow()
    })

    it('Given a wrong prefix, When decoding as SiteId, Then it should fail', () => {
      expect(() => Schema.decodeUnknownSync(SiteId)('PLT-chicago')).toThrow()
      expect(() => Schema.decodeUnknownSync(SiteId)('ENT-corp')).toThrow()
    })

    it('Given a non-string, When decoding as SiteId, Then it should fail', () => {
      expect(() => Schema.decodeUnknownSync(SiteId)(123)).toThrow()
      expect(() => Schema.decodeUnknownSync(SiteId)(null)).toThrow()
    })
  })

  describe('Scenario: makeSiteId factory', () => {
    it('Given a slug, When calling makeSiteId, Then it should return SIT-prefixed id', () => {
      const id = makeSiteId('chicago-main')
      expect(id).toBe('SIT-chicago-main')
    })

    it('Given various slugs, When calling makeSiteId, Then all should be valid SiteIds', () => {
      const slugs = ['site-1', 'north-america', 'emea-hq']
      slugs.forEach((slug) => {
        const id = makeSiteId(slug)
        expect(() => Schema.decodeUnknownSync(SiteId)(id)).not.toThrow()
      })
    })
  })
})

// =============================================================================
// Feature: Site Entity
// =============================================================================

describe('Feature: Site Entity Schema', () => {
  const validSiteData = {
    _tag: 'Site' as const,
    id: 'SIT-chicago-main',
    name: 'Chicago Main Site',
    status: 'operational' as const,
    enterpriseId: 'ENT-acme-corp',
    timezone: 'America/Chicago',
    createdAt: '2025-01-01T00:00:00.000Z',
    hierarchyPath: {
      _tag: 'HierarchyPath' as const,
      segments: [
        { _tag: 'PathSegment' as const, level: 'enterprise' as const, id: 'ENT-acme-corp' },
        { _tag: 'PathSegment' as const, level: 'site' as const, id: 'SIT-chicago-main' },
      ],
      materialized: '/ENT-acme-corp/SIT-chicago-main',
      depth: 2,
    },
  }

  describe('Scenario: Valid Site decoding', () => {
    it('Given minimal valid site data, When decoding, Then it should produce a Site', () => {
      const result = Schema.decodeUnknownSync(Site)(validSiteData)
      expect(result._tag).toBe('Site')
      expect(result.id).toBe('SIT-chicago-main')
      expect(result.name).toBe('Chicago Main Site')
      expect(result.status).toBe('operational')
      expect(result.enterpriseId).toBe('ENT-acme-corp')
      expect(result.timezone).toBe('America/Chicago')
    })

    it('Given site data with full address, When decoding, Then all address fields should decode', () => {
      // Encoded form uses raw values, decode transforms to Option
      const fullData = {
        ...validSiteData,
        address: '123 Industrial Pkwy',
        city: 'Chicago',
        state: 'IL',
        country: 'USA',
        postalCode: '60601',
      }
      const result = Schema.decodeUnknownSync(Site)(fullData)
      expect(Option.isSome(result.address)).toBe(true)
      expect(Option.isSome(result.city)).toBe(true)
      expect(Option.isSome(result.state)).toBe(true)
      expect(Option.isSome(result.country)).toBe(true)
      expect(Option.isSome(result.postalCode)).toBe(true)
    })

    it('Given site data with location (GPS), When decoding, Then location should be present', () => {
      // Encoded form uses raw values for AssetLocation
      const dataWithLocation = {
        ...validSiteData,
        location: {
          _tag: 'AssetLocation' as const,
          latitude: 41.8781,
          longitude: -87.6298,
        },
      }
      const result = Schema.decodeUnknownSync(Site)(dataWithLocation)
      expect(Option.isSome(result.location)).toBe(true)
    })
  })

  describe('Scenario: Invalid Site decoding', () => {
    it('Given data without required enterpriseId, When decoding, Then it should fail', () => {
      const invalidData = { ...validSiteData }
      delete (invalidData as any).enterpriseId
      expect(() => Schema.decodeUnknownSync(Site)(invalidData)).toThrow()
    })

    it('Given data without required timezone, When decoding, Then it should fail', () => {
      const invalidData = { ...validSiteData }
      delete (invalidData as any).timezone
      expect(() => Schema.decodeUnknownSync(Site)(invalidData)).toThrow()
    })

    it('Given empty name, When decoding, Then it should fail', () => {
      const invalidData = { ...validSiteData, name: '' }
      expect(() => Schema.decodeUnknownSync(Site)(invalidData)).toThrow()
    })

    it('Given invalid status, When decoding, Then it should fail', () => {
      const invalidData = { ...validSiteData, status: 'invalid' }
      expect(() => Schema.decodeUnknownSync(Site)(invalidData)).toThrow()
    })
  })

  describe('Scenario: Site methods', () => {
    it('Given a Site, When calling getAutomationLevel, Then it should return 3', () => {
      const site = Schema.decodeUnknownSync(Site)(validSiteData)
      expect(site.getAutomationLevel()).toBe(3)
    })

    it('Given an operational Site, When calling isOperational, Then it should return true', () => {
      const site = Schema.decodeUnknownSync(Site)(validSiteData)
      expect(site.isOperational()).toBe(true)
    })

    it('Given a seasonal_shutdown Site, When calling isOperational, Then it should return true', () => {
      const site = Schema.decodeUnknownSync(Site)({ ...validSiteData, status: 'seasonal_shutdown' })
      expect(site.isOperational()).toBe(true)
    })

    it('Given a planned Site, When calling isOperational, Then it should return false', () => {
      const site = Schema.decodeUnknownSync(Site)({ ...validSiteData, status: 'planned' })
      expect(site.isOperational()).toBe(false)
    })

    it('Given a decommissioned Site, When calling isOperational, Then it should return false', () => {
      const site = Schema.decodeUnknownSync(Site)({ ...validSiteData, status: 'decommissioned' })
      expect(site.isOperational()).toBe(false)
    })

    it('Given a Site, When calling isContainer, Then it should return true', () => {
      const site = Schema.decodeUnknownSync(Site)(validSiteData)
      expect(site.isContainer()).toBe(true)
    })
  })
})

// =============================================================================
// Feature: Create Site Parameters
// =============================================================================

describe('Feature: CreateSiteParams Schema', () => {
  describe('Scenario: Valid create params', () => {
    it('Given valid params with slug, When decoding, Then it should succeed', () => {
      const params = {
        slug: 'chicago-main',
        name: 'Chicago Main Site',
        enterpriseId: 'ENT-acme-corp',
        timezone: 'America/Chicago',
      }
      const result = Schema.decodeUnknownSync(CreateSiteParams)(params)
      expect(result.slug).toBe('chicago-main')
      expect(result.name).toBe('Chicago Main Site')
    })

    it('Given params with optional address fields, When decoding, Then all should be present', () => {
      const params = {
        slug: 'chicago-main',
        name: 'Chicago Main Site',
        enterpriseId: 'ENT-acme-corp',
        timezone: 'America/Chicago',
        address: '123 Industrial Pkwy',
        city: 'Chicago',
        state: 'IL',
        country: 'USA',
        postalCode: '60601',
      }
      const result = Schema.decodeUnknownSync(CreateSiteParams)(params)
      expect(result.address).toBe('123 Industrial Pkwy')
      expect(result.city).toBe('Chicago')
    })
  })

  describe('Scenario: Invalid create params', () => {
    it('Given invalid slug format, When decoding, Then it should fail', () => {
      const params = {
        slug: 'invalid slug!',
        name: 'Test Site',
        enterpriseId: 'ENT-acme-corp',
        timezone: 'America/Chicago',
      }
      expect(() => Schema.decodeUnknownSync(CreateSiteParams)(params)).toThrow()
    })
  })
})

// =============================================================================
// Feature: Update Site Parameters
// =============================================================================

describe('Feature: UpdateSiteParams Schema', () => {
  describe('Scenario: Valid update params', () => {
    it('Given only id and name, When decoding, Then it should succeed', () => {
      // Encoded form uses raw values, decode transforms to Option
      const params = {
        id: 'SIT-chicago-main',
        name: 'Updated Site Name',
      }
      const result = Schema.decodeUnknownSync(UpdateSiteParams)(params)
      expect(result.id).toBe('SIT-chicago-main')
      expect(Option.isSome(result.name)).toBe(true)
    })

    it('Given partial update, When decoding, Then only provided fields should be some', () => {
      // Encoded form uses raw values
      const params = {
        id: 'SIT-chicago-main',
        status: 'closed' as const,
      }
      const result = Schema.decodeUnknownSync(UpdateSiteParams)(params)
      expect(Option.isSome(result.status)).toBe(true)
      expect(Option.isNone(result.name ?? Option.none())).toBe(true)
    })
  })
})
