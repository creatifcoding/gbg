/**
 * AgentTaskCommandRouterService
 *
 * Validates and routes task commands received from NATS micro endpoints.
 *
 * Responsibilities:
 * - Decode/validate command payloads via Effect Schema
 * - Emit audit logs via AgentTaskService.publishLog()
 * - Publish command lifecycle events via NatsPubSubService
 * - Return typed acknowledgement payloads for request/reply handlers
 *
 * @module agent-task/services/AgentTaskCommandRouterService
 */

import { Context, Data, DateTime, Effect, Layer, Schema } from 'effect'
import { nanoid } from 'nanoid'
import { AgentTaskService } from './AgentTaskService'
import { NatsPubSubService } from '../../holonet/nats/pubsub'
import {
  AgentTaskCommand,
  AgentTaskCommandAck,
  AgentTaskCommandEvent,
  AgentTaskCommandSchema,
  AgentTaskCommandEventSchema,
} from '../schemas/command'
import { AgentTaskLogEntry } from '../schemas/log-entry'

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CommandDecodeError extends Data.TaggedError('AgentTask/CommandDecodeError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class CommandRouteError extends Data.TaggedError('AgentTask/CommandRouteError')<{
  readonly message: string
  readonly taskId: string
  readonly action: string
  readonly cause?: unknown
}> {}

export class CommandEventPublishError extends Data.TaggedError('AgentTask/CommandEventPublishError')<{
  readonly message: string
  readonly taskId: string
  readonly cause?: unknown
}> {}

export type AgentTaskCommandRouterError =
  | CommandDecodeError
  | CommandRouteError
  | CommandEventPublishError

// ---------------------------------------------------------------------------
// Subject helpers
// ---------------------------------------------------------------------------

export const resolveTaskCommandEventsSubject = (taskId: string): string =>
  `agent.task.${taskId}.commands.events`

// ---------------------------------------------------------------------------
// Service shape
// ---------------------------------------------------------------------------

export interface AgentTaskCommandRouterServiceShape {
  /** Decode a command payload and normalize defaults. */
  readonly decode: (
    payload: unknown,
    taskIdFromSubject?: string,
  ) => Effect.Effect<AgentTaskCommand, CommandDecodeError>

  /** Route a validated command and return an acknowledgement. */
  readonly route: (
    command: AgentTaskCommand,
  ) => Effect.Effect<AgentTaskCommandAck, AgentTaskCommandRouterError>

  /** Decode + route in one step. */
  readonly routePayload: (
    payload: unknown,
    taskIdFromSubject?: string,
  ) => Effect.Effect<AgentTaskCommandAck, AgentTaskCommandRouterError>
}

// ---------------------------------------------------------------------------
// Context.Tag
// ---------------------------------------------------------------------------

export class AgentTaskCommandRouterService extends Context.Tag(
  'AgentTask/AgentTaskCommandRouterService',
)<AgentTaskCommandRouterService, AgentTaskCommandRouterServiceShape>() {}

// ---------------------------------------------------------------------------
// Live implementation
// ---------------------------------------------------------------------------

const make = Effect.gen(function* () {
  const tasks = yield* AgentTaskService
  const pubsub = yield* NatsPubSubService

  const decode: AgentTaskCommandRouterServiceShape['decode'] = (
    payload,
    taskIdFromSubject,
  ) =>
    Effect.gen(function* () {
      const now = yield* DateTime.now

      const normalized =
        typeof payload === 'object' && payload !== null
          ? {
              ...(payload as Record<string, unknown>),
              taskId:
                (payload as Record<string, unknown>).taskId ?? taskIdFromSubject,
              createdAt:
                (payload as Record<string, unknown>).createdAt ?? now,
            }
          : payload

      return yield* Schema.decodeUnknown(AgentTaskCommandSchema)(normalized).pipe(
        Effect.mapError(
          (cause) =>
            new CommandDecodeError({
              message: 'Invalid AgentTaskCommand payload',
              cause,
            }),
        ),
      )
    })

  const route: AgentTaskCommandRouterServiceShape['route'] = (command) =>
    Effect.gen(function* () {
      const now = yield* DateTime.now
      const commandId =
        command.commandId ??
        `cmd-${command.taskId}-${nanoid(10)}`

      // 1) Audit log entry for visibility in existing log stream UI
      const logEntry = new AgentTaskLogEntry({
        id: commandId,
        timestamp: now,
        level: 'INFO',
        source: 'agent-task.micro.command-router',
        message: `Command received: ${command.action}`,
        parentTaskId: command.taskId,
        metadata: {
          requestedBy: command.requestedBy ?? 'unknown',
          reason: command.reason ?? null,
          action: command.action,
        },
      })

      yield* tasks.publishLog(command.taskId, logEntry).pipe(
        Effect.mapError(
          (cause) =>
            new CommandRouteError({
              message: 'Failed to publish command audit log',
              taskId: command.taskId,
              action: command.action,
              cause,
            }),
        ),
      )

      // 2) Ack payload for request/reply
      const ack = new AgentTaskCommandAck({
        taskId: command.taskId,
        action: command.action,
        status: 'queued',
        message: `Command '${command.action}' queued for executor`,
        commandId,
        handledBy: 'agent-task.micro.command-router',
        receivedAt: now,
      })

      // 3) Event fan-out for observers
      const event = new AgentTaskCommandEvent({
        taskId: command.taskId,
        kind: 'command.acknowledged',
        command,
        ack,
        emittedAt: now,
      })

      yield* pubsub
        .publish(
          resolveTaskCommandEventsSubject(command.taskId),
          AgentTaskCommandEventSchema,
          event,
        )
        .pipe(
          Effect.mapError(
            (cause) =>
              new CommandEventPublishError({
                message: 'Failed to publish command event',
                taskId: command.taskId,
                cause,
              }),
          ),
        )

      return ack
    })

  const routePayload: AgentTaskCommandRouterServiceShape['routePayload'] = (
    payload,
    taskIdFromSubject,
  ) =>
    decode(payload, taskIdFromSubject).pipe(
      Effect.flatMap(route),
    )

  return {
    decode,
    route,
    routePayload,
  } satisfies AgentTaskCommandRouterServiceShape
})

export const AgentTaskCommandRouterServiceLive = Layer.effect(
  AgentTaskCommandRouterService,
  make,
)
