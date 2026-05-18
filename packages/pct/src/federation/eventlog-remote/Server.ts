/**
 * PCT EventLogRemote server layer (Flow C substrate).
 *
 * This is the first PCT-owned adapter around Effect-smol's native
 * EventLogRemote RPC handlers. It deliberately speaks in EventJournal
 * `Entry` / `RemoteEntry` terms, not RegistryDelta terms.
 *
 * Status: spike-grade server handler layer. It exposes the RPC handler
 * layer and wires writes into the local EventJournal. The read side can
 * serve a backlog from the local journal; streaming future changes is a
 * follow-up once the HTTP/RPC transport is mounted in `pact serve`.
 *
 * @module @tmnl/pct/federation/eventlog-remote/Server
 */

import * as Context from "effect-v4/Context"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Schema from "effect-v4/Schema"
import * as Stream from "effect-v4/Stream"
import * as EventJournal from "effect-v4/unstable/eventlog/EventJournal"
import * as EventLog from "effect-v4/unstable/eventlog/EventLog"
import {
  ChangesRpc,
  EventLogProtocolError,
  StoreId,
  WriteEntriesUnencrypted,
} from "effect-v4/unstable/eventlog/EventLogMessage"
import * as EventLogServer from "effect-v4/unstable/eventlog/EventLogServer"

export const PctRegistryStoreId = StoreId.make("pct:registry")

export interface ServerLayerOptions {
  readonly storeId?: StoreId
}

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
      const storeId = options.storeId ?? PctRegistryStoreId
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

      return EventLogServer.layerRpcHandlers({
        remoteId,
        getOrCreateSessionAuthBinding: (publicKey, signingPublicKey) =>
          Effect.sync(() => {
            const existing = sessionBindings.get(publicKey)
            if (existing !== undefined) return existing
            sessionBindings.set(publicKey, signingPublicKey)
            return signingPublicKey
          }),
        onWrite: Effect.fnUntraced(function* (data) {
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
        }),
        changes: Effect.fnUntraced(function* ({
          publicKey,
          storeId: requestedStoreId,
          startSequence,
        }) {
          yield* assertStore(
            storeId,
            requestedStoreId,
            "Changes",
            publicKey,
          )
          const entries = yield* journal.entries
          const remoteEntries = entries
            .map(
              (entry, index) =>
                new EventJournal.RemoteEntry({
                  remoteSequence: index + 1,
                  entry,
                }),
            )
            .filter((entry) => entry.remoteSequence >= startSequence)

          return Stream.fromArray(remoteEntries).pipe(
            Stream.mapEffect((entry) => ChangesRpc.encodeUnencrypted([entry])),
          )
        }, Stream.unwrap),
      })
    }),
  )
