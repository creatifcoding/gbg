/**
 * ReactorRegistry — runtime declarations for rule-driven propagation.
 *
 * The registry is deliberately boring: it holds the three declarations that make
 * Reactor behavior meaningful without hardcoding source/target branches in the
 * core loop.
 *
 * - EventObservationSpec: durable event -> ReactorObservation
 * - RelationshipPropagationPolicy: signal + relationship topology -> request
 * - EntityReactionContract: target-owned request handling capability
 *
 * @module
 */

import { Context, Effect, Layer, Option } from 'effect'
import * as EventJournal from '@effect/experimental/EventJournal'
import {
  EntityReactionRequest,
  ObservationSignal,
  ReactorObservation,
} from '../../schemas/reactor'
import {
  RelationshipNodeType,
  RelationshipPropagationPolicy,
} from '../../schemas/relationships/edge-types'
import { EligibilityResult } from '../../schemas/relationships/eligibility'

// =============================================================================
// Runtime declaration contracts
// =============================================================================

export interface EventObservationSpec {
  readonly id: string
  readonly eventTag: string
  readonly observe: (entry: EventJournal.Entry) => Effect.Effect<ReactorObservation, unknown>
}

export interface EntityReactionCapability {
  readonly id: string
  readonly classify: (request: EntityReactionRequest) => Effect.Effect<EligibilityResult, unknown>
  readonly dispatch: (request: EntityReactionRequest) => Effect.Effect<unknown, unknown>
}

export interface EntityReactionContract {
  readonly entityType: RelationshipNodeType
  readonly capabilities: ReadonlyMap<string, EntityReactionCapability>
}

export interface ReactorRegistryConfig {
  readonly observations: readonly EventObservationSpec[]
  readonly propagationPolicies: readonly RelationshipPropagationPolicy[]
  readonly entities: readonly EntityReactionContract[]
}

export interface ReactorRegistryShape {
  readonly observe: (entry: EventJournal.Entry) => Effect.Effect<Option.Option<ReactorObservation>, unknown>
  readonly policiesForSignal: (signal: ObservationSignal) => readonly RelationshipPropagationPolicy[]
  readonly contractFor: (entityType: RelationshipNodeType) => Option.Option<EntityReactionContract>
  readonly capabilityFor: (input: {
    readonly entityType: RelationshipNodeType
    readonly capability: string
  }) => Option.Option<EntityReactionCapability>
}

export class ReactorRegistry extends Context.Tag('iiot/ReactorRegistry')<
  ReactorRegistry,
  ReactorRegistryShape
>() {}

// =============================================================================
// Helpers
// =============================================================================

const assertUnique = <A>(
  items: readonly A[],
  key: (item: A) => string,
  label: string,
): void => {
  const seen = new Set<string>()
  for (const item of items) {
    const value = key(item)
    if (seen.has(value)) {
      throw new Error(`Duplicate Reactor registry ${label}: ${value}`)
    }
    seen.add(value)
  }
}

const signalMatches = (
  signal: ObservationSignal,
  policy: RelationshipPropagationPolicy,
): boolean => {
  const matcher = policy.accepts
  if (matcher.axis !== signal.axis) return false
  if (matcher.kind !== undefined && matcher.kind !== signal.kind) return false
  if (matcher.value !== undefined && matcher.value !== signal.value) return false
  return true
}

export const makeReactorRegistry = (config: ReactorRegistryConfig): ReactorRegistryShape => {
  assertUnique(config.observations, (spec) => spec.id, 'observation id')
  assertUnique(config.observations, (spec) => spec.eventTag, 'event tag')
  assertUnique(config.propagationPolicies, (policy) => policy.id, 'propagation policy id')
  assertUnique(config.entities, (contract) => contract.entityType, 'entity contract')

  const observationsByEvent = new Map(config.observations.map((spec) => [spec.eventTag, spec] as const))
  const contractsByEntity = new Map(config.entities.map((contract) => [contract.entityType, contract] as const))

  return {
    observe: (entry) => {
      const spec = observationsByEvent.get(entry.event)
      if (!spec) return Effect.succeed(Option.none())
      return spec.observe(entry).pipe(Effect.map(Option.some))
    },

    policiesForSignal: (signal) =>
      config.propagationPolicies.filter((policy) => signalMatches(signal, policy)),

    contractFor: (entityType) => Option.fromNullable(contractsByEntity.get(entityType)),

    capabilityFor: ({ entityType, capability }) =>
      Option.flatMap(
        Option.fromNullable(contractsByEntity.get(entityType)),
        (contract) => Option.fromNullable(contract.capabilities.get(capability)),
      ),
  }
}

export const ReactorRegistryLayer = (config: ReactorRegistryConfig) =>
  Layer.sync(ReactorRegistry, () => ReactorRegistry.of(makeReactorRegistry(config)))
