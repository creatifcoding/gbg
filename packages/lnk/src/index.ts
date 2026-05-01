/**
 * @tmnl/lnk — Effect v4-native Durable Streams library
 *
 * Spec-faithful implementation of the Durable Streams wire protocol with
 * first-class yieldable handles, ref-counted multi-stream factory, and
 * `@tmnl/stx` reactive atom integration.
 *
 * @example
 * ```ts
 * import { Effect } from "effect-v4"
 * import { Services } from "@tmnl/lnk"
 * import { InMemoryWire } from "@tmnl/lnk/services/wire/in-memory"
 *
 * const program = Effect.gen(function*() {
 *   const lnks = yield* Services.Lnks.Lnks
 *   const lnk = yield* lnks.connect(streamId, contentType)
 *   yield* lnk.append(payload)
 *   const subscription = lnk.subscribe()
 *   // ...
 * })
 *
 * Effect.runPromise(
 *   program.pipe(
 *     Effect.provide(Services.Lnks.Lnks.Default),
 *     Effect.provide(InMemoryWire.layer),
 *   ),
 * )
 * ```
 *
 * Phase status:
 *   - Phase 0 (contracts)           : ✅ done
 *   - Phase 1 (wire layer)          : ✅ done — InMemoryWire + HttpWire
 *                                     against 241/299 upstream conformance
 *                                     tests, 0 in-scope failures
 *   - Phase 2 (Lnk handle)          : ✅ done (2.0 + 2.1 + 2.3)
 *     - 2.0: Lnk yieldable handle   : ✅
 *     - 2.1: Lnks factory (RcMap)   : ✅
 *     - 2.2: Producer Sink          : (deferred)
 *     - 2.3: @tmnl/stx integration  : ✅
 *     - 2.4: React surface          : (covered by stx hooks)
 *   - Phase 3 (NATS-bridge)         : not started
 *   - Phase 4 (server runtime)      : not started — TTL reaper, ETag,
 *                                     security headers (~24 conformance
 *                                     tests gated here)
 *   - Phase 5 (Fork)                : not started — branching streams
 *                                     (~37 conformance tests gated here)
 *
 * @module
 */

// Phase 0 — wire & type contracts (Schema-backed brands + errors)
export * as Contracts from "./contracts/index.js"

// Phase 1 + 2 — services (Wire transport, Lnk handle, Lnks factory, Stx bridge)
export * as Services from "./services/index.js"
