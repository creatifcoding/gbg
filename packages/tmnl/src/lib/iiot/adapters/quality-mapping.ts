/**
 * Protocol Quality Code Mapping
 *
 * Maps protocol-specific quality codes to the canonical OpcUaQuality type
 * from the IIoT sensor readings schema.
 *
 * Each industrial protocol has its own quality representation:
 * - OPC-UA: StatusCode names (e.g., 'Good', 'Bad_SensorFailure') -- direct mapping
 * - Sparkplug B: integer quality bitmask (>=192=good, >=64=uncertain, <64=bad)
 * - Modbus: no quality concept (assume 'good' if response received)
 *
 * @module @gbg/tmnl/iiot/adapters/quality-mapping
 * @see OPC UA Part 8 - Data Access, Section 5.6
 * @see Sparkplug B Specification, Section 6.4.16 (Metric Quality)
 */

import type { OpcUaQuality } from '../schemas/readings'

// =============================================================================
// OPC-UA StatusCode Lookup Table
// =============================================================================

/**
 * Canonical mapping of normalized OPC-UA StatusCode names to OpcUaQuality literals.
 *
 * OPC-UA StatusCodes arrive in various casing and delimiter styles:
 * - CamelCase: 'GoodLocalOverride', 'BadSensorFailure'
 * - Underscore: 'Good_LocalOverride', 'Bad_SensorFailure'
 * - Mixed: 'good', 'GOOD', 'Bad_NoCommunication'
 *
 * All are normalized to lowercase with underscores stripped before lookup.
 */
const OPCUA_STATUS_MAP: Record<string, OpcUaQuality> = {
  good: 'good' as OpcUaQuality,
  goodlocaloverride: 'good_local_override' as OpcUaQuality,
  uncertain: 'uncertain' as OpcUaQuality,
  uncertainsensorcalibration: 'uncertain_sensor_calibration' as OpcUaQuality,
  uncertainlastusablevalue: 'uncertain_last_usable_value' as OpcUaQuality,
  bad: 'bad' as OpcUaQuality,
  badsensorfailure: 'bad_sensor_failure' as OpcUaQuality,
  badnocommunication: 'bad_no_communication' as OpcUaQuality,
  badconfigurationerror: 'bad_configuration_error' as OpcUaQuality,
  badnotconnected: 'bad_not_connected' as OpcUaQuality,
  baddevicefailure: 'bad_device_failure' as OpcUaQuality,
}

// =============================================================================
// OPC-UA StatusCode Mapping
// =============================================================================

/**
 * Map an OPC-UA StatusCode string to OpcUaQuality.
 *
 * Normalizes the input by lowercasing and stripping underscores/spaces,
 * then looks up in the canonical mapping table. Falls back to 'uncertain'
 * for unrecognized status codes.
 *
 * @param statusCode - The OPC-UA StatusCode name (e.g., 'Good', 'Bad_SensorFailure')
 * @returns The corresponding OpcUaQuality literal
 */
export const mapOpcUaStatusCode = (statusCode: string): OpcUaQuality => {
  const normalized = statusCode.toLowerCase().replace(/[_\s]+/g, '')
  return OPCUA_STATUS_MAP[normalized] ?? ('uncertain' as OpcUaQuality)
}

// =============================================================================
// Sparkplug B Quality Mapping
// =============================================================================

/**
 * Map a Sparkplug B quality integer (as string) to OpcUaQuality.
 *
 * Sparkplug B encodes quality as an integer bitmask in the metric payload:
 * - >= 192: Good quality
 * - >= 64:  Uncertain quality
 * - < 64:   Bad quality
 *
 * Non-numeric input falls back to 'bad' (conservative).
 *
 * @param quality - The Sparkplug B quality integer as string (e.g., '192', '0')
 * @returns The corresponding OpcUaQuality literal
 */
export const mapSparkplugQuality = (quality: string): OpcUaQuality => {
  const q = parseInt(quality, 10)
  if (isNaN(q)) return 'bad' as OpcUaQuality
  if (q >= 192) return 'good' as OpcUaQuality
  if (q >= 64) return 'uncertain' as OpcUaQuality
  return 'bad' as OpcUaQuality
}

// =============================================================================
// Protocol Dispatch
// =============================================================================

/**
 * Map protocol-specific quality codes to the canonical OpcUaQuality type.
 *
 * This is the primary entry point for quality mapping. It dispatches to
 * protocol-specific mappers based on the protocol name.
 *
 * @param protocol - Protocol name ('opcua', 'sparkplug', 'modbus', etc.)
 * @param sourceQuality - Protocol-specific quality string (optional)
 * @returns The corresponding OpcUaQuality literal
 *
 * @example
 * ```ts
 * mapQuality('opcua', 'Good')           // 'good'
 * mapQuality('opcua', 'Bad_SensorFailure') // 'bad_sensor_failure'
 * mapQuality('sparkplug', '192')         // 'good'
 * mapQuality('sparkplug', '0')           // 'bad'
 * mapQuality('modbus', 'anything')       // 'good'
 * mapQuality('opcua', undefined)         // 'good' (no quality = assume good)
 * mapQuality('unknown', '100')           // 'uncertain'
 * ```
 */
export const mapQuality = (protocol: string, sourceQuality?: string): OpcUaQuality => {
  // No quality information provided -- assume good (data arrived successfully)
  if (sourceQuality === undefined || sourceQuality === null) {
    return 'good' as OpcUaQuality
  }

  switch (protocol) {
    case 'opcua':
      return mapOpcUaStatusCode(sourceQuality)
    case 'sparkplug':
      return mapSparkplugQuality(sourceQuality)
    case 'modbus':
      // Modbus has no native quality concept.
      // If data was received, it is considered good.
      return 'good' as OpcUaQuality
    default:
      // Unknown protocol -- conservative fallback to uncertain
      return 'uncertain' as OpcUaQuality
  }
}

// =============================================================================
// Quality Score (0-1 numeric)
// =============================================================================

/**
 * Map a quality string to a normalized numeric score (0.0 - 1.0).
 *
 * Useful for downstream numeric comparisons, weighting, and visualization.
 *
 * @param quality - An OpcUaQuality literal or arbitrary quality string
 * @returns Numeric score: 1.0 (good), 0.9 (good_local_override), 0.5 (uncertain), 0.0 (bad)
 */
export const qualityToScore = (quality: string): number => {
  if (quality.startsWith('good_')) return 0.9
  if (quality === 'good') return 1.0
  if (quality.startsWith('bad')) return 0.0
  if (quality.startsWith('uncertain')) return 0.5
  // Unknown quality string -- assume uncertain
  return 0.5
}
