/**
 * `pact serve` — boot the PCT HTTP server.
 *
 * Reads PactConfig (server.port + server.host) and binds an HTTP
 * server that serves the `Server.Routes` layer alongside any other
 * routes you've composed onto the same HttpRouter.
 *
 * # Runtime detection
 *
 * - On Bun: uses `Bun.serve()` directly (native, fast)
 * - On Node: falls back to `node:http` createServer
 *
 * Both accept the `HttpRouter.toWebHandler` output (a function from
 * `globalThis.Request` → `Promise<Response>`).
 *
 * # Layer composition
 *
 * The serve command provides the full PCT stack:
 *
 *   PactConfig          ← Sources.stack (env + files + defaults)
 *   Identity (ephemeral) ← layerEphemeral
 *   Registry             ← layerMemory composition
 *   Notary               ← Default
 *   Routes               ← addAll([/capabilities, /schemas/:id, /publish])
 *
 * Future: add `--persistent` flag once SQL EventJournal layer lands.
 *
 * @module @tmnl/pct/cli/serve
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { Readable } from "node:stream"

import * as Console from "effect-v4/Console"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Option from "effect-v4/Option"
import { Command, Flag } from "effect-v4/unstable/cli"
import * as EventJournal from "effect-v4/unstable/eventlog/EventJournal"
import * as HttpRouter from "effect-v4/unstable/http/HttpRouter"

import { Services as LnkServices } from "@tmnl/lnk"

import * as Config from "../config/index.js"
import * as IdentityLayers from "../identity/Layers.js"
import * as NotaryDefault from "../notary/Default.js"
import * as RegistryMemory from "../registry/Memory.js"
import { Routes as PactRoutes } from "../server/Routes.js"

// ─── Server runtime detection ───────────────────────────────────────────────

interface BunRuntime {
  serve(options: {
    port: number
    hostname: string
    fetch: (request: Request) => Response | Promise<Response>
  }): { stop: () => void; port: number; hostname: string }
}

const maybeBun = (): BunRuntime | undefined => {
  const g = globalThis as unknown as { Bun?: BunRuntime }
  return g.Bun
}

/**
 * Bind the handler to a TCP port. Returns a teardown function.
 * Uses Bun.serve when available, else falls back to node:http.
 *
 * The handler signature accepts an optional Context arg; we ignore
 * the second slot since toWebHandler's emitted handler accepts being
 * called with just `(request)`.
 */
const bindServer = (
  handler: (request: Request, ctx?: never) => Promise<Response>,
  options: { port: number; host: string },
): Effect.Effect<{ readonly close: () => void; readonly url: string }> =>
  Effect.sync(() => {
    const bun = maybeBun()
    if (bun !== undefined) {
      const server = bun.serve({
        port: options.port,
        hostname: options.host,
        fetch: (req) => handler(req),
      })
      return {
        close: () => server.stop(),
        url: `http://${server.hostname}:${server.port}`,
      }
    }

    // node:http fallback: convert IncomingMessage → Request, write Response back.
    const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
        const headers = new Headers()
        for (const [k, v] of Object.entries(req.headers)) {
          if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv))
          else if (v !== undefined) headers.set(k, v)
        }
        const init: RequestInit = { method: req.method ?? "GET", headers }
        if (req.method !== "GET" && req.method !== "HEAD") {
          const chunks: Array<Uint8Array> = []
          for await (const chunk of req) chunks.push(chunk as Uint8Array)
          init.body = Buffer.concat(chunks)
        }
        const request = new Request(url.toString(), init)
        const response = await handler(request)
        res.statusCode = response.status
        response.headers.forEach((v, k) => res.setHeader(k, v))
        if (response.body) {
          Readable.fromWeb(response.body as never).pipe(res)
        } else {
          res.end()
        }
      } catch (err) {
        res.statusCode = 500
        res.end(String(err))
      }
    })
    httpServer.listen(options.port, options.host)
    return {
      close: () => httpServer.close(),
      url: `http://${options.host}:${options.port}`,
    }
  })

// ─── pact serve ─────────────────────────────────────────────────────────────

const configFileFlag = Flag.string("config").pipe(
  Flag.withDescription(
    "Path to a pact.config.json (overrides project/user/system files)",
  ),
  Flag.optional,
)

const portOverrideFlag = Flag.integer("port").pipe(
  Flag.withDescription("Override server.port from config"),
  Flag.optional,
)

const hostOverrideFlag = Flag.string("host").pipe(
  Flag.withDescription("Override server.host from config"),
  Flag.optional,
)

export const serveCommand = Command.make(
  "serve",
  {
    config: configFileFlag,
    port: portOverrideFlag,
    host: hostOverrideFlag,
  },
  ({ config: configFile, port: portOverride, host: hostOverride }) =>
    Effect.gen(function* () {
      // Resolve config (with optional --config / --port / --host overrides)
      const config = yield* Config.PactConfig
      const port = Option.isSome(portOverride)
        ? portOverride.value
        : config.server.port
      const host = Option.isSome(hostOverride)
        ? hostOverride.value
        : config.server.host

      // Build the full app layer:
      //   PactRoutes        → /capabilities, /schemas/:id, /publish
      //   LnkServices.Wire.Http.Routes → /streams/:streamId (PUT, POST, GET)
      // Both compose onto the single HttpRouter that toWebHandler
      // builds, demonstrating the architectural commitment from PCT.md
      // §6: "lnk + pct served on one HTTP host."
      const AppLayer = Layer.mergeAll(
        PactRoutes,
        LnkServices.Wire.Http.Routes,
      ).pipe(
        Layer.provideMerge(NotaryDefault.Default),
        Layer.provideMerge(RegistryMemory.layer),
        Layer.provideMerge(IdentityLayers.layerEphemeral),
        Layer.provideMerge(LnkServices.Wire.InMemory.InMemoryWire.layer),
        Layer.provideMerge(EventJournal.layerMemory),
      )

      const { handler, dispose } = HttpRouter.toWebHandler(AppLayer)

      const server = yield* bindServer(handler, { port, host })

      yield* Console.log(``)
      yield* Console.log(`  PCT + Lnk server running.`)
      yield* Console.log(`  ┃ ${server.url}`)
      yield* Console.log(`  ┃`)
      yield* Console.log(`  ┃ PCT  /capabilities, /schemas/:id, /publish`)
      yield* Console.log(`  ┃ Lnk  /streams/:streamId  (PUT POST GET)`)
      yield* Console.log(``)

      // Wait for SIGINT / SIGTERM to shut down cleanly.
      yield* Effect.callback<void>((_resume) => {
        const shutdown = () => {
          server.close()
          dispose().catch(() => {})
          _resume(Effect.void)
        }
        process.on("SIGINT", shutdown)
        process.on("SIGTERM", shutdown)
      })
    }).pipe(Effect.provide(configLayer(configFile))),
).pipe(
  Command.withDescription(
    "Start the PCT HTTP server (binds to config.server.host:port)",
  ),
)

// ─── Layer helper (private) ─────────────────────────────────────────────────

const configLayer = (explicitFile: Option.Option<string>) =>
  Config.layer({
    cwd: process.cwd(),
    env: Config.envFromProcess(),
    ...(Option.isSome(explicitFile)
      ? { explicitFile: explicitFile.value }
      : {}),
  })
