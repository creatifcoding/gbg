/**
 * AgentTaskMicroHostService
 *
 * Hosts a discoverable NATS micro service for agent-task command control.
 *
 * Control-plane endpoint (request/reply):
 * - agent.task.*.commands
 *
 * Data-plane streams remain in existing services:
 * - agent.task.{taskId}.logs
 * - agent.task.{taskId}.commands.events
 *
 * @module agent-task/services/AgentTaskMicroHostService
 */

import { Data, Effect, Schema } from 'effect'
import type { ServiceIdentity, ServiceInfo, ServiceStats } from 'nats.ws'

import { NatsMicroService } from '../../holonet/nats/micro'
import { AgentTaskCommandRouterService } from './AgentTaskCommandRouterService'
import { AgentTaskCommandAckSchema } from '../schemas/command'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AGENT_TASK_MICRO_SERVICE_NAME = 'agent-task'
export const AGENT_TASK_MICRO_SERVICE_VERSION = '0.1.0'
export const AGENT_TASK_COMMAND_SUBJECT = 'agent.task.*.commands'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract taskId from subject pattern `agent.task.{taskId}.commands`. */
export const extractTaskIdFromCommandSubject = (
  subject: string,
): string | null => {
  const parts = subject.split('.')
  if (parts.length !== 4) return null
  if (parts[0] !== 'agent' || parts[1] !== 'task' || parts[3] !== 'commands') {
    return null
  }
  return parts[2] || null
}

class InvalidCommandSubjectError extends Data.TaggedError(
  'AgentTask/InvalidCommandSubjectError',
)<{ readonly subject: string; readonly message: string }> {}

class InvalidCommandPayloadError extends Data.TaggedError(
  'AgentTask/InvalidCommandPayloadError',
)<{ readonly message: string; readonly cause?: unknown }> {}

// ---------------------------------------------------------------------------
// Service shape
// ---------------------------------------------------------------------------

export interface AgentTaskMicroHostServiceShape {
  /** Service name/id for diagnostics. */
  readonly identity: () => Effect.Effect<ServiceIdentity>

  /** Full service info (endpoints, metadata). */
  readonly info: () => Effect.Effect<ServiceInfo>

  /** Runtime stats (requests/errors/latency). */
  readonly stats: () => Effect.Effect<ServiceStats>

  /** Manual stop (in addition to scoped release). */
  readonly stop: (err?: Error) => Effect.Effect<void>
}

// ---------------------------------------------------------------------------
// Context.Tag
// ---------------------------------------------------------------------------

export class AgentTaskMicroHostService extends Effect.Service<AgentTaskMicroHostService>()(
  'AgentTask/AgentTaskMicroHostService',
  {
    scoped: Effect.gen(function* () {
      const micro = yield* NatsMicroService
      const router = yield* AgentTaskCommandRouterService

      const service = yield* micro.addScoped({
        name: AGENT_TASK_MICRO_SERVICE_NAME,
        version: AGENT_TASK_MICRO_SERVICE_VERSION,
        description: 'Agent task command control plane',
        metadata: {
          domain: 'agent',
          bounded_context: 'agent-task',
          endpoint: AGENT_TASK_COMMAND_SUBJECT,
        },
        queue: 'agent-task-control',
      })

      // Register command endpoint after service startup.
      service.addEndpoint('task-command', {
        subject: AGENT_TASK_COMMAND_SUBJECT,
        metadata: {
          description: 'Routes task control commands to command router',
          request: 'AgentTaskCommand',
          response: 'AgentTaskCommandAck',
        },
        handler: (err, msg) => {
          if (err) {
            Effect.runFork(micro.stop(service, err).pipe(Effect.ignore))
            return
          }

          const handleCommand = Effect.gen(function* () {
            const taskIdFromSubject = extractTaskIdFromCommandSubject(msg.subject)
            if (!taskIdFromSubject) {
              return yield* Effect.fail(
                new InvalidCommandSubjectError({
                  subject: msg.subject,
                  message: `Invalid command subject: '${msg.subject}'`,
                }),
              )
            }

            const payload = yield* Effect.try({
              try: () => (msg.data.length > 0 ? msg.json<unknown>() : {}),
              catch: (cause) =>
                new InvalidCommandPayloadError({
                  message: 'Invalid JSON command payload',
                  cause,
                }),
            })

            const ack = yield* router.routePayload(payload, taskIdFromSubject)
            const encodedAck = yield* Schema.encode(AgentTaskCommandAckSchema)(ack)

            yield* Effect.sync(() => {
              msg.respond(JSON.stringify(encodedAck))
            })
          }).pipe(
            Effect.catchTags({
              'AgentTask/InvalidCommandSubjectError': (cause) =>
                Effect.sync(() => {
                  msg.respondError(400, cause.message)
                }),
              'AgentTask/InvalidCommandPayloadError': (cause) =>
                Effect.sync(() => {
                  msg.respondError(400, cause.message)
                }),
              'AgentTask/CommandDecodeError': (cause) =>
                Effect.sync(() => {
                  msg.respondError(400, cause.message)
                }),
            }),
            Effect.catchAll((cause) =>
              Effect.sync(() => {
                const tagged = cause as { message?: string }
                msg.respondError(500, tagged.message ?? 'Command routing failed')
              }),
            ),
          )

          Effect.runFork(handleCommand)
        },
      })

      return {
        identity: () => Effect.sync(() => service.ping()),
        info: () => Effect.sync(() => service.info()),
        stats: () =>
          Effect.tryPromise({
            try: () => service.stats(),
            catch: (cause) =>
              new Error(`Failed to retrieve agent-task micro stats: ${String(cause)}`),
          }),
        stop: (err?: Error) => micro.stop(service, err),
      } satisfies AgentTaskMicroHostServiceShape
    }),
  },
) {}

export const AgentTaskMicroHostServiceLive = AgentTaskMicroHostService.Default
