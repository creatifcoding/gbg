/** Tests for concrete MSH adapter seams. */

import { describe, expect, it } from "vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { NatsKVService, NatsStreamService, Inner } from "@tmnl/msh/nats"

import { trust as trustContentType } from "../../../../src/contracts/ContentType.js"
import { trust as trustStreamId } from "../../../../src/contracts/StreamId.js"
import { BatchPublisher } from "../../../../src/services/wire/nats-bridge/BatchPublisher.js"
import { CasMetadataStore } from "../../../../src/services/wire/nats-bridge/CasMetadataStore.js"
import { MshBatchPublisher } from "../../../../src/services/wire/nats-bridge/MshBatchPublisher.js"
import { MshCasMetadataStore } from "../../../../src/services/wire/nats-bridge/MshCasMetadataStore.js"
import { makeInitialMetadata, type DurableBatchEnvelope } from "../../../../src/services/wire/nats-bridge/kernel.js"

const streamId = trustStreamId("tenant/a")
const contentType = trustContentType("text/plain")

const metadata = makeInitialMetadata({ streamId, contentType, nowMillis: 1 })

describe("MSH bridge adapters", () => {
  it("backs CasMetadataStore with typed MSH KV CAS operations", async () => {
    const calls: string[] = []
    const kvLayer = Layer.succeed(NatsKVService)(NatsKVService.of({
      getEntry: (bucket: string, key: string) => {
        calls.push(`getEntry:${bucket}:${key}`)
        return Effect.succeed({ key, value: metadata, revision: 7, created: new Date(0), operation: "PUT" })
      },
      create: (bucket: string, key: string, _schema: unknown, value: unknown) => {
        calls.push(`create:${bucket}:${key}:${(value as { readonly streamId: string }).streamId}`)
        return Effect.succeed(8)
      },
      updateIfRevision: (bucket: string, key: string, _schema: unknown, _value: unknown, revision: number) => {
        calls.push(`update:${bucket}:${key}:${revision}`)
        return Effect.succeed(9)
      },
      deleteIfRevision: (bucket: string, key: string, revision: number) => {
        calls.push(`delete:${bucket}:${key}:${revision}`)
        return Effect.void
      },
    } as never))

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* CasMetadataStore
        const loaded = yield* store.get(streamId)
        const created = yield* store.create(streamId, metadata)
        const updated = yield* store.updateIfRevision(streamId, metadata, 7)
        yield* store.deleteIfRevision(streamId, 9)
        return { loaded, created, updated }
      }).pipe(Effect.provide(MshCasMetadataStore.layer({ metadataBucket: "TEST_META" }).pipe(Layer.provide(kvLayer)))),
    )

    expect(result.loaded?.revision).toBe(7)
    expect(result.loaded?.metadata).toEqual(metadata)
    expect(result.created).toBe(8)
    expect(result.updated).toBe(9)
    expect(calls).toEqual([
      "getEntry:TEST_META:stream.tenant_2Fa",
      "create:TEST_META:stream.tenant_2Fa:tenant/a",
      "update:TEST_META:stream.tenant_2Fa:7",
      "delete:TEST_META:stream.tenant_2Fa:9",
    ])
  })

  it("maps MSH KV revision conflicts to bridge CAS conflicts", async () => {
    const kvLayer = Layer.succeed(NatsKVService)(NatsKVService.of({
      getEntry: () => Effect.succeed(null),
      create: () => Effect.fail(new Inner.KV.RevisionConflictError({
        message: "exists",
        bucketName: "TEST_META",
        key: "stream.tenant_2Fa",
        expectedRevision: 0,
      })),
      updateIfRevision: () => Effect.fail(new Error("unused")),
      deleteIfRevision: () => Effect.fail(new Error("unused")),
    } as never))

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* CasMetadataStore
        return yield* store.create(streamId, metadata).pipe(Effect.result)
      }).pipe(Effect.provide(MshCasMetadataStore.layer({ metadataBucket: "TEST_META" }).pipe(Layer.provide(kvLayer)))),
    )

    expect(result._tag).toBe("Failure")
    if (result._tag === "Failure") {
      expect(result.failure._tag).toBe("MetadataCasConflictError")
    }
  })

  it("backs BatchPublisher with typed MSH JetStream publish expectations", async () => {
    const published: Array<{ subject: string; msgId: string | undefined; expectStream: string | undefined; expectLastSubjectSequence: number | undefined }> = []
    const streamLayer = Layer.succeed(NatsStreamService)(NatsStreamService.of({
      publish: (subject: string, _schema: unknown, _data: DurableBatchEnvelope, opts?: {
        msgId?: string
        expectStream?: string
        expectLastSubjectSequence?: number
      }) => {
        published.push({
          subject,
          msgId: opts?.msgId,
          expectStream: opts?.expectStream,
          expectLastSubjectSequence: opts?.expectLastSubjectSequence,
        })
        return Effect.succeed({ stream: opts?.expectStream ?? "UNKNOWN", seq: 11, duplicate: true })
      },
    } as never))

    const envelope: DurableBatchEnvelope = {
      version: 1,
      streamId,
      contentType,
      baseSeq: 0,
      baseByteOffset: 0,
      messages: [],
      streamClosed: false,
    }

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const publisher = yield* BatchPublisher
        return yield* publisher.publish({
          streamId,
          envelope,
          msgID: "m1",
          expectedLastSubjectSequence: 10,
        })
      }).pipe(Effect.provide(MshBatchPublisher.layer({ subjectRoot: "_test.lnk", streamNamePrefix: "TEST" }).pipe(Layer.provide(streamLayer)))),
    )

    expect(result).toEqual({ subjectSequence: 11, duplicate: true })
    expect(published).toEqual([{
      subject: "_test.lnk.tenant_2Fa",
      msgId: "m1",
      expectStream: "TEST_tenant_2Fa",
      expectLastSubjectSequence: 10,
    }])
  })
})
