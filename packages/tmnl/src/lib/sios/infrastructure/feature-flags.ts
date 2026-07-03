/**
 * SIOS Feature Flags
 *
 * Controls event emission, AI features, experimental capabilities.
 * Follows IIoT's IIoTFeatureFlags pattern.
 *
 * @module sios/infrastructure/feature-flags
 */

import { Context, Layer } from 'effect'

// =============================================================================
// Shape
// =============================================================================

export interface SiosFeatureFlagsShape {
  /** Emit domain events (for event sourcing / reactivity) */
  readonly eventsEnabled: boolean
  /** Enable AI-powered features (troubleshooting, estimating) */
  readonly aiEnabled: boolean
  /** Enable EVM alert calculations */
  readonly evmAlertsEnabled: boolean
}

// =============================================================================
// Service Tag
// =============================================================================

export class SiosFeatureFlags extends Context.Tag('sios/FeatureFlags')<
  SiosFeatureFlags,
  SiosFeatureFlagsShape
>() {}

// =============================================================================
// Layers
// =============================================================================

/** All features disabled — for unit tests */
export const SiosFlagsDisabledLayer = Layer.succeed(SiosFeatureFlags, {
  eventsEnabled: false,
  aiEnabled: false,
  evmAlertsEnabled: false,
})

/** All features enabled — for production */
export const SiosFlagsEnabledLayer = Layer.succeed(SiosFeatureFlags, {
  eventsEnabled: true,
  aiEnabled: true,
  evmAlertsEnabled: true,
})
