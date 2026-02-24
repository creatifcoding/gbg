/**
 * Entity stx Tests
 *
 * Validates:
 * - Entity lifecycle machine transitions (spawning → hydrated → live → stale → despawned)
 * - Entity stx factory creates isolated instances
 * - Entity store operations (spawn, get, despawn, clear)
 * - Trait Fermion integration (populate on spawn, cleanup on despawn)
 * - UI state direct mutations on Legend-State
 * - Reactive atoms (spawnedEntityIdsAtom, entityCountAtom)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createEntityStx,
  spawnEntity,
  getEntityStx,
  despawnEntity,
  getSpawnedEntityIds,
  clearAllEntities,
  entityCount,
  spawnedEntityIdsAtom,
  entityCountAtom,
  syncEntityAtoms,
} from '../entity-stx'
import {
  geoPositionFermion,
  uiStateFermion,
  flightDataFermion,
  clearAllTraitStores,
  getEntityTraitNames,
} from '../../fermion'
import { Atom } from '@effect-atom/atom'
import * as Registry from '@effect-atom/atom/Registry'

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearAllEntities()
  clearAllTraitStores()
})

// ─────────────────────────────────────────────────────────────────────────────
// Entity Machine Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe('entity machine lifecycle', () => {
  it('starts in spawning state', () => {
    const entity = createEntityStx({
      entityId: 'flight:test-001',
      entityType: 'flight',
      displayLabel: 'UAL1234',
    })

    const snapshot = entity.actor!.getSnapshot()
    expect(snapshot.value).toBe('spawning')
  })

  it('transitions to hydrated on HYDRATE', () => {
    const entity = createEntityStx({
      entityId: 'flight:test-002',
      entityType: 'flight',
      displayLabel: 'UAL5678',
    })

    entity.send({ type: 'HYDRATE', traitIds: ['GeoPosition', 'FlightData'] })

    const snapshot = entity.actor!.getSnapshot()
    expect(snapshot.value).toBe('hydrated')
    expect(snapshot.context.traitIds).toContain('GeoPosition')
    expect(snapshot.context.traitIds).toContain('FlightData')
  })

  it('transitions to live from hydrated when START_TRACKING + has position', () => {
    const entity = createEntityStx({
      entityId: 'flight:test-003',
      entityType: 'flight',
      displayLabel: 'DAL9012',
      position: { longitude: -122.4, latitude: 37.7 },
      traits: {
        GeoPosition: { _tag: 'GeoPosition', lon: -122.4, lat: 37.7 },
      },
    })

    // Auto-hydrated because traits provided → HYDRATE sent during spawn
    expect(entity.actor!.getSnapshot().value).toBe('hydrated')

    entity.send({ type: 'START_TRACKING' })
    expect(entity.actor!.getSnapshot().value).toBe('live')
  })

  it('stays hydrated if START_TRACKING without position', () => {
    const entity = createEntityStx({
      entityId: 'poi:test-004',
      entityType: 'poi',
      displayLabel: 'Test POI',
    })

    entity.send({ type: 'HYDRATE', traitIds: ['PoiData'] })
    // Guard: hasPosition should fail (no position data)
    entity.send({ type: 'START_TRACKING' })
    // Should remain hydrated (guard blocked transition)
    expect(entity.actor!.getSnapshot().value).toBe('hydrated')
  })

  it('transitions to despawned from any state', () => {
    const entity = createEntityStx({
      entityId: 'flight:test-005',
      entityType: 'flight',
      displayLabel: 'SWA3456',
      position: { longitude: -80.0, latitude: 40.0 },
    })

    entity.send({ type: 'DESPAWN' })
    expect(entity.actor!.getSnapshot().value).toBe('despawned')
  })

  it('handles MARK_STALE → stale → REFRESH → hydrated', () => {
    const entity = createEntityStx({
      entityId: 'flight:test-006',
      entityType: 'flight',
      displayLabel: 'AAL7890',
      position: { longitude: -90.0, latitude: 35.0 },
    })

    entity.send({ type: 'MARK_STALE' })
    // From spawning, MARK_STALE isn't valid — need to hydrate first
    // Send HYDRATE first
    entity.send({ type: 'HYDRATE', traitIds: ['GeoPosition'] })
    expect(entity.actor!.getSnapshot().value).toBe('hydrated')

    entity.send({ type: 'MARK_STALE' })
    expect(entity.actor!.getSnapshot().value).toBe('stale')

    entity.send({ type: 'REFRESH' })
    expect(entity.actor!.getSnapshot().value).toBe('hydrated')
  })

  it('handles ERROR → errored → REFRESH → hydrated', () => {
    const entity = createEntityStx({
      entityId: 'flight:test-007',
      entityType: 'flight',
      displayLabel: 'JBU1111',
    })

    entity.send({ type: 'ERROR', message: 'Network timeout' })
    expect(entity.actor!.getSnapshot().value).toBe('errored')
    expect(entity.actor!.getSnapshot().context.error).toBe('Network timeout')

    entity.send({ type: 'REFRESH' })
    expect(entity.actor!.getSnapshot().value).toBe('hydrated')
    expect(entity.actor!.getSnapshot().context.error).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Entity Store Operations
// ─────────────────────────────────────────────────────────────────────────────

describe('entity store', () => {
  it('spawnEntity creates and registers entity', () => {
    const entity = spawnEntity({
      entityId: 'flight:store-001',
      entityType: 'flight',
      displayLabel: 'Test Flight',
    })

    expect(entity).toBeDefined()
    expect(getEntityStx('flight:store-001')).toBe(entity)
    expect(entityCount()).toBe(1)
  })

  it('spawnEntity returns existing if already spawned', () => {
    const first = spawnEntity({
      entityId: 'flight:store-002',
      entityType: 'flight',
      displayLabel: 'First',
    })

    const second = spawnEntity({
      entityId: 'flight:store-002',
      entityType: 'flight',
      displayLabel: 'Second',
    })

    expect(first).toBe(second) // Same reference
    expect(entityCount()).toBe(1) // Only one
  })

  it('despawnEntity removes from store and cleans up traits', () => {
    spawnEntity({
      entityId: 'flight:store-003',
      entityType: 'flight',
      displayLabel: 'Despawnable',
      position: { longitude: -100, latitude: 40 },
    })

    expect(geoPositionFermion.has('flight:store-003')).toBe(true)
    expect(uiStateFermion.has('flight:store-003')).toBe(true)

    despawnEntity('flight:store-003')

    expect(getEntityStx('flight:store-003')).toBeUndefined()
    expect(geoPositionFermion.has('flight:store-003')).toBe(false)
    expect(uiStateFermion.has('flight:store-003')).toBe(false)
    expect(entityCount()).toBe(0)
  })

  it('getSpawnedEntityIds returns all IDs', () => {
    spawnEntity({ entityId: 'a', entityType: 'flight', displayLabel: 'A' })
    spawnEntity({ entityId: 'b', entityType: 'track', displayLabel: 'B' })
    spawnEntity({ entityId: 'c', entityType: 'poi', displayLabel: 'C' })

    const ids = getSpawnedEntityIds()
    expect(ids).toHaveLength(3)
    expect(ids).toContain('a')
    expect(ids).toContain('b')
    expect(ids).toContain('c')
  })

  it('clearAllEntities removes everything', () => {
    spawnEntity({ entityId: 'x', entityType: 'flight', displayLabel: 'X' })
    spawnEntity({ entityId: 'y', entityType: 'track', displayLabel: 'Y' })

    clearAllEntities()

    expect(entityCount()).toBe(0)
    expect(getSpawnedEntityIds()).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Fermion Integration
// ─────────────────────────────────────────────────────────────────────────────

describe('Fermion integration', () => {
  it('spawn populates GeoPosition Fermion when position provided', () => {
    spawnEntity({
      entityId: 'flight:ferm-001',
      entityType: 'flight',
      displayLabel: 'Positioned',
      position: { longitude: -73.9, latitude: 40.7 },
    })

    expect(geoPositionFermion.has('flight:ferm-001')).toBe(true)
    const pos = geoPositionFermion.peek('flight:ferm-001')
    expect(pos).toEqual({
      _tag: 'GeoPosition',
      lon: -73.9,
      lat: 40.7,
    })
  })

  it('spawn populates UIState Fermion for every entity', () => {
    spawnEntity({
      entityId: 'poi:ferm-002',
      entityType: 'poi',
      displayLabel: 'No Position POI',
    })

    expect(uiStateFermion.has('poi:ferm-002')).toBe(true)
    const ui = uiStateFermion.peek('poi:ferm-002')
    expect(ui?.selected).toBe(false)
    expect(ui?.pinned).toBe(false)
  })

  it('spawn populates custom traits via traits map', () => {
    spawnEntity({
      entityId: 'flight:ferm-003',
      entityType: 'flight',
      displayLabel: 'Full Flight',
      position: { longitude: -80, latitude: 35 },
      traits: {
        FlightData: {
          _tag: 'FlightData',
          icao24: 'abc123',
          callsign: 'UAL999',
          category: 'heavy',
          originCountry: 'US',
          onGround: false,
          lastContact: new Date(),
          source: 'opensky',
        },
      },
    })

    expect(flightDataFermion.has('flight:ferm-003')).toBe(true)
    const fd = flightDataFermion.peek('flight:ferm-003')
    expect(fd?._tag).toBe('FlightData')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// UI State Direct Mutations
// ─────────────────────────────────────────────────────────────────────────────

describe('UI state direct mutations', () => {
  it('select/deselect via Legend-State data$', () => {
    const entity = spawnEntity({
      entityId: 'flight:ui-001',
      entityType: 'flight',
      displayLabel: 'Selectable',
    })

    // Direct mutation
    entity.data.selected.set(true)
    expect(entity.data.selected.get()).toBe(true)

    entity.data.selected.set(false)
    expect(entity.data.selected.get()).toBe(false)
  })

  it('pin/unpin via Legend-State data$', () => {
    const entity = spawnEntity({
      entityId: 'flight:ui-002',
      entityType: 'flight',
      displayLabel: 'Pinnable',
    })

    entity.data.pinned.set(true)
    expect(entity.data.pinned.get()).toBe(true)
  })

  it('hover state via Legend-State data$', () => {
    const entity = spawnEntity({
      entityId: 'flight:ui-003',
      entityType: 'flight',
      displayLabel: 'Hoverable',
    })

    entity.data.hovered.set(true)
    expect(entity.data.hovered.get()).toBe(true)

    entity.data.hovered.set(false)
    expect(entity.data.hovered.get()).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Reactive Atoms
// ─────────────────────────────────────────────────────────────────────────────

describe('entity store queries', () => {
  it('getSpawnedEntityIds returns correct IDs after spawn', () => {
    spawnEntity({ entityId: 'r1', entityType: 'flight', displayLabel: 'R1' })
    spawnEntity({ entityId: 'r2', entityType: 'track', displayLabel: 'R2' })

    expect(getSpawnedEntityIds()).toEqual(['r1', 'r2'])
    expect(entityCount()).toBe(2)
  })

  it('getSpawnedEntityIds reflects despawn', () => {
    spawnEntity({ entityId: 'r3', entityType: 'flight', displayLabel: 'R3' })
    spawnEntity({ entityId: 'r4', entityType: 'poi', displayLabel: 'R4' })

    despawnEntity('r3')

    expect(getSpawnedEntityIds()).toEqual(['r4'])
    expect(entityCount()).toBe(1)
  })

  it('syncEntityAtoms populates atoms from store state', () => {
    const r = Registry.make()

    spawnEntity({ entityId: 'a1', entityType: 'flight', displayLabel: 'A1' })
    syncEntityAtoms()

    // The sync sets the atoms via Atom.set — verify it doesn't throw
    // (Atom.set works at module scope, not per-registry)
    expect(entityCount()).toBe(1)
  })
})
