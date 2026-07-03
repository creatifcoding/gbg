/** Live acceptance tests for the concrete MSH-backed LNK bridge. */

import { afterAll, beforeAll, expect, it } from "vitest"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"

import { trust as trustContentType } from "../../../../src/contracts/ContentType.js"
import { trustEpoch, trustProducerId, trustSeq } from "../../../../src/contracts/Producer.js"
import { trust as trustStreamId } from "../../../../src/contracts/StreamId.js"
import { Wire } from "../../../../src/services/wire/Wire.js"
import { MshBridgeWire } from "../../../../src/services/wire/nats-bridge/MshBridgeWire.js"
import { liveDescribe, startLiveNats, type LiveNatsServer } from "../../../support/live-nats.js"

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const collectText = (body: Stream.Stream<Uint8Array, never, never>) =>
  Effect.gen(function* () {
    const chunks = yield* Stream.runCollect(body)
    const bytes = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    const out = new Uint8Array(bytes)
    let offset = 0
    for (const chunk of chunks) {
      out.set(chunk, offset)
      offset += chunk.length
    }
    return decoder.decode(out)
  })

liveDescribe("MshBridgeWire live NATS", () => {
  let server: LiveNatsServer

  beforeAll(async () => {
    server = await startLiveNats()
  }, 10_000)

  afterAll(async () => {
    await server?.stop()
  }, 10_000)

  it("round-trips Durable Stream create/append/read/delete through real JetStream and KV", async () => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e9)}`
    const layer = MshBridgeWire.layer({
      servers: server.servers,
      name: `lnk-live-roundtrip-${suffix}`,
      reconnect: false,
      maxReconnectAttempts: 0,
      reconnectDelayMs: 50,
      subjectRoot: `_tmnl.live.${suffix}`,
      streamNamePrefix: `LNKLIVE_${suffix}`,
      metadataBucket: `LNK_LIVE_META_${suffix}`,
      shardCount: 4,
    })

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wire = yield* Wire
          const sid = trustStreamId(`live/roundtrip/${suffix}`)
          const ct = trustContentType("application/json")

          const created = yield* wire.put({
            streamId: sid,
            contentType: ct,
            body: encoder.encode(JSON.stringify([{ a: 1 }, { b: 2 }])),
            schemaId: "live-json@1",
          })
          const appended = yield* wire.post({
            streamId: sid,
            body: encoder.encode(JSON.stringify({ c: 3 })),
          })
          const head = yield* wire.head({ streamId: sid })
          const read = yield* wire.get({ streamId: sid, position: "-1" })
          const body = yield* collectText(read.body)
          const deleted = yield* wire.delete({ streamId: sid })
          const missing = yield* Effect.result(wire.head({ streamId: sid }))

          return { created, appended, head, read, body, deleted, missing }
        }),
      ).pipe(Effect.provide(layer)),
    )

    expect(result.created.created).toBe(true)
    expect(result.created.nextOffset).toBe("msh:00000000000000000001_00000000000000000007")
    expect(result.appended.nextOffset).toBe("msh:00000000000000000002_00000000000000000014")
    expect(result.head).toMatchObject({
      contentType: "application/json",
      closed: false,
      schemaId: "live-json@1",
      nextOffset: result.appended.nextOffset,
    })
    expect(JSON.parse(result.body)).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
    expect(result.read.upToDate).toBe(true)
    expect(result.deleted.deleted).toBe(true)
    expect(result.missing._tag).toBe("Failure")
  }, 20_000)

  it("preserves producer idempotency on real JetStream publish expectations", async () => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e9)}`
    const layer = MshBridgeWire.layer({
      servers: server.servers,
      name: `lnk-live-producer-${suffix}`,
      reconnect: false,
      maxReconnectAttempts: 0,
      reconnectDelayMs: 50,
      subjectRoot: `_tmnl.live.producer.${suffix}`,
      streamNamePrefix: `LNKLIVEPROD_${suffix}`,
      metadataBucket: `LNK_LIVE_PROD_META_${suffix}`,
      shardCount: 4,
    })

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wire = yield* Wire
          const sid = trustStreamId(`live/producer/${suffix}`)
          yield* wire.put({ streamId: sid, contentType: trustContentType("text/plain") })
          const producer = {
            producerId: trustProducerId("live-producer"),
            epoch: trustEpoch(0),
            seq: trustSeq(0),
          }
          const first = yield* wire.post({ streamId: sid, body: encoder.encode("alpha"), producer })
          const duplicate = yield* wire.post({ streamId: sid, body: encoder.encode("alpha"), producer })
          const read = yield* wire.get({ streamId: sid, position: "-1" })
          const body = yield* collectText(read.body)
          yield* wire.delete({ streamId: sid })
          return { first, duplicate, body }
        }),
      ).pipe(Effect.provide(layer)),
    )

    expect(result.first.duplicate).toBe(false)
    expect(result.duplicate.duplicate).toBe(true)
    expect(result.duplicate.nextOffset).toBe(result.first.nextOffset)
    expect(result.body).toBe("alpha")
  }, 20_000)
})
