/**
 * Reactor declaration contracts.
 *
 * These are pure Effect v3-compatible declaration shapes: event observations,
 * propagation policies, and target-owned reaction contracts. Runtime registry
 * assembly lives in `ReactorRegistry.ts`; this file is intentionally free of
 * service construction so declarations can be reused without dragging DI along.
 *
 * @module
 */

import { Effect, Option } from 'effect'
import * as EventJournal from '@effect/experimental/EventJournal'
import {
  EntityReactionRequest,
  ObservationSignal,
  ReactorObservation,
  type ReactorPolicyEpoch,
  type ReactorRegistryFingerprint,
} from '../../schemas/reactor'
import {
  RelationshipNodeType,
  RelationshipPropagationPolicy,
} from '../../schemas/relationships/edge-types'
import { EligibilityResult } from '../../schemas/relationships/eligibility'

/** Durable event -> ReactorObservation projection. */
export interface EventObservationSpec {
  readonly id: string
  readonly eventTag: string
  readonly observe: (entry: EventJournal.Entry) => Effect.Effect<ReactorObservation, unknown>
}

/** Target-owned capability: classify first, then dispatch if eligible. */
export interface EntityReactionCapability {
  readonly id: string
  readonly classify: (request: EntityReactionRequest) => Effect.Effect<EligibilityResult, unknown>
  readonly dispatch: (request: EntityReactionRequest) => Effect.Effect<unknown, unknown>
}

/** Target entity contract keyed by relationship graph node type. */
export interface EntityReactionContract {
  readonly entityType: RelationshipNodeType
  readonly capabilities: ReadonlyMap<string, EntityReactionCapability>
}

/** Static declaration set used to assemble a ReactorRegistry. */
export interface ReactorRegistryConfig {
  readonly policyEpoch?: ReactorPolicyEpoch
  readonly registryFingerprint?: ReactorRegistryFingerprint
  readonly observations: readonly EventObservationSpec[]
  readonly propagationPolicies: readonly RelationshipPropagationPolicy[]
  readonly entities: readonly EntityReactionContract[]
}

/** Runtime lookup surface produced from Reactor declarations. */
export interface ReactorRegistryShape {
  readonly policyEpoch: ReactorPolicyEpoch
  readonly registryFingerprint: ReactorRegistryFingerprint
  readonly observe: (entry: EventJournal.Entry) => Effect.Effect<Option.Option<ReactorObservation>, unknown>
  readonly policiesForSignal: (signal: ObservationSignal) => readonly RelationshipPropagationPolicy[]
  readonly contractFor: (entityType: RelationshipNodeType) => Option.Option<EntityReactionContract>
  readonly capabilityFor: (input: {
    readonly entityType: RelationshipNodeType
    readonly capability: string
  }) => Option.Option<EntityReactionCapability>
}
