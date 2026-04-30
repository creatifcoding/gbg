/**
 * @tmnl/lnk/services/wire — Wire layer for the Durable Streams protocol.
 *
 * Public surface:
 *   - `Protocol` — RpcGroup spec (single source of truth for op schemas/tags)
 *   - `Wire`     — Context.Service interface (transport-agnostic)
 *   - Per-impl subdirectories (each is a `Layer<Wire>`):
 *       - `./in-memory` — `InMemoryWire` (Phase 1)
 *       - (`./http`     — `HttpWire`,        Phase 1.1)
 *       - (`./nats-bridge` — `NatsBridgeWire`, Phase 5)
 *
 * @module @tmnl/lnk/services/wire
 */

// Service tag + hand-curated shape (consumed by callers).
export {
  Wire,
  type WireShape,
  type GetResult,
  type PostInput_PostBody,
  type PutInputT,
  type PutResultT,
  type PostInputT,
  type PostResultT,
  type GetInputT,
  type GetHeadersT,
  type HeadInputT,
  type HeadResultT,
  type DeleteInputT,
  type DeleteResultT,
} from "./Wire.js"

// RpcGroup spec + per-op schemas (single source of truth).
export {
  Protocol,
  PutRpc,
  PostRpc,
  GetRpc,
  HeadRpc,
  DeleteRpc,
  PutInput,
  PutResult,
  PostInput,
  PostResult,
  ProducerHeaders,
  GetInput,
  GetHeaders,
  HeadInput,
  HeadResult,
  DeleteInput,
  DeleteResult,
  LiveMode,
  PutError,
  PostError,
  GetError,
  HeadError,
  DeleteError,
} from "./Protocol.js"

export * as InMemory from "./in-memory/index.js"
export * as Http from "./http/index.js"
