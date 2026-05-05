/**
 * PactClient — typed proxy for a remote PCT instance.
 *
 * The client side of the bedside-vitals tracer. From a `baseUrl`
 * pointing at a running `Server.Routes`, the client offers:
 *
 *   - `publish(name, version, schema, opts?)` — POSTs to /publish,
 *     auto-serializes the Schema to its `SchemaRepresentation.Document`
 *     wire form. The remote node's Notary auto-stamps origin + time.
 *
 *   - `fetchSchema(schemaId)` — GETs /schemas/:id, decodes the wire
 *     document, reconstructs an Effect `Schema.Top`. Cached so
 *     repeated lookups don't re-fetch.
 *
 *   - `capabilities()` — GETs /capabilities, returns the decoded
 *     `Manifest` (read-only snapshot of the remote registry).
 *
 *   - `clearCache()` — drop cached schemas (forces re-fetch).
 *
 * # Design notes
 *
 * Cached schemas:
 *   `fetchSchema` caches by `schemaId` indefinitely. PCT semver
 *   guarantees a published `name@version` is immutable (deprecation
 *   is a flag, not mutation), so cached entries are safe forever
 *   for a given `(name, version)`. `clearCache()` is provided for
 *   tests and rare cases where the client wants to re-discover.
 *
 * Identity:
 *   Clients are *not* PCT nodes — they don't have an Identity
 *   service or sign events. Auto-stamping happens server-side via
 *   the remote node's Notary. The client only carries its baseUrl.
 *
 * Error handling:
 *   All errors funnel through `PactClientError` (transport, decode,
 *   server-side error envelopes) or `SchemaNotFound` (typed 404 for
 *   missing schemas). Caller catches via `catchTag`.
 *
 * @module @tmnl/pct/client/PactClient
 */

import * as Context from "effect-v4/Context"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Ref from "effect-v4/Ref"
import * as Schema from "effect-v4/Schema"
import * as SchemaRepresentation from "effect-v4/SchemaRepresentation"
import * as HttpClient from "effect-v4/unstable/http/HttpClient"
import * as HttpClientRequest from "effect-v4/unstable/http/HttpClientRequest"

import { Manifest } from "../manifest/Manifest.js"
import { GetSchemaResponse, PublishSchemaResponse } from "../server/wire.js"

// ─── Errors ─────────────────────────────────────────────────────────────────

/**
 * All client-side failures funnel through this typed error.
 *
 * Discriminated by `_tag` (Schema.TaggedErrorClass auto-injects it),
 * so callers can `Effect.catchTag("PactClientError", ...)`.
 */
export class PactClientError extends Schema.TaggedErrorClass<PactClientError>()(
  "PactClientError",
  {
    status: Schema.Number,
    code: Schema.String,
    message: Schema.String,
  },
) {}

/**
 * Distinct typed error for "schema not in registry." Lets callers
 * distinguish "fetch failed" from "fetch succeeded with 404."
 */
export class SchemaNotFound extends Schema.TaggedErrorClass<SchemaNotFound>()(
  "SchemaNotFound",
  {
    schemaId: Schema.String,
  },
) {}

// ─── Service shape ──────────────────────────────────────────────────────────

export interface PublishResult {
  readonly schemaId: string
  readonly revision: number
  readonly originNodeId: string
  readonly registeredAt: number
}

export interface PactClientShape {
  readonly baseUrl: string

  /**
   * Register a schema at the remote node. The remote Notary auto-
   * stamps `originNodeId` (the SERVER's nodeId, not the client's)
   * and `registeredAt`. Returns the assigned schemaId + revision.
   */
  readonly publish: (
    name: string,
    version: string,
    schema: Schema.Top,
    options?: { description?: string },
  ) => Effect.Effect<PublishResult, PactClientError>

  /**
   * Fetch a schema by id. Reconstructs an Effect `Schema.Top` from
   * the wire SchemaRepresentation.Document. Cached after first
   * successful fetch.
   */
  readonly fetchSchema: (
    schemaId: string,
  ) => Effect.Effect<Schema.Top, PactClientError | SchemaNotFound>

  /** Fetch the remote node's full Manifest. */
  readonly capabilities: Effect.Effect<Manifest, PactClientError>

  /** Drop all cached schemas. */
  readonly clearCache: Effect.Effect<void>
}

// ─── Service tag ────────────────────────────────────────────────────────────

export class PactClient extends Context.Service<PactClient, PactClientShape>()(
  "@tmnl/pct/client/PactClient",
) {}

// ─── Implementation helpers ─────────────────────────────────────────────────

const decodePublishResponse = Schema.decodeUnknownEffect(PublishSchemaResponse)
const decodeGetSchemaResponse = Schema.decodeUnknownEffect(GetSchemaResponse)

interface ErrorEnvelope {
  readonly error?: { readonly code?: string; readonly message?: string }
}

const transportError = (cause: unknown): PactClientError =>
  new PactClientError({
    status: 0,
    code: "PCT_TRANSPORT",
    message: String(cause),
  })

const liftEnvelopeError = (
  status: number,
  body: unknown,
  defaultCode: string,
): PactClientError => {
  const envelope = body as ErrorEnvelope | undefined
  return new PactClientError({
    status,
    code: envelope?.error?.code ?? defaultCode,
    message: envelope?.error?.message ?? `HTTP ${status}`,
  })
}

// ─── Implementation ─────────────────────────────────────────────────────────

/**
 * Construct a PactClient against a baseUrl.
 *
 * Requires `HttpClient.HttpClient` for the wire transport.
 */
export const make = (options: { readonly baseUrl: string }) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const cache = yield* Ref.make<Map<string, Schema.Top>>(new Map())

    const baseUrl = options.baseUrl.replace(/\/+$/, "") // trim trailing /

    /**
     * Wrap an HttpClient.execute call: lifts transport failures and
     * body-decode failures into `PactClientError`.
     */
    const fetchJson = (request: HttpClientRequest.HttpClientRequest) =>
      client.execute(request).pipe(
        Effect.mapError(transportError),
        Effect.flatMap((response) =>
          response.json.pipe(
            Effect.mapError((cause) =>
              new PactClientError({
                status: response.status,
                code: "PCT_BODY_DECODE",
                message: String(cause),
              }),
            ),
            Effect.map((body) => ({ status: response.status, body })),
          ),
        ),
      )

    const publish: PactClientShape["publish"] = (name, version, schema, opts) =>
      Effect.gen(function* () {
        const document = SchemaRepresentation.fromAST(schema.ast)
        const schemaDocument = Schema.encodeUnknownSync(
          SchemaRepresentation.DocumentFromJson,
        )(document)

        const body: Record<string, unknown> = { name, version, schemaDocument }
        if (opts?.description !== undefined) body.description = opts.description

        const { status, body: respBody } = yield* fetchJson(
          HttpClientRequest.post(`${baseUrl}/publish`).pipe(
            HttpClientRequest.bodyJsonUnsafe(body),
          ),
        )

        if (status >= 400) {
          return yield* Effect.fail(
            liftEnvelopeError(status, respBody, "PCT_PUBLISH_FAILED"),
          )
        }

        const decoded = yield* decodePublishResponse(respBody).pipe(
          Effect.mapError(
            (cause) =>
              new PactClientError({
                status,
                code: "PCT_RESPONSE_SCHEMA",
                message: String(cause),
              }),
          ),
        )

        // Update cache with the schema we just published — saves a fetch.
        yield* Ref.update(cache, (m) =>
          new Map(m).set(decoded.schemaId, schema),
        )

        return {
          schemaId: decoded.schemaId,
          revision: decoded.revision,
          originNodeId: decoded.originNodeId,
          registeredAt: decoded.registeredAt,
        }
      })

    const fetchSchema: PactClientShape["fetchSchema"] = (schemaId) =>
      Effect.gen(function* () {
        const cached = (yield* Ref.get(cache)).get(schemaId)
        if (cached !== undefined) return cached

        const { status, body } = yield* fetchJson(
          HttpClientRequest.get(
            `${baseUrl}/schemas/${encodeURIComponent(schemaId)}`,
          ),
        )

        if (status === 404) {
          return yield* Effect.fail(new SchemaNotFound({ schemaId }))
        }
        if (status >= 400) {
          return yield* Effect.fail(
            liftEnvelopeError(status, body, "PCT_FETCH_FAILED"),
          )
        }

        const entry = yield* decodeGetSchemaResponse(body).pipe(
          Effect.mapError(
            (cause) =>
              new PactClientError({
                status,
                code: "PCT_RESPONSE_SCHEMA",
                message: String(cause),
              }),
          ),
        )

        const document = yield* Effect.try({
          try: () =>
            Schema.decodeUnknownSync(SchemaRepresentation.DocumentFromJson)(
              entry.schemaDocument,
            ),
          catch: (cause) =>
            new PactClientError({
              status,
              code: "PCT_DOCUMENT_DECODE",
              message: String(cause),
            }),
        })

        const reconstructed = SchemaRepresentation.toSchema(document)

        yield* Ref.update(cache, (m) =>
          new Map(m).set(schemaId, reconstructed),
        )

        return reconstructed
      })

    const capabilities = Effect.gen(function* () {
      const { status, body } = yield* fetchJson(
        HttpClientRequest.get(`${baseUrl}/capabilities`),
      )

      if (status >= 400) {
        return yield* Effect.fail(
          liftEnvelopeError(status, body, "PCT_CAPABILITIES_FAILED"),
        )
      }

      return yield* Manifest.decode(body).pipe(
        Effect.mapError(
          (cause) =>
            new PactClientError({
              status,
              code: "PCT_MANIFEST_DECODE",
              message: String(cause),
            }),
        ),
      )
    })

    const clearCache = Ref.set(cache, new Map())

    return PactClient.of({
      baseUrl,
      publish,
      fetchSchema,
      capabilities,
      clearCache,
    })
  })

/**
 * Layer constructor — provides a `PactClient` against the given baseUrl.
 *
 * Requires `HttpClient.HttpClient` from the runtime. Use
 * `FetchHttpClient.layer` (browser/Node fetch) or
 * `NodeHttpClient.layerUndici` (Node native) to satisfy.
 */
export const layer = (
  options: { readonly baseUrl: string },
): Layer.Layer<PactClient, never, HttpClient.HttpClient> =>
  Layer.effect(PactClient, make(options))
