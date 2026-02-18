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
// Raw line schema — transport deals in strings
// ---------------------------------------------------------------------------

/** Schema for raw JSONL string transport. PubSub encodes/decodes as string. */
const RawLine = Schema.String

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const makeNatsTransport = Effect.gen(function* () {
  const pubsub = yield* NatsPubSubService

  const shape: TransportService['Type'] = {
    subscribe: (taskId) =>
      Effect.gen(function* () {
        const subject = resolveLogSubject(taskId)

        const typedStream = yield* pubsub.subscribe(subject, RawLine).pipe(
          Effect.mapError(
            (err) =>
              new TransportSubscribeError(
                `Failed to subscribe to ${subject}`,
                err,
              ),
          ),
        )

        // Extract raw string data from typed messages
        return pipe(
          typedStream,
          Stream.map((msg) => msg.data),
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
      pubsub.publish(resolveLogSubject(taskId), RawLine, line).pipe(
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
