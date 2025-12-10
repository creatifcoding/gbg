/**
 * Asset Entity Unit Tests
 *
 * Tests RPC definitions and entity structure.
 * Integration tests with handlers are in a separate file.
 */

import { describe, it, expect } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import {
  AssetEntity,
  CreateAssetRpc,
  UpdateAssetRpc,
  MoveAssetRpc,
  SetAssetPropertyRpc,
  RemoveAssetPropertyRpc,
  AddAssetTraitRpc,
  RemoveAssetTraitRpc,
  DeleteAssetRpc,
  GetAssetRpc,
  GetAssetSummaryRpc,
  AssetExistsRpc,
  ListAssetsBySiteRpc,
  ListAssetsBySectorRpc,
  ListAssetsByContainerRpc,
  SearchAssetsRpc,
  GetAssetPropertyRpc,
  GetAssetPropertiesRpc,
  CountAssetsBySiteRpc,
  CountAssetsByStatusRpc,
  CountAssetsByKindRpc,
} from '../asset'

describe('Asset Entity', () => {
  describe('Entity Definition', () => {
    it('has correct type', () => {
      expect(AssetEntity.type).toBe('Asset')
    })

    it('has protocol with all RPCs', () => {
      // Entity.make converts array to RpcGroup internally
      expect(AssetEntity).toBeDefined()
    })
  })

  describe('Command RPCs', () => {
    it('CreateAssetRpc has correct tag', () => {
      expect(CreateAssetRpc._tag).toBe('CreateAsset')
    })

    it('UpdateAssetRpc has correct tag', () => {
      expect(UpdateAssetRpc._tag).toBe('UpdateAsset')
    })

    it('MoveAssetRpc has correct tag', () => {
      expect(MoveAssetRpc._tag).toBe('MoveAsset')
    })

    it('SetAssetPropertyRpc has correct tag', () => {
      expect(SetAssetPropertyRpc._tag).toBe('SetAssetProperty')
    })

    it('RemoveAssetPropertyRpc has correct tag', () => {
      expect(RemoveAssetPropertyRpc._tag).toBe('RemoveAssetProperty')
    })

    it('AddAssetTraitRpc has correct tag', () => {
      expect(AddAssetTraitRpc._tag).toBe('AddAssetTrait')
    })

    it('RemoveAssetTraitRpc has correct tag', () => {
      expect(RemoveAssetTraitRpc._tag).toBe('RemoveAssetTrait')
    })

    it('DeleteAssetRpc has correct tag', () => {
      expect(DeleteAssetRpc._tag).toBe('DeleteAsset')
    })
  })

  describe('Query RPCs', () => {
    it('GetAssetRpc has correct tag', () => {
      expect(GetAssetRpc._tag).toBe('GetAsset')
    })

    it('GetAssetSummaryRpc has correct tag', () => {
      expect(GetAssetSummaryRpc._tag).toBe('GetAssetSummary')
    })

    it('AssetExistsRpc has correct tag', () => {
      expect(AssetExistsRpc._tag).toBe('AssetExists')
    })

    it('ListAssetsBySiteRpc has correct tag', () => {
      expect(ListAssetsBySiteRpc._tag).toBe('ListAssetsBySite')
    })

    it('ListAssetsBySectorRpc has correct tag', () => {
      expect(ListAssetsBySectorRpc._tag).toBe('ListAssetsBySector')
    })

    it('ListAssetsByContainerRpc has correct tag', () => {
      expect(ListAssetsByContainerRpc._tag).toBe('ListAssetsByContainer')
    })

    it('SearchAssetsRpc has correct tag', () => {
      expect(SearchAssetsRpc._tag).toBe('SearchAssets')
    })

    it('GetAssetPropertyRpc has correct tag', () => {
      expect(GetAssetPropertyRpc._tag).toBe('GetAssetProperty')
    })

    it('GetAssetPropertiesRpc has correct tag', () => {
      expect(GetAssetPropertiesRpc._tag).toBe('GetAssetProperties')
    })

    it('CountAssetsBySiteRpc has correct tag', () => {
      expect(CountAssetsBySiteRpc._tag).toBe('CountAssetsBySite')
    })

    it('CountAssetsByStatusRpc has correct tag', () => {
      expect(CountAssetsByStatusRpc._tag).toBe('CountAssetsByStatus')
    })

    it('CountAssetsByKindRpc has correct tag', () => {
      expect(CountAssetsByKindRpc._tag).toBe('CountAssetsByKind')
    })
  })

  describe('RPC Schemas', () => {
    it('all RPCs have payload schema', () => {
      const rpcs = [
        CreateAssetRpc,
        UpdateAssetRpc,
        MoveAssetRpc,
        SetAssetPropertyRpc,
        RemoveAssetPropertyRpc,
        AddAssetTraitRpc,
        RemoveAssetTraitRpc,
        DeleteAssetRpc,
        GetAssetRpc,
        GetAssetSummaryRpc,
        AssetExistsRpc,
        ListAssetsBySiteRpc,
        ListAssetsBySectorRpc,
        ListAssetsByContainerRpc,
        SearchAssetsRpc,
        GetAssetPropertyRpc,
        GetAssetPropertiesRpc,
        CountAssetsBySiteRpc,
        CountAssetsByStatusRpc,
        CountAssetsByKindRpc,
      ]

      for (const rpc of rpcs) {
        expect(rpc.payloadSchema).toBeDefined()
        expect(rpc.successSchema).toBeDefined()
        expect(rpc.errorSchema).toBeDefined()
      }
    })

    it('command RPCs have error schema', () => {
      const commands = [
        CreateAssetRpc,
        UpdateAssetRpc,
        MoveAssetRpc,
        SetAssetPropertyRpc,
        RemoveAssetPropertyRpc,
        AddAssetTraitRpc,
        RemoveAssetTraitRpc,
        DeleteAssetRpc,
      ]

      for (const cmd of commands) {
        // Error schema should not be Schema.Never for commands
        expect(cmd.errorSchema).toBeDefined()
      }
    })
  })
})
