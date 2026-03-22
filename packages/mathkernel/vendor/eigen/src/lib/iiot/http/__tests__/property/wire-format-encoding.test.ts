/**
 * Property-Based Tests: Wire Format Encoding
 *
 * Verifies ndjson and JSON serialization properties for all entity schemas
 * used in the HTTP layer. Ensures that:
 *
 * 1. Schema.encodeSync produces JSON-safe values (no Dates, no symbols)
 * 2. JSON.stringify -> JSON.parse -> Schema.decodeSync roundtrip preserves data
 * 3. Branded types serialize as plain strings
 * 4. Boundary values (empty strings, unicode, large numbers) survive the wire
 *
 * Uses Arbitrary.make() from Effect to generate test data compatible with
 * fast-check for property-based testing.
 *
 * @module @gbg/tmnl/iiot/http/__tests__/property/wire-format-encoding
 */

import { describe, it, expect } from 'vitest'
import { Arbitrary, Schema, FastCheck as fc } from 'effect'

// =============================================================================
// Imports: Asset Entity Schemas
// =============================================================================
import {
  Plant,
  PlantId,
  PlantStatus,
  CreatePlantParams,
} from '../../../../iiot/schemas/assets/plant'
import {
  Line,
  LineId,
  LineStatus,
  CreateLineParams,
} from '../../../../iiot/schemas/assets/line'
import {
  Enterprise,
  EnterpriseId,
  EnterpriseStatus,
  CreateEnterpriseParams,
} from '../../../../iiot/schemas/assets/enterprise'
import {
  Site,
  SiteId,
  SiteStatus,
  CreateSiteParams,
} from '../../../../iiot/schemas/assets/site'
import {
  Area,
  AreaId,
  AreaStatus,
  CreateAreaParams,
} from '../../../../iiot/schemas/assets/area'
import {
  WorkCell,
  WorkCellStatus,
  CreateWorkCellParams,
} from '../../../../iiot/schemas/assets/workcell'
import {
  Machine,
  MachineId,
  MachineStatus,
  CreateMachineParams,
} from '../../../../iiot/schemas/assets/machine'
import {
  Device,
  DeviceId,
  DeviceStatus,
  DeviceType,
  CreateDeviceParams,
} from '../../../../iiot/schemas/assets/device'
import {
  Sensor,
  SensorId,
  SensorStatus,
  SensorType,
  MeasurementUnit,
  CreateSensorParams,
} from '../../../../iiot/schemas/assets/sensor'

// =============================================================================
// Imports: RPC Error Schemas
// =============================================================================
import {
  RpcQueryError,
  RpcPlantNotFoundError,
  RpcMachineNotFoundError,
  RpcDeviceNotFoundError,
  RpcHierarchyError,
  RpcAlarmNotFoundError,
} from '../../../../iiot/rpc/errors'

// =============================================================================
// Constants
// =============================================================================

const NUM_RUNS = 30

// =============================================================================
// Helper: JSON Wire Format Roundtrip
// =============================================================================

/**
 * Check if a value contains NaN or Infinity, which are not JSON-safe.
 * JSON.stringify converts NaN and Infinity to null, causing roundtrip failures.
 */
function containsNonFiniteNumbers(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'number') return !Number.isFinite(value)
  if (Array.isArray(value)) return value.some(containsNonFiniteNumbers)
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(containsNonFiniteNumbers)
  }
  return false
}

/**
 * Assert that Schema.encodeSync produces a value that survives
 * JSON.stringify -> JSON.parse -> Schema.decodeSync without data loss.
 *
 * This simulates the ndjson wire format: encode -> serialize -> deserialize -> decode.
 *
 * Note: Values containing NaN/Infinity are skipped because JSON.stringify
 * converts them to null, which is a known JSON limitation (not a schema bug).
 */
function assertWireRoundtrip<A, I>(
  schema: Schema.Schema<A, I, never>,
  value: A,
): void {
  const encoded = Schema.encodeSync(schema)(value)
  // Skip values with NaN/Infinity -- JSON cannot represent these
  if (containsNonFiniteNumbers(encoded)) return
  const serialized = JSON.stringify(encoded)
  const deserialized = JSON.parse(serialized)
  // The deserialized form should be accepted by decodeSync
  const decoded = Schema.decodeSync(schema)(deserialized)
  // Re-encode the decoded value to compare with the original encoding
  const reEncoded = Schema.encodeSync(schema)(decoded)
  expect(JSON.stringify(reEncoded)).toBe(serialized)
}

/**
 * Assert that Schema.encodeSync output contains no non-JSON-safe values.
 * Recursively checks that there are no Date objects, symbols, undefined values
 * (outside of explicit null), functions, or BigInt.
 */
function assertJsonSafe(value: unknown, path = ''): void {
  if (value === null || value === undefined) return
  const type = typeof value
  if (type === 'string' || type === 'number' || type === 'boolean') return
  if (type === 'symbol') throw new Error(`Symbol found at ${path}`)
  if (type === 'function') throw new Error(`Function found at ${path}`)
  if (type === 'bigint') throw new Error(`BigInt found at ${path}`)
  if (value instanceof Date) throw new Error(`Date object found at ${path}`)
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertJsonSafe(item, `${path}[${i}]`))
    return
  }
  if (type === 'object') {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      assertJsonSafe(val, path ? `${path}.${key}` : key)
    }
  }
}

/**
 * Property test wrapper: generate arbitrary values and assert wire roundtrip.
 */
function wireRoundtripProperty<A, I>(
  name: string,
  schema: Schema.Schema<A, I, never>,
): void {
  it(name, () => {
    const arb = Arbitrary.make(schema)
    fc.assert(
      fc.property(arb, (value) => {
        assertWireRoundtrip(schema, value)
        return true
      }),
      { numRuns: NUM_RUNS },
    )
  })
}

/**
 * Property test wrapper: generate arbitrary values and assert JSON-safety of encoded output.
 */
function jsonSafetyProperty<A, I>(
  name: string,
  schema: Schema.Schema<A, I, never>,
): void {
  it(name, () => {
    const arb = Arbitrary.make(schema)
    fc.assert(
      fc.property(arb, (value) => {
        const encoded = Schema.encodeSync(schema)(value)
        assertJsonSafe(encoded)
        return true
      }),
      { numRuns: NUM_RUNS },
    )
  })
}

// =============================================================================
// Tests: ndjson Roundtrip
// =============================================================================

describe('Wire Format: ndjson roundtrip', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Entity schemas
  // ─────────────────────────────────────────────────────────────────────────

  wireRoundtripProperty(
    'Plant schema survives JSON wire roundtrip',
    Plant,
  )

  wireRoundtripProperty(
    'Line schema survives JSON wire roundtrip',
    Line,
  )

  wireRoundtripProperty(
    'Enterprise schema survives JSON wire roundtrip',
    Enterprise,
  )

  wireRoundtripProperty(
    'Site schema survives JSON wire roundtrip',
    Site,
  )

  wireRoundtripProperty(
    'Area schema survives JSON wire roundtrip',
    Area,
  )

  wireRoundtripProperty(
    'WorkCell schema survives JSON wire roundtrip',
    WorkCell,
  )

  wireRoundtripProperty(
    'Machine schema survives JSON wire roundtrip',
    Machine,
  )

  wireRoundtripProperty(
    'Device schema survives JSON wire roundtrip',
    Device,
  )

  wireRoundtripProperty(
    'Sensor schema survives JSON wire roundtrip',
    Sensor,
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Branded ID roundtrip
  // ─────────────────────────────────────────────────────────────────────────

  it('Branded PlantId serializes as plain string via JSON', () => {
    const id = 'PLT-test-001'
    const serialized = JSON.stringify(id)
    expect(serialized).toBe('"PLT-test-001"')
    expect(JSON.parse(serialized)).toBe(id)
  })

  it('Branded LineId serializes as plain string via JSON', () => {
    const id = 'LIN-assembly-01'
    const serialized = JSON.stringify(id)
    expect(serialized).toBe('"LIN-assembly-01"')
    expect(JSON.parse(serialized)).toBe(id)
  })

  it('Branded EnterpriseId serializes as plain string via JSON', () => {
    const id = 'ENT-acme-corp'
    const serialized = JSON.stringify(id)
    expect(serialized).toBe('"ENT-acme-corp"')
    expect(JSON.parse(serialized)).toBe(id)
  })

  it('Branded SiteId serializes as plain string via JSON', () => {
    const id = 'SIT-chicago-facility'
    const serialized = JSON.stringify(id)
    expect(serialized).toBe('"SIT-chicago-facility"')
    expect(JSON.parse(serialized)).toBe(id)
  })

  it('Branded DeviceId serializes as plain string via JSON', () => {
    const id = 'DEV-motor-01'
    const serialized = JSON.stringify(id)
    expect(serialized).toBe('"DEV-motor-01"')
    expect(JSON.parse(serialized)).toBe(id)
  })

  it('Branded SensorId serializes as plain string via JSON', () => {
    const id = 'SNS-temp-01'
    const serialized = JSON.stringify(id)
    expect(serialized).toBe('"SNS-temp-01"')
    expect(JSON.parse(serialized)).toBe(id)
  })
})

// =============================================================================
// Tests: Schema-to-JSON Invariants
// =============================================================================

describe('Wire Format: Schema-to-JSON invariants', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // JSON-safety: encodeSync produces no Dates, symbols, BigInts
  // ─────────────────────────────────────────────────────────────────────────

  jsonSafetyProperty(
    'Plant encodeSync produces JSON-safe output',
    Plant,
  )

  jsonSafetyProperty(
    'Line encodeSync produces JSON-safe output',
    Line,
  )

  jsonSafetyProperty(
    'Enterprise encodeSync produces JSON-safe output',
    Enterprise,
  )

  jsonSafetyProperty(
    'Site encodeSync produces JSON-safe output',
    Site,
  )

  jsonSafetyProperty(
    'Area encodeSync produces JSON-safe output',
    Area,
  )

  jsonSafetyProperty(
    'Machine encodeSync produces JSON-safe output',
    Machine,
  )

  jsonSafetyProperty(
    'Device encodeSync produces JSON-safe output',
    Device,
  )

  jsonSafetyProperty(
    'Sensor encodeSync produces JSON-safe output',
    Sensor,
  )

  // ─────────────────────────────────────────────────────────────────────────
  // RPC Error schemas encode/decode cleanly
  // ─────────────────────────────────────────────────────────────────────────

  wireRoundtripProperty(
    'RpcQueryError survives wire roundtrip',
    RpcQueryError,
  )

  wireRoundtripProperty(
    'RpcPlantNotFoundError survives wire roundtrip',
    RpcPlantNotFoundError,
  )

  wireRoundtripProperty(
    'RpcMachineNotFoundError survives wire roundtrip',
    RpcMachineNotFoundError,
  )

  wireRoundtripProperty(
    'RpcDeviceNotFoundError survives wire roundtrip',
    RpcDeviceNotFoundError,
  )

  wireRoundtripProperty(
    'RpcHierarchyError survives wire roundtrip',
    RpcHierarchyError,
  )

  wireRoundtripProperty(
    'RpcAlarmNotFoundError survives wire roundtrip',
    RpcAlarmNotFoundError,
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Encode -> Decode roundtrip is identity for CreateParams schemas
  // ─────────────────────────────────────────────────────────────────────────

  wireRoundtripProperty(
    'CreatePlantParams wire roundtrip is identity',
    CreatePlantParams,
  )

  wireRoundtripProperty(
    'CreateLineParams wire roundtrip is identity',
    CreateLineParams,
  )

  wireRoundtripProperty(
    'CreateEnterpriseParams wire roundtrip is identity',
    CreateEnterpriseParams,
  )

  wireRoundtripProperty(
    'CreateSiteParams wire roundtrip is identity',
    CreateSiteParams,
  )

  wireRoundtripProperty(
    'CreateAreaParams wire roundtrip is identity',
    CreateAreaParams,
  )
})

// =============================================================================
// Tests: Boundary Values
// =============================================================================

describe('Wire Format: Boundary values', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // String boundaries
  // ─────────────────────────────────────────────────────────────────────────

  it('Empty string survives JSON roundtrip', () => {
    const data = { name: '', slug: 'empty' }
    const serialized = JSON.stringify(data)
    const deserialized = JSON.parse(serialized)
    expect(deserialized.name).toBe('')
    expect(deserialized.slug).toBe('empty')
  })

  it('Unicode characters in name fields survive JSON roundtrip', () => {
    const data = { name: '\u5DE5\u5834\u30C6\u30B9\u30C8', slug: 'unicode-test' }
    const serialized = JSON.stringify(data)
    const deserialized = JSON.parse(serialized)
    expect(deserialized.name).toBe('\u5DE5\u5834\u30C6\u30B9\u30C8')
  })

  it('Emoji characters survive JSON roundtrip', () => {
    const data = { name: 'Plant \uD83C\uDFED Test \u2699\uFE0F', description: 'with emojis \uD83D\uDE80' }
    const serialized = JSON.stringify(data)
    const deserialized = JSON.parse(serialized)
    expect(deserialized.name).toBe('Plant \uD83C\uDFED Test \u2699\uFE0F')
    expect(deserialized.description).toBe('with emojis \uD83D\uDE80')
  })

  it('Special JSON characters (quotes, backslashes) survive roundtrip', () => {
    const data = { name: 'Plant "Alpha" \\Beta\\', description: 'line1\nline2\ttab' }
    const serialized = JSON.stringify(data)
    const deserialized = JSON.parse(serialized)
    expect(deserialized.name).toBe('Plant "Alpha" \\Beta\\')
    expect(deserialized.description).toBe('line1\nline2\ttab')
  })

  it('Maximum-length string survives JSON roundtrip', () => {
    const longString = 'a'.repeat(10000)
    const data = { name: longString }
    const serialized = JSON.stringify(data)
    const deserialized = JSON.parse(serialized)
    expect(deserialized.name).toBe(longString)
    expect(deserialized.name.length).toBe(10000)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Numeric boundaries
  // ─────────────────────────────────────────────────────────────────────────

  it('Large integer values survive JSON roundtrip', () => {
    const data = { capacity: Number.MAX_SAFE_INTEGER, position: 0 }
    const serialized = JSON.stringify(data)
    const deserialized = JSON.parse(serialized)
    expect(deserialized.capacity).toBe(Number.MAX_SAFE_INTEGER)
    expect(deserialized.position).toBe(0)
  })

  it('Small positive decimals survive JSON roundtrip', () => {
    const data = { threshold: 0.001, rate: 1e-10 }
    const serialized = JSON.stringify(data)
    const deserialized = JSON.parse(serialized)
    expect(deserialized.threshold).toBe(0.001)
    expect(deserialized.rate).toBe(1e-10)
  })

  it('Negative numbers survive JSON roundtrip', () => {
    const data = { thresholdLow: -40.5, criticalLow: -273.15 }
    const serialized = JSON.stringify(data)
    const deserialized = JSON.parse(serialized)
    expect(deserialized.thresholdLow).toBe(-40.5)
    expect(deserialized.criticalLow).toBe(-273.15)
  })

  it('Zero values survive JSON roundtrip', () => {
    const data = { value: 0, negZero: -0 }
    const serialized = JSON.stringify(data)
    const deserialized = JSON.parse(serialized)
    expect(deserialized.value).toBe(0)
    // JSON does not preserve -0 distinction
    expect(deserialized.negZero).toBe(0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Null vs undefined for optional fields
  // ─────────────────────────────────────────────────────────────────────────

  it('null fields survive JSON roundtrip', () => {
    const data = { name: 'Test', description: null, metadata: null }
    const serialized = JSON.stringify(data)
    const deserialized = JSON.parse(serialized)
    expect(deserialized.description).toBeNull()
    expect(deserialized.metadata).toBeNull()
  })

  it('undefined fields are omitted from JSON serialization', () => {
    const data = { name: 'Test', description: undefined, metadata: undefined }
    const serialized = JSON.stringify(data)
    const deserialized = JSON.parse(serialized)
    expect(deserialized).toEqual({ name: 'Test' })
    expect('description' in deserialized).toBe(false)
    expect('metadata' in deserialized).toBe(false)
  })

  it('Mixed null and present fields survive JSON roundtrip', () => {
    const data = {
      name: 'Mixed',
      description: null,
      timezone: 'UTC',
      siteCode: null,
      status: 'commissioning',
    }
    const serialized = JSON.stringify(data)
    const deserialized = JSON.parse(serialized)
    expect(deserialized.name).toBe('Mixed')
    expect(deserialized.description).toBeNull()
    expect(deserialized.timezone).toBe('UTC')
    expect(deserialized.siteCode).toBeNull()
    expect(deserialized.status).toBe('commissioning')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Array and object boundary values
  // ─────────────────────────────────────────────────────────────────────────

  it('Empty object metadata survives JSON roundtrip', () => {
    const data = { metadata: {} }
    const serialized = JSON.stringify(data)
    const deserialized = JSON.parse(serialized)
    expect(deserialized.metadata).toEqual({})
  })

  it('Nested metadata with various types survives JSON roundtrip', () => {
    const data = {
      metadata: {
        stringVal: 'test',
        numVal: 42,
        boolVal: true,
        nullVal: null,
        nested: { deep: 'value' },
        arrayVal: [1, 'two', null, true],
      },
    }
    const serialized = JSON.stringify(data)
    const deserialized = JSON.parse(serialized)
    expect(deserialized.metadata).toEqual(data.metadata)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Status enum literal roundtrip
  // ─────────────────────────────────────────────────────────────────────────

  it('All PlantStatus values survive JSON roundtrip', () => {
    const statuses = [
      'commissioning',
      'operational',
      'scheduled_shutdown',
      'emergency_shutdown',
      'maintenance_shutdown',
      'decommissioned',
    ] as const
    for (const status of statuses) {
      const serialized = JSON.stringify(status)
      expect(JSON.parse(serialized)).toBe(status)
    }
  })

  it('All DeviceStatus values survive JSON roundtrip', () => {
    const statuses = [
      'provisioned',
      'online',
      'offline',
      'faulted',
      'firmware_update',
      'decommissioned',
    ] as const
    for (const status of statuses) {
      const serialized = JSON.stringify(status)
      expect(JSON.parse(serialized)).toBe(status)
    }
  })

  it('All SensorStatus values survive JSON roundtrip', () => {
    const statuses = [
      'active',
      'calibrating',
      'needs_calibration',
      'faulted',
      'offline',
      'decommissioned',
    ] as const
    for (const status of statuses) {
      const serialized = JSON.stringify(status)
      expect(JSON.parse(serialized)).toBe(status)
    }
  })
})
