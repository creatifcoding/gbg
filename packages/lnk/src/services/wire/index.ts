/**
 * @tmnl/lnk/services/wire — Wire layer for the Durable Streams protocol.
 *
 * Public surface:
 *   - `DurableStreamWire` — Context.Service interface (transport-agnostic)
 *   - `Wire` — RpcGroup spec (single source of truth for op schemas/tags)
 *   - Per-impl subdirectories (each is a `Layer<DurableStreamWire>`):
 *       - `./in-memory` — `InMemoryWire` (Phase 1)
 *       - (`./http`     — `HttpWire`,        Phase 1.1)
 *       - (`./nats-bridge` — `NatsBridgeWire`, Phase 5)
 *
 * @module @tmnl/lnk/services/wire
 */

export {
  DurableStreamWire,
  type DurableStreamWireShape,
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
} from "./DurableStreamWire.js"

export {
  Wire,
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
} from "./Wire.js"

export * as InMemory from "./in-memory/index.js"
