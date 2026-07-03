import { spawn, type ChildProcess } from "node:child_process"
import { existsSync, readdirSync } from "node:fs"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import net from "node:net"
import * as Effect from "effect/Effect"

export type SoakNatsSubstrateMode = "external" | "managed-local"

export interface SoakNatsSubstrateConfig {
  readonly mode: SoakNatsSubstrateMode
  readonly servers?: string
  readonly monitorUrl?: string
  readonly natsServerBin?: string
  readonly startupTimeoutMs?: number
  readonly extraConfig?: string
}

export interface SoakNatsSubstrate {
  readonly mode: SoakNatsSubstrateMode
  readonly servers: string
  readonly monitorUrl: string
  readonly configPath: string
  readonly storeDir: string
  readonly stop: Effect.Effect<void, never>
}

export class SoakNatsSubstrateError extends Error {
  readonly _tag = "SoakNatsSubstrateError"
  constructor(message: string, readonly cause?: unknown) {
    super(message)
  }
}

export const resolveSoakNatsSubstrateConfig = (
  env: Record<string, string | undefined> = process.env,
): SoakNatsSubstrateConfig => {
  const externalUrl = env.PCT_SOAK_NATS_URL ?? env.LNK_LIVE_NATS_URL ?? env.MSH_LIVE_NATS_URL
  if (externalUrl !== undefined && externalUrl !== "") {
    const startupTimeoutMs = parsePositiveInt(env.PCT_SOAK_NATS_STARTUP_TIMEOUT_MS)
    return {
      mode: "external",
      servers: externalUrl,
      monitorUrl: env.PCT_SOAK_NATS_MONITOR_URL ?? env.LNK_LIVE_NATS_MONITOR_URL ?? env.MSH_LIVE_NATS_MONITOR_URL ?? "",
      ...(startupTimeoutMs === undefined ? {} : { startupTimeoutMs }),
    }
  }

  const startupTimeoutMs = parsePositiveInt(env.PCT_SOAK_NATS_STARTUP_TIMEOUT_MS)
  return {
    mode: "managed-local",
    ...(env.NATS_SERVER_BIN === undefined || env.NATS_SERVER_BIN === "" ? {} : { natsServerBin: env.NATS_SERVER_BIN }),
    ...(startupTimeoutMs === undefined ? {} : { startupTimeoutMs }),
  }
}

const parsePositiveInt = (value: string | undefined): number | undefined => {
  if (value === undefined || value === "") return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

const findOpenPort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (typeof address === "object" && address) {
        const port = address.port
        server.close(() => resolve(port))
      } else {
        server.close(() => reject(new Error("failed to allocate port")))
      }
    })
  })

const findExecutableOnPath = (name: string): string | null => {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (dir === "") continue
    const candidate = path.join(dir, name)
    if (existsSync(candidate)) return candidate
  }
  return null
}

const findNixStoreNatsServer = (): string | null => {
  try {
    for (const entry of readdirSync("/nix/store")) {
      if (!entry.includes("-nats-server-")) continue
      const candidate = path.join("/nix/store", entry, "bin", "nats-server")
      if (existsSync(candidate)) return candidate
    }
  } catch {
    // Non-Nix hosts simply skip the fallback.
  }
  return null
}

export const resolveNatsServerBin = (configured?: string): Effect.Effect<string, SoakNatsSubstrateError> => {
  if (configured !== undefined && configured !== "") return Effect.succeed(configured)
  const candidate = findExecutableOnPath("nats-server") ?? findNixStoreNatsServer()
  if (candidate !== null) return Effect.succeed(candidate)
  return Effect.fail(new SoakNatsSubstrateError(
    "Soak NATS local mode requires nats-server on PATH or NATS_SERVER_BIN=/absolute/path/to/nats-server",
  ))
}

const waitForHealth = async (
  url: string,
  proc: ChildProcess,
  timeoutMs: number,
): Promise<void> => {
  const started = Date.now()
  let lastError: unknown
  while (Date.now() - started < timeoutMs) {
    if (proc.exitCode !== null) {
      throw new Error(`nats-server exited before health check succeeded (exit=${proc.exitCode})`)
    }
    try {
      const response = await fetch(url)
      if (response.ok) return
      lastError = new Error(`health returned ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`nats-server health check timed out: ${String(lastError)}`)
}

const stopProcess = (proc: ChildProcess): Effect.Effect<void, never> =>
  Effect.promise(async () => {
    if (proc.exitCode !== null) return
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (proc.exitCode === null) proc.kill("SIGKILL")
      }, 2_000)
      proc.once("exit", () => {
        clearTimeout(timer)
        resolve()
      })
      proc.kill("SIGTERM")
    })
  }).pipe(Effect.ignore)

export const startSoakNatsSubstrate = (
  input: SoakNatsSubstrateConfig = resolveSoakNatsSubstrateConfig(),
): Effect.Effect<SoakNatsSubstrate, SoakNatsSubstrateError> => {
  if (input.mode === "external") {
    if (input.servers === undefined || input.servers === "") {
      return Effect.fail(new SoakNatsSubstrateError("external NATS substrate requires servers"))
    }
    return Effect.succeed({
      mode: "external",
      servers: input.servers,
      monitorUrl: input.monitorUrl ?? "",
      configPath: "<external>",
      storeDir: "<external>",
      stop: Effect.void,
    })
  }

  return Effect.gen(function* () {
    const bin = yield* resolveNatsServerBin(input.natsServerBin)
    const [client, monitor, websocket] = yield* Effect.tryPromise({
      try: () => Promise.all([findOpenPort(), findOpenPort(), findOpenPort()]),
      catch: (cause) => new SoakNatsSubstrateError("failed to allocate NATS ports", cause),
    })

    const root = yield* Effect.tryPromise({
      try: () => mkdtemp(path.join(tmpdir(), "tmnl-pct-soak-nats-")),
      catch: (cause) => new SoakNatsSubstrateError("failed to create NATS temp dir", cause),
    })
    const storeDir = path.join(root, "jetstream")
    const configPath = path.join(root, "nats-server.conf")
    const serverName = `pct-soak-${process.pid}-${Date.now()}`
    const config = `
server_name: ${serverName}
port: ${client}
http: 127.0.0.1:${monitor}

jetstream {
  store_dir: "${storeDir}"
}

websocket {
  host: 127.0.0.1
  port: ${websocket}
  no_tls: true
  same_origin: false
  compression: false
}

${input.extraConfig ?? ""}
`

    yield* Effect.tryPromise({
      try: () => writeFile(configPath, config),
      catch: (cause) => new SoakNatsSubstrateError("failed to write NATS config", cause),
    })

    const proc = spawn(bin, ["-c", configPath], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    })

    let stderr = ""
    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })

    const cleanup: Effect.Effect<void, never> = Effect.gen(function* () {
      yield* stopProcess(proc)
      yield* Effect.promise(() => rm(root, { recursive: true, force: true })).pipe(Effect.ignore)
    })

    yield* Effect.tryPromise({
      try: () => waitForHealth(`http://127.0.0.1:${monitor}/healthz`, proc, input.startupTimeoutMs ?? 5_000),
      catch: (cause) => new SoakNatsSubstrateError(`nats-server health check failed: ${String(cause)}\n${stderr}`, cause),
    }).pipe(Effect.catch((error: SoakNatsSubstrateError) => Effect.andThen(cleanup, Effect.fail(error))))

    return {
      mode: "managed-local" as const,
      servers: `ws://127.0.0.1:${websocket}`,
      monitorUrl: `http://127.0.0.1:${monitor}`,
      configPath,
      storeDir,
      stop: cleanup,
    }
  })
}
