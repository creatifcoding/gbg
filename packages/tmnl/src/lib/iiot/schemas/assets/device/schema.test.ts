/**
 * Device Entity Schema Tests
 *
 * ISA-95 Level 0 - Control Module (Actuator/Device)
 * Devices WRITE values (control physical equipment), unlike Sensors which READ values.
 */

import { describe, it, expect } from 'vitest'
import { DateTime, Option, Schema } from 'effect'
import {
  DeviceId,
  makeDeviceId,
  DeviceType,
  Device,
  CreateDeviceParams,
} from './schema'

// =============================================================================
// DeviceId Tests
// =============================================================================

describe('DeviceId', () => {
  it('should validate correct DEV- prefixed IDs', () => {
    const validIds = ['DEV-motor-01', 'DEV-valve-123', 'DEV-pump-main']

    for (const id of validIds) {
      const result = Schema.decodeSync(DeviceId)(id)
      expect(result).toBe(id)
    }
  })

  it('should reject IDs without DEV- prefix', () => {
    const invalidIds = ['SNS-motor-01', 'MCH-valve', 'motor-01', 'dev-lowercase']

    for (const id of invalidIds) {
      expect(() => Schema.decodeSync(DeviceId)(id)).toThrow()
    }
  })

  it('should reject empty or malformed slugs', () => {
    const invalidIds = ['DEV-', 'DEV-@invalid', 'DEV-has space']

    for (const id of invalidIds) {
      expect(() => Schema.decodeSync(DeviceId)(id)).toThrow()
    }
  })
})

describe('makeDeviceId', () => {
  it('should create DeviceId with DEV- prefix', () => {
    const id = makeDeviceId('motor-01')
    expect(id).toBe('DEV-motor-01')
  })

  it('should handle alphanumeric slugs with hyphens', () => {
    expect(makeDeviceId('pump-main-123')).toBe('DEV-pump-main-123')
    expect(makeDeviceId('valve42')).toBe('DEV-valve42')
  })
})

// =============================================================================
// DeviceType Tests
// =============================================================================

describe('DeviceType', () => {
  it('should accept all valid device types', () => {
    const validTypes = [
      'motor',
      'valve',
      'pump',
      'heater',
      'cooler',
      'conveyor',
      'actuator',
      'servo',
      'relay',
      'vfd',
      'solenoid',
      'gripper',
      'light',
      'alarm',
      'other',
    ]

    for (const type of validTypes) {
      const result = Schema.decodeSync(DeviceType)(type)
      expect(result).toBe(type)
    }
  })

  it('should reject invalid device types', () => {
    expect(() => Schema.decodeSync(DeviceType)('sensor')).toThrow()
    expect(() => Schema.decodeSync(DeviceType)('invalid')).toThrow()
  })
})

// =============================================================================
// Device Entity Tests
// =============================================================================

describe('Device', () => {
  const createValidDevice = () =>
    new Device({
      id: makeDeviceId('motor-01'),
      name: 'Main Motor' as Schema.Schema.Type<typeof Schema.NonEmptyString>,
      status: 'active',
      machineId: 'MCH-cnc-001' as Schema.Schema.Type<typeof Schema.String> & { readonly MachineId: unique symbol },
      deviceType: 'motor',
      controlMode: Option.some('auto' as const),
      ratedPower: Option.some(5000),
      powerUnit: Option.some('watts' as const),
      lastCommandAt: Option.none(),
      opcUaNodeId: Option.some('ns=2;s=Motor01.Control'),
      description: Option.some('Main spindle motor'),
      createdAt: DateTime.unsafeNow(),
      updatedAt: Option.none(),
      metadata: {},
    })

  it('should create a valid device instance', () => {
    const device = createValidDevice()

    expect(device._tag).toBe('Device')
    expect(device.id).toBe('DEV-motor-01')
    expect(device.name).toBe('Main Motor')
    expect(device.deviceType).toBe('motor')
  })

  describe('getAutomationLevel', () => {
    it('should return 0 for ISA-95 Level 0 (physical process)', () => {
      const device = createValidDevice()
      expect(device.getAutomationLevel()).toBe(0)
    })
  })

  describe('isOperational', () => {
    it('should return true only for active status', () => {
      const activeDevice = createValidDevice()
      expect(activeDevice.isOperational()).toBe(true)

      const inactiveDevice = new Device({
        ...activeDevice,
        status: 'inactive',
      })
      expect(inactiveDevice.isOperational()).toBe(false)

      const maintenanceDevice = new Device({
        ...activeDevice,
        status: 'maintenance',
      })
      expect(maintenanceDevice.isOperational()).toBe(false)

      const decommissionedDevice = new Device({
        ...activeDevice,
        status: 'decommissioned',
      })
      expect(decommissionedDevice.isOperational()).toBe(false)
    })
  })

  describe('isContainer', () => {
    it('should return false (devices are leaf nodes)', () => {
      const device = createValidDevice()
      expect(device.isContainer()).toBe(false)
    })
  })

  describe('isActuator', () => {
    it('should return true (distinguishes from Sensor)', () => {
      const device = createValidDevice()
      expect(device.isActuator()).toBe(true)
    })
  })

  it('should handle optional fields as Option', () => {
    const deviceWithNoOptionals = new Device({
      id: makeDeviceId('valve-01'),
      name: 'Simple Valve' as Schema.Schema.Type<typeof Schema.NonEmptyString>,
      status: 'active',
      machineId: 'MCH-machine-01' as Schema.Schema.Type<typeof Schema.String> & { readonly MachineId: unique symbol },
      deviceType: 'valve',
      controlMode: Option.none(),
      ratedPower: Option.none(),
      powerUnit: Option.none(),
      lastCommandAt: Option.none(),
      opcUaNodeId: Option.none(),
      description: Option.none(),
      createdAt: DateTime.unsafeNow(),
      updatedAt: Option.none(),
      metadata: {},
    })

    expect(Option.isNone(deviceWithNoOptionals.controlMode)).toBe(true)
    expect(Option.isNone(deviceWithNoOptionals.ratedPower)).toBe(true)
    expect(Option.isNone(deviceWithNoOptionals.powerUnit)).toBe(true)
  })
})

// =============================================================================
// CreateDeviceParams Tests
// =============================================================================

describe('CreateDeviceParams', () => {
  it('should validate valid create params', () => {
    const params = {
      slug: 'motor-01',
      name: 'Main Motor',
      machineId: 'MCH-machine-01',
      deviceType: 'motor',
    }

    const result = Schema.decodeSync(CreateDeviceParams)(params)
    expect(result.slug).toBe('motor-01')
    expect(result.name).toBe('Main Motor')
    expect(result.deviceType).toBe('motor')
  })

  it('should accept optional fields', () => {
    const params = {
      slug: 'pump-main',
      name: 'Main Coolant Pump',
      machineId: 'MCH-cnc-01',
      deviceType: 'pump',
      controlMode: 'auto',
      ratedPower: 2500,
      powerUnit: 'watts',
      opcUaNodeId: 'ns=2;s=Pump.Control',
      description: 'Main coolant circulation pump',
    }

    const result = Schema.decodeSync(CreateDeviceParams)(params)
    expect(result.controlMode).toBe('auto')
    expect(result.ratedPower).toBe(2500)
    expect(result.powerUnit).toBe('watts')
  })

  it('should default status to active', () => {
    const params = {
      slug: 'valve-01',
      name: 'Control Valve',
      machineId: 'MCH-process-01',
      deviceType: 'valve',
    }

    const result = Schema.decodeSync(CreateDeviceParams)(params)
    expect(result.status).toBe('active')
  })

  it('should reject invalid slug patterns', () => {
    const invalidParams = {
      slug: 'has space',
      name: 'Invalid Device',
      machineId: 'MCH-test',
      deviceType: 'motor',
    }

    expect(() => Schema.decodeSync(CreateDeviceParams)(invalidParams)).toThrow()
  })

  it('should reject negative ratedPower', () => {
    const invalidParams = {
      slug: 'motor-bad',
      name: 'Bad Motor',
      machineId: 'MCH-test',
      deviceType: 'motor',
      ratedPower: -100,
    }

    expect(() => Schema.decodeSync(CreateDeviceParams)(invalidParams)).toThrow()
  })
})
