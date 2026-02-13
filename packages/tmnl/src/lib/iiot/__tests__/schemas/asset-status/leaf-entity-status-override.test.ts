/**
 * Leaf Entity Status Override Tests
 *
 * Validates that Machine, Device, and Sensor each define their own status
 * literal matching their domain state-graph, overriding the generic AssetStatus.
 *
 * TDD: These tests are written BEFORE implementation changes.
 *
 * @module @gbg/tmnl/iiot/__tests__/schemas/asset-status/leaf-entity-status-override
 */

import { describe, it, expect } from '@effect/vitest'
import { Effect, Schema, DateTime, Option } from 'effect'

// -- Machine imports --
import {
  Machine,
  MachineId,
  makeMachineId,
  CreateMachineParams,
} from '../../../schemas/assets/machine/schema'
import type { MachineStatus } from '../../../schemas/assets/machine/schema'

// -- Device imports --
import {
  Device,
  DeviceId,
  makeDeviceId,
  CreateDeviceParams,
} from '../../../schemas/assets/device/schema'
import type { DeviceStatus } from '../../../schemas/assets/device/schema'

// -- Sensor imports --
import {
  Sensor,
  SensorId,
  makeSensorId,
  CreateSensorParams,
} from '../../../schemas/assets/sensor/schema'
import type { SensorStatus } from '../../../schemas/assets/sensor/schema'

// -- Shared helpers --
import { HierarchyPath, PathSegment } from '../../../schemas/hierarchy'
import { PlantId, LineId, EnterpriseId, SiteId } from '../../../schemas/identifiers'

const now = DateTime.unsafeNow()

const makeHierarchyPath = (segments: Array<{ level: string; id: string }>) =>
  HierarchyPath.fromSegments(
    segments.map(
      (s) => new PathSegment({ level: s.level as any, id: s.id, name: Option.none() })
    )
  )

// =============================================================================
// MACHINE STATUS TESTS
// =============================================================================

describe('MachineStatus override', () => {
  const MACHINE_GRAPH_STATES = [
    'commissioned',
    'operational',
    'idle',
    'faulted',
    'scheduled_maintenance',
    'unscheduled_maintenance',
    'retired',
    'decommissioned',
  ] as const

  const machinePath = makeHierarchyPath([
    { level: 'enterprise', id: 'ENT-test' },
    { level: 'site', id: 'SIT-test' },
    { level: 'plant', id: 'PLT-test' },
    { level: 'line', id: 'LIN-test' },
    { level: 'machine', id: 'MCH-test' },
  ])

  const makeMachine = (status: string) =>
    new Machine({
      id: makeMachineId('test-machine'),
      name: 'Test Machine' as any,
      status: status as any,
      hierarchyPath: machinePath,
      machineType: 'CNC Lathe',
      enterpriseId: 'ENT-test' as EnterpriseId,
      siteId: 'SIT-test' as SiteId,
      plantId: 'PLT-test' as PlantId,
      lineId: 'LIN-test' as LineId,
      workCellId: Option.none(),
      manufacturer: Option.none(),
      modelNumber: Option.none(),
      serialNumber: Option.none(),
      installationDate: Option.none(),
      lastMaintenanceDate: Option.none(),
      nextMaintenanceDate: Option.none(),
      description: Option.none(),
      location: Option.none(),
      createdAt: now,
      updatedAt: Option.none(),
      metadata: {},
      areaId: Option.none(),
      machineId: Option.none(),
    })

  describe('Schema literal accepts graph states', () => {
    for (const state of MACHINE_GRAPH_STATES) {
      it(`accepts '${state}'`, () => {
        const machine = makeMachine(state)
        expect(machine.status).toBe(state)
      })
    }
  })

  describe('Schema literal rejects old generic states', () => {
    it.effect('rejects "active" (not a machine graph state)', () =>
      Effect.gen(function* () {
        const MachineStatusSchema = Schema.Literal(...MACHINE_GRAPH_STATES)
        const result = yield* Schema.decodeUnknown(MachineStatusSchema)('active').pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )

    it.effect('rejects "inactive" (not a machine graph state)', () =>
      Effect.gen(function* () {
        const MachineStatusSchema = Schema.Literal(...MACHINE_GRAPH_STATES)
        const result = yield* Schema.decodeUnknown(MachineStatusSchema)('inactive').pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  })

  describe('isOperational uses domain states', () => {
    it('returns true for "operational"', () => {
      expect(makeMachine('operational').isOperational()).toBe(true)
    })

    it('returns true for "idle"', () => {
      expect(makeMachine('idle').isOperational()).toBe(true)
    })

    it('returns false for "commissioned"', () => {
      expect(makeMachine('commissioned').isOperational()).toBe(false)
    })

    it('returns false for "faulted"', () => {
      expect(makeMachine('faulted').isOperational()).toBe(false)
    })

    it('returns false for "scheduled_maintenance"', () => {
      expect(makeMachine('scheduled_maintenance').isOperational()).toBe(false)
    })

    it('returns false for "unscheduled_maintenance"', () => {
      expect(makeMachine('unscheduled_maintenance').isOperational()).toBe(false)
    })

    it('returns false for "retired"', () => {
      expect(makeMachine('retired').isOperational()).toBe(false)
    })

    it('returns false for "decommissioned"', () => {
      expect(makeMachine('decommissioned').isOperational()).toBe(false)
    })
  })

  describe('CreateMachineParams uses MachineStatus', () => {
    it.effect('defaults status to "commissioned" (not "active")', () =>
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeUnknown(CreateMachineParams)({
          slug: 'test-machine',
          name: 'Test Machine',
          enterpriseId: 'ENT-test',
          siteId: 'SIT-test',
          plantId: 'PLT-test',
          lineId: 'LIN-test',
          machineType: 'CNC Lathe',
        })
        expect(decoded.status).toBe('commissioned')
      })
    )

    it.effect('rejects "active" as status (not a machine graph state)', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(CreateMachineParams)({
          slug: 'test-machine',
          name: 'Test Machine',
          enterpriseId: 'ENT-test',
          siteId: 'SIT-test',
          plantId: 'PLT-test',
          lineId: 'LIN-test',
          machineType: 'CNC Lathe',
          status: 'active',
        }).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  })
})

// =============================================================================
// DEVICE STATUS TESTS
// =============================================================================

describe('DeviceStatus override', () => {
  const DEVICE_GRAPH_STATES = [
    'provisioned',
    'online',
    'offline',
    'faulted',
    'firmware_update',
    'decommissioned',
  ] as const

  const devicePath = makeHierarchyPath([
    { level: 'enterprise', id: 'ENT-test' },
    { level: 'site', id: 'SIT-test' },
    { level: 'plant', id: 'PLT-test' },
    { level: 'line', id: 'LIN-test' },
    { level: 'machine', id: 'MCH-test' },
    { level: 'device', id: 'DEV-test' },
  ])

  const makeDevice = (status: string) =>
    new Device({
      id: makeDeviceId('test-device'),
      name: 'Test Device' as any,
      status: status as any,
      hierarchyPath: devicePath,
      deviceType: 'motor' as any,
      controlMode: Option.none(),
      ratedPower: Option.none(),
      powerUnit: Option.none(),
      lastCommandAt: Option.none(),
      opcUaNodeId: Option.none(),
      description: Option.none(),
      location: Option.none(),
      createdAt: now,
      updatedAt: Option.none(),
      metadata: {},
      enterpriseId: Option.none(),
      siteId: Option.none(),
      areaId: Option.none(),
      plantId: Option.none(),
      lineId: Option.none(),
      workCellId: Option.none(),
      machineId: Option.none(),
    })

  describe('Schema literal accepts graph states', () => {
    for (const state of DEVICE_GRAPH_STATES) {
      it(`accepts '${state}'`, () => {
        const device = makeDevice(state)
        expect(device.status).toBe(state)
      })
    }
  })

  describe('Schema literal rejects old generic states', () => {
    it.effect('rejects "active" (not a device graph state)', () =>
      Effect.gen(function* () {
        const DeviceStatusSchema = Schema.Literal(...DEVICE_GRAPH_STATES)
        const result = yield* Schema.decodeUnknown(DeviceStatusSchema)('active').pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )

    it.effect('rejects "inactive" (not a device graph state)', () =>
      Effect.gen(function* () {
        const DeviceStatusSchema = Schema.Literal(...DEVICE_GRAPH_STATES)
        const result = yield* Schema.decodeUnknown(DeviceStatusSchema)('inactive').pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  })

  describe('isOperational uses domain states', () => {
    it('returns true for "online"', () => {
      expect(makeDevice('online').isOperational()).toBe(true)
    })

    it('returns false for "provisioned"', () => {
      expect(makeDevice('provisioned').isOperational()).toBe(false)
    })

    it('returns false for "offline"', () => {
      expect(makeDevice('offline').isOperational()).toBe(false)
    })

    it('returns false for "faulted"', () => {
      expect(makeDevice('faulted').isOperational()).toBe(false)
    })

    it('returns false for "firmware_update"', () => {
      expect(makeDevice('firmware_update').isOperational()).toBe(false)
    })

    it('returns false for "decommissioned"', () => {
      expect(makeDevice('decommissioned').isOperational()).toBe(false)
    })
  })

  describe('CreateDeviceParams uses DeviceStatus', () => {
    it.effect('defaults status to "provisioned" (not "active")', () =>
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeUnknown(CreateDeviceParams)({
          slug: 'test-device',
          name: 'Test Device',
          machineId: 'MCH-test-machine',
          deviceType: 'motor',
        })
        expect(decoded.status).toBe('provisioned')
      })
    )

    it.effect('rejects "active" as status (not a device graph state)', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(CreateDeviceParams)({
          slug: 'test-device',
          name: 'Test Device',
          machineId: 'MCH-test-machine',
          deviceType: 'motor',
          status: 'active',
        }).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  })
})

// =============================================================================
// SENSOR STATUS TESTS
// =============================================================================

describe('SensorStatus override', () => {
  const SENSOR_GRAPH_STATES = [
    'active',
    'calibrating',
    'needs_calibration',
    'faulted',
    'offline',
    'decommissioned',
  ] as const

  const sensorPath = makeHierarchyPath([
    { level: 'enterprise', id: 'ENT-test' },
    { level: 'site', id: 'SIT-test' },
    { level: 'plant', id: 'PLT-test' },
    { level: 'line', id: 'LIN-test' },
    { level: 'machine', id: 'MCH-test' },
    { level: 'sensor', id: 'SNS-test' },
  ])

  const makeSensor = (status: string) =>
    new Sensor({
      id: makeSensorId('test-sensor'),
      name: 'Test Sensor' as any,
      status: status as any,
      hierarchyPath: sensorPath,
      sensorType: 'temperature' as any,
      unit: 'celsius' as any,
      sampleRateMs: Option.none(),
      thresholdHigh: Option.none(),
      thresholdCritical: Option.none(),
      thresholdLow: Option.none(),
      thresholdCriticalLow: Option.none(),
      lastCalibrationDate: Option.none(),
      nextCalibrationDate: Option.none(),
      opcUaNodeId: Option.none(),
      description: Option.none(),
      location: Option.none(),
      createdAt: now,
      updatedAt: Option.none(),
      metadata: {},
      enterpriseId: Option.none(),
      siteId: Option.none(),
      areaId: Option.none(),
      plantId: Option.none(),
      lineId: Option.none(),
      workCellId: Option.none(),
      machineId: Option.none(),
    })

  describe('Schema literal accepts graph states', () => {
    for (const state of SENSOR_GRAPH_STATES) {
      it(`accepts '${state}'`, () => {
        const sensor = makeSensor(state)
        expect(sensor.status).toBe(state)
      })
    }
  })

  describe('Schema literal rejects old generic states', () => {
    it.effect('rejects "inactive" (not a sensor graph state)', () =>
      Effect.gen(function* () {
        const SensorStatusSchema = Schema.Literal(...SENSOR_GRAPH_STATES)
        const result = yield* Schema.decodeUnknown(SensorStatusSchema)('inactive').pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )

    it.effect('rejects "maintenance" (not a sensor graph state)', () =>
      Effect.gen(function* () {
        const SensorStatusSchema = Schema.Literal(...SENSOR_GRAPH_STATES)
        const result = yield* Schema.decodeUnknown(SensorStatusSchema)('maintenance').pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  })

  describe('isOperational uses domain states', () => {
    it('returns true for "active"', () => {
      expect(makeSensor('active').isOperational()).toBe(true)
    })

    it('returns true for "calibrating"', () => {
      expect(makeSensor('calibrating').isOperational()).toBe(true)
    })

    it('returns true for "needs_calibration"', () => {
      expect(makeSensor('needs_calibration').isOperational()).toBe(true)
    })

    it('returns false for "faulted"', () => {
      expect(makeSensor('faulted').isOperational()).toBe(false)
    })

    it('returns false for "offline"', () => {
      expect(makeSensor('offline').isOperational()).toBe(false)
    })

    it('returns false for "decommissioned"', () => {
      expect(makeSensor('decommissioned').isOperational()).toBe(false)
    })
  })

  describe('CreateSensorParams uses SensorStatus', () => {
    it.effect('defaults status to "active"', () =>
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeUnknown(CreateSensorParams)({
          slug: 'test-sensor',
          name: 'Test Sensor',
          machineId: 'MCH-test-machine',
          sensorType: 'temperature',
          unit: 'celsius',
        })
        expect(decoded.status).toBe('active')
      })
    )

    it.effect('rejects "inactive" as status (not a sensor graph state)', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(CreateSensorParams)({
          slug: 'test-sensor',
          name: 'Test Sensor',
          machineId: 'MCH-test-machine',
          sensorType: 'temperature',
          unit: 'celsius',
          status: 'inactive',
        }).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  })
})
