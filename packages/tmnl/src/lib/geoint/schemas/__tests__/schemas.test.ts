import { describe, it, expect } from '@effect/vitest'
import { Effect, Schema, Match } from 'effect'
import {
  // Core
  TrackId,
  FeatureId,
  LayerId,
  Classification,
  ObjectType,
  classificationColors,
  // Tracks
  TrackPosition,
  TrackMetadata,
  Track,
  TrackPositionUpdate,
  TrackClassificationUpdate,
  TrackEvent,
  // Features
  PointGeometry,
  LineStringGeometry,
  PolygonGeometry,
  Geometry,
  Feature,
  Layer,
  LayerToggle,
  LayerOpacityChange,
  LayerEvent,
  // Analysis
  ThreatVolume,
  TileId,
  ImageryChunk
} from '../index'

describe('GEOINT Schemas', () => {
  describe('Branded Types', () => {
    it('creates branded TrackId', () => {
      const trackId = Schema.decodeSync(TrackId)('track-123')
      expect(trackId).toBe('track-123')
      // Type-level brand is applied
      const _check: typeof TrackId.Type = trackId
    })

    it('creates branded FeatureId', () => {
      const featureId = Schema.decodeSync(FeatureId)('feat-456')
      expect(featureId).toBe('feat-456')
    })

    it('creates branded LayerId', () => {
      const layerId = Schema.decodeSync(LayerId)('layer-789')
      expect(layerId).toBe('layer-789')
    })
  })

  describe('TrackPosition (TaggedClass)', () => {
    it('creates valid TrackPosition with _tag', () => {
      const pos = new TrackPosition({
        lat: 37.7749,
        lon: -122.4194,
        timestamp: new Date(),
        heading: 90,
        speed: 450
      })

      expect(pos._tag).toBe('TrackPosition')
      expect(pos.lat).toBe(37.7749)
      expect(pos.lon).toBe(-122.4194)
      expect(pos.altitude).toBe(0) // default
    })

    it('validates latitude bounds', () => {
      expect(() =>
        new TrackPosition({
          lat: 95, // invalid
          lon: 0,
          timestamp: new Date(),
          heading: 0,
          speed: 0
        })
      ).toThrow()
    })

    it('validates longitude bounds', () => {
      expect(() =>
        new TrackPosition({
          lat: 0,
          lon: 200, // invalid
          timestamp: new Date(),
          heading: 0,
          speed: 0
        })
      ).toThrow()
    })
  })

  describe('Track (TaggedClass)', () => {
    const createTestTrack = () => {
      const trackId = Schema.decodeSync(TrackId)('track-001')
      const pos1 = new TrackPosition({
        lat: 37.7749,
        lon: -122.4194,
        timestamp: new Date('2024-01-01T00:00:00Z'),
        heading: 90,
        speed: 450
      })
      const pos2 = new TrackPosition({
        lat: 37.8,
        lon: -122.5,
        timestamp: new Date('2024-01-01T01:00:00Z'),
        heading: 95,
        speed: 460
      })
      const metadata = new TrackMetadata({
        objectType: 'aircraft',
        confidence: 0.95,
        source: 'radar'
      })

      return new Track({
        trackId,
        positions: [pos1, pos2],
        metadata
      })
    }

    it('creates valid Track with _tag', () => {
      const track = createTestTrack()
      expect(track._tag).toBe('Track')
      expect(track.trackId).toBe('track-001')
      expect(track.positions.length).toBe(2)
    })

    it('computes latestPosition', () => {
      const track = createTestTrack()
      expect(track.latestPosition?.lat).toBe(37.8)
    })

    it('computes duration', () => {
      const track = createTestTrack()
      expect(track.duration).toBe(3600000) // 1 hour in ms
    })

    it('defaults classification to unknown', () => {
      const track = createTestTrack()
      expect(track.metadata.classification).toBe('unknown')
    })
  })

  describe('TrackEvent Union (Pattern Matching)', () => {
    it('matches TrackPositionUpdate', () => {
      const trackId = Schema.decodeSync(TrackId)('track-001')
      const pos = new TrackPosition({
        lat: 37.7749,
        lon: -122.4194,
        timestamp: new Date(),
        heading: 90,
        speed: 450
      })
      const event = new TrackPositionUpdate({
        trackId,
        position: pos,
        eventTimestamp: new Date()
      })

      const result = Match.value(event as TrackEvent).pipe(
        Match.tag('TrackPositionUpdate', (e) => `position update for ${e.trackId}`),
        Match.tag('TrackClassificationUpdate', (e) => `classification: ${e.classification}`),
        Match.exhaustive
      )

      expect(result).toBe('position update for track-001')
    })

    it('matches TrackClassificationUpdate', () => {
      const trackId = Schema.decodeSync(TrackId)('track-002')
      const event = new TrackClassificationUpdate({
        trackId,
        classification: 'hostile',
        eventTimestamp: new Date()
      })

      const result = Match.value(event as TrackEvent).pipe(
        Match.tag('TrackPositionUpdate', () => 'position'),
        Match.tag('TrackClassificationUpdate', (e) => e.classification),
        Match.exhaustive
      )

      expect(result).toBe('hostile')
    })
  })

  describe('Geometry Union (Pattern Matching)', () => {
    it('matches PointGeometry', () => {
      const point = new PointGeometry({
        type: 'Point',
        coordinates: [-122.4194, 37.7749]
      })

      const result = Match.value(point as Geometry).pipe(
        Match.tag('Point', (g) => `Point at ${g.coordinates[0]}, ${g.coordinates[1]}`),
        Match.tag('LineString', () => 'LineString'),
        Match.tag('Polygon', () => 'Polygon'),
        Match.exhaustive
      )

      expect(result).toBe('Point at -122.4194, 37.7749')
    })

    it('matches LineStringGeometry', () => {
      const line = new LineStringGeometry({
        type: 'LineString',
        coordinates: [
          [-122.4194, 37.7749],
          [-122.5, 37.8]
        ]
      })

      expect(line._tag).toBe('LineString')
      expect(line.coordinates.length).toBe(2)
    })

    it('matches PolygonGeometry', () => {
      const polygon = new PolygonGeometry({
        type: 'Polygon',
        coordinates: [
          [
            [-122.4194, 37.7749],
            [-122.5, 37.7749],
            [-122.5, 37.8],
            [-122.4194, 37.8],
            [-122.4194, 37.7749]
          ]
        ]
      })

      expect(polygon._tag).toBe('Polygon')
    })
  })

  describe('Layer and LayerEvent', () => {
    it('creates Layer with _tag', () => {
      const layerId = Schema.decodeSync(LayerId)('tracks-layer')
      const layer = new Layer({
        id: layerId,
        name: 'Track Paths',
        type: 'vector',
        visible: true,
        opacity: 0.8
      })

      expect(layer._tag).toBe('Layer')
      expect(layer.zIndex).toBe(0) // default
    })

    it('pattern matches LayerEvent', () => {
      const layerId = Schema.decodeSync(LayerId)('tracks-layer')
      const toggle = new LayerToggle({ layerId, visible: false })

      const result = Match.value(toggle as LayerEvent).pipe(
        Match.tag('LayerToggle', (e) => `toggle ${e.layerId} to ${e.visible}`),
        Match.tag('LayerOpacityChange', (e) => `opacity ${e.opacity}`),
        Match.exhaustive
      )

      expect(result).toBe('toggle tracks-layer to false')
    })
  })

  describe('ThreatVolume', () => {
    it('creates ThreatVolume with _tag', () => {
      const threat = new ThreatVolume({
        center: [-122.4194, 37.7749],
        radius: 5000,
        height: 10000,
        level: 'high',
        confidence: 0.85
      })

      expect(threat._tag).toBe('ThreatVolume')
      expect(threat.level).toBe('high')
      expect(threat.trackId).toBeUndefined()
    })

    it('associates ThreatVolume with track', () => {
      const trackId = Schema.decodeSync(TrackId)('hostile-001')
      const threat = new ThreatVolume({
        center: [-122.4194, 37.7749],
        radius: 5000,
        height: 10000,
        level: 'critical',
        trackId,
        confidence: 0.95
      })

      expect(threat.trackId).toBe('hostile-001')
    })
  })

  describe('Classification Colors', () => {
    it('maps classification to colors', () => {
      expect(classificationColors.friendly).toEqual([0, 255, 0])
      expect(classificationColors.hostile).toEqual([255, 0, 0])
      expect(classificationColors.neutral).toEqual([255, 255, 0])
      expect(classificationColors.unknown).toEqual([128, 128, 128])
    })
  })

  describe('Schema Encoding/Decoding', () => {
    it('encodes and decodes Track', async () => {
      const trackId = Schema.decodeSync(TrackId)('track-round-trip')
      const pos = new TrackPosition({
        lat: 37.7749,
        lon: -122.4194,
        timestamp: new Date('2024-01-01T00:00:00Z'),
        heading: 90,
        speed: 450
      })
      const metadata = new TrackMetadata({
        objectType: 'vessel',
        confidence: 0.8,
        classification: 'neutral',
        source: 'ais'
      })
      const track = new Track({
        trackId,
        positions: [pos],
        metadata
      })

      // Encode to JSON
      const encoded = await Effect.runPromise(Schema.encode(Track)(track))
      expect(encoded._tag).toBe('Track')

      // Decode back
      const decoded = await Effect.runPromise(Schema.decode(Track)(encoded))
      expect(decoded.trackId).toBe('track-round-trip')
      expect(decoded.metadata.classification).toBe('neutral')
    })
  })
})
