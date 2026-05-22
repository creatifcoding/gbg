/**
 * Schema-backed bridge intents.
 *
 * Optional wire fields are normalized here, once, into explicit tagged domain
 * intent. The live port and CAS path should not grow conditional object-spread
 * barnacles just to satisfy exactOptionalPropertyTypes.
 */

import * as Option from "effect-v4/Option"
import * as Schema from "effect-v4/Schema"

import { ContentType, type ContentType as ContentTypeT } from "../../../contracts/ContentType.js"
import { Epoch, ProducerId, Seq } from "../../../contracts/Producer.js"
import { StreamId, type StreamId as StreamIdT } from "../../../contracts/StreamId.js"
import type { NatsBridgePortShape } from "./Port.js"
import type { DurableAppendInput, DurableCreateInput } from "./kernel.js"

export const ProducerState = Schema.Struct({
  producerId: ProducerId,
  epoch: Epoch,
  seq: Seq,
})
export type ProducerState = typeof ProducerState.Type

const AppendOptionalFields = {
  contentType: Schema.OptionFromOptionalKey(ContentType),
  producer: Schema.OptionFromOptionalKey(ProducerState),
  streamSeq: Schema.OptionFromOptionalKey(Schema.String),
} as const

export const AppendIntent = Schema.TaggedUnion({
  AppendMessages: {
    streamId: StreamId,
    messages: Schema.Array(Schema.Uint8Array),
    ...AppendOptionalFields,
  },
  AppendAndClose: {
    streamId: StreamId,
    messages: Schema.Array(Schema.Uint8Array),
    ...AppendOptionalFields,
  },
  CloseStream: {
    streamId: StreamId,
    producer: Schema.OptionFromOptionalKey(ProducerState),
    streamSeq: Schema.OptionFromOptionalKey(Schema.String),
  },
})
export type AppendIntent = typeof AppendIntent.Type

const decodeAppendIntent = Schema.decodeUnknownSync(AppendIntent)

type Writable<T> = { -readonly [K in keyof T]: T[K] }

export interface AppendIntentInput {
  readonly streamId: StreamIdT
  readonly contentType?: ContentTypeT | undefined
  readonly producer?: ProducerState | undefined
  readonly streamSeq?: string | undefined
  readonly streamClosed?: true | undefined
}

type RawAppendIntent = Record<string, unknown>

const addAppendOptionalFields = (
  raw: RawAppendIntent,
  input: AppendIntentInput,
  contentType: ContentTypeT | undefined,
): void => {
  if (contentType !== undefined) raw.contentType = contentType
  if (input.producer !== undefined) raw.producer = input.producer
  if (input.streamSeq !== undefined) raw.streamSeq = input.streamSeq
}

export const makeAppendIntent = (
  input: AppendIntentInput,
  messages: ReadonlyArray<Uint8Array>,
  contentTypeOverride?: ContentTypeT,
): AppendIntent => {
  const contentType = contentTypeOverride ?? input.contentType

  if (messages.length === 0 && input.streamClosed === true) {
    const raw: RawAppendIntent = {
      _tag: "CloseStream",
      streamId: input.streamId,
    }
    addAppendOptionalFields(raw, input, undefined)
    return decodeAppendIntent(raw)
  }

  if (input.streamClosed === true) {
    const raw: RawAppendIntent = {
      _tag: "AppendAndClose",
      streamId: input.streamId,
      messages,
    }
    addAppendOptionalFields(raw, input, contentType)
    return decodeAppendIntent(raw)
  }

  const raw: RawAppendIntent = {
    _tag: "AppendMessages",
    streamId: input.streamId,
    messages,
  }
  addAppendOptionalFields(raw, input, contentType)
  return decodeAppendIntent(raw)
}

const applyProducer = (
  target: { producer?: ProducerState },
  producer: Option.Option<ProducerState>,
): void => {
  if (Option.isSome(producer)) target.producer = producer.value
}

const applyStreamSeq = (
  target: { streamSeq?: string },
  streamSeq: Option.Option<string>,
): void => {
  if (Option.isSome(streamSeq)) target.streamSeq = streamSeq.value
}

const applyContentType = (
  target: { contentType?: typeof ContentType.Type },
  contentType: Option.Option<typeof ContentType.Type>,
): void => {
  if (Option.isSome(contentType)) target.contentType = contentType.value
}

export const toDurableCreateInput = (
  input: Parameters<NatsBridgePortShape["create"]>[0],
  hasAppendBody: boolean,
): DurableCreateInput => {
  const out: Writable<DurableCreateInput> = {
    streamId: input.streamId,
    contentType: input.contentType,
  }
  if (input.streamClosed === true && !hasAppendBody) out.streamClosed = true
  if (input.ttl !== undefined) out.ttl = input.ttl
  if (input.expiresAt !== undefined) out.expiresAt = input.expiresAt
  if (input.schemaId !== undefined) out.schemaId = input.schemaId
  return out
}

export const toDurableAppendInput = (intent: AppendIntent): DurableAppendInput => {
  switch (intent._tag) {
    case "AppendMessages": {
      const out: DurableAppendInput = {
        streamId: intent.streamId,
        messages: intent.messages,
      }
      applyContentType(out, intent.contentType)
      applyProducer(out, intent.producer)
      applyStreamSeq(out, intent.streamSeq)
      return out
    }
    case "AppendAndClose": {
      const out: DurableAppendInput = {
        streamId: intent.streamId,
        messages: intent.messages,
        streamClosed: true,
      }
      applyContentType(out, intent.contentType)
      applyProducer(out, intent.producer)
      applyStreamSeq(out, intent.streamSeq)
      return out
    }
    case "CloseStream": {
      const out: DurableAppendInput = {
        streamId: intent.streamId,
        messages: [],
        streamClosed: true,
      }
      applyProducer(out, intent.producer)
      applyStreamSeq(out, intent.streamSeq)
      return out
    }
  }
}
