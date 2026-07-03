/**
 * Identity layer tests.
 */

import { describe, expect, it } from "vitest"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as EventLog from "effect/unstable/eventlog/EventLog"

import { Identity } from "../src/identity/Identity.js"
import * as IdentityLayers from "../src/identity/Layers.js"

const inMemoryFs = (
  files: Map<string, string>,
  dirs: Set<string> = new Set(),
): Layer.Layer<FileSystem.FileSystem> => {
  const fs = FileSystem.makeNoop({
    exists: (path) => Effect.succeed(files.has(path) || dirs.has(path)),
    readFileString: (path) => {
      const contents = files.get(path)
      return contents === undefined
        ? Effect.fail(new Error(`ENOENT: ${path}`) as never)
        : Effect.succeed(contents)
    },
    makeDirectory: (path) =>
      Effect.sync(() => {
        dirs.add(path)
      }),
    writeFileString: (path, contents) =>
      Effect.sync(() => {
        files.set(path, contents)
      }),
  })
  return Layer.succeed(FileSystem.FileSystem)(fs)
}

const PlatformLayer = (files: Map<string, string>) =>
  Layer.merge(inMemoryFs(files), Path.layer)

describe("Identity.layerPersistent", () => {
  it("creates then reuses a stable EventLog identity file", async () => {
    const files = new Map<string, string>()
    const filePath = "/tmp/pct/node.identity"

    const load = Effect.gen(function* () {
      const pactIdentity = yield* Identity
      const eventLogIdentity = yield* EventLog.Identity
      return {
        nodeId: pactIdentity.nodeId,
        publicKey: eventLogIdentity.publicKey,
        encoded: EventLog.encodeIdentityString(eventLogIdentity),
      }
    }).pipe(
      Effect.provide(IdentityLayers.layerPersistent({ filePath })),
      Effect.provide(PlatformLayer(files)),
    )

    const first = await Effect.runPromise(load)
    const second = await Effect.runPromise(load)

    expect(files.get(filePath)).toBe(`${first.encoded}\n`)
    expect(second.nodeId).toBe(first.nodeId)
    expect(second.publicKey).toBe(first.publicKey)
  })
})
