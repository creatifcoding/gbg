/**
 * TopicRouter Service — UNS Topic to DeviceId Routing
 *
 * Maps protocol topics (MQTT/Sparkplug B, OPC-UA, Modbus) to DeviceId
 * using the Unified Namespace (UNS) convention.
 *
 * Supports:
 * - Exact match: O(1) via HashMap
 * - Glob match: O(n) via pattern list (n is small -- typically < 50 routes)
 *
 * Glob matching uses simple '*' wildcard that matches a single path segment
 * (any sequence of non-'/' characters).
 *
 * @module @gbg/tmnl/iiot/adapters/device-routing
 * @see phase5-stream-architecture.md Section 3 (Topic-to-DeviceId Routing)
 */

import { Context, Effect, Schema, HashMap, Ref, Layer } from 'effect'

// =============================================================================
// TopicRoute Schema
// =============================================================================

/**
 * Route entry mapping a topic pattern to a deviceId.
 *
 * Supports:
 * - Exact match: 'spBv1.0/acme/DDATA/site-a/temp-01'
 * - Glob match: 'spBv1.0/acme/DDATA/site-a/*'
 * - OPC-UA node: 'ns=2;s=Motor01.Temperature'
 */
export const TopicRoute = Schema.Struct({
  topicPattern: Schema.String,
  deviceId: Schema.String,
  /** Optional transform (e.g., scale factor, offset for unit conversion) */
  transform: Schema.optional(Schema.Struct({
    scale: Schema.optional(Schema.Number),
    offset: Schema.optional(Schema.Number),
  })),
})
export type TopicRoute = Schema.Schema.Type<typeof TopicRoute>

// =============================================================================
// TopicRouter Service Interface
// =============================================================================

export interface TopicRouterShape {
  /** Resolve a topic string to a deviceId. Returns null if no route matches. */
  readonly resolve: (topic: string) => Effect.Effect<string | null>
  /** Register a single route. Patterns with '*' go to glob list; exact otherwise. */
  readonly register: (route: TopicRoute) => Effect.Effect<void>
  /** Register multiple routes in one call. */
  readonly registerBatch: (routes: ReadonlyArray<TopicRoute>) => Effect.Effect<void>
}

export class TopicRouter extends Context.Tag('tmnl/iiot/TopicRouter')<
  TopicRouter,
  TopicRouterShape
>() {}

// =============================================================================
// Glob Matching Helper
// =============================================================================

/**
 * Simple glob matching where '*' matches exactly one path segment
 * (any sequence of characters that are NOT '/').
 *
 * Algorithm:
 * 1. Escape regex special characters in the pattern
 * 2. Replace escaped '\*' with '[^/]+'  (one or more non-separator chars)
 * 3. Anchor with ^ and $
 * 4. Test against the topic string
 *
 * @example
 * matchGlob('spBv1.0/&#42;/DDATA/&#42;', 'spBv1.0/acme/DDATA/temp-01') // true
 * matchGlob('spBv1.0/&#42;/DDATA/&#42;', 'spBv1.0/acme/DDATA/a/b')     // false (extra segment)
 */
export const matchGlob = (pattern: string, topic: string): boolean => {
  // Escape all regex special chars except '*'
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  // Replace '*' with a pattern that matches one path segment (non-separator chars)
  const regexStr = '^' + escaped.replace(/\*/g, '[^/]+') + '$'
  return new RegExp(regexStr).test(topic)
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Creates the TopicRouter implementation backed by:
 * - HashMap<string, TopicRoute> for exact matches (O(1) lookup)
 * - ReadonlyArray<TopicRoute> for glob patterns (O(n) scan, small n)
 *
 * Routes containing '*' are classified as glob; all others as exact.
 */
const makeTopicRouter = Effect.gen(function* () {
  const exactRoutes = yield* Ref.make(HashMap.empty<string, TopicRoute>())
  const globRoutes = yield* Ref.make<ReadonlyArray<TopicRoute>>([])

  const isGlob = (pattern: string): boolean => pattern.includes('*')

  const registerSingle = (route: TopicRoute): Effect.Effect<void> => {
    if (isGlob(route.topicPattern)) {
      return Ref.update(globRoutes, (current) => [...current, route])
    }
    return Ref.update(exactRoutes, (map) =>
      HashMap.set(map, route.topicPattern, route)
    )
  }

  const resolve = (topic: string): Effect.Effect<string | null> =>
    Effect.gen(function* () {
      // 1. Try exact match first (O(1))
      const exact = yield* Ref.get(exactRoutes)
      const found = HashMap.get(exact, topic)
      if (found._tag === 'Some') {
        return found.value.deviceId
      }

      // 2. Try glob match (O(n) but glob list is small)
      const globs = yield* Ref.get(globRoutes)
      for (const route of globs) {
        if (matchGlob(route.topicPattern, topic)) {
          return route.deviceId
        }
      }

      return null
    })

  const register = (route: TopicRoute): Effect.Effect<void> =>
    registerSingle(route)

  const registerBatch = (routes: ReadonlyArray<TopicRoute>): Effect.Effect<void> =>
    Effect.forEach(routes, registerSingle, { discard: true })

  return TopicRouter.of({ resolve, register, registerBatch })
})

// =============================================================================
// Live Layer
// =============================================================================

export const TopicRouterLive: Layer.Layer<TopicRouter> = Layer.effect(
  TopicRouter,
  makeTopicRouter
)
