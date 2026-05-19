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
  type ReactorPolicyEpoch,
  type ReactorRegistryFingerprint,
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
  readonly policyEpoch?: ReactorPolicyEpoch
  readonly registryFingerprint?: ReactorRegistryFingerprint
  readonly observations: readonly EventObservationSpec[]
  readonly propagationPolicies: readonly RelationshipPropagationPolicy[]
  readonly entities: readonly EntityReactionContract[]
}

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

export const DEFAULT_REACTOR_POLICY_EPOCH = 'reactor-policy-epoch.v1' as ReactorPolicyEpoch

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

const fnv1a32 = (value: string): string => {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export const fingerprintReactorRegistryConfig = (config: Pick<
  ReactorRegistryConfig,
  'observations' | 'propagationPolicies' | 'entities'
>): ReactorRegistryFingerprint => {
  const payload = {
    observations: config.observations
      .map((spec) => ({ id: spec.id, eventTag: spec.eventTag }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    propagationPolicies: config.propagationPolicies
      .map((policy) => ({
        id: policy.id,
        version: policy.version,
        edgeType: policy.edgeType,
        observedEndpoint: policy.observedEndpoint,
        requestEndpoint: policy.requestEndpoint,
        signal: policy.accepts,
        capability: policy.request.capability,
        effect: policy.effect,
        idempotencyStrategy: policy.idempotencyStrategy,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    entities: config.entities
      .map((contract) => ({
        entityType: contract.entityType,
        capabilities: Array.from(contract.capabilities.values())
          .map((capability) => capability.id)
          .sort(),
      }))
      .sort((a, b) => a.entityType.localeCompare(b.entityType)),
  }

  return `fnv1a32:${fnv1a32(stableStringify(payload))}` as ReactorRegistryFingerprint
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
  const policyEpoch = config.policyEpoch ?? DEFAULT_REACTOR_POLICY_EPOCH
  const registryFingerprint = config.registryFingerprint ?? fingerprintReactorRegistryConfig(config)

  return {
    policyEpoch,
    registryFingerprint,

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
