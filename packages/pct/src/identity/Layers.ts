/**
 * Identity layers — concrete identity providers.
 *
 * Each layer constructs both:
 *   - `Pact.Identity`  — Pact's addressing surface (nodeId, nodeUrl)
 *   - `EventLog.Identity` — the underlying cryptographic keypair
 *
 * Provided as a pair so consumers don't need to wire EventLog's
 * substrate manually; `Layer.provide(Identity.layerEphemeral)` is
 * sufficient for both `Notary` and the EventLog substrate.
 *
 * @module @tmnl/pct/identity/Layers
 */

import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Hash from "effect/Hash"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Path from "effect/Path"
import * as EventLog from "effect/unstable/eventlog/EventLog"
import * as EventLogEncryption from "effect/unstable/eventlog/EventLogEncryption"

import { trustNodeId, type NodeId } from "../contracts/Brands.js"
import { Identity } from "./Identity.js"

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Derive a deterministic, short, opaque NodeId from a public key.
 *
 * Format: `pct:<8-char hex>`. Stable for the lifetime of the keypair.
 * Cryptographically one-way (different keys → different nodeIds).
 *
 * Uses Effect's `Hash.string` (FNV-style) for portability across
 * runtimes that may lack WebCrypto sync hashing. SHA-256 would be
 * stronger; FNV is sufficient for distinguishing distinct keys at the
 * scale of "<thousand peer nodes." Upgradable to SHA-256 in a future
 * spec rev without breaking compatibility (NodeId is opaque).
 */
const deriveNodeId = (publicKey: string): NodeId => {
  const hash = Hash.string(publicKey)
  // Convert to unsigned 32-bit, then to 8-char hex.
  const unsigned = (hash >>> 0).toString(16).padStart(8, "0")
  return trustNodeId(`pct:${unsigned}`)
}

// ─── Ephemeral layer (default for tests/dev) ────────────────────────────────

/**
 * Provides a fresh `Pact.Identity` and `EventLog.Identity` per process.
 *
 * The keypair is generated via `EventLogEncryption.makeIdentity`
 * (WebCrypto-backed). The NodeId is derived from the public key
 * deterministically.
 *
 * Use for: tests, dev servers, ad-hoc clients. Not suitable for
 * production nodes that need stable identity across restarts —
 * use `layerPersistent` for that.
 */
export const layerEphemeralWith = (
  options: FromKeyOptions = {},
): Layer.Layer<Identity | EventLog.Identity, never, never> =>
  Layer.unwrap(
    Effect.gen(function* () {
      const eventLogIdentity = yield* EventLog.makeIdentity.pipe(
        Effect.provide(EventLogEncryption.layerSubtle),
      )
      const nodeId = options.nodeId ?? deriveNodeId(eventLogIdentity.publicKey)
      return Layer.mergeAll(
        Layer.succeed(Identity, {
          nodeId,
          nodeUrl:
            options.nodeUrl !== undefined
              ? Option.some(options.nodeUrl)
              : Option.none(),
        }),
        Layer.succeed(EventLog.Identity, eventLogIdentity),
      )
    }),
  )

export const layerEphemeral: Layer.Layer<
  Identity | EventLog.Identity,
  never,
  never
> = layerEphemeralWith()

// ─── From-key layer (explicit) ──────────────────────────────────────────────

export interface FromKeyOptions {
  readonly nodeId?: NodeId
  readonly nodeUrl?: string
}

export interface PersistentOptions extends FromKeyOptions {
  /** File containing EventLog.encodeIdentityString output. */
  readonly filePath: string
}

/**
 * Wrap an externally-supplied `EventLog.Identity` as a `Pact.Identity`.
 *
 * Useful for test fixtures that need deterministic identities, or for
 * production nodes that load their keypair from disk/env via a custom
 * EventLog.Identity layer.
 *
 * If `nodeId` is omitted, derived from the public key (same algorithm
 * as `layerEphemeral`).
 */
export const layerFromEventLogIdentity = (
  options: FromKeyOptions = {},
): Layer.Layer<Identity, never, EventLog.Identity> =>
  Layer.effect(
    Identity,
    Effect.gen(function* () {
      const eventLogIdentity = yield* EventLog.Identity
      const nodeId = options.nodeId ?? deriveNodeId(eventLogIdentity.publicKey)
      return {
        nodeId,
        nodeUrl:
          options.nodeUrl !== undefined
            ? Option.some(options.nodeUrl)
            : Option.none(),
      }
    }),
  )

// ─── Persistent layer ──────────────────────────────────────────────────────

/**
 * Load or create a stable EventLog identity at `filePath`.
 *
 * The file stores Effect-smol's `EventLog.encodeIdentityString` output.
 * If absent, a fresh identity is generated, the parent directory is
 * created, and the encoded identity is written before services are
 * provided. This keeps Pact `nodeId` stable across process restarts.
 */
export const layerPersistent = (
  options: PersistentOptions,
): Layer.Layer<
  Identity | EventLog.Identity,
  Error,
  FileSystem.FileSystem | Path.Path
> =>
  Layer.unwrap(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const exists = yield* fs.exists(options.filePath).pipe(
        Effect.catchCause(() => Effect.succeed(false)),
      )

      const eventLogIdentity = exists
        ? yield* fs.readFileString(options.filePath).pipe(
            Effect.map((contents) =>
              EventLog.decodeIdentityString(contents.trim()),
            ),
            Effect.mapError(
              (cause) =>
                new Error(
                  `pct identity: failed to read ${options.filePath}: ${cause}`,
                ),
            ),
          )
        : yield* Effect.gen(function* () {
            const created = yield* EventLog.makeIdentity.pipe(
              Effect.provide(EventLogEncryption.layerSubtle),
            )
            yield* fs.makeDirectory(path.dirname(options.filePath), {
              recursive: true,
            }).pipe(
              Effect.mapError(
                (cause) =>
                  new Error(
                    `pct identity: failed to create ${path.dirname(options.filePath)}: ${cause}`,
                  ),
              ),
            )
            yield* fs.writeFileString(
              options.filePath,
              `${EventLog.encodeIdentityString(created)}\n`,
            ).pipe(
              Effect.mapError(
                (cause) =>
                  new Error(
                    `pct identity: failed to write ${options.filePath}: ${cause}`,
                  ),
              ),
            )
            return created
          })

      const nodeId = options.nodeId ?? deriveNodeId(eventLogIdentity.publicKey)
      return Layer.mergeAll(
        Layer.succeed(Identity, {
          nodeId,
          nodeUrl:
            options.nodeUrl !== undefined
              ? Option.some(options.nodeUrl)
              : Option.none(),
        }),
        Layer.succeed(EventLog.Identity, eventLogIdentity),
      )
    }),
  )
