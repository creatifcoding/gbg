/**
 * EventLogRemote HTTP client helpers for PCT Flow C.
 */

import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as EventLogRemote from "effect-v4/unstable/eventlog/EventLogRemote"
import * as EventLogMessage from "effect-v4/unstable/eventlog/EventLogMessage"
import * as FetchHttpClient from "effect-v4/unstable/http/FetchHttpClient"
import * as RpcClient from "effect-v4/unstable/rpc/RpcClient"
import * as RpcSerialization from "effect-v4/unstable/rpc/RpcSerialization"

import { DEFAULT_RPC_PATH } from "./Server.js"

export interface HttpClientOptions {
  readonly baseUrl: string
  readonly path?: string
}

const endpoint = (options: HttpClientOptions): string => {
  const trimmed = options.baseUrl.endsWith("/")
    ? options.baseUrl.slice(0, -1)
    : options.baseUrl
  return `${trimmed}${options.path ?? DEFAULT_RPC_PATH}`
}

export const layerRemoteClientHttp = (
  options: HttpClientOptions,
): Layer.Layer<EventLogRemote.EventLogRemoteClient> =>
  EventLogRemote.EventLogRemoteClient.layer.pipe(
    Layer.provide(
      RpcClient.layerProtocolHttp({ url: endpoint(options) }).pipe(
        Layer.provideMerge(FetchHttpClient.layer),
        Layer.provideMerge(RpcSerialization.layerMsgPack),
      ),
    ),
  )

export const makeRemoteHttp = (options: HttpClientOptions) =>
  Effect.gen(function* () {
    const scope = yield* Effect.scope
    const context = yield* Layer.buildWithScope(
      layerRemoteClientHttp(options),
      scope,
    )
    return yield* EventLogRemote.makeUnencrypted.pipe(Effect.provide(context))
  })

export type EventLogRemoteRpcs = typeof EventLogMessage.EventLogRemoteRpcs
