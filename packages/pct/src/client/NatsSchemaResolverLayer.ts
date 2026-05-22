/**
 * NATS-native SchemaResolver provider for LNK typed auto-binding.
 *
 * This is the PCT-side adapter for a future NATS micro control plane. LNK's
 * contract stays unchanged: it asks a `SchemaResolver` for a `Schema.Top` by
 * opaque schema id. This layer satisfies that contract by request/replying a
 * PCT micro endpoint (default `${subjectRoot}.schema.get`) and reconstructing
 * the same schema document shape returned by HTTP `PactClient.fetchSchema`.
 *
 * MSH remains substrate-only; this module owns the PCT response semantics and
 * maps NATS service errors to LNK-domain resolver errors.
 *
 * @module @tmnl/pct/client/NatsSchemaResolverLayer
 */

import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Schema from "effect-v4/Schema"
import * as SchemaRepresentation from "effect-v4/SchemaRepresentation"

import {
  NatsConnectionService,
  NatsCodec,
} from "@tmnl/msh/nats"
import {
  ServiceError,
  ServiceErrorCodeHeader,
  ServiceErrorHeader,
  type Msg,
} from "nats.ws"
import {
  FetchError,
  SchemaResolver,
  SchemaResolverNotFound,
  type SchemaResolverShape,
} from "@tmnl/lnk/contracts"

import {
  GetSchemaResponse,
  SchemaGetRequest,
} from "../server/wire.js"

export { SchemaGetRequest }

export const SchemaGetResponse = GetSchemaResponse
export type SchemaGetResponse = typeof SchemaGetResponse.Type

export interface NatsSchemaResolverOptions {
  /** PCT micro subject root. Proof default is readable; production can use `_tmnl.pct.v1`. */
  readonly subjectRoot?: string
  /** Endpoint subject suffix under `subjectRoot`. */
  readonly endpoint?: string
  /** Core NATS request timeout in milliseconds. */
  readonly timeoutMs?: number
}

export interface ResolvedNatsSchemaResolverOptions {
  readonly subjectRoot: string
  readonly endpoint: string
  readonly timeoutMs: number
  readonly subject: string
}

export const DEFAULT_NATS_SCHEMA_RESOLVER_OPTIONS: ResolvedNatsSchemaResolverOptions = {
  subjectRoot: "pct.v1",
  endpoint: "schema.get",
  timeoutMs: 5_000,
  subject: "pct.v1.schema.get",
}

export const resolveNatsSchemaResolverOptions = (
  options: NatsSchemaResolverOptions = {},
): ResolvedNatsSchemaResolverOptions => {
  const subjectRoot = options.subjectRoot ?? DEFAULT_NATS_SCHEMA_RESOLVER_OPTIONS.subjectRoot
  const endpoint = options.endpoint ?? DEFAULT_NATS_SCHEMA_RESOLVER_OPTIONS.endpoint
  return {
    subjectRoot,
    endpoint,
    timeoutMs: options.timeoutMs ?? DEFAULT_NATS_SCHEMA_RESOLVER_OPTIONS.timeoutMs,
    subject: `${subjectRoot}.${endpoint}`,
  }
}

const decodeSchemaGetResponse = Schema.decodeUnknownEffect(SchemaGetResponse)

const toSchemaResolverNotFound = (schemaId: string): SchemaResolverNotFound =>
  new SchemaResolverNotFound({ schemaId })

const toFetchError = (message: string, cause: unknown, status = 502): FetchError =>
  cause instanceof FetchError
    ? cause
    : new FetchError({ status, message, cause })

const serviceErrorFromMsg = (msg: Msg): ServiceError | null => {
  const fromHelper = ServiceError.toServiceError(msg)
  if (fromHelper !== null) return fromHelper

  const code = msg.headers?.get(ServiceErrorCodeHeader)
  const description = msg.headers?.get(ServiceErrorHeader)
  if (code !== undefined || description !== undefined) {
    const parsedCode = code === undefined ? 500 : Number(code)
    return new ServiceError(
      Number.isFinite(parsedCode) ? parsedCode : 500,
      description ?? "NATS service error",
    )
  }
  return null
}

const decodeSchemaResponse = (
  msg: Msg,
  schemaId: string,
): Effect.Effect<Schema.Top, FetchError | SchemaResolverNotFound> =>
  Effect.gen(function* () {
    const serviceError = serviceErrorFromMsg(msg)
    if (serviceError !== null) {
      if (serviceError.code === 404) return yield* Effect.fail(toSchemaResolverNotFound(schemaId))
      return yield* Effect.fail(
        toFetchError(
          `PCT NATS schema.get failed (${serviceError.code}): ${serviceError.message}`,
          serviceError,
          serviceError.code,
        ),
      )
    }

    const payload = yield* NatsCodec.decodeJson(SchemaGetResponse, {
      subject: msg.subject,
    })(msg.data).pipe(
      Effect.mapError((cause) =>
        toFetchError("PCT NATS schema.get response failed decoding", cause),
      ),
    )

    const entry = yield* decodeSchemaGetResponse(payload).pipe(
      Effect.mapError((cause) =>
        toFetchError("PCT NATS schema.get response failed schema validation", cause),
      ),
    )

    const document = yield* Effect.try({
      try: () =>
        Schema.decodeUnknownSync(SchemaRepresentation.DocumentFromJson)(
          entry.schemaDocument,
        ),
      catch: (cause) =>
        toFetchError("PCT NATS schema document failed decoding", cause),
    })

    return SchemaRepresentation.toSchema(document)
  })

export const make = (
  options: NatsSchemaResolverOptions = {},
): Effect.Effect<SchemaResolverShape, never, NatsConnectionService> =>
  Effect.gen(function* () {
    const resolved = resolveNatsSchemaResolverOptions(options)
    const { nc } = yield* NatsConnectionService

    const fetchSchema: SchemaResolverShape["fetchSchema"] = (schemaId) =>
      Effect.gen(function* () {
        const request = yield* NatsCodec.encodeJson(SchemaGetRequest, { schemaId }).pipe(
          Effect.mapError((cause) =>
            toFetchError("PCT NATS schema.get request failed encoding", cause, 500),
          ),
        )
        const msg = yield* Effect.tryPromise({
          try: () => nc.request(resolved.subject, request, { timeout: resolved.timeoutMs }),
          catch: (cause) =>
            toFetchError(
              `PCT NATS schema.get request to '${resolved.subject}' failed`,
              cause,
              503,
            ),
        })
        return yield* decodeSchemaResponse(msg, schemaId)
      })

    return SchemaResolver.of({ fetchSchema })
  })

export const layer = (
  options: NatsSchemaResolverOptions = {},
): Layer.Layer<SchemaResolver, never, NatsConnectionService> =>
  Layer.effect(SchemaResolver, make(options))
