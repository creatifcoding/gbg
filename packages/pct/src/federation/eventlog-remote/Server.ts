/**
 * PCT EventLogRemote server layer (Flow C substrate).
 *
 * This is the first PCT-owned adapter around Effect-smol's native
 * EventLogRemote RPC handlers. It deliberately speaks in EventJournal
 * `Entry` / `RemoteEntry` terms, not RegistryDelta terms.
 *
 * Status: server handler layer plus HTTP route layer. It wires writes
 * into the local EventJournal and serves registry journal entries through
 * Effect-smol RPC over the same HttpRouter used by `pact serve`.
 *
 * @module @tmnl/pct/federation/eventlog-remote/Server
 */

import * as Context from "effect-v4/Context"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Redacted from "effect-v4/Redacted"
import * as Schema from "effect-v4/Schema"
import * as Stream from "effect-v4/Stream"
import * as EventJournal from "effect-v4/unstable/eventlog/EventJournal"
import * as EventLog from "effect-v4/unstable/eventlog/EventLog"
import * as EventLogMessage from "effect-v4/unstable/eventlog/EventLogMessage"
import {
  ChangesRpc,
  ChunkedMessage,
  EventLogAuthentication,
  EventLogProtocolError,
  HelloResponse,
  SingleMessage,
  StoreId,
  WriteEntriesUnencrypted,
} from "effect-v4/unstable/eventlog/EventLogMessage"
import * as EventLogSessionAuth from "effect-v4/unstable/eventlog/EventLogSessionAuth"
import * as RpcSerialization from "effect-v4/unstable/rpc/RpcSerialization"
import * as RpcServer from "effect-v4/unstable/rpc/RpcServer"

export { PctRegistryStoreId } from "../../registry/StoreId.js"

export interface ServerLayerOptions {
  readonly storeId?: StoreId
}

export interface RouteLayerOptions extends ServerLayerOptions {
  readonly path?: `/${string}`
}

export const DEFAULT_RPC_PATH = "/federation/eventlog-remote" as const

const protocolError = (options: {
  readonly requestTag: string
  readonly publicKey?: string
  readonly storeId?: StoreId
  readonly code: "Unauthorized" | "Forbidden" | "NotFound" | "InvalidRequest" | "InternalServerError"
  readonly message: string
}) => new EventLogProtocolError(options)

const assertStore = (
  expected: StoreId,
  actual: StoreId,
  requestTag: string,
  publicKey?: string,
): Effect.Effect<void, EventLogProtocolError> =>
  actual === expected
    ? Effect.void
    : Effect.fail(
        protocolError({
          requestTag,
          ...(publicKey !== undefined ? { publicKey } : {}),
          storeId: actual,
          code: "NotFound",
          message: `Unknown PCT EventLog store: ${actual}`,
        }),
      )

const replayEntry = (options: {
  readonly registry: EventLog.Registry["Service"]
  readonly identity: EventLog.Identity["Service"]
  readonly storeId: StoreId
  readonly entry: EventJournal.Entry
  readonly conflicts: ReadonlyArray<EventJournal.Entry>
}): Effect.Effect<void, unknown, unknown> =>
  Effect.gen(function* () {
    const handler = options.registry.handlers.get(options.entry.event)
    if (handler === undefined) return

    const decodePayload = Schema.decodeUnknownEffect(handler.event.payloadMsgPack)
    const payload = (yield* decodePayload(options.entry.payload).pipe(
      Effect.updateContext((input) => Context.merge(handler.context, input)),
    )) as never

    yield* handler.handler({
      storeId: options.storeId,
      payload,
      entry: options.entry,
      conflicts: [],
    }).pipe(
      Effect.updateContext((input) => Context.merge(handler.context, input)),
      Effect.provideService(EventLog.Identity, options.identity),
      Effect.asVoid,
    )
  })

/**
 * Build RPC handlers for PCT registry EventLogRemote replication.
 *
 * Requirements are the same runtime pieces used by the PCT registry:
 * `EventJournal`, `EventLog.Registry`, and `EventLog.Identity`.
 */
export const layerRpcHandlers = (options: ServerLayerOptions = {}) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const storeId = options.storeId ?? (yield* EventLog.CurrentStoreId)
      const journal = yield* EventJournal.EventJournal
      const registry = yield* EventLog.Registry
      const identity = yield* EventLog.Identity
      const remoteId = EventJournal.makeRemoteIdUnsafe()
      const sessionBindings = new Map<string, Uint8Array<ArrayBuffer>>()
      const remoteIdsByPublicKey = new Map<string, EventJournal.RemoteId>()
      const sequencesByPublicKey = new Map<string, number>()

      const remoteIdFor = (publicKey: string): EventJournal.RemoteId => {
        const existing = remoteIdsByPublicKey.get(publicKey)
        if (existing !== undefined) return existing
        const created = EventJournal.makeRemoteIdUnsafe()
        remoteIdsByPublicKey.set(publicKey, created)
        return created
      }

      const nextRemoteEntries = (
        publicKey: string,
        entries: ReadonlyArray<EventJournal.Entry>,
      ): ReadonlyArray<EventJournal.RemoteEntry> => {
        let sequence = sequencesByPublicKey.get(publicKey) ?? 0
        const remoteEntries = entries.map(
          (entry) =>
            new EventJournal.RemoteEntry({
              remoteSequence: ++sequence,
              entry,
            }),
        )
        sequencesByPublicKey.set(publicKey, sequence)
        return remoteEntries
      }

      const authenticatedPublicKeys = new Set<string>()
      const challenges: Array<{
        readonly challenge: Uint8Array<ArrayBuffer>
        readonly expiresAt: number
      }> = []
      const constEmptyPrivateKey = Redacted.make(new Uint8Array(32))

      const onWrite = Effect.fnUntraced(function* (data: Uint8Array<ArrayBuffer>) {
        const request = yield* WriteEntriesUnencrypted.decode(data).pipe(
          Effect.mapError(() =>
            protocolError({
              requestTag: "WriteEntries",
              code: "InternalServerError",
              message: "Failed to decode unencrypted EventLog write",
            }),
          ),
        )
        yield* assertStore(
          storeId,
          request.storeId,
          "WriteEntries",
          request.publicKey,
        )
        if (request.entries.length === 0) return

        const sourceRemoteId = remoteIdFor(request.publicKey)
        const remoteEntries = nextRemoteEntries(
          request.publicKey,
          request.entries,
        )
        yield* journal.withLock(storeId)(
          journal.writeFromRemote({
            remoteId: sourceRemoteId,
            entries: remoteEntries,
            effect: ({ entry, conflicts }) =>
              replayEntry({ registry, identity, storeId, entry, conflicts }).pipe(
                Effect.mapError((cause) =>
                  new EventJournal.EventJournalError({
                    method: "pct-eventlog-remote-replay",
                    cause,
                  }),
                ),
              ) as Effect.Effect<void, EventJournal.EventJournalError>,
          }),
        ).pipe(
          Effect.mapError((cause) =>
            protocolError({
              requestTag: "WriteEntries",
              publicKey: request.publicKey,
              storeId,
              code: "InternalServerError",
              message: String(cause),
            }),
          ),
        )
      })

      const changes = Effect.fnUntraced(function* ({
        publicKey,
        storeId: requestedStoreId,
        startSequence,
      }: {
        readonly publicKey: string
        readonly storeId: StoreId
        readonly startSequence: number
      }) {
        yield* assertStore(
          storeId,
          requestedStoreId,
          "Changes",
          publicKey,
        )
        const subscription = yield* journal.changes
        const entries = yield* journal.entries
        const seenEntryIds = new Set(entries.map((entry) => entry.idString))
        let sequence = entries.length
        const backlog = entries
          .map(
            (entry, index) =>
              new EventJournal.RemoteEntry({
                remoteSequence: index + 1,
                entry,
              }),
          )
          .filter((entry) => entry.remoteSequence >= startSequence)

        const live = Stream.fromSubscription(subscription).pipe(
          Stream.filter((entry) => {
            if (seenEntryIds.has(entry.idString)) return false
            seenEntryIds.add(entry.idString)
            return true
          }),
          Stream.map(
            (entry) =>
              new EventJournal.RemoteEntry({
                remoteSequence: ++sequence,
                entry,
              }),
          ),
          Stream.filter((entry) => entry.remoteSequence >= startSequence),
        )

        return Stream.concat(Stream.fromArray(backlog), live).pipe(
          Stream.mapEffect((entry) => ChangesRpc.encodeUnencrypted([entry])),
        )
      }, Stream.unwrap)

      const extractPublicKey = (requestTag: string, payload: unknown) =>
        Effect.gen(function* () {
          if (requestTag === "EventLog.Changes") {
            const publicKey = (payload as { readonly publicKey?: unknown }).publicKey
            if (typeof publicKey === "string") return publicKey
          }
          if (requestTag === "EventLog.WriteSingle") {
            const data = (payload as { readonly data?: unknown }).data
            if (data instanceof Uint8Array) {
              const request = yield* WriteEntriesUnencrypted.decode(
                data as Uint8Array<ArrayBuffer>,
              ).pipe(
                Effect.mapError(() =>
                  protocolError({
                    requestTag: "WriteEntries",
                    code: "InvalidRequest",
                    message: "Failed to decode unencrypted EventLog write",
                  }),
                ),
              )
              return request.publicKey
            }
          }
          if (requestTag === "EventLog.WriteChunked") return "pct:chunked-http"
          return yield* protocolError({
            requestTag,
            code: "Forbidden",
            message: "Unable to determine EventLogRemote public key",
          })
        })

      const authenticationLayer = Layer.succeed(
        EventLogAuthentication,
        (effect, { rpc, payload }) =>
          Effect.gen(function* () {
            const publicKey = yield* extractPublicKey(rpc._tag, payload)
            if (
              publicKey !== "pct:chunked-http" &&
              !authenticatedPublicKeys.has(publicKey)
            ) {
              return yield* protocolError({
                requestTag: rpc._tag,
                publicKey,
                code: "Forbidden",
                message: "Unauthenticated EventLogRemote HTTP request",
              })
            }
            return yield* Effect.provideService(effect, EventLog.Identity, {
              publicKey,
              privateKey: constEmptyPrivateKey,
            })
          }),
      )

      let chunkedIdCounter = 0

      return EventLogMessage.EventLogRemoteRpcs.toLayer(
        Effect.gen(function* () {
          return EventLogMessage.EventLogRemoteRpcs.of({
            "EventLog.Hello": Effect.fnUntraced(function* () {
              const challenge = yield* EventLogSessionAuth.makeSessionAuthChallenge.pipe(
                Effect.orDie,
              )
              challenges.push({
                challenge,
                expiresAt:
                  Date.now() +
                  EventLogSessionAuth.SessionAuthChallengeTimeToLiveMillis,
              })
              return new HelloResponse({ remoteId, challenge })
            }),
            "EventLog.Authenticate": Effect.fnUntraced(function* (request) {
              const now = Date.now()
              for (let i = challenges.length - 1; i >= 0; i--) {
                const current = challenges[i]
                if (current !== undefined && current.expiresAt <= now) {
                  challenges.splice(i, 1)
                }
              }

              const signingPublicKey =
                sessionBindings.get(request.publicKey) ?? request.signingPublicKey
              let verified = false
              for (let i = 0; i < challenges.length; i++) {
                const current = challenges[i]
                if (current === undefined) continue
                verified = yield* EventLogSessionAuth.verifySessionAuthenticateRequest({
                  remoteId,
                  challenge: current.challenge,
                  publicKey: request.publicKey,
                  signingPublicKey,
                  signature: request.signature,
                  algorithm: request.algorithm,
                }).pipe(Effect.catch(() => Effect.succeed(false)))
                if (verified) {
                  challenges.splice(i, 1)
                  break
                }
              }

              if (!verified) {
                return yield* protocolError({
                  requestTag: "Authenticate",
                  publicKey: request.publicKey,
                  code: "Forbidden",
                  message: challenges.length === 0
                    ? "Session auth challenge has expired"
                    : "Session auth signature verification failed",
                })
              }

              if (!sessionBindings.has(request.publicKey)) {
                sessionBindings.set(request.publicKey, request.signingPublicKey)
              }
              authenticatedPublicKeys.add(request.publicKey)
              yield* Effect.void
            }),
            "EventLog.WriteSingle": Effect.fnUntraced(function* (request) {
              yield* onWrite(request.data as Uint8Array<ArrayBuffer>)
            }),
            "EventLog.WriteChunked": Effect.fnUntraced(function* () {
              return yield* protocolError({
                requestTag: "WriteChunked",
                code: "InvalidRequest",
                message: "PCT HTTP EventLogRemote does not support chunked writes yet",
              })
            }),
            "EventLog.Changes": (request) =>
              changes(request).pipe(
                Stream.mapArray((data): [SingleMessage | ChunkedMessage, ...(SingleMessage | ChunkedMessage)[]] => {
                  const messages: Array<SingleMessage | ChunkedMessage> = []
                  for (const chunk of data) {
                    if (chunk.byteLength <= ChunkedMessage.chunkSize) {
                      messages.push(new SingleMessage({ data: chunk }))
                    } else {
                      messages.push(...ChunkedMessage.split(chunkedIdCounter++, chunk))
                    }
                  }
                  return messages as [
                    SingleMessage | ChunkedMessage,
                    ...(SingleMessage | ChunkedMessage)[],
                  ]
                }),
                Stream.catchCause((cause) =>
                  Stream.fail(
                    protocolError({
                      requestTag: "Changes",
                      publicKey: request.publicKey,
                      storeId: request.storeId,
                      code: "InternalServerError",
                      message: `Changes stream failure: ${String(cause)}`,
                    }),
                  ),
                ),
              ),
          })
        }),
      ).pipe(Layer.merge(authenticationLayer))
    }),
  )

/**
 * Add the EventLogRemote RPC endpoint to the shared HttpRouter.
 *
 * The RPC client must use the same MessagePack serialization layer;
 * `Client.ts` provides `layerRemoteClientHttp` for that pairing.
 */
export const Routes = (options: RouteLayerOptions = {}) =>
  RpcServer.layerHttp({
    group: EventLogMessage.EventLogRemoteRpcs,
    path: options.path ?? DEFAULT_RPC_PATH,
    protocol: "http",
    spanPrefix: "pct.eventlogRemote",
  }).pipe(
    Layer.provideMerge(layerRpcHandlers(options)),
    Layer.provide(RpcSerialization.layerMsgPack),
  )
