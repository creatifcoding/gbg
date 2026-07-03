/**
 * Serve-level federation smoke.
 *
 * Starts two real `pact serve` processes on localhost. Node B is
 * configured with Flow B federation enabled and node A as an initial
 * peer. Publishing a ProcedureGroup to A must converge into B's live
 * `/capabilities` surface without invoking Federation directly.
 */

import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams,
} from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createServer } from "node:net"

import { describe, expect, it } from "vitest"
import * as Schema from "effect/Schema"
import * as SchemaRepresentation from "effect/SchemaRepresentation"

import * as Procedure from "../src/procedures/index.js"

const HeartRateInput = Schema.Struct({
  bpm: Schema.Number,
  deviceId: Schema.String,
})

const HeartRate = Schema.Struct({
  bpm: Schema.Number,
  observedAt: Schema.String,
  deviceId: Schema.String,
})

const ExtraReading = Schema.Struct({
  value: Schema.Number,
})

const extraReadingDocument = Schema.encodeUnknownSync(
  SchemaRepresentation.DocumentFromJson,
)(SchemaRepresentation.fromAST(ExtraReading.ast))

const submitReading = Procedure.mutation("vitals.submitReading", {
  input: HeartRateInput,
  output: HeartRate,
  errors: [],
  version: "1.0.0",
})

const Vitals = Procedure.makeGroup(
  { name: "vitals", version: "1.0.0" },
  submitReading,
)

interface RunningProcess {
  readonly child: ChildProcessWithoutNullStreams
  readonly logs: () => string
}

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (typeof address !== "object" || address === null) {
        server.close(() => reject(new Error("freePort: non-TCP address")))
        return
      }
      const port = address.port
      server.close(() => resolve(port))
    })
  })

const spawnPact = (args: ReadonlyArray<string>): RunningProcess => {
  const child = spawn("bun", ["bin/pact.ts", ...args], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  })
  let output = ""
  child.stdout.on("data", (chunk) => {
    output += String(chunk)
  })
  child.stderr.on("data", (chunk) => {
    output += String(chunk)
  })
  return { child, logs: () => output }
}

const runPact = (args: ReadonlyArray<string>): string => {
  const result = spawnSync("bun", ["bin/pact.ts", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 10_000,
  })
  if (result.status !== 0) {
    throw new Error(
      `pact ${args.join(" ")} failed (${result.status}):\n${result.stdout}\n${result.stderr}`,
    )
  }
  return `${result.stdout}${result.stderr}`
}

const stop = async (running: RunningProcess): Promise<void> => {
  if (running.child.exitCode !== null || running.child.signalCode !== null) return
  running.child.kill("SIGTERM")
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (running.child.exitCode === null) running.child.kill("SIGKILL")
      resolve()
    }, 2_000)
    running.child.once("exit", () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

const waitForCapabilities = async (
  baseUrl: string,
  running: RunningProcess,
): Promise<void> => {
  const started = Date.now()
  while (Date.now() - started < 10_000) {
    if (running.child.exitCode !== null) {
      throw new Error(`pact serve exited early:\n${running.logs()}`)
    }
    try {
      const response = await fetch(`${baseUrl}/capabilities`)
      if (response.ok) return
    } catch {
      // Not bound yet; keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${baseUrl}:\n${running.logs()}`)
}

const waitForOperation = async (baseUrl: string): Promise<unknown> => {
  const started = Date.now()
  while (Date.now() - started < 10_000) {
    const response = await fetch(`${baseUrl}/capabilities`)
    if (response.ok) {
      const body = (await response.json()) as {
        readonly schemas?: ReadonlyArray<{ readonly schemaId: string }>
        readonly operations?: ReadonlyArray<{ readonly name: string }>
      }
      if (
        body.schemas?.some((schema) =>
          schema.schemaId === "vitals.submitReading/Input",
        ) === true &&
        body.operations?.some((operation) =>
          operation.name === "vitals.submitReading",
        ) === true
      ) {
        return body
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for federated operation at ${baseUrl}`)
}

describe("pact serve — federation Flow B", () => {
  it("configured peers converge through live HTTP servers", async () => {
    const portA = await freePort()
    const portB = await freePort()
    const baseA = `http://127.0.0.1:${portA}`
    const baseB = `http://127.0.0.1:${portB}`
    const dir = await mkdtemp(join(tmpdir(), "pct-serve-fed-"))
    const configB = join(dir, "pact.config.json")

    await writeFile(
      configB,
      JSON.stringify({
        server: { port: portB, host: "127.0.0.1" },
        client: { baseUrl: baseB },
        node: {},
        federation: {
          enabled: true,
          pollIntervalMs: 100,
          peers: [baseA],
        },
      }),
    )

    const nodeA = spawnPact(["serve", "--host", "127.0.0.1", "--port", String(portA)])
    const nodeB = spawnPact(["serve", "--config", configB])

    try {
      await waitForCapabilities(baseA, nodeA)
      await waitForCapabilities(baseB, nodeB)

      const publish = await fetch(`${baseA}/publish/group`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Procedure.toGroupDocument(Vitals)),
      })
      expect(publish.status).toBe(200)

      const body = (await waitForOperation(baseB)) as {
        readonly revision: number
        readonly schemas: ReadonlyArray<{ readonly schemaId: string }>
        readonly operations: ReadonlyArray<{ readonly name: string }>
      }
      expect(body.revision).toBeGreaterThanOrEqual(3)
      expect(body.schemas).toHaveLength(2)
      expect(body.operations).toHaveLength(1)
      expect(body.operations[0].name).toBe("vitals.submitReading")
      expect(nodeB.logs()).toContain("Fed  enabled")
    } finally {
      await stop(nodeA)
      await stop(nodeB)
      await rm(dir, { recursive: true, force: true })
    }
  }, 30_000)

  it("federation admin CLI manages peers and triggers sync", async () => {
    const portA = await freePort()
    const portB = await freePort()
    const baseA = `http://127.0.0.1:${portA}`
    const baseB = `http://127.0.0.1:${portB}`
    const dir = await mkdtemp(join(tmpdir(), "pct-serve-fed-admin-"))
    const configB = join(dir, "pact.config.json")

    await writeFile(
      configB,
      JSON.stringify({
        server: { port: portB, host: "127.0.0.1" },
        client: { baseUrl: baseB },
        node: {},
        federation: {
          enabled: true,
          pollIntervalMs: 60_000,
          peers: [],
        },
      }),
    )

    const nodeA = spawnPact(["serve", "--host", "127.0.0.1", "--port", String(portA)])
    const nodeB = spawnPact(["serve", "--config", configB])

    try {
      await waitForCapabilities(baseA, nodeA)
      await waitForCapabilities(baseB, nodeB)

      expect(runPact(["federation", "peers", "--url", baseB])).toContain("(none)")
      expect(runPact(["federation", "peer", baseA, "--url", baseB])).toContain(baseA)

      const publish = await fetch(`${baseA}/publish/group`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Procedure.toGroupDocument(Vitals)),
      })
      expect(publish.status).toBe(200)

      const syncOut = runPact(["federation", "sync", baseA, "--url", baseB])
      expect(syncOut).toContain("Synced")
      expect(syncOut).toContain("writes=")

      const body = (await waitForOperation(baseB)) as {
        readonly operations: ReadonlyArray<{ readonly name: string }>
      }
      expect(body.operations[0].name).toBe("vitals.submitReading")

      const secondPublish = await fetch(`${baseA}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "vitals/ExtraReading",
          version: "1.0.0",
          schemaDocument: extraReadingDocument,
        }),
      })
      expect(secondPublish.status).toBe(200)

      const deltaSyncOut = runPact(["federation", "sync", baseA, "--url", baseB])
      expect(deltaSyncOut).toContain("writes=1")

      const unpeerOut = runPact(["federation", "unpeer", baseA, "--url", baseB])
      expect(unpeerOut).toContain("Removed federation peer")
      expect(runPact(["federation", "status", "--url", baseB])).toContain("(none)")
    } finally {
      await stop(nodeA)
      await stop(nodeB)
      await rm(dir, { recursive: true, force: true })
    }
  }, 30_000)
})
