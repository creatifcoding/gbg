/**
 * OsmIngester Unit Tests
 *
 * Tests for OSM POI data ingestion service:
 * - Schema validation for configuration
 * - Transformer: overpassElementToPoiInput
 * - Service configuration defaults
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Option, Schema } from 'effect'
import {
  OsmIngestionRegion,
  OsmIngesterConfig,
  DEFAULT_OSM_INGESTION_REGIONS,
  DEFAULT_OSM_INGESTER_CONFIG,
  overpassElementToPoiInput,
} from '../OsmIngester'
import { OverpassElement } from '../../schemas'

describe('OsmIngester', () => {
  // ===========================================================================
  // Schema Tests
  // ===========================================================================

  describe('OsmIngestionRegion schema', () => {
    it('decodes valid region with all fields', () => {
      const input = {
        name: 'test-region',
        bounds: [-122.5, 37.0, -122.0, 37.5] as const,
        amenities: ['restaurant', 'cafe'],
        tags: { shop: 'supermarket' },
        ttlDays: 14,
      }

      const result = Schema.decodeUnknownSync(OsmIngestionRegion)(input)

      expect(result.name).toBe('test-region')
      expect(result.bounds).toEqual([-122.5, 37.0, -122.0, 37.5])
      expect(result.amenities).toEqual(['restaurant', 'cafe'])
      expect(result.tags).toEqual({ shop: 'supermarket' })
      expect(result.ttlDays).toBe(14)
    })

    it('provides defaults for optional fields', () => {
      const input = {
        name: 'minimal-region',
        bounds: [-123.0, 36.0, -121.0, 38.0] as const,
      }

      const result = Schema.decodeUnknownSync(OsmIngestionRegion)(input)

      expect(result.name).toBe('minimal-region')
      expect(result.bounds).toEqual([-123.0, 36.0, -121.0, 38.0])
      expect(result.amenities).toEqual(['restaurant', 'cafe', 'hospital', 'pharmacy', 'fuel', 'bank'])
      expect(result.tags).toEqual({})
      expect(result.ttlDays).toBe(7)
    })

    it('rejects invalid bounds tuple', () => {
      const input = {
        name: 'bad-bounds',
        bounds: [-122.5, 37.0, -122.0], // Only 3 values
      }

      expect(() => Schema.decodeUnknownSync(OsmIngestionRegion)(input)).toThrow()
    })
  })

  describe('OsmIngesterConfig schema', () => {
    it('decodes valid config with all fields', () => {
      const input = {
        regions: [{
          name: 'test-region',
          bounds: [-122.5, 37.0, -122.0, 37.5] as const,
        }],
        intervalMs: 600000,
        queryTimeoutMs: 120000,
        logIngestion: false,
      }

      const result = Schema.decodeUnknownSync(OsmIngesterConfig)(input)

      expect(result.regions.length).toBe(1)
      expect(result.intervalMs).toBe(600000)
      expect(result.queryTimeoutMs).toBe(120000)
      expect(result.logIngestion).toBe(false)
    })

    it('provides defaults for optional fields', () => {
      const input = {
        regions: [],
      }

      const result = Schema.decodeUnknownSync(OsmIngesterConfig)(input)

      expect(result.regions).toEqual([])
      expect(result.intervalMs).toBe(300000) // 5 minutes
      expect(result.queryTimeoutMs).toBe(60000)
      expect(result.logIngestion).toBe(true)
    })
  })

  // ===========================================================================
  // Default Configuration Tests
  // ===========================================================================

  describe('DEFAULT_OSM_INGESTION_REGIONS', () => {
    it('contains SF Bay Area region', () => {
      expect(DEFAULT_OSM_INGESTION_REGIONS.length).toBeGreaterThan(0)

      const sfBayArea = DEFAULT_OSM_INGESTION_REGIONS.find(r => r.name === 'sf-bay-area')
      expect(sfBayArea).toBeDefined()
      expect(sfBayArea!.bounds).toEqual([-122.6, 37.3, -121.8, 37.9])
      expect(sfBayArea!.amenities).toContain('restaurant')
      expect(sfBayArea!.amenities).toContain('hospital')
      expect(sfBayArea!.ttlDays).toBe(7)
    })
  })

  describe('DEFAULT_OSM_INGESTER_CONFIG', () => {
    it('has expected defaults', () => {
      expect(DEFAULT_OSM_INGESTER_CONFIG.intervalMs).toBe(300000) // 5 minutes
      expect(DEFAULT_OSM_INGESTER_CONFIG.queryTimeoutMs).toBe(60000)
      expect(DEFAULT_OSM_INGESTER_CONFIG.logIngestion).toBe(true)
      expect(DEFAULT_OSM_INGESTER_CONFIG.regions.length).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // Transformer Tests
  // ===========================================================================

  describe('overpassElementToPoiInput', () => {
    const testBbox: readonly [number, number, number, number] = [-122.5, 37.0, -122.0, 37.5]

    describe('node elements (direct lat/lon)', () => {
      it('transforms node with all fields', () => {
        const element = new OverpassElement({
          type: 'node',
          id: 123456789,
          lat: 37.7749,
          lon: -122.4194,
          tags: {
            name: 'Test Restaurant',
            amenity: 'restaurant',
            cuisine: 'italian',
          },
        })

        const result = overpassElementToPoiInput(element, element, testBbox, 7)

        expect(result).not.toBeNull()
        expect(result!._tag).toBe('PoiInput')
        expect(result!.osmId).toBe(BigInt(123456789))
        expect(result!.osmType).toBe('node')
        expect(result!.geometry).toEqual({
          type: 'Point',
          coordinates: [-122.4194, 37.7749],
        })
        expect(Option.getOrNull(result!.centroidLon)).toBe(-122.4194)
        expect(Option.getOrNull(result!.centroidLat)).toBe(37.7749)
        expect(result!.tags).toEqual({
          name: 'Test Restaurant',
          amenity: 'restaurant',
          cuisine: 'italian',
        })
        expect(Option.getOrNull(result!.queryBbox)).toEqual(testBbox)
        expect(Option.getOrNull(result!.ttlDays)).toBe(7)
      })

      it('transforms node without explicit tags (uses default)', () => {
        const element = new OverpassElement({
          type: 'node',
          id: 987654321,
          lat: 37.8,
          lon: -122.3,
        })

        const result = overpassElementToPoiInput(element, element, testBbox, 14)

        expect(result).not.toBeNull()
        expect(result!.osmId).toBe(BigInt(987654321))
        expect(result!.tags).toEqual({}) // Default empty object
        expect(Option.getOrNull(result!.ttlDays)).toBe(14)
      })

      it('returns null for node without coordinates', () => {
        const element = new OverpassElement({
          type: 'node',
          id: 111,
          // No lat/lon
        })

        const result = overpassElementToPoiInput(element, element, testBbox, 7)

        expect(result).toBeNull()
      })
    })

    describe('way elements (center property)', () => {
      it('transforms way with center', () => {
        const element = new OverpassElement({
          type: 'way',
          id: 456789012,
          center: {
            lat: 37.75,
            lon: -122.45,
          },
          tags: {
            name: 'Golden Gate Park',
            leisure: 'park',
          },
        })

        const result = overpassElementToPoiInput(element, element, testBbox, 7)

        expect(result).not.toBeNull()
        expect(result!.osmId).toBe(BigInt(456789012))
        expect(result!.osmType).toBe('way')
        expect(result!.geometry).toEqual({
          type: 'Point',
          coordinates: [-122.45, 37.75],
        })
        expect(Option.getOrNull(result!.centroidLon)).toBe(-122.45)
        expect(Option.getOrNull(result!.centroidLat)).toBe(37.75)
      })

      it('returns null for way without center', () => {
        const element = new OverpassElement({
          type: 'way',
          id: 789,
          tags: { name: 'No Center Way' },
        })

        const result = overpassElementToPoiInput(element, element, testBbox, 7)

        expect(result).toBeNull()
      })
    })

    describe('relation elements', () => {
      it('transforms relation with center', () => {
        const element = new OverpassElement({
          type: 'relation',
          id: 789012345,
          center: {
            lat: 37.78,
            lon: -122.42,
          },
          tags: {
            name: 'San Francisco',
            place: 'city',
          },
        })

        const result = overpassElementToPoiInput(element, element, testBbox, 30)

        expect(result).not.toBeNull()
        expect(result!.osmId).toBe(BigInt(789012345))
        expect(result!.osmType).toBe('relation')
        expect(Option.getOrNull(result!.centroidLon)).toBe(-122.42)
        expect(Option.getOrNull(result!.centroidLat)).toBe(37.78)
        expect(Option.getOrNull(result!.ttlDays)).toBe(30)
      })

      it('returns null for relation without center', () => {
        const element = new OverpassElement({
          type: 'relation',
          id: 321,
        })

        const result = overpassElementToPoiInput(element, element, testBbox, 7)

        expect(result).toBeNull()
      })
    })

    describe('raw data preservation', () => {
      it('preserves original raw data separately from element', () => {
        const element = new OverpassElement({
          type: 'node',
          id: 555,
          lat: 37.7,
          lon: -122.4,
          tags: { name: 'Test' },
        })

        const rawApiResponse = {
          ...element,
          _extra_field: 'preserved',
          timestamp: '2024-01-01',
        }

        const result = overpassElementToPoiInput(element, rawApiResponse, testBbox, 7)

        expect(result).not.toBeNull()
        expect(result!.raw).toEqual(rawApiResponse)
        expect((result!.raw as any)._extra_field).toBe('preserved')
      })
    })

    describe('boundary conditions', () => {
      it('handles zero coordinates', () => {
        const element = new OverpassElement({
          type: 'node',
          id: 100,
          lat: 0,
          lon: 0,
        })

        const result = overpassElementToPoiInput(element, element, testBbox, 7)

        expect(result).not.toBeNull()
        expect(Option.getOrNull(result!.centroidLat)).toBe(0)
        expect(Option.getOrNull(result!.centroidLon)).toBe(0)
      })

      it('handles negative coordinates', () => {
        const element = new OverpassElement({
          type: 'node',
          id: 200,
          lat: -33.8688,
          lon: 151.2093,
        })

        const result = overpassElementToPoiInput(element, element, testBbox, 7)

        expect(result).not.toBeNull()
        expect(Option.getOrNull(result!.centroidLat)).toBe(-33.8688)
        expect(Option.getOrNull(result!.centroidLon)).toBe(151.2093)
      })

      it('handles large OSM IDs', () => {
        const element = new OverpassElement({
          type: 'node',
          id: 9007199254740991, // Max safe integer
          lat: 37.7,
          lon: -122.4,
        })

        const result = overpassElementToPoiInput(element, element, testBbox, 7)

        expect(result).not.toBeNull()
        expect(result!.osmId).toBe(BigInt(9007199254740991))
      })

      it('handles empty tags object', () => {
        const element = new OverpassElement({
          type: 'node',
          id: 300,
          lat: 37.7,
          lon: -122.4,
          tags: {},
        })

        const result = overpassElementToPoiInput(element, element, testBbox, 7)

        expect(result).not.toBeNull()
        expect(result!.tags).toEqual({})
      })
    })

    describe('preference order for coordinates', () => {
      it('prefers direct lat/lon over center for nodes', () => {
        const element = new OverpassElement({
          type: 'node',
          id: 400,
          lat: 37.8,
          lon: -122.5,
          center: {
            lat: 37.0, // Different from direct coords
            lon: -122.0,
          },
        })

        const result = overpassElementToPoiInput(element, element, testBbox, 7)

        expect(result).not.toBeNull()
        // Should use direct lat/lon, not center
        expect(Option.getOrNull(result!.centroidLat)).toBe(37.8)
        expect(Option.getOrNull(result!.centroidLon)).toBe(-122.5)
      })
    })
  })
})
