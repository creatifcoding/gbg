/**
 * Flow B+ delta HTTP route.
 *
 * `GET /federation/delta/:fromRevision` exposes PCT-native registry
 * deltas. It depends on Registry + Identity only, not the Federation
 * poller, so every `pact serve` node can be a delta source even if it
 * is not itself actively peering with anyone.
 *
 * @module @tmnl/pct/federation/DeltaRoutes
 */

import * as Effect from "effect-v4/Effect"
import * as Option from "effect-v4/Option"
import * as HttpRouter from "effect-v4/unstable/http/HttpRouter"
import * as HttpServerResponse from "effect-v4/unstable/http/HttpServerResponse"

import { Identity } from "../identity/Identity.js"
import * as RegistryDelta from "../registry/RegistryDelta.js"
import { Registry } from "../registry/Registry.js"
import { asOfIso } from "../registry/RegistryState.js"
import { type ErrorBody } from "../server/wire.js"

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

const parseRevision = (raw: string | undefined): number | undefined => {
  if (raw === undefined) return undefined
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 0) return undefined
  return parsed
}

const deltaHandler = Effect.gen(function* () {
  const params = yield* HttpRouter.params
  const fromRevision = parseRevision(params.fromRevision)
  if (fromRevision === undefined) {
    return errorResponse(
      400,
      "PCT_DELTA_BAD_REVISION",
      "fromRevision path parameter must be a non-negative integer",
    )
  }

  const identity = yield* Identity
  const registry = yield* Registry
  const state = yield* registry.snapshot
  const changes = yield* registry.deltaSince(fromRevision)
  const delta = RegistryDelta.fromChanges({
    nodeId: identity.nodeId,
    ...(Option.isSome(identity.nodeUrl)
      ? { nodeUrl: identity.nodeUrl.value }
      : {}),
    fromRevision,
    toRevision: state.revision,
    asOf: asOfIso(state),
    complete: true,
    changes,
  })
  const encoded = yield* RegistryDelta.encode(delta)
  return HttpServerResponse.jsonUnsafe(encoded)
}).pipe(
  Effect.catch((err) =>
    Effect.succeed(errorResponse(500, "PCT_DELTA_FAILED", String(err))),
  ),
)

export const DeltaRoutes = HttpRouter.addAll([
  HttpRouter.route("GET", "/federation/delta/:fromRevision", deltaHandler),
])
