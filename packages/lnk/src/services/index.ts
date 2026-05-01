/**
 * @tmnl/lnk/services — Effect-native services for the Durable Streams library.
 *
 * Layered surface (top → bottom):
 *   - `Lnks` (Phase 2.1+) — ref-counted multi-stream factory (RcMap)
 *   - `Lnk`  (Phase 2)    — yieldable handle to a single stream
 *   - `Wire` (Phase 1)    — transport-agnostic HTTP-spec interface
 *
 * @module @tmnl/lnk/services
 */

export * as Wire from "./wire/index.js"
export * as Lnks from "./lnks/index.js"
