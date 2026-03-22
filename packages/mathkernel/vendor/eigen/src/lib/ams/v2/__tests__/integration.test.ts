/**
 * AMS v2 Full Integration Tests
 *
 * Tests that all modules work together.
 */

import { describe, it, expect } from '@effect/vitest'
import { Effect, Schema, DateTime } from 'effect'
import * as AMS from '../index'

describe('AMS v2 Integration', () => {
  it('exports Core namespace', () => {
    expect(AMS.Core).toBeDefined()
    expect(AMS.Core.AssetId).toBeDefined()
    expect(AMS.Core.Provenance).toBeDefined()
    expect(AMS.Core.BfoContinuantClasses).toBeDefined()
  })

  it('exports Base namespace', () => {
    expect(AMS.Base).toBeDefined()
  })

  it('exports WMS namespace', () => {
    expect(AMS.WMS).toBeDefined()
  })

  it('exports TMS namespace', () => {
    expect(AMS.TMS).toBeDefined()
  })

  describe('Cross-module schema composition', () => {
    it.effect('Asset uses Core identifiers', () =>
      Effect.gen(function* () {
        const now = DateTime.unsafeNow()

        // Create provenance using Core
        const provenance = new AMS.Core.Provenance({
          sourceType: 'manual' as AMS.Core.SourceType,
          timestamp: now as AMS.Core.CreatedAt,
        })
        expect(provenance._tag).toBe('Provenance')

        // Create asset location using Base
        const location = new AMS.Base.AssetLocation({
          siteId: 'site-01' as AMS.Core.SiteId,
          sectorId: 'sector-A' as AMS.Core.SectorId,
        })
        expect(location._tag).toBe('AssetLocation')

        // Create base properties
        const baseProps = new AMS.Base.BaseAssetProperties({
          quantity: 1,
        })
        expect(baseProps._tag).toBe('BaseAssetProperties')

        // Create full asset
        const asset = new AMS.Base.Asset({
          id: 'asset-001' as AMS.Core.AssetId,
          bfoClass: 'material_entity' as AMS.Core.BfoMaterialEntity,
          kind: 'EQUIPMENT' as AMS.Core.AssetKind,
          label: 'Test Asset' as AMS.Core.AssetLabel,
          status: 'available' as AMS.Base.AssetStatus,
          location,
          baseProperties: baseProps,
          properties: [] as unknown as AMS.Base.AssetProperties,
          traits: [] as unknown as AMS.Base.AssetTraits,
          tags: [] as unknown as AMS.Core.Tags,
          createdAt: now as AMS.Core.CreatedAt,
          updatedAt: now as AMS.Core.UpdatedAt,
        })

        expect(asset._tag).toBe('Asset')
        expect(asset.isOperational()).toBe(true)
        expect(asset.siteId).toBe('site-01')
      })
    )

    it.effect('Location hierarchy composes correctly', () =>
      Effect.gen(function* () {
        const now = DateTime.unsafeNow()

        // Site
        const site = new AMS.Base.Site({
          id: 'site-01' as AMS.Core.SiteId,
          bfoClass: 'site' as AMS.Core.BfoSite,
          name: 'Main Warehouse',
          geoFrame: new AMS.Base.GeoFrame({
            crs: 'EPSG:4326',
            origin: new AMS.Base.GeoPoint({ lat: 37.7749, lon: -122.4194 }),
          }),
          createdAt: now as AMS.Core.CreatedAt,
          updatedAt: now as AMS.Core.UpdatedAt,
        })
        expect(site._tag).toBe('Site')

        // Sector within Site
        const sector = new AMS.Base.Sector({
          id: 'sector-A' as AMS.Core.SectorId,
          bfoClass: 'spatial_region' as AMS.Core.BfoSpatialRegion,
          siteId: site.id,
          sectorTypeId: 'zone' as AMS.Core.SectorTypeId,
          name: 'Zone A',
          footprint: new AMS.Base.GeoPolygon({
            vertices: [
              new AMS.Base.GeoPoint({ lat: 37.7749, lon: -122.4194 }),
              new AMS.Base.GeoPoint({ lat: 37.7750, lon: -122.4194 }),
              new AMS.Base.GeoPoint({ lat: 37.7750, lon: -122.4193 }),
            ],
          }),
          createdAt: now as AMS.Core.CreatedAt,
          updatedAt: now as AMS.Core.UpdatedAt,
        })
        expect(sector._tag).toBe('Sector')
        expect(sector.siteId).toBe(site.id)

        // Container within Sector
        const container = new AMS.Base.Container({
          id: 'container-rack-01' as AMS.Core.ContainerId,
          bfoClass: 'object' as AMS.Core.BfoObject,
          siteId: site.id,
          sectorId: sector.id,
          containerTypeId: 'rack' as AMS.Core.ContainerTypeId,
          label: 'Rack 01',
          createdAt: now as AMS.Core.CreatedAt,
          updatedAt: now as AMS.Core.UpdatedAt,
        })
        expect(container._tag).toBe('Container')
        expect(container.isMobile()).toBe(false)
      })
    )

    it.effect('Policy schemas compose with Core identifiers', () =>
      Effect.gen(function* () {
        const now = DateTime.unsafeNow()

        const policy = new AMS.Base.EnrichmentPolicy({
          id: 'policy-01' as AMS.Core.PolicyId,
          mode: 'automated' as AMS.Base.EnrichmentMode,
          allowedAgentIds: ['agent-001', 'agent-002'] as AMS.Core.IdentityId[],
          maxSpendPerHour: 100,
          strategy: 'risk_based' as AMS.Base.EnrichmentStrategy,
          createdAt: now as AMS.Core.CreatedAt,
          updatedAt: now as AMS.Core.UpdatedAt,
        })

        expect(policy._tag).toBe('EnrichmentPolicy')
        expect(policy.mode).toBe('automated')
        expect(policy.allowedAgentIds).toHaveLength(2)

        const budget = new AMS.Base.BudgetPool({
          id: 'budget-01' as AMS.Core.PolicyId,
          scope: 'site' as AMS.Base.BudgetScope,
          siteId: 'site-01' as AMS.Core.SiteId,
          budgetAmount: 1000,
          currency: 'USD',
          windowHours: 24,
          createdAt: now as AMS.Core.CreatedAt,
          updatedAt: now as AMS.Core.UpdatedAt,
        })

        expect(budget._tag).toBe('BudgetPool')
        expect(budget.hourlyRate()).toBeCloseTo(41.67, 1)
      })
    )
  })
})
