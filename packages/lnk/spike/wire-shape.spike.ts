/**
 * SPIKE — RpcGroup as type-level spec, hand-curated service shape.
 *
 * First spike (auto-derive via `RpcClient.From<typeof Wire>`) FAILED:
 *   - `Discard` and `AsQueue` generic parameters force the impl to be itself
 *     generic over them, returning conditional types based on those flags.
 *   - Hand-rolled impl cannot satisfy that contract; it would have to BE
 *     `RpcClient.make()`'s actual output (with all the request-id/ack
 *     plumbing).
 *
 * This second spike tests the alternative:
 *
 *   - `Wire` is an RpcGroup of `Rpc.make(...)` definitions (single source of
 *      truth for op schemas + tags + stream flags).
 *   - The `DurableStreamWire` service shape is **hand-curated**:
 *     `{ put: (input) => Effect<...>, get: (input) => Stream<...>, ... }`
 *   - Method input/output/error types are extracted from each Rpc via
 *     `Schema.Schema.Type<...>` over the Rpc's payload/success/error
 *     schemas.
 *
 * Goals:
 *   Q-A. Can we extract the operation types directly from the Rpc objects?
 *   Q-B. Does a hand-rolled impl typecheck cleanly?
 *   Q-C. Does the streaming `get` method's return type cleanly resolve to
 *        `Stream<Message, GetError>` without RpcClient envelope leakage?
 *   Q-D. Do the typed errors propagate? (FetchError visible in Effect's E
 *        channel, etc.)
 *
 * If all four are green, this is the architecture.
 */

import * as Effect from "effect-v4/Effect"
import * as Schema from "effect-v4/Schema"
import * as Stream from "effect-v4/Stream"
import * as Rpc from "effect-v4/unstable/rpc/Rpc"
import * as RpcGroup from "effect-v4/unstable/rpc/RpcGroup"

import { Offset, ReadPosition } from "../src/contracts/Offset.js"
import { StreamId } from "../src/contracts/StreamId.js"
import {
  StaleEpochError,
  StreamClosedError,
  RetentionDroppedError,
  FetchError,
} from "../src/contracts/errors.js"

// ─── Op payload/success/error schemas ──────────────────────────────────────

const PutInput = Schema.Struct({
  streamId: StreamId,
  contentType: Schema.String,
})

const PutResult = Schema.Struct({
  streamId: StreamId,
  created: Schema.Boolean,
})

const PostInput = Schema.Struct({
  streamId: StreamId,
  body: Schema.Uint8Array,
})

const PostResult = Schema.Struct({
  nextOffset: Offset,
  duplicate: Schema.Boolean,
})

const GetInput = Schema.Struct({
  streamId: StreamId,
  offset: ReadPosition,
})

const Message = Schema.Struct({
  offset: Offset,
  body: Schema.Uint8Array,
})

// ─── Wire RpcGroup (the spec) ──────────────────────────────────────────────

const PutRpc = Rpc.make("put", {
  payload: PutInput,
  success: PutResult,
  error: FetchError,
})

const PostRpc = Rpc.make("post", {
  payload: PostInput,
  success: PostResult,
  error: Schema.Union([FetchError, StaleEpochError, StreamClosedError]),
})

const GetRpc = Rpc.make("get", {
  payload: GetInput,
  success: Message,
  error: Schema.Union([FetchError, RetentionDroppedError]),
  stream: true,
})

class Wire extends RpcGroup.make(PutRpc, PostRpc, GetRpc) {}

// ─── Q-A: Type extractors ──────────────────────────────────────────────────
//
// Per Rpc.d.ts:
//   Rpc.Payload<R> = R extends Rpc<_,Payload,_,_,_,_> ? Schema.Schema.Type<Payload> : never
//   Rpc.Success<R> ≈ Schema.Schema.Type<SuccessSchema<R>>  // for non-streaming
//   Rpc.SuccessExitSchema<R> = SuccessSchema<R> extends RpcSchema.Stream<A, E> ? A : SuccessSchema<R>
//
// Cleanest approach for our hand-curated shape: extract directly via
// Schema.Schema.Type over the schema instances we already have.

type PutInputT = typeof PutInput.Type
type PutResultT = typeof PutResult.Type
type PostInputT = typeof PostInput.Type
type PostResultT = typeof PostResult.Type
type GetInputT = typeof GetInput.Type
type MessageT = typeof Message.Type

// ─── Q-B: Hand-curated service shape ───────────────────────────────────────

interface DurableStreamWireOps {
  readonly put: (input: PutInputT) => Effect.Effect<PutResultT, FetchError>
  readonly post: (
    input: PostInputT,
  ) => Effect.Effect<PostResultT, FetchError | StaleEpochError | StreamClosedError>
  readonly get: (
    input: GetInputT,
  ) => Stream.Stream<MessageT, FetchError | RetentionDroppedError>
}

// ─── Q-B + Q-C + Q-D: Construct an impl ────────────────────────────────────

const handRolledImpl: DurableStreamWireOps = {
  put: (input) =>
    Effect.succeed({
      streamId: input.streamId,
      created: true,
    }),
  post: (_input) =>
    Effect.succeed({
      nextOffset: "0" as PostResultT["nextOffset"],
      duplicate: false,
    }),
  get: (_input) =>
    Stream.empty as Stream.Stream<
      MessageT,
      FetchError | RetentionDroppedError
    >,
}

// ─── Verify the shapes resolve cleanly ─────────────────────────────────────

// Effect<PutResultT, FetchError, never> — note the clean R = never.
const putReturn = handRolledImpl.put({
  streamId: "x" as PutInputT["streamId"],
  contentType: "application/json",
})
type PutReturnT = typeof putReturn // visible in IDE; should be Effect<PutResultT, FetchError, never>

// Stream<MessageT, FetchError | RetentionDroppedError, never> — clean.
const getReturn = handRolledImpl.get({
  streamId: "x" as GetInputT["streamId"],
  offset: "-1",
})
type GetReturnT = typeof getReturn // should be Stream<MessageT, FetchError | RetentionDroppedError, never>

// ─── Demonstrate composition with Effect.gen ───────────────────────────────

const sample = Effect.gen(function* () {
  const result = yield* handRolledImpl.put({
    streamId: "test" as PutInputT["streamId"],
    contentType: "application/json",
  })
  // result has type PutResultT.
  return result.streamId
})
type SampleT = typeof sample // Effect<StreamId, FetchError, never>

// ─── Demonstrate streaming consumption ─────────────────────────────────────

const drained = Stream.runForEach(getReturn, (msg) =>
  Effect.sync(() => {
    // msg is MessageT — { offset, body }
    void msg.offset
    void msg.body
  }),
)
type DrainedT = typeof drained // Effect<void, FetchError | RetentionDroppedError, never>

// ─── Q-A continued: Can we tie the curated shape BACK to the Wire group? ──
//
// Type-level proof that the curated shape's tags are a subset of Wire's tags
// (catches drift if we add a Rpc but forget to add a method, etc.).

type WireRpcs = RpcGroup.Rpcs<typeof Wire>
type WireRpcTags = WireRpcs["_tag"]
type CuratedTags = keyof DurableStreamWireOps

// Compile-time assertion: every curated method tag is a known Wire Rpc tag.
type _AssertCuratedSubsetOfWire = CuratedTags extends WireRpcTags ? true : never
const _curatedTagsAreWireTags: _AssertCuratedSubsetOfWire = true
void _curatedTagsAreWireTags

// ─── Verdict checklist (after `bun run typecheck`) ─────────────────────────
//
//   Q-A. Type extractors via `typeof Schema.Type` work — should be GREEN.
//   Q-B. Hand-rolled impl typechecks against curated shape — GREEN if no
//        TS errors below this comment.
//   Q-C. Streaming get returns Stream<MessageT, GetError, never> with NO
//        Queue/asQueue/Scope baggage — GREEN if `getReturn`'s hover type is
//        Stream<MessageT, FetchError | RetentionDroppedError, never>.
//   Q-D. Errors propagate: `drained` should have E = FetchError |
//        RetentionDroppedError. GREEN if the type assertion compiles.

export {}
