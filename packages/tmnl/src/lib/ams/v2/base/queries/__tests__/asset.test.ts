/**
 * Asset Query Unit Tests
 */

import { describe, it, expect } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import {
  GetAsset,
  GetAssetSummary,
  AssetExists,
  ListAssetsBySite,
  ListAssetsBySector,
  ListAssetsByContainer,
  SearchAssets,
  ListAssetsByTag,
  ListAssetsByKind,
  ListAssetsByStatus,
  GetAssetProperty,
  GetAssetProperties,
  CountAssetsBySite,
  CountAssetsByStatus,
  CountAssetsByKind,
  AssetQuery,
  PaginationInput,
  PageInfo,
  AssetQueryEmpty,
} from '../asset'
import {
  AssetId,
  AssetKind,
  SiteId,
  SectorId,
  ContainerId,
  PropertyKey,
  Tag,
} from '../../../core/schemas/identifiers'
import { AssetStatus } from '../../schemas/asset'

describe('Asset Queries', () => {
  describe('Single Asset Queries', () => {
    it('GetAsset creates query with _tag', () => {
      const query = new GetAsset({
        assetId: 'asset-001' as AssetId,
      })

      expect(query._tag).toBe('GetAsset')
      expect(query.assetId).toBe('asset-001')
    })

    it('GetAssetSummary creates query with _tag', () => {
      const query = new GetAssetSummary({
        assetId: 'asset-001' as AssetId,
      })

      expect(query._tag).toBe('GetAssetSummary')
    })

    it('AssetExists creates query with _tag', () => {
      const query = new AssetExists({
        assetId: 'asset-001' as AssetId,
      })

      expect(query._tag).toBe('AssetExists')
    })

    it.effect('GetAsset encodes and decodes', () =>
      Effect.gen(function* () {
        const query = new GetAsset({
          assetId: 'asset-001' as AssetId,
        })

        const encoded = yield* Schema.encode(GetAsset)(query)
        expect(encoded).toBeDefined()

        const decoded = yield* Schema.decode(GetAsset)(encoded)
        expect(decoded._tag).toBe('GetAsset')
        expect(decoded.assetId).toBe('asset-001')
      })
    )
  })

  describe('List Queries', () => {
    it('ListAssetsBySite creates query with _tag', () => {
      const query = new ListAssetsBySite({
        siteId: 'site-01' as SiteId,
      })

      expect(query._tag).toBe('ListAssetsBySite')
      expect(query.siteId).toBe('site-01')
    })

    it('ListAssetsBySite accepts filters', () => {
      const query = new ListAssetsBySite({
        siteId: 'site-01' as SiteId,
        status: 'available' as AssetStatus,
        kind: 'EQUIPMENT' as AssetKind,
      })

      expect(query.status).toBe('available')
      expect(query.kind).toBe('EQUIPMENT')
    })

    it('ListAssetsBySector creates query with _tag', () => {
      const query = new ListAssetsBySector({
        siteId: 'site-01' as SiteId,
        sectorId: 'sector-A' as SectorId,
      })

      expect(query._tag).toBe('ListAssetsBySector')
      expect(query.sectorId).toBe('sector-A')
    })

    it('ListAssetsByContainer creates query with _tag', () => {
      const query = new ListAssetsByContainer({
        containerId: 'container-01' as ContainerId,
      })

      expect(query._tag).toBe('ListAssetsByContainer')
    })

    it('ListAssetsByTag creates query with _tag', () => {
      const query = new ListAssetsByTag({
        tag: 'high-value' as Tag,
      })

      expect(query._tag).toBe('ListAssetsByTag')
      expect(query.tag).toBe('high-value')
    })

    it('ListAssetsByKind creates query with _tag', () => {
      const query = new ListAssetsByKind({
        kind: 'HAND_TOOL' as AssetKind,
      })

      expect(query._tag).toBe('ListAssetsByKind')
    })

    it('ListAssetsByStatus creates query with _tag', () => {
      const query = new ListAssetsByStatus({
        status: 'maintenance' as AssetStatus,
      })

      expect(query._tag).toBe('ListAssetsByStatus')
    })
  })

  describe('Search Query', () => {
    it('SearchAssets creates query with _tag', () => {
      const query = new SearchAssets({
        query: 'hammer',
      })

      expect(query._tag).toBe('SearchAssets')
      expect(query.query).toBe('hammer')
    })

    it('SearchAssets accepts all filters', () => {
      const query = new SearchAssets({
        query: 'forklift',
        siteId: 'site-01' as SiteId,
        status: 'available' as AssetStatus,
        kind: 'EQUIPMENT' as AssetKind,
        tags: ['heavy', 'licensed'] as never,
      })

      expect(query.siteId).toBe('site-01')
      expect(query.status).toBe('available')
    })
  })

  describe('Property Queries', () => {
    it('GetAssetProperty creates query with _tag', () => {
      const query = new GetAssetProperty({
        assetId: 'asset-001' as AssetId,
        key: 'serialNumber' as PropertyKey,
      })

      expect(query._tag).toBe('GetAssetProperty')
      expect(query.key).toBe('serialNumber')
    })

    it('GetAssetProperties creates query with _tag', () => {
      const query = new GetAssetProperties({
        assetId: 'asset-001' as AssetId,
      })

      expect(query._tag).toBe('GetAssetProperties')
    })
  })

  describe('Aggregate Queries', () => {
    it('CountAssetsBySite creates query with _tag', () => {
      const query = new CountAssetsBySite({
        siteId: 'site-01' as SiteId,
      })

      expect(query._tag).toBe('CountAssetsBySite')
    })

    it('CountAssetsBySite accepts status filter', () => {
      const query = new CountAssetsBySite({
        siteId: 'site-01' as SiteId,
        status: 'available' as AssetStatus,
      })

      expect(query.status).toBe('available')
    })

    it('CountAssetsByStatus creates query with _tag', () => {
      const query = new CountAssetsByStatus({
        siteId: 'site-01' as SiteId,
      })

      expect(query._tag).toBe('CountAssetsByStatus')
    })

    it('CountAssetsByKind creates query with _tag', () => {
      const query = new CountAssetsByKind({})

      expect(query._tag).toBe('CountAssetsByKind')
    })
  })

  describe('Pagination', () => {
    it('PaginationInput creates with defaults', () => {
      const pagination = PaginationInput.Default

      expect(pagination._tag).toBe('PaginationInput')
      expect(pagination.limit).toBeUndefined()
      expect(pagination.cursor).toBeUndefined()
    })

    it('PaginationInput accepts custom values', () => {
      const pagination = new PaginationInput({
        limit: 50,
        cursor: 'abc123',
        sortBy: 'createdAt',
        sortDirection: 'desc',
      })

      expect(pagination.limit).toBe(50)
      expect(pagination.cursor).toBe('abc123')
      expect(pagination.sortBy).toBe('createdAt')
      expect(pagination.sortDirection).toBe('desc')
    })

    it('PageInfo creates with required fields', () => {
      const pageInfo = new PageInfo({
        nextCursor: 'next-abc',
        hasNextPage: true,
        totalCount: 100,
      })

      expect(pageInfo._tag).toBe('PageInfo')
      expect(pageInfo.nextCursor).toBe('next-abc')
      expect(pageInfo.hasNextPage).toBe(true)
      expect(pageInfo.totalCount).toBe(100)
    })

    it('PageInfo allows null nextCursor', () => {
      const pageInfo = new PageInfo({
        nextCursor: null,
        hasNextPage: false,
      })

      expect(pageInfo.nextCursor).toBeNull()
      expect(pageInfo.hasNextPage).toBe(false)
    })

    it('queries accept pagination input', () => {
      const query = new ListAssetsBySite({
        siteId: 'site-01' as SiteId,
        pagination: new PaginationInput({
          limit: 25,
          sortBy: 'label',
          sortDirection: 'asc',
        }),
      })

      expect(query.pagination?.limit).toBe(25)
      expect(query.pagination?.sortBy).toBe('label')
    })
  })

  describe('Error Schemas', () => {
    it('AssetQueryEmpty creates with _tag', () => {
      const err = new AssetQueryEmpty({
        query: 'SearchAssets',
        message: 'No assets found matching criteria',
      })

      expect(err._tag).toBe('AssetQueryEmpty')
      expect(err.query).toBe('SearchAssets')
    })
  })

  describe('AssetQuery Union', () => {
    it.effect('pattern matches on _tag', () =>
      Effect.gen(function* () {
        const queries: AssetQuery[] = [
          new GetAsset({ assetId: 'a' as AssetId }),
          new SearchAssets({ query: 'test' }),
          new CountAssetsBySite({ siteId: 's' as SiteId }),
        ]

        const tags = queries.map((q) => q._tag)
        expect(tags).toEqual(['GetAsset', 'SearchAssets', 'CountAssetsBySite'])
      })
    )
  })
})
