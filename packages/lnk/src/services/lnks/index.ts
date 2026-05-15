/**
 * @tmnl/lnk/services/lnks — Lnk handle layer (Phase 2).
 *
 * Public surface:
 *   - `Lnk`     — yieldable handle to a single stream (extends
 *                 `Effect.YieldableClass<Option<Message>, never, never>`)
 *   - `Message` — per-message envelope (offset + payload bytes)
 *
 * The handle layer lives ABOVE the wire layer:
 *   - `Wire` speaks the HTTP protocol (raw bodies, status codes)
 *   - `Lnk` speaks the user's protocol (yieldable, per-message stream,
 *     append/close domain methods, driver-fiber-managed live PubSub)
 *
 * @module @tmnl/lnk/services/lnks
 */

export { Lnk, type LnkAppendOptions, type LnkMakeOptions } from "./Lnk.js"
export { Lnks, type LnksConfig, type LnksShape } from "./Lnks.js"
export {
  JSON_CONTENT_TYPE,
  TypedLnk,
  make as typedLnkMake,
  withSchema as withLnkSchema,
} from "./TypedLnk.js"
export {
  Message,
  fromBytes as messageFromBytes,
  fromBytesWithOffset as messageFromBytesWithOffset,
} from "./Message.js"

// Optional @tmnl/stx integration. Re-exported for callers that have
// @tmnl/stx installed (peer dep). If not installed, importing these names
// is a TS error — the rest of the module remains usable.
export { lnkLatest, lnkFeed } from "./Stx.js"
