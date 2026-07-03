/**
 * SchemaResolver implementation backed by PactClient.
 *
 * Bridges `@tmnl/lnk`'s abstract `SchemaResolver` service to
 * `PactClient.fetchSchema`. Lnk depends on the abstract interface;
 * pct provides the concrete impl. Dependency direction stays clean:
 * `pct -> lnk` only, never reversed.
 *
 * # Layer composition
 *
 * ```ts
 * Layer.mergeAll(
 *   Pact.Server.Routes,
 *   Lnk.Wire.Http.Routes,
 * ).pipe(
 *   Layer.provideMerge(Pact.Notary.Default),
 *   Layer.provideMerge(Pact.Registry.layer),
 *   Layer.provideMerge(Pact.Identity.layerEphemeral),
 *   Layer.provideMerge(Lnk.Wire.InMemory.InMemoryWire.layer),
 *   Layer.provideMerge(EventJournal.layerMemory),
 *   Layer.provideMerge(Lnks.layer()),
 *   Layer.provideMerge(SchemaResolverLayer({ baseUrl })),  // ← this
 * )
 * ```
 *
 * `Lnks.connectTypedById` will then resolve schemas via the running
 * PCT server. PactClient's in-process cache handles repeated lookups.
 *
 * @module @tmnl/pct/client/SchemaResolverLayer
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpClient from "effect/unstable/http/HttpClient"

import {
  SchemaResolver,
  SchemaResolverNotFound,
  type SchemaResolverShape,
} from "@tmnl/lnk/contracts"
import { FetchError } from "@tmnl/lnk/contracts"

import {
  type PactClientError,
  PactClient,
  layer as pactClientLayer,
  SchemaNotFound,
} from "./PactClient.js"

// ─── Adapter ────────────────────────────────────────────────────────────────

/**
 * Build a `SchemaResolverShape` that delegates to a `PactClient`.
 *
 * Error mapping:
 *   - `PactClient.SchemaNotFound`   → `SchemaResolverNotFound` (typed)
 *   - `PactClient.PactClientError` → `FetchError` (Lnk's transport bucket)
 */
const adapter = (
  client: PactClientShape,
): SchemaResolverShape => ({
  fetchSchema: (schemaId) =>
    client.fetchSchema(schemaId).pipe(
      Effect.catchTag("SchemaNotFound", (err: SchemaNotFound) =>
        Effect.fail(new SchemaResolverNotFound({ schemaId: err.schemaId })),
      ),
      Effect.catchTag("PactClientError", (err: PactClientError) =>
        Effect.fail(
          new FetchError({
            ...(err.status !== undefined ? { status: err.status } : {}),
            message: `[${err.code}] ${err.message}`,
            cause: err,
          }),
        ),
      ),
    ),
})

// Re-typed alias to avoid importing the type from PactClient directly
// at this module's top — keeps the import list clean.
type PactClientShape = typeof PactClient.Service

// ─── Layers ─────────────────────────────────────────────────────────────────

/**
 * Provide `SchemaResolver` from a PactClient that's already in scope.
 *
 * Use this when the application already constructs a `PactClient`
 * (e.g. for `client.publish(...)`) and you want the same instance to
 * power Lnk's schema-auto-fetch path. They share the cache.
 */
export const layerFromPactClient: Layer.Layer<
  SchemaResolver,
  never,
  PactClient
> = Layer.effect(
  SchemaResolver,
  Effect.gen(function* () {
    const client = yield* PactClient
    return adapter(client)
  }),
)

/**
 * Provide `SchemaResolver` by constructing a fresh PactClient
 * pointing at `baseUrl`. Bundles HttpClient as a dep.
 *
 * Use when this is your application's only PactClient usage
 * (e.g. inside a server that ONLY resolves schemas, doesn't
 * publish).
 */
export const layer = (
  options: { readonly baseUrl: string },
): Layer.Layer<SchemaResolver, never, HttpClient.HttpClient> =>
  layerFromPactClient.pipe(Layer.provide(pactClientLayer(options)))
