/**
 * NexEventWatcher Service
 *
 * Effect service for monitoring NEX lifecycle events:
 * - Workload started/stopped events
 * - Node started/stopped events
 * - Workload logs (stdout/stderr)
 *
 * @module nex/services/events
 */

import { Effect, Stream, Config } from 'effect'
import type { Msg } from 'nats.ws'
import { NatsInnerService } from '@/lib/holonet/nats/inner'
import { MessageDecoder } from '../decoder'
import { EventSubscriptionError } from '../errors'
import {
  NexEvent,
  WorkloadStartedEvent,
  WorkloadStoppedEvent,
  LogEntry,
} from '../schemas'

// =============================================================================
// Service Implementation
// =============================================================================

export class NexEventWatcher extends Effect.Service<NexEventWatcher>()(
  'nex/EventWatcher',
  {
    effect: Effect.gen(function* () {
      const nats = yield* NatsInnerService
      const decoder = yield* MessageDecoder

      // Load namespace from config
      const namespace = yield* Config.string('NEX_NAMESPACE').pipe(
        Config.withDefault('default')
      )

      // ─────────────────────────────────────────────────────────────────────────
      // Event Streams
      // ─────────────────────────────────────────────────────────────────────────

      /**
       * Subscribe to all NEX lifecycle events.
       *
       * @returns Stream of NexEvent (WorkloadStarted, WorkloadStopped, etc.)
       */
      const watchEvents = () =>
        Effect.gen(function* () {
          const subject = `$NEX.FEED.${namespace}.event.>`

          const sub = yield* nats.core.subscribe(subject).pipe(
            Effect.mapError(
              (error) =>
                new EventSubscriptionError({
                  message: `Failed to subscribe to events: ${error}`,
                  subject,
                  cause: error,
                })
            )
          )

          // Create async iterable wrapper
          const subIterable: AsyncIterable<Msg> = {
            [Symbol.asyncIterator]: () => sub[Symbol.asyncIterator](),
          }

          return Stream.fromAsyncIterable(subIterable, (e) => e as Error).pipe(
            Stream.mapEffect((msg) =>
              decoder.decodeBytes(NexEvent)(msg.data).pipe(
                Effect.tapError((err) =>
                  Effect.logDebug(`Event decode error: ${err.message}`)
                ),
                Effect.option
              )
            ),
            Stream.filterMap((opt) => opt)
          )
        })

      /**
       * Subscribe to workload started events only.
       */
      const watchWorkloadStarted = () =>
        Effect.gen(function* () {
          const subject = `$NEX.FEED.${namespace}.event.WorkloadStarted`

          const sub = yield* nats.core.subscribe(subject).pipe(
            Effect.mapError(
              (error) =>
                new EventSubscriptionError({
                  message: `Failed to subscribe: ${error}`,
                  subject,
                  cause: error,
                })
            )
          )

          const subIterable: AsyncIterable<Msg> = {
            [Symbol.asyncIterator]: () => sub[Symbol.asyncIterator](),
          }

          return Stream.fromAsyncIterable(subIterable, (e) => e as Error).pipe(
            Stream.mapEffect((msg) =>
              decoder.decodeBytes(WorkloadStartedEvent)(msg.data).pipe(
                Effect.option
              )
            ),
            Stream.filterMap((opt) => opt)
          )
        })

      /**
       * Subscribe to workload stopped events only.
       */
      const watchWorkloadStopped = () =>
        Effect.gen(function* () {
          const subject = `$NEX.FEED.${namespace}.event.WorkloadStopped`

          const sub = yield* nats.core.subscribe(subject).pipe(
            Effect.mapError(
              (error) =>
                new EventSubscriptionError({
                  message: `Failed to subscribe: ${error}`,
                  subject,
                  cause: error,
                })
            )
          )

          const subIterable: AsyncIterable<Msg> = {
            [Symbol.asyncIterator]: () => sub[Symbol.asyncIterator](),
          }

          return Stream.fromAsyncIterable(subIterable, (e) => e as Error).pipe(
            Stream.mapEffect((msg) =>
              decoder.decodeBytes(WorkloadStoppedEvent)(msg.data).pipe(
                Effect.option
              )
            ),
            Stream.filterMap((opt) => opt)
          )
        })

      // ─────────────────────────────────────────────────────────────────────────
      // Log Streams
      // ─────────────────────────────────────────────────────────────────────────

      /**
       * Subscribe to workload logs.
       *
       * @param workloadId - Optional: filter to specific workload
       * @returns Stream of LogEntry
       */
      const watchLogs = (workloadId?: string) =>
        Effect.gen(function* () {
          const subject = workloadId
            ? `$NEX.FEED.${namespace}.logs.${workloadId}.>`
            : `$NEX.FEED.${namespace}.logs.>`

          const sub = yield* nats.core.subscribe(subject).pipe(
            Effect.mapError(
              (error) =>
                new EventSubscriptionError({
                  message: `Failed to subscribe to logs: ${error}`,
                  subject,
                  cause: error,
                })
            )
          )

          const subIterable: AsyncIterable<Msg> = {
            [Symbol.asyncIterator]: () => sub[Symbol.asyncIterator](),
          }

          return Stream.fromAsyncIterable(subIterable, (e) => e as Error).pipe(
            Stream.map((msg) => {
              const parts = msg.subject.split('.')
              // Subject format: $NEX.FEED.<ns>.logs.<wid>.<stream>
              const wid = parts[4] ?? 'unknown'
              const streamType = msg.subject.endsWith('.out')
                ? 'stdout'
                : 'stderr'

              const entry: LogEntry = {
                workloadId: wid,
                stream: streamType,
                data: new TextDecoder().decode(msg.data),
                timestamp: new Date(),
              }

              return entry
            })
          )
        })

      /**
       * Subscribe to stdout only for a workload.
       */
      const watchStdout = (workloadId: string) =>
        Effect.gen(function* () {
          const subject = `$NEX.FEED.${namespace}.logs.${workloadId}.out`

          const sub = yield* nats.core.subscribe(subject).pipe(
            Effect.mapError(
              (error) =>
                new EventSubscriptionError({
                  message: `Failed to subscribe to stdout: ${error}`,
                  subject,
                  cause: error,
                })
            )
          )

          const subIterable: AsyncIterable<Msg> = {
            [Symbol.asyncIterator]: () => sub[Symbol.asyncIterator](),
          }

          return Stream.fromAsyncIterable(subIterable, (e) => e as Error).pipe(
            Stream.map((msg) => new TextDecoder().decode(msg.data))
          )
        })

      /**
       * Subscribe to stderr only for a workload.
       */
      const watchStderr = (workloadId: string) =>
        Effect.gen(function* () {
          const subject = `$NEX.FEED.${namespace}.logs.${workloadId}.err`

          const sub = yield* nats.core.subscribe(subject).pipe(
            Effect.mapError(
              (error) =>
                new EventSubscriptionError({
                  message: `Failed to subscribe to stderr: ${error}`,
                  subject,
                  cause: error,
                })
            )
          )

          const subIterable: AsyncIterable<Msg> = {
            [Symbol.asyncIterator]: () => sub[Symbol.asyncIterator](),
          }

          return Stream.fromAsyncIterable(subIterable, (e) => e as Error).pipe(
            Stream.map((msg) => new TextDecoder().decode(msg.data))
          )
        })

      // ─────────────────────────────────────────────────────────────────────────
      // Service API
      // ─────────────────────────────────────────────────────────────────────────

      return {
        namespace,

        // Event streams
        watchEvents,
        watchWorkloadStarted,
        watchWorkloadStopped,

        // Log streams
        watchLogs,
        watchStdout,
        watchStderr,
      } as const
    }),
    dependencies: [NatsInnerService.Default, MessageDecoder.Default],
  }
) {}

// =============================================================================
// Layer Exports
// =============================================================================

export const NexEventWatcherLive = NexEventWatcher.Default
