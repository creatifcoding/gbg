/**
 * Quality Code Mapping Tests
 *
 * Exhaustive unit tests for protocol-specific quality code mapping
 * to the canonical OpcUaQuality type.
 *
 * @module @gbg/tmnl/iiot/adapters/__tests__/quality-mapping
 */

import { describe, expect, it } from 'vitest'
import { mapQuality, mapOpcUaStatusCode, mapSparkplugQuality, qualityToScore } from '../quality-mapping'

// =============================================================================
// 1. OPC-UA StatusCode Mappings
// =============================================================================

describe('mapOpcUaStatusCode', () => {
  it('maps "Good" to "good"', () => {
    expect(mapOpcUaStatusCode('Good')).toBe('good')
  })

  it('maps "Good_LocalOverride" to "good_local_override"', () => {
    expect(mapOpcUaStatusCode('Good_LocalOverride')).toBe('good_local_override')
  })

  it('maps "Uncertain" to "uncertain"', () => {
    expect(mapOpcUaStatusCode('Uncertain')).toBe('uncertain')
  })

  it('maps "Uncertain_SensorCalibration" to "uncertain_sensor_calibration"', () => {
    expect(mapOpcUaStatusCode('Uncertain_SensorCalibration')).toBe('uncertain_sensor_calibration')
  })

  it('maps "Uncertain_LastUsableValue" to "uncertain_last_usable_value"', () => {
    expect(mapOpcUaStatusCode('Uncertain_LastUsableValue')).toBe('uncertain_last_usable_value')
  })

  it('maps "Bad" to "bad"', () => {
    expect(mapOpcUaStatusCode('Bad')).toBe('bad')
  })

  it('maps "Bad_SensorFailure" to "bad_sensor_failure"', () => {
    expect(mapOpcUaStatusCode('Bad_SensorFailure')).toBe('bad_sensor_failure')
  })

  it('maps "Bad_NoCommunication" to "bad_no_communication"', () => {
    expect(mapOpcUaStatusCode('Bad_NoCommunication')).toBe('bad_no_communication')
  })

  it('maps "Bad_ConfigurationError" to "bad_configuration_error"', () => {
    expect(mapOpcUaStatusCode('Bad_ConfigurationError')).toBe('bad_configuration_error')
  })

  it('maps "Bad_NotConnected" to "bad_not_connected"', () => {
    expect(mapOpcUaStatusCode('Bad_NotConnected')).toBe('bad_not_connected')
  })

  it('maps "Bad_DeviceFailure" to "bad_device_failure"', () => {
    expect(mapOpcUaStatusCode('Bad_DeviceFailure')).toBe('bad_device_failure')
  })

  it('falls back to "uncertain" for unknown status codes', () => {
    expect(mapOpcUaStatusCode('SomeUnknownStatus')).toBe('uncertain')
  })

  // Case insensitivity
  it('handles all-uppercase "GOOD"', () => {
    expect(mapOpcUaStatusCode('GOOD')).toBe('good')
  })

  it('handles all-lowercase "good"', () => {
    expect(mapOpcUaStatusCode('good')).toBe('good')
  })

  it('handles mixed case "gOoD"', () => {
    expect(mapOpcUaStatusCode('gOoD')).toBe('good')
  })

  it('handles uppercase "BAD_SENSORFAILURE"', () => {
    expect(mapOpcUaStatusCode('BAD_SENSORFAILURE')).toBe('bad_sensor_failure')
  })

  it('handles lowercase "bad_sensorfailure"', () => {
    expect(mapOpcUaStatusCode('bad_sensorfailure')).toBe('bad_sensor_failure')
  })

  // OPC-UA often uses CamelCase without underscores for compound words
  it('handles "BadSensorFailure" without underscore', () => {
    expect(mapOpcUaStatusCode('BadSensorFailure')).toBe('bad_sensor_failure')
  })

  it('handles "GoodLocalOverride" without underscore', () => {
    expect(mapOpcUaStatusCode('GoodLocalOverride')).toBe('good_local_override')
  })
})

// =============================================================================
// 2. Sparkplug B Quality Mappings
// =============================================================================

describe('mapSparkplugQuality', () => {
  it('maps "192" (good boundary) to "good"', () => {
    expect(mapSparkplugQuality('192')).toBe('good')
  })

  it('maps "255" (max good) to "good"', () => {
    expect(mapSparkplugQuality('255')).toBe('good')
  })

  it('maps "200" (within good range) to "good"', () => {
    expect(mapSparkplugQuality('200')).toBe('good')
  })

  it('maps "64" (uncertain boundary) to "uncertain"', () => {
    expect(mapSparkplugQuality('64')).toBe('uncertain')
  })

  it('maps "128" (within uncertain range) to "uncertain"', () => {
    expect(mapSparkplugQuality('128')).toBe('uncertain')
  })

  it('maps "191" (just below good boundary) to "uncertain"', () => {
    expect(mapSparkplugQuality('191')).toBe('uncertain')
  })

  it('maps "0" (bad floor) to "bad"', () => {
    expect(mapSparkplugQuality('0')).toBe('bad')
  })

  it('maps "63" (just below uncertain boundary) to "bad"', () => {
    expect(mapSparkplugQuality('63')).toBe('bad')
  })

  it('maps "1" (within bad range) to "bad"', () => {
    expect(mapSparkplugQuality('1')).toBe('bad')
  })

  it('falls back to "bad" for non-numeric input', () => {
    expect(mapSparkplugQuality('not_a_number')).toBe('bad')
  })
})

// =============================================================================
// 3. Modbus Protocol (no native quality)
// =============================================================================

describe('mapQuality with modbus protocol', () => {
  it('returns "good" regardless of sourceQuality', () => {
    expect(mapQuality('modbus', 'anything')).toBe('good')
  })

  it('returns "good" when sourceQuality is undefined', () => {
    expect(mapQuality('modbus', undefined)).toBe('good')
  })

  it('returns "good" when sourceQuality is empty string', () => {
    expect(mapQuality('modbus', '')).toBe('good')
  })
})

// =============================================================================
// 4. Default / Unknown Protocol
// =============================================================================

describe('mapQuality with unknown protocol', () => {
  it('returns "uncertain" for unknown protocol with sourceQuality', () => {
    expect(mapQuality('unknown_protocol', '100')).toBe('uncertain')
  })

  it('returns "uncertain" for empty string protocol with sourceQuality', () => {
    expect(mapQuality('', 'some_quality')).toBe('uncertain')
  })
})

// =============================================================================
// 5. Null/Undefined sourceQuality
// =============================================================================

describe('mapQuality with missing sourceQuality', () => {
  it('returns "good" when sourceQuality is undefined (opcua)', () => {
    expect(mapQuality('opcua', undefined)).toBe('good')
  })

  it('returns "good" when sourceQuality is undefined (sparkplug)', () => {
    expect(mapQuality('sparkplug', undefined)).toBe('good')
  })

  it('returns "good" when sourceQuality is undefined (unknown protocol)', () => {
    expect(mapQuality('anything', undefined)).toBe('good')
  })
})

// =============================================================================
// 6. Case Insensitivity via mapQuality (end-to-end)
// =============================================================================

describe('mapQuality case insensitivity', () => {
  it('maps opcua "GOOD" case-insensitively', () => {
    expect(mapQuality('opcua', 'GOOD')).toBe('good')
  })

  it('maps opcua "good" case-insensitively', () => {
    expect(mapQuality('opcua', 'good')).toBe('good')
  })

  it('maps opcua "Good" case-insensitively', () => {
    expect(mapQuality('opcua', 'Good')).toBe('good')
  })

  it('maps opcua "Bad_SensorFailure" case-insensitively', () => {
    expect(mapQuality('opcua', 'Bad_SensorFailure')).toBe('bad_sensor_failure')
  })

  it('maps opcua "BAD_SENSORFAILURE" case-insensitively', () => {
    expect(mapQuality('opcua', 'BAD_SENSORFAILURE')).toBe('bad_sensor_failure')
  })
})

// =============================================================================
// 7. mapQuality Integration (protocol dispatch)
// =============================================================================

describe('mapQuality protocol dispatch', () => {
  it('dispatches to OPC-UA mapping for "opcua" protocol', () => {
    expect(mapQuality('opcua', 'Good')).toBe('good')
    expect(mapQuality('opcua', 'Bad')).toBe('bad')
  })

  it('dispatches to Sparkplug mapping for "sparkplug" protocol', () => {
    expect(mapQuality('sparkplug', '192')).toBe('good')
    expect(mapQuality('sparkplug', '0')).toBe('bad')
  })

  it('dispatches to Modbus mapping for "modbus" protocol', () => {
    expect(mapQuality('modbus', 'anything')).toBe('good')
  })

  it('returns "uncertain" for unrecognized protocols', () => {
    expect(mapQuality('profinet', '100')).toBe('uncertain')
    expect(mapQuality('ethercat', 'Good')).toBe('uncertain')
  })
})

// =============================================================================
// 8. qualityToScore
// =============================================================================

describe('qualityToScore', () => {
  it('maps "good" to 1.0', () => {
    expect(qualityToScore('good')).toBe(1.0)
  })

  it('maps "good_local_override" to 0.9', () => {
    expect(qualityToScore('good_local_override')).toBe(0.9)
  })

  it('maps "uncertain" to 0.5', () => {
    expect(qualityToScore('uncertain')).toBe(0.5)
  })

  it('maps "bad" to 0.0', () => {
    expect(qualityToScore('bad')).toBe(0.0)
  })

  it('maps unknown quality string to 0.5 (uncertain)', () => {
    expect(qualityToScore('something_else')).toBe(0.5)
  })
})
