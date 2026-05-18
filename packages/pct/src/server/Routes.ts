/**
 * PCT HTTP routes — Layer-shaped, composes onto a shared `HttpRouter`.
 *
 * Following the v4 `HttpRouter.addAll` pattern: this module exports a
 * `Layer` that adds the PCT endpoints to whatever `HttpRouter` is in
 * scope. Compose with `Lnk.Routes` to host both protocols on one server.
 *
 * Current endpoints:
 *   - `GET  /capabilities`            — manifest snapshot
 *   - `GET  /schemas/:schemaId`        — single schema entry
 *   - `POST /publish`                  — register a schema (Notary-stamped)
 *   - `POST /publish/procedure`        — register one operation + schemas
 *   - `POST /publish/group`            — register a ProcedureGroup
 *
 * Planned endpoints:
 *   - `POST /rpc/:opId`                — invoke a procedure
 *   - `GET  /snapshots/...`            — signed snapshots
 *   - `*    /federation/*`             — peer/admin and delta sync
 *
 * @module @tmnl/pct/server/Routes
 */

import * as Effect from "effect-v4/Effect"
import * as Option from "effect-v4/Option"
import * as Schema from "effect-v4/Schema"
import * as SchemaRepresentation from "effect-v4/SchemaRepresentation"
import * as HttpRouter from "effect-v4/unstable/http/HttpRouter"
import * as HttpServerRequest from "effect-v4/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect-v4/unstable/http/HttpServerResponse"

import { Identity } from "../identity/Identity.js"
import { Manifest } from "../manifest/Manifest.js"
import { Notary } from "../notary/Notary.js"
import {
  fromDocument,
  fromGroupDocument,
} from "../procedures/Document.js"
import { Registry } from "../registry/Registry.js"
import {
  ErrorBody,
  PublishProcedureGroupRequest,
  PublishProcedureRequest,
  PublishSchemaRequest,
} from "./wire.js"

// ─── Helpers ────────────────────────────────────────────────────────────────

const decodePublishBody = Schema.decodeUnknownEffect(PublishSchemaRequest)
const decodePublishProcedureBody = Schema.decodeUnknownEffect(
  PublishProcedureRequest,
)
const decodePublishGroupBody = Schema.decodeUnknownEffect(
  PublishProcedureGroupRequest,
)

/**
 * Construct a JSON error response with the given status + code.
 *
 * Per `PCT.md` §11: error bodies are `{ error: { code, message, detail? } }`
 * with HTTP status conveying the class.
 */
const errorResponse = (
  status: number,
  code: string,
  message: string,
  detail?: unknown,
): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.jsonUnsafe(
    {
      error:
        detail !== undefined
          ? { code, message, detail }
          : { code, message },
    } satisfies ErrorBody,
    { status },
  )

// ─── GET /capabilities ──────────────────────────────────────────────────────

const capabilitiesHandler = Effect.gen(function* () {
  const identity = yield* Identity
  const manifest = yield* Manifest.fromRegistry({
    nodeId: identity.nodeId,
    ...(Option.isSome(identity.nodeUrl)
      ? { nodeUrl: identity.nodeUrl.value }
      : {}),
  })
  const encoded = yield* manifest.encode()
  return HttpServerResponse.jsonUnsafe(encoded)
}).pipe(
  Effect.catch((err) =>
    Effect.succeed(
      errorResponse(500, "PCT_MANIFEST_ENCODE", String(err)),
    ),
  ),
)

// ─── GET /schemas/:schemaId ─────────────────────────────────────────────────

const getSchemaHandler = Effect.gen(function* () {
  const params = yield* HttpRouter.params
  const rawSchemaId = params.schemaId
  if (rawSchemaId === undefined) {
    return errorResponse(
      400,
      "PCT_MISSING_PARAM",
      "schemaId path parameter required",
    )
  }
  const schemaId = decodeURIComponent(rawSchemaId)
  const registry = yield* Registry
  const entry = yield* registry.getSchema(schemaId)
  if (entry === undefined) {
    return errorResponse(
      404,
      "PCT_SCHEMA_NOT_FOUND",
      `no schema registered for id '${schemaId}'`,
    )
  }
  return HttpServerResponse.jsonUnsafe({
    schemaId: entry.schemaId,
    version: entry.version,
    schemaDocument: entry.schemaDocument,
    description: entry.description ?? null,
    registeredAt: entry.registeredAt,
    originNodeId: entry.originNodeId,
    deprecated: entry.deprecated,
  })
})

// ─── POST /publish ──────────────────────────────────────────────────────────

const publishHandler = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  const rawBody = yield* request.json
  const body = yield* decodePublishBody(rawBody)
  const notary = yield* Notary
  const registry = yield* Registry

  // Reconstruct an Effect Schema from the wire schemaDocument.
  const document = Schema.decodeUnknownSync(
    SchemaRepresentation.DocumentFromJson,
  )(body.schemaDocument)
  const schema = SchemaRepresentation.toSchema(document)

  const { schemaId } = yield* notary.registerSchema(
    body.name,
    body.version,
    schema,
    body.description !== undefined ? { description: body.description } : {},
  )
  const revision = yield* registry.revision
  const entry = yield* registry.getSchema(schemaId)

  return HttpServerResponse.jsonUnsafe({
    schemaId,
    registeredAt: entry?.registeredAt ?? 0,
    originNodeId: entry?.originNodeId ?? "",
    revision,
  })
}).pipe(
  Effect.catchTag("SchemaError", (err) =>
    Effect.succeed(
      errorResponse(
        400,
        "PCT_SCHEMA_DECODE",
        "request body failed validation",
        { issues: String(err) },
      ),
    ),
  ),
  Effect.catchTag("EventJournalError", (err) =>
    Effect.succeed(
      errorResponse(500, "PCT_JOURNAL_WRITE", String(err)),
    ),
  ),
  Effect.catch((err) =>
    Effect.succeed(
      errorResponse(500, "PCT_PUBLISH_FAILED", String(err)),
    ),
  ),
)

// ─── POST /publish/procedure ───────────────────────────────────────────────

const publishProcedureHandler = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  const rawBody = yield* request.json
  const body = yield* decodePublishProcedureBody(rawBody)

  const decoded = yield* Effect.result(
    Effect.try({
      try: () => fromDocument(body),
      catch: (cause) => cause,
    }),
  )
  if (decoded._tag === "Failure") {
    return errorResponse(
      400,
      "PCT_PROCEDURE_DECODE",
      "procedure document failed validation",
      { issues: String(decoded.failure) },
    )
  }

  const notary = yield* Notary
  const registry = yield* Registry
  const published = yield* notary.publishProcedure(decoded.success)
  const revision = yield* registry.revision
  const op = yield* registry.getOperation(published.schemaId)

  return HttpServerResponse.jsonUnsafe({
    ...published,
    registeredAt: op?.registeredAt ?? 0,
    originNodeId: op?.originNodeId ?? "",
    revision,
  })
}).pipe(
  Effect.catchTag("SchemaError", (err) =>
    Effect.succeed(
      errorResponse(
        400,
        "PCT_PROCEDURE_DECODE",
        "request body failed validation",
        { issues: String(err) },
      ),
    ),
  ),
  Effect.catchTag("EventJournalError", (err) =>
    Effect.succeed(
      errorResponse(500, "PCT_JOURNAL_WRITE", String(err)),
    ),
  ),
  Effect.catch((err) =>
    Effect.succeed(
      errorResponse(500, "PCT_PUBLISH_PROCEDURE_FAILED", String(err)),
    ),
  ),
)

// ─── POST /publish/group ───────────────────────────────────────────────────

const publishGroupHandler = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  const rawBody = yield* request.json
  const body = yield* decodePublishGroupBody(rawBody)

  const decoded = yield* Effect.result(
    Effect.try({
      try: () => fromGroupDocument(body),
      catch: (cause) => cause,
    }),
  )
  if (decoded._tag === "Failure") {
    return errorResponse(
      400,
      "PCT_PROCEDURE_GROUP_DECODE",
      "procedure group document failed validation",
      { issues: String(decoded.failure) },
    )
  }

  const notary = yield* Notary
  const registry = yield* Registry
  const result = yield* notary.publish(decoded.success)
  const enriched = []
  for (const procedure of result.procedures) {
    const op = yield* registry.getOperation(procedure.schemaId)
    enriched.push({
      ...procedure,
      registeredAt: op?.registeredAt ?? result.publishedAt,
      originNodeId: op?.originNodeId ?? "",
      revision: result.revision,
    })
  }

  return HttpServerResponse.jsonUnsafe({
    name: decoded.success.name,
    ...(decoded.success.version !== undefined
      ? { version: decoded.success.version }
      : {}),
    procedures: enriched,
    publishedAt: result.publishedAt,
    originNodeId: enriched[0]?.originNodeId ?? "",
    revision: result.revision,
  })
}).pipe(
  Effect.catchTag("SchemaError", (err) =>
    Effect.succeed(
      errorResponse(
        400,
        "PCT_PROCEDURE_GROUP_DECODE",
        "request body failed validation",
        { issues: String(err) },
      ),
    ),
  ),
  Effect.catchTag("EventJournalError", (err) =>
    Effect.succeed(
      errorResponse(500, "PCT_JOURNAL_WRITE", String(err)),
    ),
  ),
  Effect.catch((err) =>
    Effect.succeed(
      errorResponse(500, "PCT_PUBLISH_GROUP_FAILED", String(err)),
    ),
  ),
)

// ─── Routes Layer ───────────────────────────────────────────────────────────

/**
 * The PCT routes Layer. Adds the PCT endpoints to whatever
 * `HttpRouter` is in scope.
 *
 * Requires (in addition to HttpRouter): `Notary | Registry | Identity`
 * — Identity for capabilities (manifest's nodeId), Notary for /publish,
 * Registry for /schemas.
 *
 * Compose with `Lnk.Routes` (when ready) on the same router for
 * single-host deployment.
 */
export const Routes = HttpRouter.addAll([
  HttpRouter.route("GET", "/capabilities", capabilitiesHandler),
  HttpRouter.route("GET", "/schemas/:schemaId", getSchemaHandler),
  HttpRouter.route("POST", "/publish", publishHandler),
  HttpRouter.route("POST", "/publish/procedure", publishProcedureHandler),
  HttpRouter.route("POST", "/publish/group", publishGroupHandler),
])
