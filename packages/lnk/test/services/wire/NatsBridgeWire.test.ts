/**
 * NatsBridgeWire skeleton tests.
 *
 * The bridge is exported and selectable, but remains guarded until the MSH
 * JetStream/KV implementation lands. These tests lock that contract: the layer
 * provides `Wire`, and every method fails clearly instead of pretending to work.
 */

import { describe, expect, it } from "vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"

import { trust as trustContentType } from "../../../src/contracts/ContentType.js"
import { trust as trustStreamId } from "../../../src/contracts/StreamId.js"
import { Wire } from "../../../src/services/wire/Wire.js"
import { NatsBridgeWire } from "../../../src/services/wire/nats-bridge/NatsBridgeWire.js"
import { MshBridgeWire } from "../../../src/services/wire/nats-bridge/MshBridgeWire.js"
import { NatsBridgePort } from "../../../src/services/wire/nats-bridge/Port.js"

describe("NatsBridgeWire skeleton", () => {
  it("exposes MshBridgeWire as the concrete public bridge and keeps NatsBridgeWire guarded", () => {
    expect(MshBridgeWire).not.toBe(NatsBridgeWire)
    expect(MshBridgeWire.layerFromPort).toBe(NatsBridgeWire.layerFromPort)
  })

  it("exports a guarded Wire layer with explicit not-implemented failures", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const wire = yield* Wire
        return yield* wire.put({
          streamId: trustStreamId("nats-bridge-test"),
          contentType: trustContentType("text/plain"),
        }).pipe(Effect.result)
      }).pipe(
        Effect.provide(
          NatsBridgeWire.layer({
            subjectRoot: "_test.lnk.stream",
            metadataBucket: "TEST_LNK_META",
          }),
        ),
      ),
    )

    expect(result._tag).toBe("Failure")
    if (result._tag === "Failure") {
      expect(result.failure._tag).toBe("FetchError")
      expect(result.failure.status).toBe(501)
      expect(result.failure.message).toContain("NatsBridgeWire.put is not implemented yet")
      expect(result.failure.message).toContain("subjectRoot=_test.lnk.stream")
      expect(result.failure.message).toContain("metadataBucket=TEST_LNK_META")
    }
  })

  it("maps Wire operations through a provided bridge port", async () => {
    const streamId = trustStreamId("nats-bridge-port-test")
    const contentType = trustContentType("text/plain")
    const calls: string[] = []
    const portLayer = Layer.succeed(NatsBridgePort)(NatsBridgePort.of({
      create: (input) => {
        calls.push(`create:${input.streamId}:${input.body?.length ?? 0}:${input.streamClosed === true}`)
        return Effect.succeed({
          streamId: input.streamId,
          contentType: input.contentType,
          created: true,
          closed: input.streamClosed === true,
          nextOffset: "msh:00000000000000000000_00000000000000000000" as never,
          ttl: input.ttl,
          expiresAt: input.expiresAt,
          schemaId: input.schemaId,
        })
      },
      append: (input) => {
        calls.push(`append:${input.streamId}:${input.body.length}:${input.streamClosed === true}`)
        return Effect.succeed({
          nextOffset: "msh:00000000000000000001_00000000000000000005" as never,
          duplicate: false,
          closed: input.streamClosed === true,
          producerEpoch: input.producer?.epoch,
          producerSeq: input.producer?.seq,
        })
      },
      read: (input) => {
        calls.push(`read:${input.streamId}:${input.position}:${input.live ?? "catchup"}`)
        return Effect.succeed({
          body: Stream.empty,
          upToDate: true,
          closed: false,
          cursor: input.cursor,
        })
      },
      metadata: (id) => {
        calls.push(`metadata:${id}`)
        return Effect.succeed({
          streamId: id,
          contentType,
          closed: false,
          ttl: 60,
          expiresAt: "2030-01-01T00:00:00.000Z",
          schemaId: "example@1.0.0",
        })
      },
      delete: (id) => {
        calls.push(`delete:${id}`)
        return Effect.succeed({ deleted: true })
      },
    }))

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const wire = yield* Wire
        const put = yield* wire.put({
          streamId,
          contentType,
          body: new Uint8Array([1, 2, 3]),
          streamClosed: true,
          streamTtl: 60,
          streamExpiresAt: "2030-01-01T00:00:00.000Z",
          schemaId: "example@1.0.0",
        })
        const post = yield* wire.post({
          streamId,
          contentType,
          body: new Uint8Array([4, 5]),
          streamClosed: true,
        })
        const head = yield* wire.head({ streamId })
        const get = yield* wire.get({
          streamId,
          position: "-1",
          live: "long-poll",
          cursor: "cursor-1",
        })
        const del = yield* wire.delete({ streamId })
        return { put, post, head, get, del }
      }).pipe(
        Effect.provide(
          NatsBridgeWire.layerFromPort().pipe(Layer.provide(portLayer)),
        ),
      ),
    )

    expect(result.put.created).toBe(true)
    expect(result.put.closed).toBe(true)
    expect(result.post.closed).toBe(true)
    expect(result.head).toMatchObject({
      contentType,
      closed: false,
      ttl: 60,
      expiresAt: "2030-01-01T00:00:00.000Z",
      schemaId: "example@1.0.0",
    })
    expect(result.get.upToDate).toBe(true)
    expect(result.get.cursor).toBe("cursor-1")
    expect(result.del.deleted).toBe(true)
    expect(calls).toEqual([
      "create:nats-bridge-port-test:3:true",
      "append:nats-bridge-port-test:2:true",
      "metadata:nats-bridge-port-test",
      "read:nats-bridge-port-test:-1:long-poll",
      "delete:nats-bridge-port-test",
    ])
  })
})
