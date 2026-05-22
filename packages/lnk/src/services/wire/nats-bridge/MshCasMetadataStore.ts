/** Concrete CasMetadataStore backed by @tmnl/msh typed KV CAS ops. */

import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import { NatsKVService } from "@tmnl/msh/nats"

import type { StreamId } from "../../../contracts/StreamId.js"
import { FetchError } from "../../../contracts/errors.js"
import {
  CasMetadataStore,
  MetadataCasConflictError,
  type MetadataStoreError,
} from "./CasMetadataStore.js"
import { metadataKeyForStream, resolveMshBridgeSubstrateOptions, type MshBridgeSubstrateOptions } from "./MshBridgeConfig.js"
import { DurableStreamMetadata } from "./kernel.js"
import { MshBridgeSpan } from "./spans.js"

const isKvRevisionConflict = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "_tag" in error &&
  (error as { readonly _tag?: unknown })._tag === "Inner/KV/RevisionConflict"

const mapKvGetError = (streamId: StreamId, operation: string) => (error: unknown): FetchError =>
  new FetchError({
    status: 500,
    message: `MSH KV metadata ${operation} failed for stream '${streamId as string}'`,
    cause: error,
  })

const mapKvError = (
  streamId: StreamId,
  operation: string,
  expectedRevision?: number,
) => (error: unknown): MetadataStoreError =>
  isKvRevisionConflict(error)
    ? new MetadataCasConflictError({
        streamId,
        expectedRevision: expectedRevision ?? 0,
        message: `Metadata CAS conflict during ${operation}`,
        cause: error,
      })
    : new FetchError({
        status: 500,
        message: `MSH KV metadata ${operation} failed for stream '${streamId as string}'`,
        cause: error,
      })

export class MshCasMetadataStore {
  static readonly layer = (
    options: MshBridgeSubstrateOptions = {},
  ): Layer.Layer<CasMetadataStore, never, NatsKVService> => {
    const resolved = resolveMshBridgeSubstrateOptions(options)
    return Layer.effect(
      CasMetadataStore,
      Effect.gen(function* () {
        const kv = yield* NatsKVService
        return CasMetadataStore.of({
          get: (streamId) =>
            kv.getEntry(resolved.metadataBucket, metadataKeyForStream(streamId), DurableStreamMetadata).pipe(
              Effect.map((entry) => entry ? { metadata: entry.value, revision: entry.revision } : null),
              Effect.mapError(mapKvGetError(streamId, "get")),
              Effect.withSpan(MshBridgeSpan.MetadataStore.get),
            ),
          create: (streamId, metadata) =>
            kv.create(resolved.metadataBucket, metadataKeyForStream(streamId), DurableStreamMetadata, metadata).pipe(
              Effect.mapError(mapKvError(streamId, "create", 0)),
              Effect.withSpan(MshBridgeSpan.MetadataStore.create),
            ),
          updateIfRevision: (streamId, metadata, expectedRevision) =>
            kv.updateIfRevision(
              resolved.metadataBucket,
              metadataKeyForStream(streamId),
              DurableStreamMetadata,
              metadata,
              expectedRevision,
            ).pipe(
              Effect.mapError(mapKvError(streamId, "updateIfRevision", expectedRevision)),
              Effect.withSpan(MshBridgeSpan.MetadataStore.updateIfRevision),
            ),
          deleteIfRevision: (streamId, expectedRevision) =>
            kv.deleteIfRevision(resolved.metadataBucket, metadataKeyForStream(streamId), expectedRevision).pipe(
              Effect.mapError(mapKvError(streamId, "deleteIfRevision", expectedRevision)),
              Effect.withSpan(MshBridgeSpan.MetadataStore.deleteIfRevision),
            ),
        })
      }),
    )
  }
}
