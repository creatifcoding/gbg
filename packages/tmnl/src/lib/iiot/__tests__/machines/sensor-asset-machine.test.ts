/**
 * SensorAssetMachine Integration Tests
 *
 * Tests the Machine + StateService + Graph validation integration.
 * Verifies ISA-95 sensor asset lifecycle state transitions are enforced.
 *
 * @module
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { Machine } from '@effect/experimental'
import {
  makeSensorAssetMachine,
  InternalCreateSensor,
  InternalGetSensor,
  InternalStartCalibration,
  InternalCompleteCalibration,
  InternalFailCalibration,
  InternalFlagForCalibration,
  InternalSensorMarkFaulted,
  InternalSensorClearFault,
  InternalTakeOffline,
  InternalBringOnline,
  InternalSensorDecommission,
} from '../../machines/SensorAssetMachine'
import { SensorAssetStateInMemory, SensorAssetState } from '../../state/SensorAssetState'
import {
  IIoTFeatureFlagsDisabledLayer,
  IIoTFeatureFlags,
} from '../../infrastructure/feature-flags'
import type { CreateSensorParams } from '../../schemas/assets/sensor'
import type { MachineId } from '../../schemas/identifiers'

// =============================================================================
// Test Helpers
// =============================================================================

const createTestSensorParams = (overrides?: Partial<{
  slug: string
  name: string
  sensorType: string
  unit: string
}>): CreateSensorParams => ({
  slug: (overrides?.slug ?? 'test-sensor-001') as CreateSensorParams['slug'],
  name: (overrides?.name ?? 'Test Sensor') as CreateSensorParams['name'],
  machineId: 'MCH-test-machine' as MachineId,
  sensorType: (overrides?.sensorType ?? 'temperature') as CreateSensorParams['sensorType'],
  unit: (overrides?.unit ?? 'celsius') as CreateSensorParams['unit'],
  status: 'active',
})

// =============================================================================
// Tests
// =============================================================================

describe('SensorAssetMachine', () => {
  describe('CREATE procedure', () => {
    it.effect('creates a sensor and returns it with initial state', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const result = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams() })
        )

        expect(result.name).toBe('Test Sensor')
        expect(result.sensorType).toBe('temperature')
        expect(result.unit).toBe('celsius')
        expect(result.id).toBeDefined()
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('GET procedure', () => {
    it.effect('retrieves a created sensor', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams() })
        )

        const fetched = yield* actor.send(
          new InternalGetSensor({ sensorId: created.id })
        )

        expect(fetched.id).toBe(created.id)
        expect(fetched.name).toBe(created.name)
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails with MachineSensorNotFoundError for non-existent sensor', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const result = yield* actor.send(
          new InternalGetSensor({ sensorId: 'SNS-non-existent' })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineSensorNotFoundError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('START CALIBRATION procedure (active|needs_calibration -> calibrating)', () => {
    it.effect('starts calibration for an active sensor', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams() })
        )

        const calibrating = yield* actor.send(
          new InternalStartCalibration({ sensorId: created.id })
        )

        expect(calibrating.status).toBe('calibrating')
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('COMPLETE CALIBRATION procedure (calibrating -> active)', () => {
    it.effect('completes calibration and returns to active', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams() })
        )
        yield* actor.send(new InternalStartCalibration({ sensorId: created.id }))

        const completed = yield* actor.send(
          new InternalCompleteCalibration({ sensorId: created.id })
        )

        expect(completed.status).toBe('active')
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('FAIL CALIBRATION procedure (calibrating -> faulted)', () => {
    it.effect('fails calibration and marks sensor as faulted', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams() })
        )
        yield* actor.send(new InternalStartCalibration({ sensorId: created.id }))

        const faulted = yield* actor.send(
          new InternalFailCalibration({ sensorId: created.id })
        )

        expect(faulted.status).toBe('faulted')
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('FLAG FOR CALIBRATION procedure (active -> needs_calibration)', () => {
    it.effect('flags an active sensor for calibration', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams() })
        )

        const flagged = yield* actor.send(
          new InternalFlagForCalibration({ sensorId: created.id })
        )

        expect(flagged.status).toBe('needs_calibration')
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('MARK FAULTED procedure (active -> faulted)', () => {
    it.effect('marks an active sensor as faulted', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams() })
        )

        const faulted = yield* actor.send(
          new InternalSensorMarkFaulted({ sensorId: created.id })
        )

        expect(faulted.status).toBe('faulted')
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('CLEAR FAULT procedure (faulted -> active)', () => {
    it.effect('clears a fault and returns to active', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams() })
        )
        yield* actor.send(new InternalSensorMarkFaulted({ sensorId: created.id }))

        const cleared = yield* actor.send(
          new InternalSensorClearFault({ sensorId: created.id })
        )

        expect(cleared.status).toBe('active')
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('TAKE OFFLINE procedure (faulted|active -> offline)', () => {
    it.effect('takes a faulted sensor offline', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams() })
        )
        yield* actor.send(new InternalSensorMarkFaulted({ sensorId: created.id }))

        const offline = yield* actor.send(
          new InternalTakeOffline({ sensorId: created.id })
        )

        expect(offline.status).toBe('offline')
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('BRING ONLINE procedure (offline -> active)', () => {
    it.effect('brings an offline sensor back online (active)', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams() })
        )
        yield* actor.send(new InternalSensorMarkFaulted({ sensorId: created.id }))
        yield* actor.send(new InternalTakeOffline({ sensorId: created.id }))

        const online = yield* actor.send(
          new InternalBringOnline({ sensorId: created.id })
        )

        expect(online.status).toBe('active')
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('DECOMMISSION procedure (offline|faulted -> decommissioned)', () => {
    it.effect('decommissions an offline sensor', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams() })
        )
        yield* actor.send(new InternalSensorMarkFaulted({ sensorId: created.id }))
        yield* actor.send(new InternalTakeOffline({ sensorId: created.id }))

        const decommissioned = yield* actor.send(
          new InternalSensorDecommission({ sensorId: created.id })
        )

        expect(decommissioned.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('Invalid transitions', () => {
    it.effect('fails when trying to transition from decommissioned', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams() })
        )
        yield* actor.send(new InternalSensorMarkFaulted({ sensorId: created.id }))
        yield* actor.send(new InternalTakeOffline({ sensorId: created.id }))
        yield* actor.send(new InternalSensorDecommission({ sensorId: created.id }))

        // Cannot bring online from decommissioned
        const result = yield* actor.send(
          new InternalBringOnline({ sensorId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineSensorInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when trying to take calibrating sensor offline (no direct)', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams() })
        )
        yield* actor.send(new InternalStartCalibration({ sensorId: created.id }))

        // Cannot take offline from calibrating
        const result = yield* actor.send(
          new InternalTakeOffline({ sensorId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineSensorInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('ISA-95 full lifecycle flow', () => {
    it.effect('completes full lifecycle: active -> calibrating -> active -> needs_calibration -> calibrating -> faulted -> offline -> decommissioned', () =>
      Effect.gen(function* () {
        const state = yield* SensorAssetState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSensorAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        // Create (active)
        const created = yield* actor.send(
          new InternalCreateSensor({ params: createTestSensorParams() })
        )
        expect(created.status).toBe('active')

        // Start calibration
        const calibrating1 = yield* actor.send(
          new InternalStartCalibration({ sensorId: created.id })
        )
        expect(calibrating1.status).toBe('calibrating')

        // Complete calibration
        const active1 = yield* actor.send(
          new InternalCompleteCalibration({ sensorId: created.id })
        )
        expect(active1.status).toBe('active')

        // Flag for calibration
        const needsCal = yield* actor.send(
          new InternalFlagForCalibration({ sensorId: created.id })
        )
        expect(needsCal.status).toBe('needs_calibration')

        // Start calibration again (from needs_calibration)
        const calibrating2 = yield* actor.send(
          new InternalStartCalibration({ sensorId: created.id })
        )
        expect(calibrating2.status).toBe('calibrating')

        // Fail calibration (goes to faulted)
        const faulted = yield* actor.send(
          new InternalFailCalibration({ sensorId: created.id })
        )
        expect(faulted.status).toBe('faulted')

        // Take offline
        const offline = yield* actor.send(
          new InternalTakeOffline({ sensorId: created.id })
        )
        expect(offline.status).toBe('offline')

        // Decommission
        const decommissioned = yield* actor.send(
          new InternalSensorDecommission({ sensorId: created.id })
        )
        expect(decommissioned.status).toBe('decommissioned')

        // Verify final state via GET
        const final = yield* actor.send(
          new InternalGetSensor({ sensorId: created.id })
        )
        expect(final.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(SensorAssetStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })
})
