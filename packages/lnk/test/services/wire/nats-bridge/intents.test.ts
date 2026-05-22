/** Pure tests for schema-backed MSH bridge intents. */

import { describe, expect, it } from "vitest"

import { trust as trustContentType } from "../../../../src/contracts/ContentType.js"
import { trustEpoch, trustProducerId, trustSeq } from "../../../../src/contracts/Producer.js"
import { trust as trustStreamId } from "../../../../src/contracts/StreamId.js"
import { makeAppendIntent, toDurableAppendInput } from "../../../../src/services/wire/nats-bridge/intents.js"

const sid = trustStreamId("intent/stream")
const ct = trustContentType("text/plain")
const bytes = new Uint8Array([1, 2, 3])

const producer = {
  producerId: trustProducerId("producer-a"),
  epoch: trustEpoch(1),
  seq: trustSeq(0),
}

describe("MshBridge intents", () => {
  it("normalizes append messages without leaking absent optional keys into durable input", () => {
    const intent = makeAppendIntent({ streamId: sid }, [bytes])
    const durable = toDurableAppendInput(intent)

    expect(intent._tag).toBe("AppendMessages")
    expect(durable).toEqual({ streamId: sid, messages: [bytes] })
    expect("producer" in durable).toBe(false)
    expect("streamSeq" in durable).toBe(false)
    expect("streamClosed" in durable).toBe(false)
  })

  it("normalizes append-and-close with producer and stream sequence", () => {
    const intent = makeAppendIntent({
      streamId: sid,
      contentType: ct,
      producer,
      streamSeq: "0001",
      streamClosed: true,
    }, [bytes])
    const durable = toDurableAppendInput(intent)

    expect(intent._tag).toBe("AppendAndClose")
    expect(durable).toMatchObject({
      streamId: sid,
      contentType: ct,
      messages: [bytes],
      producer,
      streamSeq: "0001",
      streamClosed: true,
    })
  })

  it("normalizes close-only as metadata-only durable append", () => {
    const intent = makeAppendIntent({
      streamId: sid,
      producer,
      streamClosed: true,
    }, [])
    const durable = toDurableAppendInput(intent)

    expect(intent._tag).toBe("CloseStream")
    expect(durable).toMatchObject({
      streamId: sid,
      messages: [],
      producer,
      streamClosed: true,
    })
    expect("contentType" in durable).toBe(false)
  })
})
