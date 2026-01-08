/**
 * AVA Traced Operations Utility
 *
 * Provides systematic Effect.fn tagging for AVA operations.
 * All operations are traced with consistent naming convention:
 * `ava.{domain}.{operation}`
 *
 * Effect.fn creates traced functions with automatic span creation,
 * stack traces, and timing metrics.
 *
 * @pattern Effect.fn for traced functions
 * @see https://effect.website/docs/tracing
 * @module
 */

import { Effect } from 'effect'

// ============================================================================
// Types
// ============================================================================

/**
 * AVA domain categories for tracing
 */
export type AvaDomain =
  | 'subscription' // View subscription lifecycle
  | 'artifact' // Artifact processing
  | 'delta' // Delta processing
  | 'channel' // Channel hydration
  | 'nats' // NATS transport
  | 'reconciler' // Reconciler events
  | 'cache' // Caching operations

/**
 * Traced operation metadata
 */
export interface TracedOperationMeta {
  readonly domain: AvaDomain
  readonly operation: string
  readonly description?: string
}

// ============================================================================
// Effect.fn Traced Factory
// ============================================================================

/**
 * Creates a traced Effect.fn with systematic AVA naming.
 *
 * Naming convention: `ava.{domain}.{operation}`
 *
 * @example
 * ```typescript
 * // Create a traced subscription operation
 * export const subscribeToView = avaFn(
 *   'subscription', 'subscribe',
 *   (viewId: ViewId) =>
 *     Effect.gen(function* () {
 *       const client = yield* AvaClientV2
 *       return yield* client.subscribeToView(viewId)
 *     })
 * )
 *
 * // Invoke like any Effect.fn
 * yield* subscribeToView('truck-42')
 * ```
 *
 * @param domain - The AVA domain category
 * @param operation - The specific operation name
 * @param body - The Effect function body
 */
export function avaFn<Args extends readonly unknown[], A, E, R>(
  domain: AvaDomain,
  operation: string,
  body: (...args: Args) => Effect.Effect<A, E, R>
): (...args: Args) => Effect.Effect<A, E, R> {
  const spanName = `ava.${domain}.${operation}`
  return Effect.fn(spanName)(body)
}

/**
 * Creates a traced Effect.fn with full metadata.
 *
 * @example
 * ```typescript
 * export const hydrateChannel = avaFnWithMeta(
 *   {
 *     domain: 'channel',
 *     operation: 'hydrate',
 *     description: 'Hydrate channel data from backend',
 *   },
 *   (channelId: ChannelId, viewId: ViewId) =>
 *     Effect.gen(function* () {
 *       // ...
 *     })
 * )
 * ```
 */
export function avaFnWithMeta<Args extends readonly unknown[], A, E, R>(
  meta: TracedOperationMeta,
  body: (...args: Args) => Effect.Effect<A, E, R>
): (...args: Args) => Effect.Effect<A, E, R> {
  const spanName = `ava.${meta.domain}.${meta.operation}`
  const fn = Effect.fn(spanName)(body)

  // If description provided, we can add it as span attribute
  if (meta.description) {
    return (...args: Args) =>
      fn(...args).pipe(
        Effect.withSpan(spanName, {
          attributes: { description: meta.description },
        })
      )
  }

  return fn
}

// ============================================================================
// Span Utilities
// ============================================================================

/**
 * Wrap an effect with an AVA span for tracing.
 *
 * @example
 * ```typescript
 * yield* pipe(
 *   client.subscribeArtifact(viewId),
 *   Stream.runDrain,
 *   withAvaSpan('subscription', 'streamArtifacts', { viewId })
 * )
 * ```
 */
export function withAvaSpan<A, E, R>(
  domain: AvaDomain,
  operation: string,
  attributes?: Record<string, unknown>
): (effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R> {
  const spanName = `ava.${domain}.${operation}`
  return (effect) =>
    Effect.withSpan(spanName, { attributes })(effect)
}

/**
 * Add AVA context attributes to the current span.
 *
 * @example
 * ```typescript
 * yield* annotateAvaSpan({
 *   viewId: 'truck-42',
 *   channelCount: 5,
 *   hydratedCount: 3,
 * })
 * ```
 */
export function annotateAvaSpan(
  attributes: Record<string, unknown>
): Effect.Effect<void> {
  return Effect.annotateCurrentSpan(attributes)
}

/**
 * Log an event within the current AVA span.
 *
 * @example
 * ```typescript
 * yield* logAvaEvent('artifact_received', {
 *   viewId: artifact.viewId,
 *   version: artifact.version,
 * })
 * ```
 */
export function logAvaEvent(
  name: string,
  attributes?: Record<string, unknown>
): Effect.Effect<void> {
  return Effect.logInfo(`ava.event.${name}`).pipe(
    Effect.annotateLogs(attributes ?? {})
  )
}

// ============================================================================
// Pre-built Traced Operations (Domain-Specific)
// ============================================================================

/**
 * Subscription domain traced operations
 */
export const subscriptionOps = {
  /** Trace a subscribe operation */
  subscribe: <A, E, R>(body: Effect.Effect<A, E, R>) =>
    body.pipe(withAvaSpan('subscription', 'subscribe')),

  /** Trace an unsubscribe operation */
  unsubscribe: <A, E, R>(body: Effect.Effect<A, E, R>) =>
    body.pipe(withAvaSpan('subscription', 'unsubscribe')),

  /** Trace an invalidation request */
  invalidate: <A, E, R>(body: Effect.Effect<A, E, R>) =>
    body.pipe(withAvaSpan('subscription', 'invalidate')),
}

/**
 * Artifact domain traced operations
 */
export const artifactOps = {
  /** Trace artifact decode */
  decode: <A, E, R>(body: Effect.Effect<A, E, R>) =>
    body.pipe(withAvaSpan('artifact', 'decode')),

  /** Trace artifact store */
  store: <A, E, R>(body: Effect.Effect<A, E, R>) =>
    body.pipe(withAvaSpan('artifact', 'store')),

  /** Trace artifact fetch */
  fetch: <A, E, R>(body: Effect.Effect<A, E, R>) =>
    body.pipe(withAvaSpan('artifact', 'fetch')),
}

/**
 * Channel domain traced operations
 */
export const channelOps = {
  /** Trace channel hydration */
  hydrate: <A, E, R>(body: Effect.Effect<A, E, R>) =>
    body.pipe(withAvaSpan('channel', 'hydrate')),

  /** Trace channel data extraction */
  extract: <A, E, R>(body: Effect.Effect<A, E, R>) =>
    body.pipe(withAvaSpan('channel', 'extract')),
}

/**
 * NATS domain traced operations
 */
export const natsOps = {
  /** Trace NATS connection */
  connect: <A, E, R>(body: Effect.Effect<A, E, R>) =>
    body.pipe(withAvaSpan('nats', 'connect')),

  /** Trace NATS publish */
  publish: <A, E, R>(body: Effect.Effect<A, E, R>) =>
    body.pipe(withAvaSpan('nats', 'publish')),

  /** Trace NATS subscription */
  subscribe: <A, E, R>(body: Effect.Effect<A, E, R>) =>
    body.pipe(withAvaSpan('nats', 'subscribe')),
}

// ============================================================================
// Tracer Utilities (Optional - for development)
// ============================================================================

/**
 * Enable AVA tracing by wrapping an effect with console logging.
 * Lightweight alternative to full Tracer implementation.
 *
 * @example
 * ```typescript
 * yield* subscribeToView('truck-42').pipe(
 *   withAvaTraceLog('subscribe', { viewId: 'truck-42' })
 * )
 * ```
 */
export function withAvaTraceLog<A, E, R>(
  operation: string,
  metadata?: Record<string, unknown>
): (effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R> {
  return (effect) =>
    Effect.suspend(() => {
      const start = Date.now()
      console.log(`[AVA] START ${operation}`, metadata)

      return effect.pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            const duration = Date.now() - start
            console.log(`[AVA] END ${operation} (${duration}ms)`, metadata)
          })
        ),
        Effect.tapErrorCause((cause) =>
          Effect.sync(() => {
            const duration = Date.now() - start
            console.log(`[AVA] FAIL ${operation} (${duration}ms)`, {
              ...metadata,
              error: cause,
            })
          })
        )
      )
    })
}
