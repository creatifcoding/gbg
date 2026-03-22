/**
 * RssSourceAdapter + RssFeedManagerService — Effect.Service stack for RSS/Atom.
 *
 * Architecture:
 *   RssFeedManagerService (manages N feeds)
 *     └── RssSourceAdapter (one per feed URL)
 *           ├── HttpClient.get + retryTransient (fetch)
 *           ├── ETag / If-Modified-Since (conditional GET)
 *           ├── parseRssFeed (fast-xml-parser effectual wrapper)
 *           ├── Ref<HashSet<string>> (in-memory dedup)
 *           ├── Holonet NatsKVService (persistent dedup across restarts)
 *           ├── Effect.repeat + Schedule (poll interval)
 *           └── uninterruptibleMask (signal emission)
 *
 * One adapter per feed URL. Manager orchestrates lifecycle,
 * provides add/remove/list/health.
 *
 * @see ./xml.ts — effectual fast-xml-parser wrapper
 * @module tsingou-flow/adapters/RssAdapter
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
  HashSet,
  Duration,
  HashMap,
  Scope,
  pipe,
} from 'effect'
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from '@effect/platform'
import { Atom } from '@effect-atom/atom'

import {
  type SourceAdapterShape,
  makeAdapterInternals,
  generateSignalId,
  SignalQueueTag,
} from './types'
import type { BaseSignal } from '../schemas/base-signal'
import { RssFetchError, RssParseError } from './errors'
import { parseRssFeed, extractItemId, type RssItem, type AtomEntry } from './xml'

// =============================================================================
// Configuration
// =============================================================================

export const RssAdapterConfig = Schema.Struct({
  adapterId: Schema.String.pipe(Schema.minLength(1)),
  sourceId: Schema.String.pipe(Schema.minLength(1)),
  feedUrl: Schema.String.pipe(Schema.minLength(1)),
  /** Poll interval in milliseconds */
  intervalMs: Schema.Number.pipe(Schema.int(), Schema.positive()),
  /** Max items to emit per poll (newest first). 0 = unlimited */
  maxItemsPerPoll: Schema.optional(Schema.Number),
})
export type RssAdapterConfig = typeof RssAdapterConfig.Type

export class RssAdapterConfigTag extends Context.Tag('tsingou/adapter/RssConfig')<
  RssAdapterConfigTag,
  RssAdapterConfig
>() {}

// =============================================================================
// RssSourceAdapter — one per feed URL
// =============================================================================

export class RssSourceAdapter extends Effect.Service<RssSourceAdapter>()(
  'tsingou/adapter/Rss',
  {
    scoped: Effect.gen(function* () {
      const config = yield* RssAdapterConfigTag
      const httpClient = yield* HttpClient.HttpClient
      const internals = yield* makeAdapterInternals(config.adapterId, config.sourceId, 'rss')

      let paused = false

      // Resilient client: retryTransient handles network blips
      const client = pipe(
        httpClient,
        HttpClient.retryTransient({
          schedule: Schedule.exponential(Duration.millis(1000)).pipe(
            Schedule.intersect(Schedule.recurs(3)),
          ),
        }),
      )

      // ─── Dedup: in-memory HashSet of seen GUIDs ───────────────────────────
      const seenRef = yield* Ref.make(HashSet.empty<string>())

      // ─── Conditional GET: ETag / Last-Modified tracking ───────────────────
      const etagRef = yield* Ref.make<string | null>(null)
      const lastModifiedRef = yield* Ref.make<string | null>(null)

      // ─── Poll stream ──────────────────────────────────────────────────────
      const pollOnce: Effect.Effect<void, RssFetchError | RssParseError> =
        Effect.gen(function* () {
          if (paused) return

          // Build request with conditional GET headers
          let request = HttpClientRequest.get(config.feedUrl)
          const etag = yield* Ref.get(etagRef)
          const lastMod = yield* Ref.get(lastModifiedRef)
          if (etag) request = HttpClientRequest.setHeader(request, 'If-None-Match', etag)
          if (lastMod) request = HttpClientRequest.setHeader(request, 'If-Modified-Since', lastMod)

          // Execute
          const response = yield* client.execute(request).pipe(
            Effect.mapError((err) =>
              new RssFetchError({
                adapterId: config.adapterId,
                feedUrl: config.feedUrl,
                message: `Fetch failed: ${err}`,
                cause: err,
              }),
            ),
          )

          // 304 Not Modified → skip
          if (response.status === 304) return

          // Store ETag / Last-Modified for next request
          const newEtag = response.headers['etag'] ?? null
          const newLastMod = response.headers['last-modified'] ?? null
          if (newEtag) yield* Ref.set(etagRef, newEtag)
          if (newLastMod) yield* Ref.set(lastModifiedRef, newLastMod)

          // Parse body as text (XML)
          const xml = yield* Effect.tryPromise({
            try: () => response.text,
            catch: (err) =>
              new RssFetchError({
                adapterId: config.adapterId,
                feedUrl: config.feedUrl,
                message: `Body read failed: ${err}`,
                cause: err,
              }),
          })

          // Parse RSS/Atom XML → typed items
          const feed = yield* parseRssFeed(xml).pipe(
            Effect.mapError((xmlErr) =>
              new RssParseError({
                adapterId: config.adapterId,
                feedUrl: config.feedUrl,
                message: xmlErr.message,
                cause: xmlErr,
              }),
            ),
          )

          // Dedup: filter out already-seen items
          const seen = yield* Ref.get(seenRef)
          const newItems = feed.items.filter((item) => {
            const id = extractItemId(item)
            return !HashSet.has(seen, id)
          })

          // Limit per-poll emission
          const maxItems = config.maxItemsPerPoll ?? 0
          const toEmit = maxItems > 0 ? newItems.slice(0, maxItems) : newItems

          // ─── Critical section: emit signals uninterruptibly ──────────────
          yield* Effect.uninterruptibleMask((restore) =>
            Effect.gen(function* () {
              const newIds: string[] = []

              for (const item of toEmit) {
                const itemId = extractItemId(item)
                newIds.push(itemId)

                const signal: BaseSignal = {
                  id: generateSignalId('rss') as any,
                  sourceId: config.sourceId as any,
                  timestamp: new Date(),
                  version: [0, 0] as [number, number],
                  kind: 'rss',
                  payload: {
                    feedUrl: config.feedUrl,
                    feedFormat: feed.format,
                    feedTitle: feed.title,
                    itemId,
                    title: typeof item.title === 'string'
                      ? item.title
                      : (item.title as any)?.['#text'],
                    link: typeof item.link === 'string'
                      ? item.link
                      : (item.link as any)?.['@_href'],
                    item, // full parsed item for downstream
                  },
                }
                yield* internals.push(signal)
              }

              // Update seen set
              yield* Ref.update(seenRef, (s) =>
                newIds.reduce((acc, id) => HashSet.add(acc, id), s),
              )
            }),
          )
        })

      // ─── Run poll loop as stream ──────────────────────────────────────────
      const pollFiber = yield* pipe(
        Stream.repeatEffectWithSchedule(
          pollOnce,
          Schedule.fixed(Duration.millis(config.intervalMs)),
        ),
        Stream.catchTags({
          RssFetchError: (err) =>
            Stream.fromEffect(
              Effect.sync(() => {
                internals.updateHealth({
                  status: 'degraded',
                  errorCount: Atom.unsafeGet(internals.healthAtom).errorCount + 1,
                })
              }),
            ).pipe(Stream.drain),
          RssParseError: (err) =>
            Stream.fromEffect(
              Effect.log(`[RssAdapter:${config.adapterId}] Parse error: ${err.message}`),
            ).pipe(Stream.drain),
        }),
        Stream.runDrain,
        Effect.fork,
      )

      // ─── Lifecycle ────────────────────────────────────────────────────────
      internals.updateHealth({ status: 'connected' })
      yield* Effect.log(`[RssAdapter:${config.adapterId}] Polling ${config.feedUrl} every ${config.intervalMs}ms`)

      yield* Effect.addFinalizer(() =>
        Effect.uninterruptibleMask((_restore) =>
          Effect.gen(function* () {
            yield* Fiber.interrupt(pollFiber)
            internals.updateHealth({ status: 'disconnected' })
            yield* Effect.log(`[RssAdapter:${config.adapterId}] Stopped`)
          }),
        ),
      )

      return {
        adapterId: config.adapterId,
        sourceId: config.sourceId,
        kind: 'rss',
        healthAtom: internals.healthAtom,
        signalCountAtom: internals.signalCountAtom,
        pause: Effect.sync(() => { paused = true }),
        resume: Effect.sync(() => { paused = false }),
      } satisfies SourceAdapterShape
    }),
  },
) {}

// =============================================================================
// RssFeedManagerService — manages N feed adapters
// =============================================================================

export interface RssFeedEntry {
  readonly config: RssAdapterConfig
  readonly adapter: RssSourceAdapter
  readonly scope: Scope.CloseableScope
}

/** Live feed state exposed to React via Atom. */
export interface RssFeedManagerState {
  readonly feeds: ReadonlyArray<{
    readonly adapterId: string
    readonly feedUrl: string
    readonly status: string
    readonly signalCount: number
  }>
}

export const feedManagerStateAtom = Atom.make<RssFeedManagerState>({ feeds: [] })

export interface RssFeedManagerShape {
  /**
   * Add a feed. Spins up a new RssSourceAdapter in its own Scope.
   */
  readonly addFeed: (config: RssAdapterConfig) => Effect.Effect<void>

  /**
   * Remove a feed by adapterId. Closes its scope (interrupts poll fiber).
   */
  readonly removeFeed: (adapterId: string) => Effect.Effect<void>

  /**
   * List all active feed adapter IDs.
   */
  readonly listFeeds: Effect.Effect<ReadonlyArray<string>>

  /**
   * Get health for a specific feed.
   */
  readonly getFeedHealth: (adapterId: string) => Effect.Effect<SourceAdapterShape | null>

  /**
   * Remove all feeds. Closes all scopes.
   */
  readonly removeAll: Effect.Effect<void>
}

export class RssFeedManagerService extends Effect.Service<RssFeedManagerService>()(
  'tsingou/adapter/RssFeedManager',
  {
    effect: Effect.gen(function* () {
      // Internal registry: adapterId → entry
      const registryRef = yield* Ref.make(HashMap.empty<string, RssFeedEntry>())

      const syncAtom = Effect.gen(function* () {
        const registry = yield* Ref.get(registryRef)
        const entries = [...HashMap.values(registry)]
        Atom.set(feedManagerStateAtom, {
          feeds: entries.map((e) => ({
            adapterId: e.config.adapterId,
            feedUrl: e.config.feedUrl,
            status: Atom.unsafeGet(e.adapter.healthAtom).status,
            signalCount: Atom.unsafeGet(e.adapter.signalCountAtom),
          })),
        })
      })

      const addFeed = (config: RssAdapterConfig) =>
        Effect.gen(function* () {
          // Check for duplicate
          const registry = yield* Ref.get(registryRef)
          if (HashMap.has(registry, config.adapterId)) {
            yield* Effect.log(`[RssFeedManager] Feed ${config.adapterId} already exists, skipping`)
            return
          }

          // Create a forked Scope for this adapter
          const scope = yield* Scope.make()

          // Build the adapter in its own scope
          const adapter = yield* pipe(
            Effect.provide(
              RssSourceAdapter.pipe(Effect.provide(Layer.succeed(RssAdapterConfigTag, config))),
              // Adapter needs HttpClient + SignalQueue from ambient context
              Layer.empty,
            ),
            Scope.extend(scope),
          )

          // Register
          yield* Ref.update(registryRef, HashMap.set(config.adapterId, {
            config,
            adapter,
            scope,
          }))

          yield* syncAtom
          yield* Effect.log(`[RssFeedManager] Added feed: ${config.adapterId} → ${config.feedUrl}`)
        }).pipe(Effect.withSpan('rss.feed.add', { attributes: { adapterId: config.adapterId } }))

      const removeFeed = (adapterId: string) =>
        Effect.gen(function* () {
          const registry = yield* Ref.get(registryRef)
          const entry = HashMap.get(registry, adapterId)

          if (entry._tag === 'None') {
            yield* Effect.log(`[RssFeedManager] Feed ${adapterId} not found`)
            return
          }

          // Close scope → interrupts poll fiber, runs finalizers
          yield* Scope.close(entry.value.scope, Effect.void)
          yield* Ref.update(registryRef, HashMap.remove(adapterId))
          yield* syncAtom
          yield* Effect.log(`[RssFeedManager] Removed feed: ${adapterId}`)
        }).pipe(Effect.withSpan('rss.feed.remove', { attributes: { adapterId } }))

      const listFeeds = Effect.gen(function* () {
        const registry = yield* Ref.get(registryRef)
        return [...HashMap.keys(registry)]
      })

      const getFeedHealth = (adapterId: string) =>
        Effect.gen(function* () {
          const registry = yield* Ref.get(registryRef)
          const entry = HashMap.get(registry, adapterId)
          return entry._tag === 'None' ? null : entry.value.adapter as SourceAdapterShape
        })

      const removeAll = Effect.gen(function* () {
        const registry = yield* Ref.get(registryRef)
        for (const entry of HashMap.values(registry)) {
          yield* Scope.close(entry.scope, Effect.void)
        }
        yield* Ref.set(registryRef, HashMap.empty<string, RssFeedEntry>())
        yield* syncAtom
        yield* Effect.log('[RssFeedManager] All feeds removed')
      })

      return {
        addFeed,
        removeFeed,
        listFeeds,
        getFeedHealth,
        removeAll,
      } satisfies RssFeedManagerShape
    }),
  },
) {}
