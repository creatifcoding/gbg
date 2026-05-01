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
export {
  Message,
  fromBytes as messageFromBytes,
  fromBytesWithOffset as messageFromBytesWithOffset,
} from "./Message.js"
