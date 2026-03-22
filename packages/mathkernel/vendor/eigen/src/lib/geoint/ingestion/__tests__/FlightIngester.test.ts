/**
 * FlightIngester Unit Tests
 *
 * Tests transformation functions and ingester behavior with mocked clients.
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import {
  DEFAULT_INGESTION_REGIONS,
  DEFAULT_FLIGHT_INGESTER_CONFIG,
  openSkyToFlightPosition,
  adsbLolToFlightPosition,
} from '../FlightIngester'
import { OpenSkyStateVector, AdsbLolAircraft, Icao24 } from '../../schemas'

// =============================================================================
// OpenSky Transformation Tests
// =============================================================================

describe('openSkyToFlightPosition', () => {
  it('transforms valid OpenSkyStateVector to FlightPositionInput', () => {
    const state = new OpenSkyStateVector({
      icao24: 'abc123' as Icao24,
      callsign: 'UAL123',
      originCountry: 'United States',
      timePosition: 1700000000,
      lastContact: 1700000000,
      longitude: -122.4,
      latitude: 37.78,
      baroAltitude: 10000,
      onGround: false,
      velocity: 250,
      trueTrack: 90,
      verticalRate: 0,
      sensors: null,
      geoAltitude: 10050,
      squawk: '1200',
      spi: false,
      positionSource: 0,
      category: 1,
    })

    const raw = { test: true }
    const result = openSkyToFlightPosition(state, raw)

    expect(result).not.toBeNull()
    expect(result!._tag).toBe('FlightPositionInput')
    expect(result!.icao24).toBe('abc123')
    expect(result!.source).toBe('opensky')
    expect(result!.longitude).toBe(-122.4)
    expect(result!.latitude).toBe(37.78)
    expect(Option.getOrNull(result!.altitudeM)).toBe(10000) // baroAltitude preferred
    expect(Option.getOrNull(result!.headingDeg)).toBe(90)
    expect(Option.getOrNull(result!.velocityMps)).toBe(250)
    expect(Option.getOrNull(result!.verticalRate)).toBe(0)
    expect(Option.getOrNull(result!.onGround)).toBe(false)
    expect(Option.getOrNull(result!.callsign)).toBe('UAL123')
    expect(Option.getOrNull(result!.squawk)).toBe('1200')
    expect(Option.getOrNull(result!.originCountry)).toBe('United States')
    expect(result!.raw).toEqual({ test: true })
  })

  it('uses geoAltitude when baroAltitude is null', () => {
    const state = new OpenSkyStateVector({
      icao24: 'abc123' as Icao24,
      callsign: null,
      originCountry: 'Germany',
      timePosition: 1700000000,
      lastContact: 1700000000,
      longitude: 10.0,
      latitude: 50.0,
      baroAltitude: null,
      onGround: false,
      velocity: 200,
      trueTrack: 180,
      verticalRate: -5,
      sensors: null,
      geoAltitude: 9500, // Fallback
      squawk: null,
      spi: false,
      positionSource: 0,
      category: 2,
    })

    const result = openSkyToFlightPosition(state, {})

    expect(result).not.toBeNull()
    expect(Option.getOrNull(result!.altitudeM)).toBe(9500)
  })

  it('returns null for state with null longitude', () => {
    const state = new OpenSkyStateVector({
      icao24: 'abc123' as Icao24,
      callsign: null,
      originCountry: 'France',
      timePosition: 1700000000,
      lastContact: 1700000000,
      longitude: null, // Invalid
      latitude: 48.0,
      baroAltitude: 8000,
      onGround: false,
      velocity: 150,
      trueTrack: 270,
      verticalRate: 0,
      sensors: null,
      geoAltitude: null,
      squawk: null,
      spi: false,
      positionSource: 0,
      category: 0,
    })

    const result = openSkyToFlightPosition(state, {})

    expect(result).toBeNull()
  })

  it('returns null for state with null latitude', () => {
    const state = new OpenSkyStateVector({
      icao24: 'def456' as Icao24,
      callsign: 'DLH456',
      originCountry: 'Germany',
      timePosition: 1700000000,
      lastContact: 1700000000,
      longitude: 10.0,
      latitude: null, // Invalid
      baroAltitude: 9000,
      onGround: false,
      velocity: 180,
      trueTrack: 45,
      verticalRate: 10,
      sensors: null,
      geoAltitude: null,
      squawk: '7500',
      spi: false,
      positionSource: 0,
      category: 3,
    })

    const result = openSkyToFlightPosition(state, {})

    expect(result).toBeNull()
  })

  it('handles state with many null optional fields', () => {
    const state = new OpenSkyStateVector({
      icao24: 'fed987' as Icao24,
      callsign: null,
      originCountry: 'Unknown',
      timePosition: null,
      lastContact: 1700000000,
      longitude: -100.0,
      latitude: 40.0,
      baroAltitude: null,
      onGround: true,
      velocity: null,
      trueTrack: null,
      verticalRate: null,
      sensors: null,
      geoAltitude: null,
      squawk: null,
      spi: false,
      positionSource: 0,
      category: undefined,
    })

    const result = openSkyToFlightPosition(state, {})

    expect(result).not.toBeNull()
    expect(result!.icao24).toBe('fed987')
    expect(result!.longitude).toBe(-100.0)
    expect(result!.latitude).toBe(40.0)
    expect(Option.isNone(result!.altitudeM)).toBe(true)
    expect(Option.isNone(result!.headingDeg)).toBe(true)
    expect(Option.isNone(result!.velocityMps)).toBe(true)
    expect(Option.getOrNull(result!.onGround)).toBe(true)
  })

  it('trims callsign whitespace', () => {
    const state = new OpenSkyStateVector({
      icao24: 'abc123' as Icao24,
      callsign: '  UAL456  ',
      originCountry: 'United States',
      timePosition: 1700000000,
      lastContact: 1700000000,
      longitude: -122.0,
      latitude: 37.0,
      baroAltitude: 5000,
      onGround: false,
      velocity: 100,
      trueTrack: 0,
      verticalRate: 5,
      sensors: null,
      geoAltitude: null,
      squawk: null,
      spi: false,
      positionSource: 0,
      category: 1,
    })

    const result = openSkyToFlightPosition(state, {})

    expect(result).not.toBeNull()
    expect(Option.getOrNull(result!.callsign)).toBe('UAL456')
  })

  it('normalizes icao24 to lowercase', () => {
    const state = new OpenSkyStateVector({
      icao24: 'ABC123' as Icao24,
      callsign: null,
      originCountry: 'UK',
      timePosition: 1700000000,
      lastContact: 1700000000,
      longitude: -0.1,
      latitude: 51.5,
      baroAltitude: 7000,
      onGround: false,
      velocity: 220,
      trueTrack: 120,
      verticalRate: -2,
      sensors: null,
      geoAltitude: null,
      squawk: null,
      spi: false,
      positionSource: 0,
      category: 2,
    })

    const result = openSkyToFlightPosition(state, {})

    expect(result).not.toBeNull()
    expect(result!.icao24).toBe('abc123')
  })
})

// =============================================================================
// ADSB.lol Transformation Tests
// =============================================================================

describe('adsbLolToFlightPosition', () => {
  it('transforms valid AdsbLolAircraft to FlightPositionInput', () => {
    const aircraft = new AdsbLolAircraft({
      hex: 'abc123',
      flight: 'AAL789',
      lat: 34.05,
      lon: -118.24,
      altitudeFt: 35000,
      groundSpeedKts: 450,
      trackDeg: 270,
      verticalRateFpm: -500,
      squawk: '4567',
      category: 'A3',
      onGround: false,
      seenSec: 2,
    })

    const raw = { raw: 'data' }
    const result = adsbLolToFlightPosition(aircraft, raw)

    expect(result).not.toBeNull()
    expect(result!._tag).toBe('FlightPositionInput')
    expect(result!.icao24).toBe('abc123')
    expect(result!.source).toBe('adsb-lol')
    expect(result!.longitude).toBe(-118.24)
    expect(result!.latitude).toBe(34.05)

    // Verify unit conversions
    const altitudeM = Option.getOrNull(result!.altitudeM)
    expect(altitudeM).toBeCloseTo(35000 * 0.3048, 1) // feet to meters

    const velocityMps = Option.getOrNull(result!.velocityMps)
    expect(velocityMps).toBeCloseTo(450 * 0.514444, 1) // knots to m/s

    const verticalRate = Option.getOrNull(result!.verticalRate)
    expect(verticalRate).toBeCloseTo(-500 * 0.00508, 3) // fpm to m/s

    expect(Option.getOrNull(result!.headingDeg)).toBe(270)
    expect(Option.getOrNull(result!.onGround)).toBe(false)
    expect(Option.getOrNull(result!.callsign)).toBe('AAL789')
    expect(Option.getOrNull(result!.squawk)).toBe('4567')
    expect(Option.getOrNull(result!.category)).toBe('A3')
    expect(Option.isNone(result!.originCountry)).toBe(true) // ADSB.lol doesn't provide
  })

  it('strips MLAT tilde prefix from hex', () => {
    const aircraft = new AdsbLolAircraft({
      hex: '~abc123', // MLAT prefix
      flight: undefined,
      lat: 40.0,
      lon: -74.0,
      altitudeFt: 10000,
      groundSpeedKts: 250,
      trackDeg: 90,
      verticalRateFpm: 0,
      squawk: undefined,
      category: undefined,
      onGround: false,
      seenSec: 1,
    })

    const result = adsbLolToFlightPosition(aircraft, {})

    expect(result).not.toBeNull()
    expect(result!.icao24).toBe('abc123') // Tilde stripped
  })

  it('normalizes hex to lowercase', () => {
    const aircraft = new AdsbLolAircraft({
      hex: 'ABC123',
      flight: undefined,
      lat: 50.0,
      lon: 8.0,
      altitudeFt: 15000,
      groundSpeedKts: 300,
      trackDeg: 180,
      verticalRateFpm: 500,
      squawk: undefined,
      category: undefined,
      onGround: false,
      seenSec: 0,
    })

    const result = adsbLolToFlightPosition(aircraft, {})

    expect(result).not.toBeNull()
    expect(result!.icao24).toBe('abc123')
  })

  it('returns null for aircraft without lat', () => {
    const aircraft = new AdsbLolAircraft({
      hex: 'def456',
      flight: 'SWA123',
      lat: undefined, // Missing
      lon: -95.0,
      altitudeFt: 20000,
      groundSpeedKts: 350,
      trackDeg: 45,
      verticalRateFpm: 1000,
      squawk: '7700',
      category: 'B2',
      onGround: false,
      seenSec: 5,
    })

    const result = adsbLolToFlightPosition(aircraft, {})

    expect(result).toBeNull()
  })

  it('returns null for aircraft without lon', () => {
    const aircraft = new AdsbLolAircraft({
      hex: 'def456',
      flight: 'SWA123',
      lat: 30.0,
      lon: undefined, // Missing
      altitudeFt: 20000,
      groundSpeedKts: 350,
      trackDeg: 45,
      verticalRateFpm: 1000,
      squawk: '7700',
      category: 'B2',
      onGround: false,
      seenSec: 5,
    })

    const result = adsbLolToFlightPosition(aircraft, {})

    expect(result).toBeNull()
  })

  it('returns null for invalid ICAO24 (wrong length)', () => {
    const aircraft = new AdsbLolAircraft({
      hex: 'ab12', // Too short
      flight: undefined,
      lat: 35.0,
      lon: -80.0,
      altitudeFt: 5000,
      groundSpeedKts: 150,
      trackDeg: 0,
      verticalRateFpm: 0,
      squawk: undefined,
      category: undefined,
      onGround: true,
      seenSec: 0,
    })

    const result = adsbLolToFlightPosition(aircraft, {})

    expect(result).toBeNull()
  })

  it('returns null for invalid ICAO24 (non-hex characters)', () => {
    const aircraft = new AdsbLolAircraft({
      hex: 'ghijkl', // Not hex
      flight: undefined,
      lat: 35.0,
      lon: -80.0,
      altitudeFt: 5000,
      groundSpeedKts: 150,
      trackDeg: 0,
      verticalRateFpm: 0,
      squawk: undefined,
      category: undefined,
      onGround: true,
      seenSec: 0,
    })

    const result = adsbLolToFlightPosition(aircraft, {})

    expect(result).toBeNull()
  })

  it('handles aircraft with minimal optional fields', () => {
    const aircraft = new AdsbLolAircraft({
      hex: 'fedcba',
      flight: undefined,
      lat: 25.0,
      lon: -110.0,
      altitudeFt: undefined,
      groundSpeedKts: undefined,
      trackDeg: undefined,
      verticalRateFpm: undefined,
      squawk: undefined,
      category: undefined,
      onGround: undefined,
      seenSec: undefined,
    })

    const result = adsbLolToFlightPosition(aircraft, {})

    expect(result).not.toBeNull()
    expect(result!.icao24).toBe('fedcba')
    expect(result!.longitude).toBe(-110.0)
    expect(result!.latitude).toBe(25.0)
    expect(Option.isNone(result!.altitudeM)).toBe(true)
    expect(Option.isNone(result!.velocityMps)).toBe(true)
    expect(Option.isNone(result!.headingDeg)).toBe(true)
    expect(Option.isNone(result!.verticalRate)).toBe(true)
    expect(Option.isNone(result!.onGround)).toBe(true)
    expect(Option.isNone(result!.callsign)).toBe(true)
  })

  it('trims flight callsign whitespace', () => {
    const aircraft = new AdsbLolAircraft({
      hex: 'abc123',
      flight: '  JBU456  ',
      lat: 40.0,
      lon: -73.0,
      altitudeFt: 8000,
      groundSpeedKts: 200,
      trackDeg: 60,
      verticalRateFpm: -200,
      squawk: '1234',
      category: 'A1',
      onGround: false,
      seenSec: 3,
    })

    const result = adsbLolToFlightPosition(aircraft, {})

    expect(result).not.toBeNull()
    expect(Option.getOrNull(result!.callsign)).toBe('JBU456')
  })
})

// =============================================================================
// Configuration Tests
// =============================================================================

describe('DEFAULT_INGESTION_REGIONS', () => {
  it('includes continental US region', () => {
    // Using static import now

    const usRegion = DEFAULT_INGESTION_REGIONS.find(
      (r: { name: string }) => r.name === 'continental-us'
    )

    expect(usRegion).toBeDefined()
    expect(usRegion.bounds).toEqual([-125, 24, -66, 50])
    expect(usRegion.openSky).toBe(true)
    expect(usRegion.adsbLol).toBe(true)
  })

  it('includes Europe region', () => {
    // Using static import now

    const europeRegion = DEFAULT_INGESTION_REGIONS.find(
      (r: { name: string }) => r.name === 'europe'
    )

    expect(europeRegion).toBeDefined()
    expect(europeRegion.bounds).toEqual([-10, 35, 40, 60])
    expect(europeRegion.openSky).toBe(true)
    expect(europeRegion.adsbLol).toBe(true)
  })
})

describe('DEFAULT_FLIGHT_INGESTER_CONFIG', () => {
  it('has correct default values', () => {
    // Using static import now

    expect(DEFAULT_FLIGHT_INGESTER_CONFIG.openSkyIntervalMs).toBe(6000)
    expect(DEFAULT_FLIGHT_INGESTER_CONFIG.adsbLolIntervalMs).toBe(1000)
    expect(DEFAULT_FLIGHT_INGESTER_CONFIG.adsbLolRadiusNm).toBe(150)
    expect(DEFAULT_FLIGHT_INGESTER_CONFIG.logIngestion).toBe(true)
    expect(DEFAULT_FLIGHT_INGESTER_CONFIG.regions.length).toBe(2)
  })
})
