/**
 * Asset Command Unit Tests
 */

import { describe, it, expect } from '@effect/vitest'
import { Effect, Schema, DateTime } from 'effect'
import {
  CreateAsset,
  UpdateAsset,
  MoveAsset,
  SetAssetProperty,
  RemoveAssetProperty,
  AddAssetTrait,
  RemoveAssetTrait,
  DeleteAsset,
  AssetCommand,
  AssetNotFoundError,
  AssetValidationError,
  AssetConflictError,
  AssetPermissionError,
  AssetCommandError,
} from '../asset'
import {
  AssetId,
  AssetKind,
  AssetLabel,
  SiteId,
  SectorId,
  PropertyKey,
  TraitId,
  IdentityId,
} from '../../../core/schemas/identifiers'
import { Provenance, SourceType, CreatedAt } from '../../../core/schemas/provenance'
import { PropertyValue } from '../../schemas/property'

describe('Asset Commands', () => {
  const now = DateTime.unsafeNow()
  const testIdentity = 'user-123' as IdentityId

  describe('CreateAsset', () => {
    it('creates command with _tag', () => {
      const cmd = new CreateAsset({
        siteId: 'site-01' as SiteId,
        kind: 'EQUIPMENT' as AssetKind,
        label: 'Test Equipment' as AssetLabel,
        createdBy: testIdentity,
      })

      expect(cmd._tag).toBe('CreateAsset')
      expect(cmd.siteId).toBe('site-01')
      expect(cmd.kind).toBe('EQUIPMENT')
      expect(cmd.label).toBe('Test Equipment')
    })

    it('accepts optional fields', () => {
      const cmd = new CreateAsset({
        siteId: 'site-01' as SiteId,
        sectorId: 'sector-A' as SectorId,
        kind: 'HAND_TOOL' as AssetKind,
        label: 'Hammer' as AssetLabel,
        description: 'A claw hammer' as never, // AssetDescription not defined in test imports
        createdBy: testIdentity,
      })

      expect(cmd.sectorId).toBe('sector-A')
    })

    it.effect('encodes and decodes CreateAsset', () =>
      Effect.gen(function* () {
        const cmd = new CreateAsset({
          siteId: 'site-01' as SiteId,
          kind: 'EQUIPMENT' as AssetKind,
          label: 'Test' as AssetLabel,
          createdBy: testIdentity,
        })

        const encoded = yield* Schema.encode(CreateAsset)(cmd)
        expect(encoded).toBeDefined()

        const decoded = yield* Schema.decode(CreateAsset)(encoded)
        expect(decoded._tag).toBe('CreateAsset')
        expect(decoded.siteId).toBe('site-01')
      })
    )
  })

  describe('UpdateAsset', () => {
    it('creates command with _tag', () => {
      const cmd = new UpdateAsset({
        assetId: 'asset-001' as AssetId,
        label: 'Updated Label' as AssetLabel,
        updatedBy: testIdentity,
      })

      expect(cmd._tag).toBe('UpdateAsset')
      expect(cmd.assetId).toBe('asset-001')
      expect(cmd.label).toBe('Updated Label')
    })

    it('supports optimistic concurrency', () => {
      const cmd = new UpdateAsset({
        assetId: 'asset-001' as AssetId,
        updatedBy: testIdentity,
        expectedVersion: 5,
      })

      expect(cmd.expectedVersion).toBe(5)
    })
  })

  describe('MoveAsset', () => {
    it('creates command with _tag', () => {
      const cmd = new MoveAsset({
        assetId: 'asset-001' as AssetId,
        toSiteId: 'site-02' as SiteId,
        movedBy: testIdentity,
      })

      expect(cmd._tag).toBe('MoveAsset')
      expect(cmd.toSiteId).toBe('site-02')
    })

    it('accepts optional location details', () => {
      const cmd = new MoveAsset({
        assetId: 'asset-001' as AssetId,
        toSiteId: 'site-02' as SiteId,
        toSectorId: 'sector-B' as SectorId,
        movedBy: testIdentity,
        reason: 'Relocation for inventory',
      })

      expect(cmd.toSectorId).toBe('sector-B')
      expect(cmd.reason).toBe('Relocation for inventory')
    })
  })

  describe('SetAssetProperty', () => {
    it('creates command with provenance', () => {
      const provenance = new Provenance({
        sourceType: 'manual' as SourceType,
        timestamp: now as CreatedAt,
      })

      const cmd = new SetAssetProperty({
        assetId: 'asset-001' as AssetId,
        key: 'serialNumber' as PropertyKey,
        value: 'SN-12345' as PropertyValue,
        provenance,
        changedBy: testIdentity,
      })

      expect(cmd._tag).toBe('SetAssetProperty')
      expect(cmd.key).toBe('serialNumber')
      expect(cmd.value).toBe('SN-12345')
      expect(cmd.provenance._tag).toBe('Provenance')
    })
  })

  describe('RemoveAssetProperty', () => {
    it('creates command with _tag', () => {
      const cmd = new RemoveAssetProperty({
        assetId: 'asset-001' as AssetId,
        key: 'serialNumber' as PropertyKey,
        removedBy: testIdentity,
        reason: 'Data correction',
      })

      expect(cmd._tag).toBe('RemoveAssetProperty')
      expect(cmd.key).toBe('serialNumber')
      expect(cmd.reason).toBe('Data correction')
    })
  })

  describe('AddAssetTrait', () => {
    it('creates command with _tag', () => {
      const cmd = new AddAssetTrait({
        assetId: 'asset-001' as AssetId,
        traitId: 'inspectable' as TraitId,
        addedBy: testIdentity,
      })

      expect(cmd._tag).toBe('AddAssetTrait')
      expect(cmd.traitId).toBe('inspectable')
    })

    it('accepts trait config', () => {
      const cmd = new AddAssetTrait({
        assetId: 'asset-001' as AssetId,
        traitId: 'temperature-sensitive' as TraitId,
        config: { minTemp: -20, maxTemp: 40, unit: 'celsius' },
        addedBy: testIdentity,
      })

      expect(cmd.config).toEqual({ minTemp: -20, maxTemp: 40, unit: 'celsius' })
    })
  })

  describe('RemoveAssetTrait', () => {
    it('creates command with _tag', () => {
      const cmd = new RemoveAssetTrait({
        assetId: 'asset-001' as AssetId,
        traitId: 'inspectable' as TraitId,
        removedBy: testIdentity,
      })

      expect(cmd._tag).toBe('RemoveAssetTrait')
    })
  })

  describe('DeleteAsset', () => {
    it('creates command with _tag', () => {
      const cmd = new DeleteAsset({
        assetId: 'asset-001' as AssetId,
        deletedBy: testIdentity,
        reason: 'End of life',
      })

      expect(cmd._tag).toBe('DeleteAsset')
      expect(cmd.reason).toBe('End of life')
    })

    it('supports hard delete flag', () => {
      const cmd = new DeleteAsset({
        assetId: 'asset-001' as AssetId,
        deletedBy: testIdentity,
        hard: true,
      })

      expect(cmd.hard).toBe(true)
    })
  })

  describe('AssetCommand Union', () => {
    it.effect('pattern matches on _tag', () =>
      Effect.gen(function* () {
        const commands: AssetCommand[] = [
          new CreateAsset({
            siteId: 'site-01' as SiteId,
            kind: 'EQUIPMENT' as AssetKind,
            label: 'Test' as AssetLabel,
            createdBy: testIdentity,
          }),
          new UpdateAsset({
            assetId: 'asset-001' as AssetId,
            updatedBy: testIdentity,
          }),
          new DeleteAsset({
            assetId: 'asset-001' as AssetId,
            deletedBy: testIdentity,
          }),
        ]

        const tags = commands.map((cmd) => cmd._tag)
        expect(tags).toEqual(['CreateAsset', 'UpdateAsset', 'DeleteAsset'])
      })
    )
  })

  describe('Error Schemas', () => {
    it('AssetNotFoundError has _tag', () => {
      const err = new AssetNotFoundError({
        assetId: 'missing-001' as AssetId,
        message: 'Asset not found in registry',
      })

      expect(err._tag).toBe('AssetNotFoundError')
      expect(err.assetId).toBe('missing-001')
    })

    it('AssetValidationError has _tag', () => {
      const err = new AssetValidationError({
        field: 'label',
        message: 'Label cannot be empty',
      })

      expect(err._tag).toBe('AssetValidationError')
      expect(err.field).toBe('label')
    })

    it('AssetConflictError supports optimistic concurrency', () => {
      const err = new AssetConflictError({
        assetId: 'asset-001' as AssetId,
        reason: 'Concurrent modification',
        expectedVersion: 5,
        actualVersion: 7,
      })

      expect(err._tag).toBe('AssetConflictError')
      expect(err.expectedVersion).toBe(5)
      expect(err.actualVersion).toBe(7)
    })

    it('AssetPermissionError has _tag', () => {
      const err = new AssetPermissionError({
        operation: 'DELETE',
        requiredPermission: 'asset:delete',
      })

      expect(err._tag).toBe('AssetPermissionError')
      expect(err.operation).toBe('DELETE')
    })

    it.effect('AssetCommandError union accepts all error types', () =>
      Effect.gen(function* () {
        const errors: AssetCommandError[] = [
          new AssetNotFoundError({ assetId: 'a' as AssetId }),
          new AssetValidationError({ field: 'x', message: 'y' }),
          new AssetConflictError({ assetId: 'a' as AssetId, reason: 'z' }),
          new AssetPermissionError({ operation: 'o', requiredPermission: 'p' }),
        ]

        const tags = errors.map((e) => e._tag)
        expect(tags).toEqual([
          'AssetNotFoundError',
          'AssetValidationError',
          'AssetConflictError',
          'AssetPermissionError',
        ])
      })
    )
  })
})
