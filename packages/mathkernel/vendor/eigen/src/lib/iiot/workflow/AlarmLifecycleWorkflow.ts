/**
 * AlarmLifecycleWorkflow - Durable Workflow for Alarm Lifecycle Management
 *
 * Implements alarm lifecycle with:
 * - DurableDeferred for external acknowledge signals (operator ack)
 * - DurableClock for suppression timeouts (auto-clear if unacknowledged)
 *
 * Workflow stages:
 * 1. Wait for acknowledgment OR suppression timeout (race)
 * 2. If acknowledged: process acknowledgment via entity
 * 3. If timeout: auto-clear alarm (suppressed)
 * 4. Return final alarm state
 *
 * Per DeepWiki:
 * - DurableDeferred.token() creates external signal point
 * - DurableDeferred.await() suspends until external completion
 * - DurableClock.sleep() provides durable timeout
 * - Activity.make() wraps entity calls with retry semantics
 *
 * @module
 */

import { Schema, Effect, Duration, Exit } from 'effect'
import { Workflow, Activity, DurableDeferred, DurableClock } from '@effect/workflow'
import { ClusterError } from '@effect/cluster'
import { AlarmId, Alarm, AcknowledgeAlarmParams } from '../schemas'
import {
  RpcAlarmNotFoundError,
  RpcAlarmAlreadyAcknowledgedError,
  RpcAlarmAlreadyClearedError,
} from '../rpc/errors'
import { AlarmEntity } from '../entity/AlarmEntity'
import {
  AlarmLifecycleWorkflowTag,
  AlarmAcknowledgeTag,
  AlarmClearTag,
  makeAlarmAckDeferredTag,
  makeSuppressionTimeoutTag,
} from '../tags'

// =============================================================================
// Workflow Error Types
// =============================================================================

/**
 * All possible errors from the AlarmLifecycleWorkflow.
 * Rich typed errors - no flattening.
 *
 * Domain errors:
 * - RpcAlarmNotFoundError: Alarm doesn't exist
 * - RpcAlarmAlreadyAcknowledgedError: Alarm was already acknowledged
 * - RpcAlarmAlreadyClearedError: Alarm was already cleared
 *
 * Infrastructure errors (from Entity.client):
 * - ClusterError.MailboxFull: Entity mailbox full
 * - ClusterError.AlreadyProcessingMessage: Concurrent access
 * - ClusterError.PersistenceError: Storage failure
 */
export const AlarmLifecycleError = Schema.Union(
  RpcAlarmNotFoundError,
  RpcAlarmAlreadyAcknowledgedError,
  RpcAlarmAlreadyClearedError,
  ClusterError.MailboxFull,
  ClusterError.AlreadyProcessingMessage,
  ClusterError.PersistenceError,
)
export type AlarmLifecycleError = Schema.Schema.Type<typeof AlarmLifecycleError>

// =============================================================================
// Composable Error Handlers (Testable in Isolation)
// =============================================================================

/**
 * Log activity error for observability.
 * Per EFFECT_ERROR_HANDLING.md: tapError observes without recovery.
 */
const logActivityError = (activityName: string, alarmId: AlarmId, error: { _tag: string }) =>
  Effect.logWarning(`Activity "${activityName}" failed for alarm ${alarmId}: ${error._tag}`)

/**
 * Retry configuration for transient cluster errors.
 * Per DeepWiki: Activity.retry provides CurrentAttempt automatically.
 *
 * Retries: MailboxFull, AlreadyProcessingMessage (transient)
 * Does NOT retry: NotFound, AlreadyAcknowledged, AlreadyCleared (domain)
 */
const TRANSIENT_RETRY_COUNT = 3

// =============================================================================
// Workflow Definition
// =============================================================================

/**
 * Alarm Lifecycle Workflow payload
 */
export const AlarmLifecyclePayload = Schema.Struct({
  /** Alarm ID to manage */
  alarmId: AlarmId,
  /** Suppression timeout in milliseconds (default: 5 minutes) */
  suppressionTimeoutMs: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
    { default: () => 5 * 60 * 1000 }
  ),
  /** Auto-escalate timeout in milliseconds (optional) */
  autoEscalateMs: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.positive())
  ),
})
export type AlarmLifecyclePayload = Schema.Schema.Type<typeof AlarmLifecyclePayload>

/**
 * Alarm Lifecycle Workflow result
 */
export const AlarmLifecycleResult = Schema.Struct({
  /** Final alarm state */
  alarm: Alarm,
  /** Outcome of the workflow */
  outcome: Schema.Literal('acknowledged', 'auto_cleared', 'escalated'),
  /** Processing duration in milliseconds */
  processingTimeMs: Schema.Number,
})
export type AlarmLifecycleResult = Schema.Schema.Type<typeof AlarmLifecycleResult>

/**
 * AlarmLifecycleWorkflow
 *
 * Durable workflow managing alarm lifecycle from trigger to resolution.
 * Supports operator acknowledgment (external signal) and auto-clear
 * (suppression timeout).
 *
 * Idempotency: Keyed by alarmId to ensure single workflow per alarm.
 */
export const AlarmLifecycleWorkflow = Workflow.make({
  name: AlarmLifecycleWorkflowTag,
  payload: AlarmLifecyclePayload,
  success: AlarmLifecycleResult,
  error: AlarmLifecycleError,
  idempotencyKey: ({ alarmId }) => alarmId,
})

// =============================================================================
// Workflow Implementation
// =============================================================================

/**
 * AlarmLifecycleWorkflow handler layer
 *
 * Implements the workflow logic using:
 * - DurableDeferred for external acknowledgment signals
 * - DurableClock for suppression timeouts
 * - Activity for entity mutations
 */
export const AlarmLifecycleWorkflowHandler = AlarmLifecycleWorkflow.toLayer(
  Effect.fnUntraced(function* (payload) {
    const { alarmId, suppressionTimeoutMs } = payload
    const startTime = Date.now()

    yield* Effect.logInfo(`Starting alarm lifecycle workflow for ${alarmId}`)

    // ─────────────────────────────────────────────────────────────────────────
    // DurableDeferred: External acknowledgment signal
    // ─────────────────────────────────────────────────────────────────────────
    const AckSignal = DurableDeferred.make(makeAlarmAckDeferredTag(alarmId), {
      success: AcknowledgeAlarmParams,
      error: AlarmLifecycleError,
    })

    // Get token for external completion (can be shared with external systems)
    const ackToken = yield* DurableDeferred.token(AckSignal)
    yield* Effect.logDebug(`Acknowledgment token for ${alarmId}: ${ackToken}`)

    // ─────────────────────────────────────────────────────────────────────────
    // Race: Wait for acknowledgment OR timeout
    // ─────────────────────────────────────────────────────────────────────────
    const ackResult = yield* Effect.race(
      // Path 1: Wait for external acknowledgment signal
      DurableDeferred.await(AckSignal).pipe(
        Effect.map((params) => ({ type: 'acknowledged' as const, params }))
      ),
      // Path 2: Suppression timeout
      DurableClock.sleep({
        name: makeSuppressionTimeoutTag(alarmId),
        duration: Duration.millis(suppressionTimeoutMs),
        // Keep short sleeps in memory for efficiency
        inMemoryThreshold: Duration.seconds(30),
      }).pipe(
        Effect.map(() => ({ type: 'timeout' as const, params: null }))
      )
    )

    // ─────────────────────────────────────────────────────────────────────────
    // Process result based on race outcome
    // ─────────────────────────────────────────────────────────────────────────
    let finalAlarm: Alarm
    let outcome: 'acknowledged' | 'auto_cleared' | 'escalated'

    if (ackResult.type === 'acknowledged') {
      // Operator acknowledged - process via Activity
      yield* Effect.logInfo(`Alarm ${alarmId} acknowledged by operator`)

      // Activity wraps the entity call with error handling pipeline:
      // 1. tapError for observability (BEFORE retry)
      // 2. Activity.retry for transient cluster errors
      // Rich typed errors propagate: RpcAlarmNotFoundError, RpcAlarmAlreadyAcknowledgedError, cluster errors
      const activityName = `ProcessAcknowledgment-${alarmId}`
      finalAlarm = yield* Activity.make({
        name: activityName,
        success: Alarm,
        error: AlarmLifecycleError,
        execute: Effect.gen(function* () {
          const attempt = yield* Activity.CurrentAttempt
          yield* Effect.logInfo(`Processing acknowledgment for ${alarmId} (attempt ${attempt})`)

          const makeClient = yield* AlarmEntity.client
          const client = makeClient(alarmId)

          return yield* client[AlarmAcknowledgeTag]({
            alarmId,
            acknowledgedBy: ackResult.params.acknowledgedBy,
          })
        }),
      }).pipe(
        // 1. Observability: Log errors before retry (so we see each attempt)
        Effect.tapError((e) => logActivityError(activityName, alarmId, e)),
        // 2. Retry transient cluster errors (MailboxFull, AlreadyProcessingMessage)
        Activity.retry({ times: TRANSIENT_RETRY_COUNT })
      )

      outcome = 'acknowledged'
    } else {
      // Suppression timeout - auto-clear
      yield* Effect.logWarning(`Alarm ${alarmId} auto-cleared due to suppression timeout`)

      // Activity wraps the entity call with error handling pipeline:
      // 1. tapError for observability (BEFORE retry)
      // 2. Activity.retry for transient cluster errors
      // Rich typed errors propagate: RpcAlarmNotFoundError, RpcAlarmAlreadyClearedError, cluster errors
      const clearActivityName = `AutoClear-${alarmId}`
      finalAlarm = yield* Activity.make({
        name: clearActivityName,
        success: Alarm,
        error: AlarmLifecycleError,
        execute: Effect.gen(function* () {
          const attempt = yield* Activity.CurrentAttempt
          yield* Effect.logInfo(`Auto-clearing alarm ${alarmId} (attempt ${attempt})`)

          const makeClient = yield* AlarmEntity.client
          const client = makeClient(alarmId)

          return yield* client[AlarmClearTag]({ alarmId })
        }),
      }).pipe(
        // 1. Observability: Log errors before retry (so we see each attempt)
        Effect.tapError((e) => logActivityError(clearActivityName, alarmId, e)),
        // 2. Retry transient cluster errors (MailboxFull, AlreadyProcessingMessage)
        Activity.retry({ times: TRANSIENT_RETRY_COUNT })
      )

      outcome = 'auto_cleared'
    }

    const processingTimeMs = Date.now() - startTime
    yield* Effect.logInfo(
      `Alarm lifecycle workflow completed for ${alarmId}: ${outcome} in ${processingTimeMs}ms`
    )

    return {
      alarm: finalAlarm,
      outcome,
      processingTimeMs,
    }
  })
)

// =============================================================================
// External Signal API
// =============================================================================

/**
 * Acknowledge alarm externally
 *
 * Completes the DurableDeferred signal, resuming the workflow.
 * Called by external systems (UI, API) to acknowledge an alarm.
 *
 * Per @effect/workflow/DurableDeferred.ts: Token is a branded string.
 * External callers can convert string tokens using:
 *   DurableDeferred.TokenParsed.fromString(stringToken).asToken
 *
 * @param alarmId - Alarm to acknowledge
 * @param params - Acknowledgment parameters
 * @param token - Token from workflow (branded Token type, optional)
 */
export const acknowledgeAlarmExternal = (
  alarmId: AlarmId,
  params: AcknowledgeAlarmParams,
  token?: DurableDeferred.Token
) =>
  Effect.gen(function* () {
    const AckSignal = DurableDeferred.make(makeAlarmAckDeferredTag(alarmId), {
      success: AcknowledgeAlarmParams,
      error: AlarmLifecycleError,
    })

    // If token not provided, get it from the deferred
    // DurableDeferred.token() returns Effect<Token, never, WorkflowInstance>
    const resolvedToken = token ?? (yield* DurableDeferred.token(AckSignal))

    yield* DurableDeferred.done(AckSignal, {
      token: resolvedToken,
      exit: Exit.succeed(params),
    })

    yield* Effect.logInfo(`External acknowledgment signal sent for alarm ${alarmId}`)
  })

// =============================================================================
// Type Exports
// =============================================================================

export type AlarmLifecycleWorkflow = typeof AlarmLifecycleWorkflow
