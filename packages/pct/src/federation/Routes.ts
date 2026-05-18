/**
 * Federation admin HTTP routes.
 *
 * These routes expose Flow B peer management for a live `pact serve`
 * process. They require the `Federation` service, so embedders can omit
 * this layer entirely when federation is disabled.
 *
 * @module @tmnl/pct/federation/Routes
 */

import * as Effect from "effect-v4/Effect"
import * as Schema from "effect-v4/Schema"
import * as HttpRouter from "effect-v4/unstable/http/HttpRouter"
import * as HttpServerRequest from "effect-v4/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect-v4/unstable/http/HttpServerResponse"

import { type PactClientError } from "../client/PactClient.js"
import { ErrorBody } from "../server/wire.js"
import { Federation } from "./Federation.js"
import {
  FederationPeerRequest,
  FederationSyncRequest,
  FederationUnpeerRequest,
} from "./wire.js"

// ─── Helpers ────────────────────────────────────────────────────────────────

const errorResponse = (
  status: number,
  code: string,
  message: string,
  details?: unknown,
) =>
  HttpServerResponse.jsonUnsafe(
    {
      error:
        details !== undefined
          ? { code, message, detail: details }
          : { code, message },
    } satisfies ErrorBody,
    { status },
  )

const decodePeerRequest = Schema.decodeUnknownEffect(FederationPeerRequest)
const decodeUnpeerRequest = Schema.decodeUnknownEffect(FederationUnpeerRequest)
const decodeSyncRequest = Schema.decodeUnknownEffect(FederationSyncRequest)

const readJson = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  return yield* request.json
})

const peerNotFoundStatus = (url: string) => ({
  url,
  lastPolledMs: 0,
  lastObservedRevision: 0,
  lastObservedNodeId: undefined,
  errorCount: 0,
})

const handleSchemaError = (err: unknown) =>
  Effect.succeed(
    errorResponse(400, "PCT_FEDERATION_DECODE", "request body failed validation", {
      issues: String(err),
    }),
  )

const handlePactClientError = (err: PactClientError) =>
  Effect.succeed(
    errorResponse(err.status === 404 ? 404 : 502, err.code, err.message),
  )

// ─── GET /federation/peers ─────────────────────────────────────────────────

const peersHandler = Effect.gen(function* () {
  const federation = yield* Federation
  const peers = yield* federation.peers
  return HttpServerResponse.jsonUnsafe({ peers })
})

// ─── POST /federation/peer ─────────────────────────────────────────────────

const peerHandler = Effect.gen(function* () {
  const rawBody = yield* readJson
  const body = yield* decodePeerRequest(rawBody)
  const federation = yield* Federation
  yield* federation.peer(body.url)
  const peers = yield* federation.peers
  return HttpServerResponse.jsonUnsafe({
    peer: peers.find((peer) => peer.url === body.url) ?? peerNotFoundStatus(body.url),
    peers,
  })
}).pipe(Effect.catchTag("SchemaError", handleSchemaError))

// ─── DELETE /federation/peer ───────────────────────────────────────────────

const unpeerHandler = Effect.gen(function* () {
  const rawBody = yield* readJson
  const body = yield* decodeUnpeerRequest(rawBody)
  const federation = yield* Federation
  yield* federation.unpeer(body.url)
  const peers = yield* federation.peers
  return HttpServerResponse.jsonUnsafe({ url: body.url, peers })
}).pipe(Effect.catchTag("SchemaError", handleSchemaError))

// ─── POST /federation/sync ─────────────────────────────────────────────────

const syncHandler = Effect.gen(function* () {
  const rawBody = yield* readJson
  const body = yield* decodeSyncRequest(rawBody)
  const federation = yield* Federation
  const result = yield* federation.syncNow(body.url)
  const peers = yield* federation.peers
  return HttpServerResponse.jsonUnsafe({
    url: body.url,
    peerNodeId: result.peerNodeId,
    peerRevision: result.peerRevision,
    writes: result.writes,
    peers,
  })
}).pipe(
  Effect.catchTag("SchemaError", handleSchemaError),
  Effect.catchTag("PactClientError", handlePactClientError),
)

// ─── Routes Layer ───────────────────────────────────────────────────────────

export const Routes = HttpRouter.addAll([
  HttpRouter.route("GET", "/federation/peers", peersHandler),
  HttpRouter.route("POST", "/federation/peer", peerHandler),
  HttpRouter.route("DELETE", "/federation/peer", unpeerHandler),
  HttpRouter.route("POST", "/federation/sync", syncHandler),
])
