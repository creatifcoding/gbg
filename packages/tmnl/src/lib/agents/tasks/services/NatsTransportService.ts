/**
 * NatsTransportService — Production transport via holonet/nats.
 *
 * Subscribes to NATS subjects following the AGENT domain convention:
 *   agent.task.{taskId}.logs
 *
 * Uses NatsPubSubService for core pub/sub and the SubjectSpec pattern
 * for structured subject management.
 *
 * @module agent-task/services/NatsTransportService
 */

import {
  Context,
  Effect,
  Layer,
  Stream,
  Schema,
  Scope,
  pipe,
} from 'effect'
import {
  TransportService,
  TransportSubscribeError,
  TransportPublishError,
} from './TransportService'
import { NatsPubSubService } from '../../../holonet/nats/pubsub'

// ---------------------------------------------------------------------------
// Subject convention for agent task logs
// ---------------------------------------------------------------------------

/**
 * NATS subject pattern for agent task logs.
 * Convention: agent.task.{taskId}.logs
 *
 * This follows the domain convention pattern from holonet/subject/conventions.
 * Future: register via DomainConventionRegistry with an AGENT convention.
 */
const resolveLogSubject = (taskId: string): string =>
  `agent.task.${taskId}.logs`

/**
 * Wildcard for subscribing to all task logs.
 * agent.task.*.logs
 */
export const AGENT_TASK_LOGS_WILDCARD = 'agent.task.*.logs'

// ---------------------------------------------------------------------------
// Wire payload schema
// ---------------------------------------------------------------------------

/**
 * Wire payload can be either:
 * 1) JSON-encoded string line (published via NatsPubSubService + Schema.String)
 * 2) Raw JSON object bytes (published by ad-hoc producers / nats CLI helpers)
 *
 * We normalize to JSONL string for downstream CodecService.
 */
const WirePayload = Schema.Unknown

const normalizeWirePayloadToLine = (payload: unknown): string =>
  typeof payload === 'string' ? payload : JSON.stringify(payload)

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const makeNatsTransport = Effect.gen(function* () {
  const pubsub = yield* NatsPubSubService

  const shape: TransportService['Type'] = {
    subscribe: (taskId) =>
      Effect.gen(function* () {
        const subject = resolveLogSubject(taskId)

        const typedStream = yield* pubsub.subscribe(subject, WirePayload).pipe(
          Effect.mapError(
            (err) =>
              new TransportSubscribeError(
                `Failed to subscribe to ${subject}`,
                err,
              ),
          ),
        )

        // Normalize payloads to JSONL line strings for CodecService.
        return pipe(
          typedStream,
          Stream.map((msg) => normalizeWirePayloadToLine(msg.data)),
          Stream.mapError(
            (err) =>
              new TransportSubscribeError(
                `Stream error on ${subject}`,
                err,
              ),
          ),
        )
      }),

    publish: (taskId, line) =>
      pubsub.publish(resolveLogSubject(taskId), WirePayload, line).pipe(
        Effect.mapError(
          (err) =>
            new TransportPublishError(
              `Failed to publish to ${resolveLogSubject(taskId)}`,
              err,
            ),
        ),
      ),
  }

  return shape
})

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

/**
 * NatsTransportServiceLive — requires NatsPubSubService in context.
 *
 * Usage:
 * ```typescript
 * const AppLayer = Layer.mergeAll(
 *   NatsTransportServiceLive,
 *   NatsPubSubServiceLive,
 *   // ... other deps
 * )
 * ```
 */
export const NatsTransportServiceLive = Layer.effect(
  TransportService,
  makeNatsTransport,
)
