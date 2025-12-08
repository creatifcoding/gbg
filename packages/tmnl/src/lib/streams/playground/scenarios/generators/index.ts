/**
 * Payload Generator Registry
 *
 * Central registry and factory for payload generators.
 *
 * @module
 */

import type { PayloadGenerator, PayloadProfile } from '../types'
import { senmlGenerator } from './senml'
import { opcuaGenerator } from './opcua'
import { prometheusGenerator } from './prometheus'

// ============================================================================
// GENERATOR REGISTRY
// ============================================================================

/**
 * Registry of all available payload generators.
 */
export const GENERATORS: Record<PayloadProfile, PayloadGenerator> = {
  senml: senmlGenerator,
  opcua: opcuaGenerator,
  prometheus: prometheusGenerator,
} as const

/**
 * Get a payload generator by profile ID.
 *
 * @param profile - Payload profile identifier
 * @returns The corresponding generator
 * @throws If profile is not found (should not happen with typed inputs)
 */
export const getGenerator = (profile: PayloadProfile): PayloadGenerator => {
  const generator = GENERATORS[profile]
  if (!generator) {
    throw new Error(`Unknown payload profile: ${profile}`)
  }
  return generator
}

/**
 * Get all available generator profiles.
 */
export const getAvailableProfiles = (): PayloadProfile[] => {
  return Object.keys(GENERATORS) as PayloadProfile[]
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { senmlGenerator } from './senml'
export { opcuaGenerator } from './opcua'
export { prometheusGenerator } from './prometheus'

export type { SenMLRecord } from './senml'
export type { OpcUaNetworkMessage, OpcUaDataSetMessage, OpcUaField } from './opcua'
export type { PrometheusPayload, PrometheusMetric } from './prometheus'
