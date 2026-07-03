/**
 * Flow C live-server convergence.
 *
 * Starts two real `pact serve` processes. Node B is configured only with
 * EventLogRemote federation (Flow C), not manifest/delta Flow B. A publish
 * to node A must converge into B through the mounted Effect-smol RPC route.
 */

import {
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createServer } from "node:net"

import { describe, expect, it } from "vitest"
import * as Schema from "effect/Schema"

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

const submitReading = Procedure.mutation("flowc.submitReading", {
  input: HeartRateInput,
  output: HeartRate,
  errors: [],
  version: "1.0.0",
})

const FlowCGroup = Procedure.makeGroup(
  { name: "flowc", version: "1.0.0" },
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

const waitForOperation = async (
  baseUrl: string,
  running: RunningProcess,
  source?: RunningProcess,
): Promise<unknown> => {
  const started = Date.now()
  let lastBody: unknown = undefined
  while (Date.now() - started < 12_000) {
    const response = await fetch(`${baseUrl}/capabilities`)
    if (response.ok) {
      const body = (await response.json()) as {
        readonly schemas?: ReadonlyArray<{ readonly schemaId: string }>
        readonly operations?: ReadonlyArray<{ readonly name: string }>
      }
      lastBody = body
      if (
        body.schemas?.some((schema) =>
          schema.schemaId === "flowc.submitReading/Input",
        ) === true &&
        body.operations?.some((operation) =>
          operation.name === "flowc.submitReading",
        ) === true
      ) {
        return body
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(
    `Timed out waiting for Flow C operation at ${baseUrl}\nlastBody=${JSON.stringify(lastBody)}\nlogs=\n${running.logs()}\nsourceLogs=\n${source?.logs() ?? "(none)"}`,
  )
}

describe("pact serve — EventLogRemote Flow C", () => {
  it("converges over live Effect-smol EventLogRemote RPC without Flow B", async () => {
    const portA = await freePort()
    const portB = await freePort()
    const baseA = `http://127.0.0.1:${portA}`
    const baseB = `http://127.0.0.1:${portB}`
    const dir = await mkdtemp(join(tmpdir(), "pct-serve-flowc-"))
    const configA = join(dir, "pact-a.config.json")
    const configB = join(dir, "pact-b.config.json")

    await writeFile(
      configA,
      JSON.stringify({
        server: { port: portA, host: "127.0.0.1" },
        client: { baseUrl: baseA },
        node: {},
        federation: {
          enabled: false,
          pollIntervalMs: 60_000,
          peers: [],
          eventLogRemote: {
            enabled: true,
            peers: [],
          },
        },
      }),
    )

    await writeFile(
      configB,
      JSON.stringify({
        server: { port: portB, host: "127.0.0.1" },
        client: { baseUrl: baseB },
        node: {},
        federation: {
          enabled: false,
          pollIntervalMs: 60_000,
          peers: [],
          eventLogRemote: {
            enabled: true,
            peers: [baseA],
          },
        },
      }),
    )

    const nodeA = spawnPact(["serve", "--config", configA])
    let nodeB: RunningProcess | undefined

    try {
      await waitForCapabilities(baseA, nodeA)
      nodeB = spawnPact(["serve", "--config", configB])
      await waitForCapabilities(baseB, nodeB)

      const publish = await fetch(`${baseA}/publish/group`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Procedure.toGroupDocument(FlowCGroup)),
      })
      expect(publish.status).toBe(200)

      const body = (await waitForOperation(baseB, nodeB, nodeA)) as {
        readonly revision: number
        readonly schemas: ReadonlyArray<{ readonly schemaId: string }>
        readonly operations: ReadonlyArray<{ readonly name: string }>
      }
      expect(body.revision).toBeGreaterThanOrEqual(3)
      expect(body.schemas).toHaveLength(2)
      expect(body.operations).toHaveLength(1)
      expect(body.operations[0].name).toBe("flowc.submitReading")
      expect(nodeB.logs()).toContain("Fed  disabled")
      expect(nodeB.logs()).toContain("FlowC enabled (1 peers)")
    } finally {
      await stop(nodeA)
      if (nodeB !== undefined) await stop(nodeB)
      await rm(dir, { recursive: true, force: true })
    }
  }, 30_000)
})
