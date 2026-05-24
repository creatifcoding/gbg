/**
 * ReactorConstraintAuthority — SQL-first constraint subsystem.
 *
 * This service owns durable constraint identity, idempotent assertion,
 * target-scoped retraction ordering, and active constraint queries. Target
 * contracts must not synthesize constraint ids locally; they call this service
 * with explicit assertion/retraction commands.
 *
 * @module
 */

import { Context, Effect, Layer, Option, ParseResult, Schema } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import {
  ReactorConstraintAssertion,
  EntityReactionRequest,
  ReactorConstraintEffects,
  ReactorConstraintNaturalAddress,
  ReactorConstraintRecord,
  ReactorConstraintRetraction,
  ReactorConstraintRetractionPayload,
  ReactorConstraintStates,
  TargetConstraintReconciliationResult,
} from '../../schemas/reactor'
import { RelationshipEndpoint } from '../../schemas/relationships'
import {
  ReactorAdmissionControl,
  reactorAdmissionControlPassthrough,
} from './ReactorAdmissionControl'

export class ReactorConstraintAddressRequired extends Schema.TaggedError<ReactorConstraintAddressRequired>()(
  'ReactorConstraintAddressRequired',
  {
    message: Schema.String,
  },
) {}

export type ReactorConstraintAuthorityError =
  | SqlError.SqlError
  | ParseResult.ParseError
  | ReactorConstraintAddressRequired

export interface ReactorConstraintAuthorityShape {
  /**
   * Assert a source-derived target constraint.
   *
   * SQL natural-key uniqueness is authoritative. Callers do not supply
   * constraint ids; SQL derives the returned surrogate id from the natural key.
   */
  readonly assert: (
    assertion: ReactorConstraintAssertion,
  ) => Effect.Effect<ReactorConstraintRecord, ReactorConstraintAuthorityError>

  /**
   * Retract one addressed constraint and return the target reconciliation
   * verdict for the active constraint set after retraction.
   */
  readonly retract: (
    retraction: ReactorConstraintRetraction,
  ) => Effect.Effect<TargetConstraintReconciliationResult, ReactorConstraintAuthorityError>

  /**
   * Decode an EntityReactionRequest payload into an explicitly addressed
   * retraction command. This keeps target contracts out of payload parsing and
   * constraint-id construction.
   */
  readonly retractFromReactionRequest: (
    request: EntityReactionRequest,
  ) => Effect.Effect<TargetConstraintReconciliationResult, ReactorConstraintAuthorityError>

  /** Query currently active constraints for a target. */
  readonly activeForTarget: (
    target: RelationshipEndpoint,
  ) => Effect.Effect<readonly ReactorConstraintRecord[], ReactorConstraintAuthorityError>
}

export class ReactorConstraintAuthority extends Context.Tag('iiot/ReactorConstraintAuthority')<
  ReactorConstraintAuthority,
  ReactorConstraintAuthorityShape
>() {}

const SELECT_CONSTRAINT_COLUMNS = `
  constraint_id AS "constraintId",
  target_type AS "targetType",
  target_id AS "targetId",
  capability,
  family,
  source_type AS "sourceType",
  source_id AS "sourceId",
  relationship_edge_type AS "relationshipEdgeType",
  policy_id AS "policyId",
  policy_version AS "policyVersion",
  policy_epoch AS "policyEpoch",
  registry_fingerprint AS "registryFingerprint",
  source_entry_id AS "sourceEntryId",
  source_event AS "sourceEvent",
  propagation_id AS "propagationId",
  state,
  effect,
  asserted_at AS "assertedAt",
  retracted_at AS "retractedAt",
  metadata
`

const normalizeConstraintRow = (row: unknown): unknown => {
  if (typeof row !== 'object' || row === null) return row
  const record = row as Record<string, unknown>
  return {
    _tag: 'ReactorConstraintRecord',
    identity: {
      _tag: 'ReactorConstraintIdentity',
      constraintId: record.constraintId,
      target: {
        _tag: 'RelationshipEndpoint',
        type: record.targetType,
        id: record.targetId,
      },
      capability: record.capability,
      family: record.family,
      source: {
        _tag: 'RelationshipEndpoint',
        type: record.sourceType,
        id: record.sourceId,
      },
      relationshipEdgeType: record.relationshipEdgeType,
      policyId: record.policyId,
      policyVersion: record.policyVersion,
      policyEpoch: record.policyEpoch,
      registryFingerprint: record.registryFingerprint,
      sourceEntryId: record.sourceEntryId,
      sourceEvent: record.sourceEvent,
      propagationId: record.propagationId,
    },
    state: record.state,
    effect: record.effect,
    assertedAt: record.assertedAt,
    retractedAt: record.retractedAt ?? undefined,
    metadata: record.metadata ?? {},
  }
}

const decodeConstraint = (row: unknown): Effect.Effect<ReactorConstraintRecord, ParseResult.ParseError> =>
  Schema.decodeUnknown(ReactorConstraintRecord)(normalizeConstraintRow(row))

const decodeConstraints = (rows: readonly unknown[]): Effect.Effect<readonly ReactorConstraintRecord[], ParseResult.ParseError> =>
  Schema.decodeUnknown(Schema.Array(ReactorConstraintRecord))(rows.map(normalizeConstraintRow))

const targetKey = (target: RelationshipEndpoint): string => `${target.type}:${target.id}`

const endpointKey = (endpoint: RelationshipEndpoint): string => `${endpoint.type}:${endpoint.id}`

const naturalAddressKey = (address: ReactorConstraintNaturalAddress): string => JSON.stringify({
  target: endpointKey(address.target),
  capability: address.capability,
  source: endpointKey(address.source),
  relationshipEdgeType: address.relationshipEdgeType,
  policyId: address.policyId,
  propagationId: address.propagationId,
})

const assertionSingleflightKey = (assertion: ReactorConstraintAssertion): string => JSON.stringify({
  target: endpointKey(assertion.target),
  capability: assertion.capability,
  family: assertion.family,
  source: endpointKey(assertion.source),
  relationshipEdgeType: assertion.relationshipEdgeType,
  policyId: assertion.policyId,
  policyVersion: assertion.policyVersion,
  policyEpoch: assertion.policyEpoch,
  registryFingerprint: assertion.registryFingerprint,
  sourceEntryId: assertion.sourceEntryId,
  sourceEvent: assertion.sourceEvent,
  propagationId: assertion.propagationId,
  effect: assertion.effect,
  metadata: assertion.metadata,
})

const retractionSingleflightKey = (retraction: ReactorConstraintRetraction): string => JSON.stringify({
  target: endpointKey(retraction.target),
  capability: retraction.capability,
  constraintId: retraction.constraintId,
  naturalAddress: retraction.naturalAddress !== undefined
    ? naturalAddressKey(retraction.naturalAddress)
    : undefined,
  effect: retraction.effect,
  signal: {
    axis: retraction.signal.axis,
    kind: retraction.signal.kind,
    value: retraction.signal.value,
    previousValue: retraction.signal.previousValue,
    reason: retraction.signal.reason,
    metadata: retraction.signal.metadata,
  },
  propagationId: retraction.causality.propagationId,
  causedByPropagationId: retraction.causality.causedByPropagationId,
  metadata: retraction.metadata,
})

const lockTargetForTransaction = (
  sql: SqlClient.SqlClient,
  target: RelationshipEndpoint,
) => sql`SELECT pg_advisory_xact_lock(hashtext(${targetKey(target)})::bigint)`

const activeCount = (
  sql: SqlClient.SqlClient,
  target: RelationshipEndpoint,
) =>
  Effect.gen(function* () {
    const rows = yield* sql<{ count: number }>`
      SELECT COUNT(*)::integer AS count
      FROM iiot.reactor_constraints
      WHERE target_type = ${target.type}
        AND target_id = ${target.id}
        AND state = ${ReactorConstraintStates.Asserted}
    `
    return rows[0]?.count ?? 0
  })

const selectByNaturalAddress = (
  sql: SqlClient.SqlClient,
  address: ReactorConstraintNaturalAddress,
) => sql<unknown>`
  SELECT ${sql.unsafe(SELECT_CONSTRAINT_COLUMNS)}
  FROM iiot.reactor_constraints
  WHERE target_type = ${address.target.type}
    AND target_id = ${address.target.id}
    AND capability = ${address.capability}
    AND source_type = ${address.source.type}
    AND source_id = ${address.source.id}
    AND relationship_edge_type = ${address.relationshipEdgeType}
    AND policy_id = ${address.policyId}
    AND propagation_id = ${address.propagationId}
  FOR UPDATE
`

export const ReactorConstraintAuthoritySqlLive = Layer.effect(
  ReactorConstraintAuthority,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const admissionOption = yield* Effect.serviceOption(ReactorAdmissionControl)
    const admission = Option.getOrElse(admissionOption, () => reactorAdmissionControlPassthrough)

    const activeForTarget: ReactorConstraintAuthorityShape['activeForTarget'] = (target) =>
      admission.withSqlBudget(Effect.gen(function* () {
        const rows = yield* sql<unknown>`
          SELECT ${sql.unsafe(SELECT_CONSTRAINT_COLUMNS)}
          FROM iiot.reactor_constraints
          WHERE target_type = ${target.type}
            AND target_id = ${target.id}
            AND state = ${ReactorConstraintStates.Asserted}
          ORDER BY asserted_at ASC
        `
        return yield* decodeConstraints(rows)
      })).pipe(Effect.withSpan('iiot.reactor.constraintAuthority.activeForTarget'))

    const assert: ReactorConstraintAuthorityShape['assert'] = (assertion) =>
      admission.withConstraintSingleflight(assertionSingleflightKey(assertion), admission.withSqlBudget(Effect.gen(function* () {
        const rows = yield* sql<unknown>`
          INSERT INTO iiot.reactor_constraints (
            target_type,
            target_id,
            capability,
            family,
            source_type,
            source_id,
            relationship_edge_type,
            policy_id,
            policy_version,
            policy_epoch,
            registry_fingerprint,
            source_entry_id,
            source_event,
            propagation_id,
            state,
            effect,
            metadata
          ) VALUES (
            ${assertion.target.type},
            ${assertion.target.id},
            ${assertion.capability},
            ${assertion.family},
            ${assertion.source.type},
            ${assertion.source.id},
            ${assertion.relationshipEdgeType},
            ${assertion.policyId},
            ${assertion.policyVersion},
            ${assertion.policyEpoch},
            ${assertion.registryFingerprint},
            ${assertion.sourceEntryId},
            ${assertion.sourceEvent},
            ${assertion.propagationId},
            ${ReactorConstraintStates.Asserted},
            ${assertion.effect},
            ${assertion.metadata}
          )
          ON CONFLICT (
            target_type,
            target_id,
            capability,
            source_type,
            source_id,
            relationship_edge_type,
            policy_id,
            propagation_id
          ) DO UPDATE
          SET metadata = iiot.reactor_constraints.metadata || EXCLUDED.metadata
          RETURNING ${sql.unsafe(SELECT_CONSTRAINT_COLUMNS)}
        `
        return yield* decodeConstraint(rows[0])
      }))).pipe(Effect.withSpan('iiot.reactor.constraintAuthority.assert'))

    const retract: ReactorConstraintAuthorityShape['retract'] = (retraction) =>
      admission.withConstraintSingleflight(retractionSingleflightKey(retraction), admission.withSqlBudget(Effect.gen(function* () {
        return yield* sql.withTransaction(
          Effect.gen(function* () {
            yield* lockTargetForTransaction(sql, retraction.target)

            const rows = retraction.constraintId !== undefined
              ? yield* sql<unknown>`
                SELECT ${sql.unsafe(SELECT_CONSTRAINT_COLUMNS)}
                FROM iiot.reactor_constraints
                WHERE constraint_id = ${retraction.constraintId}
                FOR UPDATE
              `
              : retraction.naturalAddress !== undefined
                ? yield* selectByNaturalAddress(sql, retraction.naturalAddress)
                : yield* Effect.fail(new ReactorConstraintAddressRequired({
                  message: 'Constraint retraction requires constraintId or naturalAddress.',
                }))

            if (rows.length === 0) {
              const count = yield* activeCount(sql, retraction.target)
              return new TargetConstraintReconciliationResult({
                target: retraction.target,
                capability: retraction.capability,
                constraintId: retraction.constraintId,
                verdict: 'unknown_constraint',
                activeConstraintCount: count,
                reason: 'Constraint was not present in SQL authority.',
              })
            }

            const current = yield* decodeConstraint(rows[0])
            if (current.state === ReactorConstraintStates.Retracted) {
              const count = yield* activeCount(sql, retraction.target)
              return new TargetConstraintReconciliationResult({
                target: retraction.target,
                capability: retraction.capability,
                constraintId: current.identity.constraintId,
                verdict: 'idempotent',
                activeConstraintCount: count,
                reason: 'Constraint was already retracted in SQL authority.',
              })
            }

            yield* sql<unknown>`
              UPDATE iiot.reactor_constraints
              SET state = ${ReactorConstraintStates.Retracted},
                  effect = ${retraction.effect},
                  retracted_at = NOW(),
                  metadata = metadata || ${{
                    releaseSignalAxis: retraction.signal.axis,
                    releaseSignalValue: retraction.signal.value,
                    ...retraction.metadata,
                  }}::jsonb
              WHERE constraint_id = ${current.identity.constraintId}
            `

            const count = yield* activeCount(sql, retraction.target)
            return new TargetConstraintReconciliationResult({
              target: retraction.target,
              capability: retraction.capability,
              constraintId: current.identity.constraintId,
              verdict: count === 0 ? 'constraint_retracted' : 'active_holds_remaining',
              activeConstraintCount: count,
              reason: count === 0
                ? 'All target constraints are clear in SQL authority.'
                : 'Other target constraints remain active in SQL authority.',
            })
          }),
        )
      }))).pipe(Effect.withSpan('iiot.reactor.constraintAuthority.retract'))

    const retractFromReactionRequest: ReactorConstraintAuthorityShape['retractFromReactionRequest'] = (request) =>
      Effect.gen(function* () {
        const payload = yield* Schema.decodeUnknown(ReactorConstraintRetractionPayload)(request.payload)
        return yield* retract(new ReactorConstraintRetraction({
          target: request.target,
          capability: request.capability,
          constraintId: payload.constraintId,
          naturalAddress: payload.naturalAddress,
          effect: payload.effect ?? ReactorConstraintEffects.ReleaseCandidate,
          signal: request.signal,
          causality: request.causality,
          metadata: payload.metadata,
        }))
      }).pipe(Effect.withSpan('iiot.reactor.constraintAuthority.retractFromReactionRequest'))

    return ReactorConstraintAuthority.of({
      assert,
      retract,
      retractFromReactionRequest,
      activeForTarget,
    })
  }),
)
