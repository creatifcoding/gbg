/**
 * Flow C server adapter smoke.
 *
 * This verifies the PCT EventLogRemote server handler layer can serve
 * native Effect-smol EventLogRemote changes for the local registry
 * journal via an in-process RpcTest client.
 */

import { describe, expect, it } from "vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Queue from "effect/Queue"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"
import * as EventLog from "effect/unstable/eventlog/EventLog"
import * as EventLogMessage from "effect/unstable/eventlog/EventLogMessage"
import {
  encodeSessionAuthPayload,
  signSessionAuthPayloadBytes,
} from "effect/unstable/eventlog/EventLogSessionAuth"
import { makeGetIdentityRootSecretMaterial } from "effect/unstable/eventlog/internal/identityRootSecretDerivation"
import * as RpcTest from "effect/unstable/rpc/RpcTest"

import * as EventLogRemoteServer from "../src/federation/eventlog-remote/index.js"
import * as IdentityLayers from "../src/identity/Layers.js"
import * as NotaryDefault from "../src/notary/Default.js"
import { Notary } from "../src/notary/Notary.js"
import * as RegistryMemory from "../src/registry/Memory.js"

const Order = Schema.Struct({
  orderId: Schema.String,
  total: Schema.Number,
})

const AppLayer = Layer.mergeAll(
  NotaryDefault.Default,
  EventLogRemoteServer.layerRpcHandlers(),
).pipe(
  Layer.provideMerge(RegistryMemory.layer),
  Layer.provideMerge(IdentityLayers.layerEphemeral),
  Layer.provideMerge(EventJournal.layerMemory),
)

const getIdentityRootSecretMaterial = makeGetIdentityRootSecretMaterial(globalThis.crypto)

const authenticate = Effect.fnUntraced(function* (options: {
  readonly client: any
  readonly identity: EventLog.Identity["Service"]
}) {
  const hello = yield* options.client["EventLog.Hello"]()
  const rootSecretMaterial = yield* getIdentityRootSecretMaterial(options.identity)
  const payload = yield* encodeSessionAuthPayload({
    remoteId: hello.remoteId,
    challenge: hello.challenge,
    publicKey: options.identity.publicKey,
    signingPublicKey: rootSecretMaterial.signingPublicKey,
  })
  const signature = yield* signSessionAuthPayloadBytes({
    payload,
    signingPrivateKey: Redacted.value(rootSecretMaterial.signingPrivateKey),
  })
  yield* options.client["EventLog.Authenticate"](
    new EventLogMessage.Authenticate({
      publicKey: options.identity.publicKey,
      signingPublicKey: rootSecretMaterial.signingPublicKey,
      signature,
      algorithm: "Ed25519",
    }),
  )
})

describe("Flow C EventLogRemote server adapter", () => {
  it("serves local registry journal entries through EventLogRemote RPC handlers", async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const notary = yield* Notary
          yield* notary.registerSchema("orders/Order", "1.0.0", Order)

          const client = yield* RpcTest.makeClient(
            EventLogMessage.EventLogRemoteRpcs,
          )
          const identity = yield* EventLog.Identity
          yield* authenticate({ client, identity })
          const changes = yield* client["EventLog.Changes"](
            {
              publicKey: identity.publicKey,
              storeId: EventLogRemoteServer.PctRegistryStoreId,
              startSequence: 0,
            },
            { asQueue: true },
          )
          const messages = yield* Queue.takeAll(changes)
          const remoteEntries = []
          for (const message of messages) {
            if (message._tag !== "Single") continue
            remoteEntries.push(
              ...(yield* EventLogMessage.ChangesRpc.decodeUnencrypted(
                message.data,
              )),
            )
          }
          return remoteEntries
        }),
      ).pipe(Effect.provide(AppLayer)),
    )

    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].remoteSequence).toBe(1)
    expect(result[0].entry.event).toBe("SchemaRegistered")
    expect(result[0].entry.primaryKey).toBe("schema:orders/Order@1.0.0")
  })
})
