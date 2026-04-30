/**
 * In-memory wire implementation.
 *
 * Provides `InMemoryWire.layer` (a `Layer<DurableStreamWire>`) backed by
 * `InMemoryInner` (an in-process `Ref<Map<StreamId, InternalStream>>`).
 *
 * @module @tmnl/lnk/services/wire/in-memory
 */

export { InMemoryWire } from "./InMemoryWire.js"
export { InMemoryInner } from "./InMemoryInner.js"
export type { InMemoryInnerShape } from "./InMemoryInner.js"
