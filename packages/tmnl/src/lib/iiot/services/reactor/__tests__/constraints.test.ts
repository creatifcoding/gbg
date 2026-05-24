import { DateTime, Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import type { PropagationId } from '../../../schemas/identifiers'
import type {
  ReactorPolicyEpoch,
  ReactorRegistryFingerprint,
} from '../../../schemas/reactor'
import {
  EntityCapabilityIds,
  RelationshipEndpoint,
} from '../../../schemas/relationships'
import {
  ObservationSignal,
  ReactorCausality,
  ReactorConstraintIdentity,
  ReactorConstraintRecord,
  TargetConstraintReconciliationRequest,
} from '../../../schemas/reactor'
import {
  TargetConstraintLedger,
  TargetConstraintLedgerInMemory,
} from '../constraints'

const target = new RelationshipEndpoint({ type: 'work_order', id: 'WO-CONSTRAINT-001' })
const machineA = new RelationshipEndpoint({ type: 'machine', id: 'MCH-CONSTRAINT-A' })
const machineB = new RelationshipEndpoint({ type: 'machine', id: 'MCH-CONSTRAINT-B' })
const safetySource = new RelationshipEndpoint({ type: 'alarm', id: 'ALM-SAFETY-001' })

const signal = new ObservationSignal({
  axis: 'equipment.availability',
  kind: 'condition_retracted',
  value: 'available',
  previousValue: 'unavailable',
  reason: 'release mock test',
})

const causality = (id: string) => new ReactorCausality({
  propagationId: id as PropagationId,
})

const constraint = (input: {
  readonly id: string
  readonly source: RelationshipEndpoint
  readonly capability?: typeof EntityCapabilityIds.DependencyBlocked | typeof EntityCapabilityIds.SafetyHold
  readonly family?: 'dependency' | 'safety'
  readonly propagationId?: string
}) => new ReactorConstraintIdentity({
  constraintId: input.id as never,
  target,
  capability: input.capability ?? EntityCapabilityIds.DependencyBlocked,
  family: input.family ?? 'dependency',
  source: input.source,
  relationshipEdgeType: input.family === 'safety' ? 'triggered_by' : 'requires',
  policyId: `${input.id}.policy` as never,
  policyVersion: '1',
  policyEpoch: 'reactor-policy-epoch.test' as ReactorPolicyEpoch,
  registryFingerprint: 'fnv1a32:test' as ReactorRegistryFingerprint,
  sourceEntryId: `${input.id}.entry` as never,
  sourceEvent: input.family === 'safety' ? 'AlarmTriggered' : 'FaultDetected',
  propagationId: (input.propagationId ?? `${input.id}.propagation`) as PropagationId,
})

const assertedRecord = (identity: ReactorConstraintIdentity) => new ReactorConstraintRecord({
  identity,
  state: 'asserted',
  effect: identity.family === 'safety' ? 'holding' : 'blocking',
  assertedAt: DateTime.unsafeNow(),
})

const releaseRequest = (identity: ReactorConstraintIdentity) => new TargetConstraintReconciliationRequest({
  target,
  capability: EntityCapabilityIds.DependencyReleased,
  constraint: identity,
  requestedState: 'retracted',
  effect: 'release_candidate',
  signal,
  causality: causality(`${identity.constraintId}.release`),
})

const runWithLedger = <A, E>(program: Effect.Effect<A, E, TargetConstraintLedger>) =>
  Effect.runPromise(program.pipe(Effect.provide(TargetConstraintLedgerInMemory)))

describe('TargetConstraintLedgerInMemory', () => {
  it('retracts the final active constraint without implying a target transition', async () => {
    const result = await runWithLedger(Effect.gen(function* () {
      const ledger = yield* TargetConstraintLedger
      const equipment = constraint({ id: 'constraint:equipment:1', source: machineA })

      yield* ledger.assertConstraint(assertedRecord(equipment))
      return yield* ledger.retractConstraint(releaseRequest(equipment))
    }))

    expect(result.verdict).toBe('constraint_retracted')
    expect(result.activeConstraintCount).toBe(0)
  })

  it('keeps the target held when another active constraint remains', async () => {
    const result = await runWithLedger(Effect.gen(function* () {
      const ledger = yield* TargetConstraintLedger
      const equipment = constraint({ id: 'constraint:equipment:2', source: machineA })
      const safety = constraint({
        id: 'constraint:safety:2',
        source: safetySource,
        capability: EntityCapabilityIds.SafetyHold,
        family: 'safety',
      })

      yield* ledger.assertConstraint(assertedRecord(equipment))
      yield* ledger.assertConstraint(assertedRecord(safety))
      return yield* ledger.retractConstraint(releaseRequest(equipment))
    }))

    expect(result.verdict).toBe('active_holds_remaining')
    expect(result.activeConstraintCount).toBe(1)
  })

  it('classifies duplicate retraction as idempotent', async () => {
    const results = await runWithLedger(Effect.gen(function* () {
      const ledger = yield* TargetConstraintLedger
      const equipment = constraint({ id: 'constraint:equipment:3', source: machineA })
      const request = releaseRequest(equipment)

      yield* ledger.assertConstraint(assertedRecord(equipment))
      const first = yield* ledger.retractConstraint(request)
      const second = yield* ledger.retractConstraint(request)
      return [first, second] as const
    }))

    expect(results[0].verdict).toBe('constraint_retracted')
    expect(results[1].verdict).toBe('idempotent')
    expect(results[1].activeConstraintCount).toBe(0)
  })

  it('does not invent a constraint for an unknown release', async () => {
    const result = await runWithLedger(Effect.gen(function* () {
      const ledger = yield* TargetConstraintLedger
      const equipment = constraint({ id: 'constraint:missing', source: machineA })
      return yield* ledger.retractConstraint(releaseRequest(equipment))
    }))

    expect(result.verdict).toBe('unknown_constraint')
    expect(result.activeConstraintCount).toBe(0)
  })

  it('serializes concurrent mock retractions while preserving all-clear outcome', async () => {
    const result = await runWithLedger(Effect.gen(function* () {
      const ledger = yield* TargetConstraintLedger
      const first = constraint({ id: 'constraint:concurrent:1', source: machineA })
      const second = constraint({ id: 'constraint:concurrent:2', source: machineB })

      yield* ledger.assertConstraint(assertedRecord(first))
      yield* ledger.assertConstraint(assertedRecord(second))

      const releases = yield* Effect.all([
        ledger.retractConstraint(releaseRequest(first)),
        ledger.retractConstraint(releaseRequest(second)),
      ], { concurrency: 'unbounded' })
      const active = yield* ledger.activeForTarget(target)
      return { releases, active }
    }))

    expect(result.active).toHaveLength(0)
    expect(result.releases.map((release) => release.verdict).sort()).toEqual([
      'active_holds_remaining',
      'constraint_retracted',
    ])
  })
})
