/**
 * Target-owned constraint reconciliation mock helpers.
 *
 * This module is intentionally Effect v3-compatible and intentionally local.
 * It uses STM/TMap plus an in-process Semaphore for deterministic mock trials.
 * It is NOT distributed authority. SQL authority lives in
 * `ReactorConstraintAuthoritySqlLive`.
 */

import { Context, DateTime, Effect, Layer, Option, STM, TMap } from 'effect'
import {
  ReactorConstraintRecord,
  TargetConstraintReconciliationRequest,
  TargetConstraintReconciliationResult,
} from '../../schemas/reactor'
import { RelationshipEndpoint } from '../../schemas/relationships'

export interface TargetConstraintLedgerShape {
  readonly assertConstraint: (record: ReactorConstraintRecord) => Effect.Effect<ReactorConstraintRecord>
  readonly retractConstraint: (
    request: TargetConstraintReconciliationRequest,
  ) => Effect.Effect<TargetConstraintReconciliationResult>
  readonly activeForTarget: (
    target: RelationshipEndpoint,
  ) => Effect.Effect<readonly ReactorConstraintRecord[]>
}

export class TargetConstraintLedger extends Context.Tag('iiot/TargetConstraintLedger')<
  TargetConstraintLedger,
  TargetConstraintLedgerShape
>() {}

const targetKey = (target: RelationshipEndpoint): string => `${target.type}:${target.id}`

const isActiveConstraint = (record: ReactorConstraintRecord): boolean => record.state === 'asserted'

const sameTarget = (record: ReactorConstraintRecord, target: RelationshipEndpoint): boolean =>
  targetKey(record.identity.target) === targetKey(target)

const activeForTargetSTM = (
  records: TMap.TMap<string, ReactorConstraintRecord>,
  target: RelationshipEndpoint,
) =>
  TMap.values(records).pipe(
    STM.map((values) => values.filter((record) => sameTarget(record, target) && isActiveConstraint(record))),
  )

export const TargetConstraintLedgerInMemory = Layer.effect(
  TargetConstraintLedger,
  Effect.gen(function* () {
    const records = yield* STM.commit(TMap.empty<string, ReactorConstraintRecord>())
    const mutex = yield* Effect.makeSemaphore(1)

    const activeForTarget = (target: RelationshipEndpoint) =>
      STM.commit(activeForTargetSTM(records, target))

    const assertConstraint = (record: ReactorConstraintRecord) =>
      STM.commit(
        TMap.set(records, record.identity.constraintId, record).pipe(
          STM.as(record),
        ),
      ).pipe(Effect.withSpan('iiot.reactor.constraints.mock.assert'))

    const retractConstraint = (request: TargetConstraintReconciliationRequest) =>
      Effect.gen(function* () {
        const now = yield* DateTime.now

        return yield* STM.commit(
          STM.gen(function* () {
            const current = yield* TMap.get(records, request.constraint.constraintId)

            if (Option.isNone(current)) {
              const active = yield* activeForTargetSTM(records, request.target)
              return new TargetConstraintReconciliationResult({
                target: request.target,
                capability: request.capability,
                constraintId: request.constraint.constraintId,
                verdict: 'unknown_constraint',
                activeConstraintCount: active.length,
                reason: 'Constraint was not present in the target mock ledger.',
              })
            }

            if (current.value.state === 'retracted') {
              const active = yield* activeForTargetSTM(records, request.target)
              return new TargetConstraintReconciliationResult({
                target: request.target,
                capability: request.capability,
                constraintId: request.constraint.constraintId,
                verdict: 'idempotent',
                activeConstraintCount: active.length,
                reason: 'Constraint was already retracted in the target mock ledger.',
              })
            }

            const retracted = new ReactorConstraintRecord({
              ...current.value,
              state: 'retracted',
              effect: request.effect,
              retractedAt: now,
              metadata: {
                ...current.value.metadata,
                releaseSignalAxis: request.signal.axis,
                releaseSignalValue: request.signal.value,
              },
            })

            yield* TMap.set(records, request.constraint.constraintId, retracted)
            const active = yield* activeForTargetSTM(records, request.target)

            return new TargetConstraintReconciliationResult({
              target: request.target,
              capability: request.capability,
              constraintId: request.constraint.constraintId,
              verdict: active.length === 0 ? 'constraint_retracted' : 'active_holds_remaining',
              activeConstraintCount: active.length,
              reason: active.length === 0
                ? 'All target constraints in this mock ledger are clear.'
                : 'Other target constraints remain active in the mock ledger.',
            })
          }),
        )
      }).pipe(
        mutex.withPermits(1),
        Effect.withSpan('iiot.reactor.constraints.mock.retract'),
      )

    return TargetConstraintLedger.of({
      assertConstraint,
      retractConstraint,
      activeForTarget,
    })
  }),
)
