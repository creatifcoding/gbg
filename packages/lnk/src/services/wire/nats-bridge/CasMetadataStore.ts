/**
 * CAS metadata store seam for MshBridgePort.
 *
 * This is the narrow LNK-side contract over revisioned stream metadata. The
 * concrete MSH adapter will implement it with `NatsKVService.getEntry/create/
 * updateIfRevision/deleteIfRevision`; the bridge kernel never reaches down to
 * raw NATS/KV. Val approves of exactly one throat to choke.
 */

import * as Context from "effect-v4/Context"
import type * as Effect from "effect-v4/Effect"
import * as Schema from "effect-v4/Schema"

import { StreamId } from "../../../contracts/StreamId.js"
import { FetchError } from "../../../contracts/errors.js"
import { DurableStreamMetadata } from "./kernel.js"

export class MetadataCasConflictError extends Schema.TaggedErrorClass<MetadataCasConflictError>(
  "@tmnl/lnk/MetadataCasConflictError",
)("MetadataCasConflictError", {
  streamId: StreamId,
  expectedRevision: Schema.Number,
  message: Schema.String,
  cause: Schema.optional(Schema.Defect),
}) {}

export type MetadataStoreError = FetchError | MetadataCasConflictError

export interface RevisionedMetadata {
  readonly metadata: DurableStreamMetadata
  readonly revision: number
}

export interface CasMetadataStoreShape {
  readonly get: (
    streamId: typeof StreamId.Type,
  ) => Effect.Effect<RevisionedMetadata | null, FetchError>

  readonly create: (
    streamId: typeof StreamId.Type,
    metadata: DurableStreamMetadata,
  ) => Effect.Effect<number, MetadataStoreError>

  readonly updateIfRevision: (
    streamId: typeof StreamId.Type,
    metadata: DurableStreamMetadata,
    expectedRevision: number,
  ) => Effect.Effect<number, MetadataStoreError>

  readonly deleteIfRevision: (
    streamId: typeof StreamId.Type,
    expectedRevision: number,
  ) => Effect.Effect<void, MetadataStoreError>
}

export class CasMetadataStore extends Context.Service<
  CasMetadataStore,
  CasMetadataStoreShape
>()("@tmnl/lnk/services/wire/nats-bridge/CasMetadataStore") {}
