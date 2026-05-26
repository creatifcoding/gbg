/**
 * SQL-backed ReactorConstraintAuthority integration tests.
 *
 * These tests prove the distributed authority shape: callers do not synthesize
 * constraint ids, constraints are uniquely identified in SQL, and target
 * reconciliation uses transaction-scoped locking.
 */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Effect, Layer } from 'effect'
import { PgClient } from '@effect/sql-pg'
import type { PropagationId } from '../../schemas/identifiers'
import {
  EntityCapabilityIds,
  RelationshipEndpoint,
} from '../../schemas/relationships'
import {
  EntityReactionRequest,
  ObservationSignal,
  ReactorCausality,
  ReactorConstraintAssertion,
  ReactorConstraintNaturalAddress,
  ReactorConstraintRetraction,
  type ReactorPolicyEpoch,
  type ReactorRegistryFingerprint,
} from '../../schemas/reactor'
import { createReactorConstraintsTable } from '../../models/reactor'
import {
  ReactorConstraintAuthority,
  ReactorConstraintAuthoritySqlLive,
} from '../../services/reactor'
import {
  TestPgClientWithMigrations,
  isDatabaseAvailable,
} from './layer'

const ConstraintIntegrationLayer = Layer.merge(
  TestPgClientWithMigrations,
  ReactorConstraintAuthoritySqlLive.pipe(Layer.provide(TestPgClientWithMigrations)),
)

const target = new RelationshipEndpoint({ type: 'work_order', id: 'WO-SQL-CONSTRAINT-001' })
const machineA = new RelationshipEndpoint({ type: 'machine', id: 'MCH-SQL-CONSTRAINT-A' })
const machineB = new RelationshipEndpoint({ type: 'machine', id: 'MCH-SQL-CONSTRAINT-B' })
const safetySource = new RelationshipEndpoint({ type: 'alarm', id: 'ALM-SQL-CONSTRAINT-001' })

const signal = new ObservationSignal({
  axis: 'equipment.availability',
  kind: 'condition_retracted',
  value: 'available',
  previousValue: 'unavailable',
  reason: 'sql release test',
})

const assertion = (input: {
  readonly source: RelationshipEndpoint
  readonly policyId: string
  readonly capability?: typeof EntityCapabilityIds.DependencyBlocked | typeof EntityCapabilityIds.SafetyHold
  readonly family?: 'dependency' | 'safety'
  readonly propagationId?: string
}) => new ReactorConstraintAssertion({
  target,
  capability: input.capability ?? EntityCapabilityIds.DependencyBlocked,
  family: input.family ?? 'dependency',
  source: input.source,
  relationshipEdgeType: input.family === 'safety' ? 'triggered_by' : 'requires',
  policyId: input.policyId as never,
  policyVersion: '1',
  policyEpoch: 'reactor-policy-epoch.sql-test' as ReactorPolicyEpoch,
  registryFingerprint: 'fnv1a32:sql-test' as ReactorRegistryFingerprint,
  sourceEntryId: `${input.policyId}.entry` as never,
  sourceEvent: input.family === 'safety' ? 'AlarmTriggered' : 'FaultDetected',
  propagationId: (input.propagationId ?? `${input.policyId}.propagation`) as PropagationId,
  effect: input.family === 'safety' ? 'holding' : 'blocking',
})

const naturalAddress = (input: ReactorConstraintAssertion) => new ReactorConstraintNaturalAddress({
  target: input.target,
  capability: input.capability,
  source: input.source,
  relationshipEdgeType: input.relationshipEdgeType,
  policyId: input.policyId,
  propagationId: input.propagationId,
})

const releaseById = (constraintId: string) => new ReactorConstraintRetraction({
  target,
  capability: EntityCapabilityIds.DependencyReleased,
  constraintId: constraintId as never,
  effect: 'release_candidate',
  signal,
  causality: new ReactorCausality({ propagationId: `${constraintId}.release` as PropagationId }),
})

const releaseByNaturalAddress = (input: ReactorConstraintAssertion) => new ReactorConstraintRetraction({
  target,
  capability: EntityCapabilityIds.DependencyReleased,
  naturalAddress: naturalAddress(input),
  effect: 'release_candidate',
  signal,
  causality: new ReactorCausality({ propagationId: `${input.policyId}.release` as PropagationId }),
})

const resetConstraintTable = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`DROP TABLE IF EXISTS iiot.reactor_constraints`
  yield* createReactorConstraintsTable
})

const cleanup = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`
    DELETE FROM iiot.reactor_constraints
    WHERE target_id = ${target.id}
  `
})

describe('ReactorConstraintAuthoritySqlLive', () => {
  let dbAvailable = false

  beforeAll(async () => {
    dbAvailable = await Effect.runPromise(
      isDatabaseAvailable.pipe(Effect.provide(ConstraintIntegrationLayer)),
    )
    if (!dbAvailable) {
      console.log('SKIPPING: IIoT database not available')
      return
    }
    await Effect.runPromise(resetConstraintTable.pipe(Effect.provide(ConstraintIntegrationLayer)))
  }, 30000)

  afterEach(async () => {
    if (!dbAvailable) return
    await Effect.runPromise(cleanup.pipe(Effect.provide(ConstraintIntegrationLayer)))
  })

  it('asserts constraints idempotently without caller-provided constraint ids', async () => {
    if (!dbAvailable) return

    await Effect.runPromise(Effect.gen(function* () {
      const authority = yield* ReactorConstraintAuthority
      const equipment = assertion({
        source: machineA,
        policyId: `constraint.sql.idempotent.${Date.now()}`,
      })

      const first = yield* authority.assert(equipment)
      const second = yield* authority.assert(equipment)
      const active = yield* authority.activeForTarget(target)

      expect(first.identity.constraintId).toMatch(/^rc_[0-9a-f]{32}$/)
      expect(second.identity.constraintId).toBe(first.identity.constraintId)
      expect(active).toHaveLength(1)
    }).pipe(Effect.provide(ConstraintIntegrationLayer)))
  })

  it('retracts one addressed constraint while preserving other active holds', async () => {
    if (!dbAvailable) return

    await Effect.runPromise(Effect.gen(function* () {
      const authority = yield* ReactorConstraintAuthority
      const equipment = assertion({
        source: machineA,
        policyId: `constraint.sql.equipment.${Date.now()}`,
      })
      const safety = assertion({
        source: safetySource,
        policyId: `constraint.sql.safety.${Date.now()}`,
        capability: EntityCapabilityIds.SafetyHold,
        family: 'safety',
      })

      const equipmentRecord = yield* authority.assert(equipment)
      yield* authority.assert(safety)
      const result = yield* authority.retract(releaseById(equipmentRecord.identity.constraintId))

      expect(result.verdict).toBe('active_holds_remaining')
      expect(result.activeConstraintCount).toBe(1)
    }).pipe(Effect.provide(ConstraintIntegrationLayer)))
  })

  it('supports natural-address retraction without target-local id synthesis', async () => {
    if (!dbAvailable) return

    await Effect.runPromise(Effect.gen(function* () {
      const authority = yield* ReactorConstraintAuthority
      const equipment = assertion({
        source: machineA,
        policyId: `constraint.sql.natural.${Date.now()}`,
      })

      yield* authority.assert(equipment)
      const result = yield* authority.retract(releaseByNaturalAddress(equipment))

      expect(result.verdict).toBe('constraint_retracted')
      expect(result.activeConstraintCount).toBe(0)
      expect(result.constraintId).toMatch(/^rc_[0-9a-f]{32}$/)
    }).pipe(Effect.provide(ConstraintIntegrationLayer)))
  })

  it('decodes addressed retractions from EntityReactionRequest payloads inside the authority', async () => {
    if (!dbAvailable) return

    await Effect.runPromise(Effect.gen(function* () {
      const authority = yield* ReactorConstraintAuthority
      const equipment = assertion({
        source: machineA,
        policyId: `constraint.sql.request.${Date.now()}`,
      })

      yield* authority.assert(equipment)
      const request = new EntityReactionRequest({
        requestId: `request.release.${Date.now()}` as never,
        capability: EntityCapabilityIds.DependencyReleased,
        source: equipment.source,
        target: equipment.target,
        signal,
        policyId: 'requires.equipment-available.releases-source' as never,
        policyVersion: '1',
        causality: new ReactorCausality({ propagationId: `${equipment.policyId}.request-release` as PropagationId }),
        payload: { naturalAddress: naturalAddress(equipment) },
      })

      const result = yield* authority.retractFromReactionRequest(request)

      expect(result.verdict).toBe('constraint_retracted')
      expect(result.activeConstraintCount).toBe(0)
      expect(result.constraintId).toMatch(/^rc_[0-9a-f]{32}$/)
    }).pipe(Effect.provide(ConstraintIntegrationLayer)))
  })

  it('requires an explicit constraint id or natural address for release requests', async () => {
    if (!dbAvailable) return

    await Effect.runPromise(Effect.gen(function* () {
      const authority = yield* ReactorConstraintAuthority
      const request = new EntityReactionRequest({
        requestId: `request.release.missing-address.${Date.now()}` as never,
        capability: EntityCapabilityIds.DependencyReleased,
        source: machineA,
        target,
        signal,
        policyId: 'requires.equipment-available.releases-source' as never,
        policyVersion: '1',
        causality: new ReactorCausality({ propagationId: `missing-address.${Date.now()}` as PropagationId }),
        payload: {},
      })

      const result = yield* authority.retractFromReactionRequest(request).pipe(Effect.either)
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('ReactorConstraintAddressRequired')
      }
    }).pipe(Effect.provide(ConstraintIntegrationLayer)))
  })

  it('returns unknown_constraint for the wrong natural address without retracting the real row', async () => {
    if (!dbAvailable) return

    await Effect.runPromise(Effect.gen(function* () {
      const authority = yield* ReactorConstraintAuthority
      const equipment = assertion({
        source: machineA,
        policyId: `constraint.sql.wrong-address.${Date.now()}`,
      })

      yield* authority.assert(equipment)
      const wrongAddress = new ReactorConstraintNaturalAddress({
        ...naturalAddress(equipment),
        source: machineB,
      })

      const result = yield* authority.retract(new ReactorConstraintRetraction({
        target,
        capability: EntityCapabilityIds.DependencyReleased,
        naturalAddress: wrongAddress,
        effect: 'release_candidate',
        signal,
        causality: new ReactorCausality({ propagationId: `${equipment.policyId}.wrong-release` as PropagationId }),
      }))
      const active = yield* authority.activeForTarget(target)

      expect(result.verdict).toBe('unknown_constraint')
      expect(result.activeConstraintCount).toBe(1)
      expect(active).toHaveLength(1)
      expect(active[0]?.identity.source.id).toBe(machineA.id)
    }).pipe(Effect.provide(ConstraintIntegrationLayer)))
  })

  it('serializes concurrent SQL retractions by target via transaction advisory lock', async () => {
    if (!dbAvailable) return

    await Effect.runPromise(Effect.gen(function* () {
      const authority = yield* ReactorConstraintAuthority
      const firstAssertion = assertion({
        source: machineA,
        policyId: `constraint.sql.concurrent.1.${Date.now()}`,
      })
      const secondAssertion = assertion({
        source: machineB,
        policyId: `constraint.sql.concurrent.2.${Date.now()}`,
      })

      const first = yield* authority.assert(firstAssertion)
      const second = yield* authority.assert(secondAssertion)

      const releases = yield* Effect.all([
        authority.retract(releaseById(first.identity.constraintId)),
        authority.retract(releaseById(second.identity.constraintId)),
      ], { concurrency: 'unbounded' })
      const active = yield* authority.activeForTarget(target)

      expect(active).toHaveLength(0)
      expect(releases.map((release) => release.verdict).sort()).toEqual([
        'active_holds_remaining',
        'constraint_retracted',
      ])
    }).pipe(Effect.provide(ConstraintIntegrationLayer)))
  })
})
