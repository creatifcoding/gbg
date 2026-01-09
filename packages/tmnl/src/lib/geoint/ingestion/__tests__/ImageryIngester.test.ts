/**
 * ImageryIngester Unit Tests
 *
 * Tests for satellite imagery data ingestion service:
 * - Schema validation for configuration
 * - Transformers: planetItemToImageryInput, sentinelItemToImageryInput
 * - Service configuration defaults
 * - Collection filtering and bounding box queries
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Option, Schema } from 'effect'
import {
  ImageryIngestionRegion,
  ImageryIngesterConfig,
  DEFAULT_IMAGERY_INGESTION_REGIONS,
  DEFAULT_IMAGERY_INGESTER_CONFIG,
  planetItemToImageryInput,
  sentinelItemToImageryInput,
  convertPlanetCloudCover,
  convertSentinelCloudCover,
  computeBboxFromPolygon,
  computeCentroidFromBbox,
} from '../ImageryIngester'
import { PlanetItem, SentinelItem } from '../../schemas'

describe('ImageryIngester', () => {
  // ===========================================================================
  // Schema Tests
  // ===========================================================================

  describe('ImageryIngestionRegion schema', () => {
    it('decodes valid region with all fields', () => {
      const input = {
        name: 'sf-bay-area',
        bounds: [-122.6, 37.3, -121.8, 37.9] as const,
        providers: ['planet', 'sentinel'] as const,
        maxCloudCover: 20,
        ttlDays: 90,
      }

      const result = Schema.decodeUnknownSync(ImageryIngestionRegion)(input)
      expect(result.name).toBe('sf-bay-area')
      expect(result.bounds).toEqual([-122.6, 37.3, -121.8, 37.9])
      expect(result.providers).toEqual(['planet', 'sentinel'])
      expect(result.maxCloudCover).toBe(20)
      expect(result.ttlDays).toBe(90)
    })

    it('provides defaults for optional fields', () => {
      const input = {
        name: 'minimal-region',
        bounds: [-123.0, 36.0, -121.0, 38.0] as const,
      }

      const result = Schema.decodeUnknownSync(ImageryIngestionRegion)(input)
      expect(result.providers).toEqual(['planet', 'sentinel']) // Both by default
      expect(result.maxCloudCover).toBe(30) // Default 30%
      expect(result.ttlDays).toBe(90) // Default 90 days
    })

    it('rejects invalid bounds tuple', () => {
      const input = {
        name: 'bad-bounds',
        bounds: [-122.5, 37.0], // Only 2 values
      }

      expect(() => Schema.decodeUnknownSync(ImageryIngestionRegion)(input)).toThrow()
    })

    it('rejects invalid provider', () => {
      const input = {
        name: 'bad-provider',
        bounds: [-122.5, 37.0, -122.0, 37.5] as const,
        providers: ['planet', 'landsat'] as const, // 'landsat' not supported
      }

      expect(() => Schema.decodeUnknownSync(ImageryIngestionRegion)(input)).toThrow()
    })

    it('rejects cloud cover outside 0-100 range', () => {
      const input = {
        name: 'bad-cloud-cover',
        bounds: [-122.5, 37.0, -122.0, 37.5] as const,
        maxCloudCover: 150, // Invalid
      }

      expect(() => Schema.decodeUnknownSync(ImageryIngestionRegion)(input)).toThrow()
    })
  })

  describe('ImageryIngesterConfig schema', () => {
    it('decodes valid config with all fields', () => {
      const input = {
        regions: [{
          name: 'test-region',
          bounds: [-122.5, 37.0, -122.0, 37.5] as const,
        }],
        intervalMs: 3600000, // 1 hour
        queryTimeoutMs: 60000,
        logIngestion: false,
        planetItemTypes: ['PSScene', 'SkySatCollect'],
        sentinelCollections: ['sentinel-2-l2a'],
        lookbackDays: 7,
      }

      const result = Schema.decodeUnknownSync(ImageryIngesterConfig)(input)
      expect(result.regions.length).toBe(1)
      expect(result.intervalMs).toBe(3600000)
      expect(result.queryTimeoutMs).toBe(60000)
      expect(result.logIngestion).toBe(false)
      expect(result.planetItemTypes).toEqual(['PSScene', 'SkySatCollect'])
      expect(result.sentinelCollections).toEqual(['sentinel-2-l2a'])
      expect(result.lookbackDays).toBe(7)
    })

    it('provides defaults for optional fields', () => {
      const input = {
        regions: [],
      }

      const result = Schema.decodeUnknownSync(ImageryIngesterConfig)(input)
      expect(result.intervalMs).toBe(3600000) // 1 hour (imagery updates less frequently)
      expect(result.queryTimeoutMs).toBe(60000)
      expect(result.logIngestion).toBe(true)
      expect(result.planetItemTypes).toEqual(['PSScene'])
      expect(result.sentinelCollections).toEqual(['sentinel-2-l2a'])
      expect(result.lookbackDays).toBe(3)
    })
  })

  // ===========================================================================
  // Default Configuration Tests
  // ===========================================================================

  describe('DEFAULT_IMAGERY_INGESTION_REGIONS', () => {
    it('contains SF Bay Area region', () => {
      expect(DEFAULT_IMAGERY_INGESTION_REGIONS.length).toBeGreaterThan(0)
      const sfBayArea = DEFAULT_IMAGERY_INGESTION_REGIONS.find(r => r.name === 'sf-bay-area')
      expect(sfBayArea).toBeDefined()
      expect(sfBayArea!.maxCloudCover).toBe(30)
    })
  })

  describe('DEFAULT_IMAGERY_INGESTER_CONFIG', () => {
    it('has expected defaults', () => {
      expect(DEFAULT_IMAGERY_INGESTER_CONFIG.intervalMs).toBe(3600000) // 1 hour
      expect(DEFAULT_IMAGERY_INGESTER_CONFIG.queryTimeoutMs).toBe(60000)
      expect(DEFAULT_IMAGERY_INGESTER_CONFIG.logIngestion).toBe(true)
      expect(DEFAULT_IMAGERY_INGESTER_CONFIG.lookbackDays).toBe(3)
    })
  })

  // ===========================================================================
  // Transformer Tests
  // ===========================================================================

  describe('planetItemToImageryInput', () => {
    // Helper to create a minimal valid PlanetItem
    const makePlanetItem = (overrides: Partial<{
      id: string
      itemType: string
      acquired: Date
      published: Date
      geometry: unknown
      assetsUrl: string
      permissions: readonly string[]
      cloudCover: number
      gsd: number
      sunAzimuth: number
      sunElevation: number
    }> = {}) => new PlanetItem({
      id: overrides.id ?? 'test-planet-item',
      itemType: overrides.itemType ?? 'PSScene',
      acquired: overrides.acquired ?? new Date('2024-01-15T18:00:00Z'),
      published: overrides.published ?? new Date('2024-01-15T20:00:00Z'),
      geometry: overrides.geometry ?? {
        type: 'Polygon',
        coordinates: [[[-122.5, 37.0], [-122.0, 37.0], [-122.0, 37.5], [-122.5, 37.5], [-122.5, 37.0]]],
      },
      assetsUrl: overrides.assetsUrl ?? 'https://api.planet.com/data/v1/item-types/PSScene/items/test/assets',
      permissions: overrides.permissions ?? ['download'],
      cloudCover: overrides.cloudCover,
      gsd: overrides.gsd,
      sunAzimuth: overrides.sunAzimuth,
      sunElevation: overrides.sunElevation,
    })

    it('transforms Planet item with all fields', () => {
      const item = makePlanetItem({
        id: '20240115_180000_planet_image',
        cloudCover: 0.15,
        gsd: 3.7,
        sunAzimuth: 135.5,
        sunElevation: 45.2,
      })

      const result = planetItemToImageryInput(item, item)

      expect(result).not.toBeNull()
      expect(result!._tag).toBe('ImageryItemInput')
      expect(result!.itemId).toBe('20240115_180000_planet_image')
      expect(result!.provider).toBe('planet')
      expect(Option.getOrNull(result!.collection)).toBe('PSScene')
      expect(Option.getOrNull(result!.acquired)).toEqual(new Date('2024-01-15T18:00:00Z'))
      expect(Option.getOrNull(result!.cloudCover)).toBe(15) // Percentage, not decimal
      expect(Option.getOrNull(result!.gsd)).toBe(3.7)
    })

    it('calculates bounding box from geometry', () => {
      const item = makePlanetItem({
        id: 'test-bbox',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-122.5, 37.0],
            [-122.0, 37.0],
            [-122.0, 37.5],
            [-122.5, 37.5],
            [-122.5, 37.0],
          ]],
        },
      })

      const result = planetItemToImageryInput(item, item)

      expect(result).not.toBeNull()
      const bbox = Option.getOrNull(result!.bbox)
      expect(bbox).not.toBeNull()
      expect(bbox![0]).toBe(-122.5) // minLon
      expect(bbox![1]).toBe(37.0)   // minLat
      expect(bbox![2]).toBe(-122.0) // maxLon
      expect(bbox![3]).toBe(37.5)   // maxLat
    })

    it('calculates centroid from geometry', () => {
      const item = makePlanetItem({
        id: 'test-centroid',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-122.5, 37.0],
            [-122.0, 37.0],
            [-122.0, 37.5],
            [-122.5, 37.5],
            [-122.5, 37.0],
          ]],
        },
      })

      const result = planetItemToImageryInput(item, item)

      expect(result).not.toBeNull()
      expect(Option.getOrNull(result!.centroidLon)).toBeCloseTo(-122.25, 2)
      expect(Option.getOrNull(result!.centroidLat)).toBeCloseTo(37.25, 2)
    })

    it('handles missing optional fields gracefully', () => {
      const item = makePlanetItem({
        id: 'minimal-item',
        // No cloudCover, gsd, sunAzimuth, sunElevation
      })

      const result = planetItemToImageryInput(item, item)

      expect(result).not.toBeNull()
      expect(Option.isNone(result!.cloudCover)).toBe(true)
      expect(Option.isNone(result!.gsd)).toBe(true)
      expect(Option.isNone(result!.sunAzimuth)).toBe(true)
      expect(Option.isNone(result!.sunElevation)).toBe(true)
    })

    it('preserves raw API response', () => {
      const item = makePlanetItem({ id: 'raw-test' })
      const rawResponse = { ...item, extraField: 'preserved' }
      const result = planetItemToImageryInput(item, rawResponse)

      expect(result!.raw).toEqual(rawResponse)
    })
  })

  describe('sentinelItemToImageryInput', () => {
    // Helper to create a minimal valid SentinelItem
    const makeSentinelItem = (overrides: Partial<{
      id: string
      collection: string
      datetime: Date
      geometry: unknown
      cloudCover: number
      gsd: number
      bbox: number[]
    }> = {}) => new SentinelItem({
      id: overrides.id ?? 'test-sentinel-item',
      datetime: overrides.datetime ?? new Date('2024-01-15T10:30:00Z'),
      geometry: overrides.geometry ?? {
        type: 'Polygon',
        coordinates: [[[-122.5, 37.0], [-122.0, 37.0], [-122.0, 37.5], [-122.5, 37.5], [-122.5, 37.0]]],
      },
      collection: overrides.collection,
      cloudCover: overrides.cloudCover,
      gsd: overrides.gsd,
      bbox: overrides.bbox,
    })

    it('transforms Sentinel item with all fields', () => {
      const item = makeSentinelItem({
        id: 'S2A_20240115_T10SGD_L2A',
        collection: 'sentinel-2-l2a',
        cloudCover: 12.5,
        gsd: 10,
        bbox: [-122.5, 37.0, -122.0, 37.5],
      })

      const result = sentinelItemToImageryInput(item, item)

      expect(result).not.toBeNull()
      expect(result!._tag).toBe('ImageryItemInput')
      expect(result!.itemId).toBe('S2A_20240115_T10SGD_L2A')
      expect(result!.provider).toBe('sentinel')
      expect(Option.getOrNull(result!.collection)).toBe('sentinel-2-l2a')
      expect(Option.getOrNull(result!.acquired)).toEqual(new Date('2024-01-15T10:30:00Z'))
      expect(Option.getOrNull(result!.cloudCover)).toBe(12.5)
      expect(Option.getOrNull(result!.gsd)).toBe(10)
    })

    it('uses bbox directly from Sentinel response', () => {
      const item = makeSentinelItem({
        id: 'bbox-test',
        collection: 'sentinel-2-l2a',
        bbox: [-122.6, 37.1, -121.9, 37.8],
      })

      const result = sentinelItemToImageryInput(item, item)

      expect(result).not.toBeNull()
      const bbox = Option.getOrNull(result!.bbox)
      expect(bbox).toEqual([-122.6, 37.1, -121.9, 37.8])
    })

    it('calculates centroid from bbox', () => {
      const item = makeSentinelItem({
        id: 'centroid-test',
        collection: 'sentinel-2-l2a',
        bbox: [-122.0, 37.0, -121.0, 38.0],
      })

      const result = sentinelItemToImageryInput(item, item)

      expect(result).not.toBeNull()
      expect(Option.getOrNull(result!.centroidLon)).toBeCloseTo(-121.5, 2)
      expect(Option.getOrNull(result!.centroidLat)).toBeCloseTo(37.5, 2)
    })

    it('handles missing optional fields gracefully', () => {
      const item = makeSentinelItem({
        id: 'minimal-sentinel',
        // No collection, cloudCover, gsd, bbox (all optional)
      })

      const result = sentinelItemToImageryInput(item, item)

      expect(result).not.toBeNull()
      expect(Option.isNone(result!.cloudCover)).toBe(true)
      expect(Option.isNone(result!.gsd)).toBe(true)
      expect(Option.isNone(result!.bbox)).toBe(true)
    })
  })

  // ===========================================================================
  // Cloud Cover Conversion
  // ===========================================================================

  describe('convertCloudCover', () => {
    it('converts Planet decimal (0-1) to percentage', () => {
      expect(convertPlanetCloudCover(0.15)).toBe(15)
      expect(convertPlanetCloudCover(0)).toBe(0)
      expect(convertPlanetCloudCover(1)).toBe(100)
    })

    it('passes Sentinel percentage through unchanged', () => {
      expect(convertSentinelCloudCover(15)).toBe(15)
      expect(convertSentinelCloudCover(0)).toBe(0)
      expect(convertSentinelCloudCover(100)).toBe(100)
    })
  })

  // ===========================================================================
  // Bounding Box Utilities
  // ===========================================================================

  describe('computeBboxFromPolygon', () => {
    it('computes bbox from simple polygon', () => {
      const polygon = {
        type: 'Polygon' as const,
        coordinates: [[
          [-122.5, 37.0],
          [-122.0, 37.0],
          [-122.0, 37.5],
          [-122.5, 37.5],
          [-122.5, 37.0],
        ]],
      }

      const bbox = computeBboxFromPolygon(polygon)
      expect(bbox).toEqual([-122.5, 37.0, -122.0, 37.5])
    })

    it('handles irregular polygons', () => {
      const polygon = {
        type: 'Polygon' as const,
        coordinates: [[
          [-122.5, 37.2],
          [-122.3, 37.0],
          [-122.0, 37.1],
          [-122.1, 37.5],
          [-122.4, 37.4],
          [-122.5, 37.2],
        ]],
      }

      const bbox = computeBboxFromPolygon(polygon)
      expect(bbox[0]).toBe(-122.5)  // minLon
      expect(bbox[1]).toBe(37.0)    // minLat
      expect(bbox[2]).toBe(-122.0)  // maxLon
      expect(bbox[3]).toBe(37.5)    // maxLat
    })
  })

  describe('computeCentroidFromBbox', () => {
    it('computes centroid from bbox', () => {
      const bbox: [number, number, number, number] = [-122.0, 37.0, -121.0, 38.0]
      const centroid = computeCentroidFromBbox(bbox)
      expect(centroid.lon).toBe(-121.5)
      expect(centroid.lat).toBe(37.5)
    })
  })
})

// ===========================================================================
// Integration Test Stubs (Implementation Pending)
// ===========================================================================

describe.skip('ImageryIngester Integration Tests', () => {
  // These tests will be enabled once full integration layer exists

  it('ingests imagery for a single region (Planet)', async () => {
    // Mock PlanetLabsClient
    // Mock ImageryRepository
    // Verify transformation and persistence
  })

  it('ingests imagery for a single region (Sentinel)', async () => {
    // Mock SentinelHubClient
    // Mock ImageryRepository
    // Verify transformation and persistence
  })

  it('paginates through multi-page responses', async () => {
    // Mock client returning multiple pages
    // Verify all pages are fetched and ingested
  })

  it('filters by cloud cover', async () => {
    // Verify items exceeding maxCloudCover are excluded
  })

  it('respects lookback days', async () => {
    // Verify date filter is applied correctly
  })

  it('handles API errors gracefully', async () => {
    // Mock API failure
    // Verify error is logged, ingestion continues
  })

  it('respects rate limits', async () => {
    // Verify concurrent requests are bounded
  })

  it('starts and stops polling fiber', async () => {
    // Test lifecycle management
  })

  it('handles OAuth token refresh (Sentinel)', async () => {
    // Mock expired token
    // Verify token is refreshed and request retried
  })
})
