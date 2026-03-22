/**
 * Unified Stress Test Scenario Types
 *
 * Effect Schema-backed types for configurable stress test scenarios
 * with realistic IIoT payload profiles.
 *
 * @module
 */

import { Schema } from 'effect'

// ============================================================================
// PAYLOAD PROFILES
// ============================================================================

/** Supported payload format profiles */
export const PayloadProfile = Schema.Literal('senml', 'opcua', 'prometheus')
export type PayloadProfile = typeof PayloadProfile.Type

/** Payload size tiers */
export const PayloadTier = Schema.Literal('small', 'medium', 'large')
export type PayloadTier = typeof PayloadTier.Type

/** Estimated payload sizes per tier (bytes) */
export const PAYLOAD_SIZE_TARGETS = {
  small: 512,      // ~0.5 kB - single sensor reading
  medium: 3072,    // ~3 kB - batch of readings
  large: 20480,    // ~20 kB - device snapshot
} as const

// ============================================================================
// PAYLOAD GENERATOR INTERFACE
// ============================================================================

/**
 * Interface for payload generators.
 *
 * Each generator produces domain-realistic mock payloads
 * for stress testing data pipelines.
 */
export interface PayloadGenerator {
  /** Unique identifier */
  readonly id: PayloadProfile
  /** Human-readable name */
  readonly name: string
  /** Description of the payload domain */
  readonly description: string
  /**
   * Generate a payload for the given tier and event index.
   *
   * @param tier - Size tier (small/medium/large)
   * @param eventIndex - Sequential event number (for deterministic device IDs, etc.)
   * @returns Generated payload object
   */
  generate(tier: PayloadTier, eventIndex: number): unknown
  /**
   * Estimate payload size in bytes for the given tier.
   *
   * @param tier - Size tier
   * @returns Estimated byte count
   */
  estimateSizeBytes(tier: PayloadTier): number
}

// ============================================================================
// BURST CONFIGURATION
// ============================================================================

/** Burst mode configuration for stress testing */
export const BurstConfig = Schema.Struct({
  /** Whether burst mode is enabled */
  enabled: Schema.Boolean,
  /** Number of events per burst */
  size: Schema.Number.pipe(Schema.positive()),
  /** Interval between bursts in milliseconds */
  intervalMs: Schema.Number.pipe(Schema.positive()),
})
export type BurstConfig = typeof BurstConfig.Type

// ============================================================================
// SCENARIO CONFIGURATION
// ============================================================================

/**
 * Unified scenario configuration.
 *
 * Replaces the hardcoded SCENARIOS[] array with a configurable,
 * UI-adjustable schema.
 */
export class UnifiedScenarioConfig extends Schema.TaggedClass<UnifiedScenarioConfig>()(
  'UnifiedScenarioConfig',
  {
    /** Target events per second (1 - 10,000) */
    eventsPerSecond: Schema.Number.pipe(Schema.clamp(1, 10000)),
    /** Duration in seconds (0 = indefinite) */
    durationSec: Schema.Number.pipe(Schema.clamp(0, 300)),
    /** Payload format profile */
    payloadProfile: PayloadProfile,
    /** Payload size tier */
    payloadTier: PayloadTier,
    /** Optional: Burst mode configuration */
    burst: Schema.optional(BurstConfig),
    /** Optional: Failure rate for chaos testing (0-1) */
    failureRate: Schema.optional(Schema.Number.pipe(Schema.clamp(0, 1))),
  }
) {}

/** Default configuration */
export const defaultScenarioConfig = (): UnifiedScenarioConfig =>
  new UnifiedScenarioConfig({
    eventsPerSecond: 33,
    durationSec: 30,
    payloadProfile: 'senml',
    payloadTier: 'small',
  })

// ============================================================================
// PRESETS (Replace old SCENARIOS array)
// ============================================================================

/** Preset scenarios for quick selection */
export const SCENARIO_PRESETS = {
  'basic-throughput': new UnifiedScenarioConfig({
    eventsPerSecond: 33,
    durationSec: 30,
    payloadProfile: 'senml',
    payloadTier: 'small',
  }),
  'stress-1k': new UnifiedScenarioConfig({
    eventsPerSecond: 1000,
    durationSec: 15,
    payloadProfile: 'senml',
    payloadTier: 'small',
  }),
  'stress-5k-opcua': new UnifiedScenarioConfig({
    eventsPerSecond: 5000,
    durationSec: 10,
    payloadProfile: 'opcua',
    payloadTier: 'medium',
  }),
  'stress-10k-prometheus': new UnifiedScenarioConfig({
    eventsPerSecond: 10000,
    durationSec: 10,
    payloadProfile: 'prometheus',
    payloadTier: 'small',
  }),
  'burst-mode': new UnifiedScenarioConfig({
    eventsPerSecond: 100,
    durationSec: 30,
    payloadProfile: 'senml',
    payloadTier: 'small',
    burst: {
      enabled: true,
      size: 50,
      intervalMs: 500,
    },
  }),
  'large-payload': new UnifiedScenarioConfig({
    eventsPerSecond: 100,
    durationSec: 20,
    payloadProfile: 'opcua',
    payloadTier: 'large',
  }),
  'chaos-testing': new UnifiedScenarioConfig({
    eventsPerSecond: 500,
    durationSec: 30,
    payloadProfile: 'senml',
    payloadTier: 'medium',
    failureRate: 0.1,
  }),
} as const

export type ScenarioPresetKey = keyof typeof SCENARIO_PRESETS

// ============================================================================
// PROFILE METADATA
// ============================================================================

/** Metadata for each payload profile (for UI display) */
export const PAYLOAD_PROFILE_META: Record<PayloadProfile, { name: string; description: string; icon: string }> = {
  senml: {
    name: 'SenML (RFC 8428)',
    description: 'IoT sensor telemetry — smart buildings, environmental monitoring',
    icon: '🌡️',
  },
  opcua: {
    name: 'OPC-UA PubSub',
    description: 'Industrial automation — SCADA, PLCs, manufacturing',
    icon: '🏭',
  },
  prometheus: {
    name: 'Prometheus Metrics',
    description: 'Observability — infrastructure monitoring, APM',
    icon: '📊',
  },
}

/** Metadata for each payload tier (for UI display) */
export const PAYLOAD_TIER_META: Record<PayloadTier, { label: string; size: string; description: string }> = {
  small: {
    label: 'S',
    size: '~0.5 kB',
    description: 'Single sensor reading',
  },
  medium: {
    label: 'M',
    size: '~3 kB',
    description: 'Batch of readings',
  },
  large: {
    label: 'L',
    size: '~20 kB',
    description: 'Device snapshot',
  },
}
