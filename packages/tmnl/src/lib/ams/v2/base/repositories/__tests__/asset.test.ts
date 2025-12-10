/**
 * Asset SQL Model Unit Tests
 *
 * Tests the Model.Class variants and schemas.
 * Note: Repository operations require a database connection.
 */

import { describe, it, expect } from '@effect/vitest'
import { Effect, Schema, Option } from 'effect'
import {
  AssetModel,
  SiteModel,
  SectorModel,
  ContainerModel,
  AssetPropertyModel,
  AssetTraitModel,
  EventJournalModel,
} from '../asset'
import { AssetId, SiteId, SectorId, ContainerId } from '../../../core/schemas/identifiers'
import { AssetStatus } from '../../schemas/asset'

describe('Asset SQL Models', () => {
  describe('AssetModel', () => {
    it('has insert variant without generated fields', () => {
      // insert variant should not require 'id' (Model.Generated)
      const insertFields = AssetModel.insert.fields
      expect(insertFields).toBeDefined()

      // Check that required fields are present
      expect(insertFields.kind).toBeDefined()
      expect(insertFields.label).toBeDefined()
      expect(insertFields.status).toBeDefined()
      expect(insertFields.siteId).toBeDefined()
      expect(insertFields.bfoClass).toBeDefined()
      expect(insertFields.version).toBeDefined()
    })

    it('has update variant with id for WHERE clause', () => {
      const updateFields = AssetModel.update.fields
      expect(updateFields).toBeDefined()

      // Update should include id
      expect(updateFields.id).toBeDefined()
    })

    it('has json variant for API', () => {
      expect(AssetModel.json).toBeDefined()
    })

    it.effect('insert make creates valid payload', () =>
      Effect.gen(function* () {
        const payload = AssetModel.insert.make({
          bfoClass: 'material_entity',
          kind: 'EQUIPMENT' as never,
          label: 'Test Asset' as never,
          description: Option.none(),
          status: 'available' as AssetStatus,
          siteId: 'site-01' as SiteId,
          sectorId: Option.none(),
          containerId: Option.none(),
          basePropertiesJson: Option.none(),
          tagsJson: Option.none(),
          version: 1,
        })

        expect(payload.kind).toBe('EQUIPMENT')
        expect(payload.label).toBe('Test Asset')
        expect(payload.status).toBe('available')
        expect(payload.siteId).toBe('site-01')
        expect(payload.version).toBe(1)
        // id should not be present in insert payload
        expect((payload as Record<string, unknown>).id).toBeUndefined()
      })
    )

    it.effect('insert make accepts all fields', () =>
      Effect.gen(function* () {
        const payload = AssetModel.insert.make({
          bfoClass: 'material_entity',
          kind: 'HAND_TOOL' as never,
          label: 'Hammer' as never,
          description: Option.some('A claw hammer' as never),
          status: 'available' as AssetStatus,
          siteId: 'site-01' as SiteId,
          sectorId: Option.some('sector-A' as SectorId),
          containerId: Option.some('container-01' as ContainerId),
          basePropertiesJson: Option.some({ quantity: 1 }),
          version: 1,
          tagsJson: Option.some(['hand-tool', 'steel'] as never),
        })

        expect(Option.getOrNull(payload.sectorId)).toBe('sector-A')
        expect(Option.getOrNull(payload.containerId)).toBe('container-01')
        expect(Option.getOrNull(payload.tagsJson)).toEqual(['hand-tool', 'steel'])
      })
    )
  })

  describe('SiteModel', () => {
    it('has insert variant', () => {
      expect(SiteModel.insert).toBeDefined()
    })

    it.effect('insert make creates valid payload', () =>
      Effect.gen(function* () {
        const payload = SiteModel.insert.make({
          bfoClass: 'site',
          name: 'Main Warehouse',
          geoFrameJson: Option.none(),
        })

        expect(payload.name).toBe('Main Warehouse')
        expect(payload.bfoClass).toBe('site')
      })
    )
  })

  describe('SectorModel', () => {
    it('has insert variant', () => {
      expect(SectorModel.insert).toBeDefined()
    })

    it.effect('insert make creates valid payload', () =>
      Effect.gen(function* () {
        const payload = SectorModel.insert.make({
          bfoClass: 'spatial_region',
          siteId: 'site-01' as SiteId,
          sectorTypeId: 'zone',
          name: 'Zone A',
          footprintJson: Option.none(),
        })

        expect(payload.name).toBe('Zone A')
        expect(payload.siteId).toBe('site-01')
        expect(payload.sectorTypeId).toBe('zone')
      })
    )
  })

  describe('ContainerModel', () => {
    it('has insert variant', () => {
      expect(ContainerModel.insert).toBeDefined()
    })

    it.effect('insert make creates valid payload', () =>
      Effect.gen(function* () {
        const payload = ContainerModel.insert.make({
          bfoClass: 'object',
          siteId: 'site-01' as SiteId,
          sectorId: Option.none(),
          containerTypeId: 'rack',
          label: 'Rack 01',
          parentContainerId: Option.none(),
          isMobile: false,
        })

        expect(payload.label).toBe('Rack 01')
        expect(payload.isMobile).toBe(false)
      })
    )

    it.effect('insert accepts parent container', () =>
      Effect.gen(function* () {
        const payload = ContainerModel.insert.make({
          bfoClass: 'object',
          siteId: 'site-01' as SiteId,
          sectorId: Option.none(),
          containerTypeId: 'shelf',
          label: 'Shelf A1',
          parentContainerId: Option.some('container-rack-01' as ContainerId),
          isMobile: false,
        })

        expect(Option.getOrNull(payload.parentContainerId)).toBe('container-rack-01')
      })
    )
  })

  describe('AssetPropertyModel', () => {
    it('has insert variant', () => {
      expect(AssetPropertyModel.insert).toBeDefined()
    })

    it.effect('insert make creates valid payload', () =>
      Effect.gen(function* () {
        const payload = AssetPropertyModel.insert.make({
          assetId: 'asset-001' as AssetId,
          key: 'serialNumber',
          value: 'SN-12345',
          provenanceJson: {
            sourceType: 'manual',
            timestamp: new Date().toISOString(),
          },
        })

        expect(payload.assetId).toBe('asset-001')
        expect(payload.key).toBe('serialNumber')
        expect(payload.value).toBe('SN-12345')
        expect(payload.provenanceJson).toBeDefined()
      })
    )
  })

  describe('AssetTraitModel', () => {
    it('has insert variant', () => {
      expect(AssetTraitModel.insert).toBeDefined()
    })

    it.effect('insert make creates valid payload', () =>
      Effect.gen(function* () {
        const payload = AssetTraitModel.insert.make({
          assetId: 'asset-001' as AssetId,
          traitId: 'inspectable',
          configJson: Option.none(),
        })

        expect(payload.assetId).toBe('asset-001')
        expect(payload.traitId).toBe('inspectable')
      })
    )

    it.effect('insert accepts config', () =>
      Effect.gen(function* () {
        const payload = AssetTraitModel.insert.make({
          assetId: 'asset-001' as AssetId,
          traitId: 'temperature-sensitive',
          configJson: Option.some({ minTemp: -20, maxTemp: 40, unit: 'celsius' }),
        })

        expect(Option.getOrNull(payload.configJson)).toEqual({ minTemp: -20, maxTemp: 40, unit: 'celsius' })
      })
    )
  })

  describe('EventJournalModel', () => {
    it('has insert variant', () => {
      expect(EventJournalModel.insert).toBeDefined()
    })

    it.effect('insert make creates valid payload', () =>
      Effect.gen(function* () {
        const payload = EventJournalModel.insert.make({
          eventTag: 'AssetCreated',
          primaryKey: 'asset-001',
          payloadJson: {
            assetId: 'asset-001',
            kind: 'EQUIPMENT',
            label: 'Test',
          },
          triggeredBy: 'user-123',
          aggregateVersion: 1,
        })

        expect(payload.eventTag).toBe('AssetCreated')
        expect(payload.primaryKey).toBe('asset-001')
        expect(payload.payloadJson).toBeDefined()
        expect(payload.triggeredBy).toBe('user-123')
        expect(payload.aggregateVersion).toBe(1)
      })
    )
  })

  describe('Model Variants', () => {
    it('all models have standard variants', () => {
      const models = [
        AssetModel,
        SiteModel,
        SectorModel,
        ContainerModel,
        AssetPropertyModel,
        AssetTraitModel,
        EventJournalModel,
      ]

      for (const model of models) {
        expect(model.insert).toBeDefined()
        expect(model.update).toBeDefined()
        expect(model.json).toBeDefined()
        expect(model.fields).toBeDefined()
      }
    })
  })
})
