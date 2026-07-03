/**
 * @tmnl/lnk — Effect v4-native Durable Streams library
 *
 * Spec-faithful implementation of the Durable Streams wire protocol with
 * first-class yieldable handles, ref-counted multi-stream factory, and
 * `@tmnl/stx` reactive atom integration.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
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
 * Phase status (canonical sequence per ARCHITECTURE.md):
 *   - Phase 0 (contracts)             : ✅ done
 *   - Phase 1 (wire layer)            : ✅ done
 *     - 1.0: in-memory + HttpWire     : ✅  (241/299 upstream conformance,
 *                                            0 in-scope failures)
 *     - 1.4: HttpRoutes Layer         : ✅  (production server routes,
 *                                            composes with Pact on one host)
 *     - 1.5: SSE / HEAD / DELETE      : (deferred; covered by spec-server)
 *   - Phase 2 (Lnk handle)            : ✅ done (2.0 + 2.1 + 2.3)
 *     - 2.0: Lnk yieldable handle     : ✅
 *     - 2.1: Lnks factory (RcMap)     : ✅
 *     - 2.2: Producer Sink            : (deferred)
 *     - 2.3: @tmnl/stx integration    : ✅
 *     - 2.4: React surface            : (covered by stx hooks)
 *     - 2.5: schema auto-bind         : (in progress)
 *   - Phase 3 (production runtime)    : not started — TTL reaper, ETag,
 *                                       security headers (~24 conformance
 *                                       tests gated here)
 *   - Phase 4 (Fork)                  : not started — branching streams
 *                                       (~37 conformance tests gated here)
 *   - Phase 5 (NATS-bridge)           : not started — ports / corrects the
 *                                       legacy v1 NATS bridge from
 *                                       tmnl/src/lib/holonet/durable-streams/v1/
 *                                       onto v4 + the new spec-faithful
 *                                       Wire shape
 *
 * @module
 */

// Phase 0 — wire & type contracts (Schema-backed brands + errors)
export * as Contracts from "./contracts/index.js"

// Phase 1 + 2 — services (Wire transport, Lnk handle, Lnks factory, Stx bridge)
export * as Services from "./services/index.js"
