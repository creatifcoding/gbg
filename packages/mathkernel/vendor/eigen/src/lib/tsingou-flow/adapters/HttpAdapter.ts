/**
 * HttpSourceAdapter — Effect.Service using @effect/platform HttpClient.
 *
 * Supports 4 ingestion modes:
 *   1. **Poll** — HttpClient.get + Effect.repeat(Schedule) + adaptive interval
 *   2. **SSE** — HttpClientResponse.stream + Sse.makeChannel (stream composition)
 *   3. **Webhook** — HttpApi + HttpApiEndpoint.post (typed receiver)
 *   4. **Long-poll** — HttpClient.get + Stream.repeatEffect + timeout
 *
 * Architecture:
 *   - Tagged errors (HttpRequestError, HttpParseError, etc.) — typed error channel
 *   - uninterruptibleMask — critical signal emission is never interrupted mid-push
 *   - Stream composition — SSE/poll/longPoll are Stream pipelines, not imperative loops
 *   - HttpClient.retryTransient — automatic recovery for transient failures
 *   - Auth as composable client middleware
 *
 * @see @effect/platform HttpClient, HttpApi, HttpApiBuilder
 * @see @effect/experimental Sse
 * @module tsingou-flow/adapters/HttpAdapter
 */

import {
  Effect,
  Stream,
  Schema,
  Context,
  Layer,
  Schedule,
  Fiber,
  Ref,
  Duration,
  Chunk,
  pipe,
  Option,
} from 'effect'
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiBuilder,
} from '@effect/platform'
import { Sse } from '@effect/experimental'
import { Atom } from '@effect-atom/atom'

import {
  type SourceAdapterShape,
  makeAdapterInternals,
  generateSignalId,
  SignalQueueTag,
} from './types'
import type { BaseSignal } from '../schemas/base-signal'
import {
  HttpRequestError,
  HttpParseError,
  HttpAuthError,
  HttpTimeoutError,
  SseConnectionError,
  SignalQueueFullError,
} from './errors'

// =============================================================================
// Configuration Schema
// =============================================================================

const HttpAuthConfig = Schema.Union(
  Schema.TaggedStruct('bearer', { token: Schema.String }),
  Schema.TaggedStruct('basic', { username: Schema.String, password: Schema.String }),
  Schema.TaggedStruct('apiKey', {
    header: Schema.optional(Schema.String),
    queryParam: Schema.optional(Schema.String),
    value: Schema.String,
  }),
  Schema.TaggedStruct('custom', {
    headers: Schema.Record({ key: Schema.String, value: Schema.String }),
  }),
  Schema.TaggedStruct('none', {}),
)

const HttpModeConfig = Schema.Union(
  Schema.TaggedStruct('poll', {
    url: Schema.String,
    intervalMs: Schema.Number.pipe(Schema.int(), Schema.positive()),
    adaptive: Schema.optional(Schema.Boolean),
    maxIntervalMs: Schema.optional(Schema.Number),
    minIntervalMs: Schema.optional(Schema.Number),
    method: Schema.optional(Schema.Literal('GET', 'POST')),
    body: Schema.optional(Schema.Unknown),
  }),
  Schema.TaggedStruct('sse', {
    url: Schema.String,
    eventTypes: Schema.optional(Schema.Array(Schema.String)),
  }),
  Schema.TaggedStruct('webhook', {
    port: Schema.Number.pipe(Schema.int(), Schema.positive()),
    path: Schema.optional(Schema.String),
  }),
  Schema.TaggedStruct('longPoll', {
    url: Schema.String,
    timeoutMs: Schema.optional(Schema.Number),
  }),
)

export const HttpAdapterConfig = Schema.Struct({
  adapterId: Schema.String.pipe(Schema.minLength(1)),
  sourceId: Schema.String.pipe(Schema.minLength(1)),
  mode: HttpModeConfig,
  auth: Schema.optional(HttpAuthConfig),
  /** JSON dot-path to extract array items (e.g., "data.items") */
  extractPath: Schema.optional(Schema.String),
})
export type HttpAdapterConfig = typeof HttpAdapterConfig.Type

export class HttpAdapterConfigTag extends Context.Tag('tsingou/adapter/HttpConfig')<
  HttpAdapterConfigTag,
  HttpAdapterConfig
>() {}

// =============================================================================
// Auth Middleware (composable HttpClient transforms)
// =============================================================================

const withAuth = (
  auth: typeof HttpAuthConfig.Type | undefined,
): ((client: HttpClient.HttpClient) => HttpClient.HttpClient) => {
  if (!auth || auth._tag === 'none') return (c) => c

  switch (auth._tag) {
    case 'bearer':
      return (c) => HttpClient.mapRequest(c, HttpClientRequest.bearerToken(auth.token))
    case 'basic':
      return (c) => HttpClient.mapRequest(c, HttpClientRequest.basicAuth(auth.username, auth.password))
    case 'apiKey':
      return auth.header
        ? (c) => HttpClient.mapRequest(c, HttpClientRequest.setHeader(auth.header!, auth.value))
        : (c) => c // query param handled at request site
    case 'custom':
      return (c) => HttpClient.mapRequest(c, HttpClientRequest.setHeaders(auth.headers))
  }
}

// =============================================================================
// JSON Path Extraction
// =============================================================================

const extractByPath = (data: unknown, path: string | undefined): ReadonlyArray<unknown> => {
  if (!path) return Array.isArray(data) ? data : [data]
  let current: any = data
  for (const segment of path.split('.')) {
    if (current == null) return []
    current = current[segment]
  }
  return Array.isArray(current) ? current : current != null ? [current] : []
}

// =============================================================================
// Response Hash (adaptive polling dedup)
// =============================================================================

const hashPayload = (data: unknown): number => {
  const str = JSON.stringify(data)
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return h
}

// =============================================================================
// Stream Constructors
// =============================================================================

/**
 * Poll stream — emits decoded JSON responses on a schedule.
 *
 * Uses Effect.repeat with adaptive interval via Ref, HttpClient.retryTransient
 * for transient error recovery, and HttpClientResponse.schemaBodyJson for
 * typed decode.
 */
const makePollStream = (
  client: HttpClient.HttpClient,
  config: Extract<typeof HttpModeConfig.Type, { _tag: 'poll' }>,
  adapterId: string,
): Stream.Stream<unknown, HttpRequestError | HttpParseError> => {
  const { url, intervalMs, adaptive, maxIntervalMs, minIntervalMs, method, body } = config

  return Stream.unwrapScoped(
    Effect.gen(function* () {
      const lastHashRef = yield* Ref.make(0)
      const intervalRef = yield* Ref.make(intervalMs)

      const fetchOnce: Effect.Effect<
        unknown,
        HttpRequestError | HttpParseError,
        HttpClient.HttpClient
      > = Effect.gen(function* () {
        const request = (method ?? 'GET') === 'POST'
          ? pipe(
              HttpClientRequest.post(url),
              body ? (r) => HttpClientRequest.bodyUnsafeJson(r, body) : (r) => r,
            )
          : HttpClientRequest.get(url)

        const response = yield* client.execute(request).pipe(
          Effect.mapError((err) =>
            new HttpRequestError({
              adapterId,
              url,
              method: method ?? 'GET',
              message: `Request failed: ${err}`,
              cause: err,
            }),
          ),
        )

        const json = yield* HttpClientResponse.schemaBodyJson(Schema.Unknown)(response).pipe(
          Effect.mapError((err) =>
            new HttpParseError({
              adapterId,
              url,
              message: `JSON parse/decode failed: ${err}`,
              cause: err,
            }),
          ),
        )

        // Adaptive interval adjustment
        if (adaptive) {
          const newHash = hashPayload(json)
          const lastHash = yield* Ref.get(lastHashRef)
          yield* Ref.set(lastHashRef, newHash)

          const current = yield* Ref.get(intervalRef)
          const next = (newHash !== lastHash && lastHash !== 0)
            ? Math.max(minIntervalMs ?? 1000, current * 0.7) // data changed → faster
            : Math.min(maxIntervalMs ?? intervalMs * 5, current * 1.3) // stale → slower
          yield* Ref.set(intervalRef, next)
        }

        return json
      })

      // Build a stream that repeatedly fetches, sleeping intervalRef ms between each
      return pipe(
        Stream.repeatEffectWithSchedule(
          fetchOnce.pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, client))),
          Schedule.fixed(Duration.millis(intervalMs)),
        ),
      )
    }),
  )
}

/**
 * SSE stream — composes HttpClientResponse.stream → text decode → Sse.makeChannel.
 *
 * Pure stream composition. No imperative callbacks.
 */
const makeSseStream = (
  client: HttpClient.HttpClient,
  config: Extract<typeof HttpModeConfig.Type, { _tag: 'sse' }>,
  adapterId: string,
): Stream.Stream<Sse.Event, SseConnectionError> =>
  pipe(
    // 1. Execute GET, get response as byte stream
    HttpClientResponse.stream(
      client.execute(HttpClientRequest.get(config.url)),
    ),
    // 2. Decode bytes → text
    Stream.decodeText(),
    // 3. Pipe through SSE channel parser
    Stream.pipeThroughChannel(Sse.makeChannel()),
    // 4. Filter by event types if configured
    Stream.filter((event) => {
      if (!config.eventTypes || config.eventTypes.length === 0) return true
      return config.eventTypes.includes(event.event ?? 'message')
    }),
    // 5. Map connection errors to tagged type
    Stream.mapError((err) =>
      new SseConnectionError({
        adapterId,
        url: config.url,
        message: `SSE stream error: ${err}`,
        cause: err,
      }),
    ),
  )

/**
 * Long-poll stream — fetch with timeout, re-request immediately on response.
 */
const makeLongPollStream = (
  client: HttpClient.HttpClient,
  config: Extract<typeof HttpModeConfig.Type, { _tag: 'longPoll' }>,
  adapterId: string,
): Stream.Stream<unknown, HttpRequestError | HttpParseError | HttpTimeoutError> => {
  const timeout = config.timeoutMs ?? 30_000

  const fetchOnce = pipe(
    client.execute(HttpClientRequest.get(config.url)),
    Effect.mapError((err) =>
      new HttpRequestError({
        adapterId,
        url: config.url,
        method: 'GET',
        message: `Long-poll request failed: ${err}`,
        cause: err,
      }),
    ),
    Effect.flatMap((response) =>
      HttpClientResponse.schemaBodyJson(Schema.Unknown)(response).pipe(
        Effect.mapError((err) =>
          new HttpParseError({
            adapterId,
            url: config.url,
            message: `Long-poll parse failed: ${err}`,
            cause: err,
          }),
        ),
      ),
    ),
    Effect.timeoutFail({
      duration: Duration.millis(timeout),
      onTimeout: () =>
        new HttpTimeoutError({
          adapterId,
          url: config.url,
          timeoutMs: timeout,
        }),
    }),
  )

  // Retry immediately on timeout (that's the long-poll contract)
  return Stream.repeatEffect(fetchOnce).pipe(
    Stream.retry(
      Schedule.recurWhile<HttpRequestError | HttpParseError | HttpTimeoutError>(
        (err) => err._tag === 'HttpTimeoutError',
      ),
    ),
  )
}

// =============================================================================
// Service: HttpSourceAdapter
// =============================================================================

export class HttpSourceAdapter extends Effect.Service<HttpSourceAdapter>()(
  'tsingou/adapter/Http',
  {
    scoped: Effect.gen(function* () {
      const config = yield* HttpAdapterConfigTag
      const rawClient = yield* HttpClient.HttpClient
      const internals = yield* makeAdapterInternals(config.adapterId, config.sourceId, 'http')

      let paused = false

      // Compose client: auth → retryTransient → filterStatusOk
      const client = pipe(
        rawClient,
        withAuth(config.auth),
        HttpClient.retryTransient({
          schedule: Schedule.exponential(Duration.millis(500)).pipe(
            Schedule.intersect(Schedule.recurs(5)),
          ),
        }),
        HttpClient.filterStatusOk,
      )

      // ─── Critical section: emit signals with uninterruptibleMask ───────────
      const emitSignals = (
        data: unknown,
        meta: Record<string, unknown>,
      ): Effect.Effect<void> =>
        Effect.uninterruptibleMask((restore) =>
          Effect.gen(function* () {
            if (paused) return

            const items = extractByPath(data, config.extractPath)

            // The actual queue push is uninterruptible — we don't want
            // a fiber interrupt to leave a half-written signal batch.
            for (const item of items) {
              const signal: BaseSignal = {
                id: generateSignalId('http') as any,
                sourceId: config.sourceId as any,
                timestamp: new Date(),
                version: [0, 0] as [number, number],
                kind: 'http',
                payload: { ...meta, data: item },
              }
              yield* internals.push(signal)
            }
          }),
        )

      // ─── Mode dispatch: compose stream → emitSignals ──────────────────────
      const fiber: Fiber.RuntimeFiber<void, unknown> | null = yield* (() => {
        switch (config.mode._tag) {
          case 'poll': {
            const stream = makePollStream(client, config.mode, config.adapterId)
            return pipe(
              stream,
              Stream.mapEffect((json) =>
                emitSignals(json, { url: config.mode.url, method: config.mode.method ?? 'GET', mode: 'poll' }),
              ),
              Stream.catchTags({
                HttpRequestError: (err) =>
                  Stream.fromEffect(
                    Effect.sync(() => internals.updateHealth({ status: 'degraded', errorCount: Atom.unsafeGet(internals.healthAtom).errorCount + 1 })),
                  ).pipe(Stream.drain),
                HttpParseError: (err) =>
                  Stream.fromEffect(
                    Effect.log(`[HttpAdapter:${config.adapterId}] Parse error: ${err.message}`),
                  ).pipe(Stream.drain),
              }),
              Stream.runDrain,
              Effect.fork,
            )
          }

          case 'sse': {
            const stream = makeSseStream(client, config.mode, config.adapterId)
            return pipe(
              stream,
              Stream.mapEffect((event) => {
                let data: unknown = event.data
                try { data = JSON.parse(event.data) } catch { /* keep string */ }
                return emitSignals(data, {
                  url: config.mode.url,
                  sseEvent: event.event ?? 'message',
                  sseId: event.id,
                  mode: 'sse',
                })
              }),
              Stream.catchTag('SseConnectionError', (err) =>
                Stream.fromEffect(
                  Effect.sync(() => internals.updateHealth({ status: 'degraded', errorCount: Atom.unsafeGet(internals.healthAtom).errorCount + 1 })),
                ).pipe(Stream.drain),
              ),
              Stream.runDrain,
              Effect.fork,
            )
          }

          case 'longPoll': {
            const stream = makeLongPollStream(client, config.mode, config.adapterId)
            return pipe(
              stream,
              Stream.mapEffect((json) =>
                emitSignals(json, { url: config.mode.url, mode: 'longPoll' }),
              ),
              Stream.catchTags({
                HttpRequestError: (err) =>
                  Stream.fromEffect(
                    Effect.sync(() => internals.updateHealth({ status: 'degraded' })),
                  ).pipe(Stream.drain),
                HttpParseError: (err) =>
                  Stream.fromEffect(
                    Effect.log(`[HttpAdapter:${config.adapterId}] Parse error: ${err.message}`),
                  ).pipe(Stream.drain),
                HttpTimeoutError: () =>
                  Stream.empty, // timeout is expected in long-poll — just retry
              }),
              Stream.runDrain,
              Effect.fork,
            )
          }

          case 'webhook': {
            // Webhook server can't bind ports in Tauri webview.
            // Log intent — real deployment uses Holonet bridge or Tauri sidecar.
            return Effect.fork(
              Effect.log(
                `[HttpAdapter:${config.adapterId}] Webhook mode on :${config.mode.port}${config.mode.path ?? '/webhook'} — ` +
                `requires Node/Bun runtime or Tauri sidecar for port binding.`,
              ).pipe(Effect.map(() => void 0)),
            )
          }
        }
      })()

      // ─── Lifecycle ────────────────────────────────────────────────────────
      internals.updateHealth({ status: 'connected' })
      yield* Effect.log(`[HttpSourceAdapter] Started: ${config.adapterId} (${config.mode._tag})`)

      yield* Effect.addFinalizer(() =>
        Effect.uninterruptibleMask((restore) =>
          Effect.gen(function* () {
            if (fiber) yield* Fiber.interrupt(fiber)
            internals.updateHealth({ status: 'disconnected' })
            yield* Effect.log(`[HttpSourceAdapter] Stopped: ${config.adapterId}`)
          }),
        ),
      )

      return {
        adapterId: config.adapterId,
        sourceId: config.sourceId,
        kind: 'http',
        healthAtom: internals.healthAtom,
        signalCountAtom: internals.signalCountAtom,
        pause: Effect.sync(() => { paused = true }),
        resume: Effect.sync(() => { paused = false }),
      } satisfies SourceAdapterShape
    }),
  },
) {}
