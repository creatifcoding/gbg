/**
 * Auth atoms — reactive auth state for React.
 *
 * Uses Atom.runtime with PiAuthBridge layer so React components
 * can observe auth status without touching services directly.
 */
import { Atom } from '@effect-atom/atom-react'
import { Effect } from 'effect'

import { PiAuthBridge, PiAuthBridgeLive, type ProviderInfo, type ProviderStatus } from '../auth/PiAuthBridge'

// ── Runtime atom ──

export const agentAuthRuntime = Atom.runtime(PiAuthBridgeLive)

// ── Auth status atoms ──

/**
 * All providers with their current auth status.
 * Re-evaluates on each subscription access (not polling).
 */
export const availableProvidersAtom = agentAuthRuntime.atom(
  Effect.flatMap(PiAuthBridge, (bridge) => bridge.listProviders()),
)

/**
 * Check if a specific provider has credentials configured.
 */
export const hasAuthAtom = (providerId: string) =>
  agentAuthRuntime.atom(
    Effect.flatMap(PiAuthBridge, (bridge) => bridge.hasAuth(providerId)),
  )

// ── Type re-exports for React consumers ──

export type { ProviderInfo, ProviderStatus }
