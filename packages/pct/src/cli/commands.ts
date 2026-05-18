/**
 * pact CLI command definitions.
 *
 * Two commands for the tracer-bullet milestone:
 *
 *   pact registry status [--config <path>] [--url <override>]
 *     Fetch /capabilities from the configured node and print the Manifest.
 *
 *   pact publish <spec-file> [--config <path>] [--url <override>]
 *     Dynamically import the spec file (TS/JS), look for exported
 *     `Procedure` or `ProcedureGroup` values, and publish operations plus
 *     component schemas to the configured node. Raw Schema exports still
 *     publish as standalone schemas. The remote Notary auto-stamps origin + time.
 *
 *   pact federation peers|status|peer|unpeer|sync ...
 *     Inspect and mutate the live Flow B federation peer set.
 *
 * # Configuration
 *
 * Both commands read their target node's baseUrl from `PactConfig`.
 * Operational precedence (per `src/config/Sources.ts`):
 *
 *   --url <flag>  >  PCT_CLIENT_BASE_URL env  >  --config FILE  >
 *     project pact.config.json  >  user XDG  >  /etc/pact/config.json  >  defaults
 *
 * `--config` overrides the file lookup (project/user/system).
 * `--url` overrides the resolved client.baseUrl one-off.
 *
 * @module @tmnl/pct/cli/commands
 */

import { resolve as resolvePath } from "node:path"
import { pathToFileURL } from "node:url"

import * as Console from "effect-v4/Console"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Option from "effect-v4/Option"
import * as Schema from "effect-v4/Schema"
import { Argument, Command, Flag } from "effect-v4/unstable/cli"
import * as FetchHttpClient from "effect-v4/unstable/http/FetchHttpClient"

import * as Config from "../config/index.js"
import { type PeerSyncStatus } from "../federation/wire.js"
import { type Manifest } from "../manifest/Manifest.js"
import { PactClient, layer as pactClientLayer } from "../client/PactClient.js"
import { isProcedure } from "../procedures/Procedure.js"
import { isProcedureGroup } from "../procedures/ProcedureGroup.js"
import { serveCommand } from "./serve.js"

// ─── Global flags ───────────────────────────────────────────────────────────

/** `--config <path>` — replaces project/user/system file lookups. */
const configFileFlag = Flag.string("config").pipe(
  Flag.withDescription(
    "Path to a pact.config.json (overrides project/user/system files)",
  ),
  Flag.optional,
)

/** `--url <baseUrl>` — overrides the resolved client.baseUrl one-off. */
const urlOverrideFlag = Flag.string("url").pipe(
  Flag.withDescription(
    "Override the configured client.baseUrl for this invocation",
  ),
  Flag.optional,
)

// ─── Layer composition helpers ──────────────────────────────────────────────

const configLayer = (explicitFile: Option.Option<string>) =>
  Config.layer({
    cwd: process.cwd(),
    env: Config.envFromProcess(),
    ...(Option.isSome(explicitFile)
      ? { explicitFile: explicitFile.value }
      : {}),
  })

/** Resolve baseUrl: --url override → PactConfig.client.baseUrl. */
const resolveBaseUrl = (
  override: Option.Option<string>,
): Effect.Effect<string, never, Config.PactConfig> =>
  Effect.gen(function* () {
    if (Option.isSome(override)) return override.value
    const config = yield* Config.PactConfig
    return config.client.baseUrl
  })

/**
 * Build the full request-execution layer for a CLI invocation:
 *   PactClient ← baseUrl ← (override flag | PactConfig)
 *              ← FetchHttpClient
 *              ← PactConfig (loaded from sources)
 */
const clientLayerForInvocation = (
  configFile: Option.Option<string>,
  urlOverride: Option.Option<string>,
) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const baseUrl = yield* resolveBaseUrl(urlOverride)
      return pactClientLayer({ baseUrl }).pipe(
        Layer.provide(FetchHttpClient.layer),
      )
    }),
  ).pipe(Layer.provide(configLayer(configFile)))

// ─── Manifest renderer ──────────────────────────────────────────────────────

/**
 * Render a Manifest as the colorless terminal status report shown in
 * the tracer documentation.
 */
const renderPeer = (peer: PeerSyncStatus): string => {
  const at =
    peer.lastPolledMs > 0
      ? new Date(peer.lastPolledMs).toISOString()
      : "never"
  const node = peer.lastObservedNodeId ?? "unknown-node"
  const suffix =
    peer.lastError !== undefined
      ? `\n      last error: ${peer.lastError}`
      : ""
  return `  • ${peer.url}\n      node: ${node}    revision: ${peer.lastObservedRevision}    last poll: ${at}    errors: ${peer.errorCount}${suffix}`
}

const renderPeers = (peers: ReadonlyArray<PeerSyncStatus>): string => {
  const lines = [`Federation peers (${peers.length}):`]
  if (peers.length === 0) {
    lines.push("  (none)")
  } else {
    for (const peer of peers) lines.push(renderPeer(peer))
  }
  return lines.join("\n")
}

const renderManifest = (manifest: Manifest): string => {
  const liveSchemas = manifest.schemas.filter((s) => s.deprecated === null)
  const liveOps = manifest.operations.filter((o) => o.deprecated === null)
  const lines: Array<string> = []
  const nodeUrl =
    manifest.nodeUrl !== undefined ? ` (${manifest.nodeUrl})` : ""
  lines.push(`Manifest ─ node: ${manifest.nodeId}${nodeUrl}`)
  lines.push(
    `           revision: ${manifest.revision}    asOf: ${manifest.asOf ?? "—"}`,
  )
  lines.push(``)
  lines.push(`Schemas (${liveSchemas.length} live):`)
  for (const s of liveSchemas) {
    const at = new Date(s.registeredAt).toISOString()
    lines.push(
      `  ✓ ${s.schemaId}@${s.version}    registered ${at} by ${s.originNodeId}`,
    )
  }
  if (liveSchemas.length === 0) {
    lines.push("  (none)")
  }
  lines.push(``)
  lines.push(`Operations (${liveOps.length} live):`)
  for (const o of liveOps) {
    lines.push(`  ✓ ${o.name}@${o.version}    ${o.kind}`)
    lines.push(`      in:  ${o.inputSchemaId}`)
    lines.push(`      out: ${o.outputSchemaId}`)
    if (o.errorSchemaIds.length > 0) {
      lines.push(`      err: ${o.errorSchemaIds.join(", ")}`)
    }
  }
  if (liveOps.length === 0) {
    lines.push("  (none)")
  }
  const depCount =
    manifest.schemas.length -
    liveSchemas.length +
    (manifest.operations.length - liveOps.length)
  if (depCount > 0) {
    lines.push(``)
    lines.push(
      `(${depCount} deprecated entries hidden — pass --include-deprecated to show)`,
    )
  }
  return lines.join("\n")
}

// ─── Type guards on imported user spec exports ──────────────────────────────

/**
 * Detector for raw Effect Schema instances exported standalone (not
 * inside a Procedure). Used when `pact publish` is scanning module
 * exports — a schema with no procedure context gets registered under
 * the export name + a default version.
 */
const isSchema = (v: unknown): v is Schema.Top =>
  typeof v === "object" &&
  v !== null &&
  "ast" in v &&
  typeof (v as { ast: unknown }).ast === "object"

// ─── pact registry status ──────────────────────────────────────────────────

const statusCommand = Command.make(
  "status",
  {
    config: configFileFlag,
    url: urlOverrideFlag,
  },
  ({ config: configFile, url: urlOverride }) =>
    Effect.gen(function* () {
      const baseUrl = yield* resolveBaseUrl(urlOverride)
      yield* Console.log(`Fetching manifest from ${baseUrl}…`)
      yield* Console.log("")
      const client = yield* PactClient
      const manifest = yield* client.capabilities
      yield* Console.log(renderManifest(manifest))
    }).pipe(
      Effect.provide(clientLayerForInvocation(configFile, urlOverride)),
      Effect.provide(configLayer(configFile)),
    ),
).pipe(
  Command.withDescription("Print the live registry manifest from a PCT node"),
)

// ─── pact registry (parent for status) ─────────────────────────────────────

const registryCommand = Command.make("registry").pipe(
  Command.withDescription("Inspect a PCT registry"),
  Command.withSubcommands([statusCommand]),
)

// ─── pact publish ──────────────────────────────────────────────────────────

const publishCommand = Command.make(
  "publish",
  {
    file: Argument.string("spec-file").pipe(
      Argument.withDescription(
        "Path to a TS/JS module exporting Procedures, ProcedureGroups, or Schemas",
      ),
    ),
    config: configFileFlag,
    url: urlOverrideFlag,
  },
  ({ file, config: configFile, url: urlOverride }) =>
    Effect.gen(function* () {
      const absolute = resolvePath(file)
      yield* Console.log(`Loading ${absolute}…`)

      const moduleExports = yield* Effect.tryPromise({
        try: () =>
          import(pathToFileURL(absolute).href) as Promise<
            Record<string, unknown>
          >,
        catch: (cause) =>
          new Error(`Failed to import ${file}: ${String(cause)}`),
      })

      const client = yield* PactClient
      let publishedSchemas = 0
      let publishedOperations = 0

      const groupedProcedures = new Set<unknown>()
      for (const value of Object.values(moduleExports)) {
        if (isProcedureGroup(value)) {
          for (const procedure of value.procedures) {
            groupedProcedures.add(procedure)
          }
        }
      }

      for (const [name, value] of Object.entries(moduleExports)) {
        if (isProcedureGroup(value)) {
          yield* Console.log(
            `  ProcedureGroup ${name} (${value.procedures.length} procedures)`,
          )
          const result = yield* client.publishGroup(value)
          publishedOperations += result.procedures.length
          for (const procedure of result.procedures) {
            publishedSchemas += 2 + procedure.errorSchemaIds.length
            yield* Console.log(`    operation ${procedure.schemaId}`)
          }
        } else if (isProcedure(value)) {
          if (groupedProcedures.has(value)) {
            yield* Console.log(
              `  Procedure ${name} → ${value.name}@${value.version} (covered by exported group)`,
            )
            continue
          }
          yield* Console.log(
            `  Procedure ${name} → ${value.name}@${value.version}`,
          )
          const result = yield* client.publishProcedure(value)
          publishedOperations++
          publishedSchemas += 2 + result.errorSchemaIds.length
        } else if (isSchema(value)) {
          yield* Console.log(`  Schema ${name} (defaulting to 1.0.0)`)
          yield* client.publish(name, "1.0.0", value)
          publishedSchemas++
        }
      }

      const baseUrl = yield* resolveBaseUrl(urlOverride)
      yield* Console.log("")
      yield* Console.log(
        `Published ${publishedSchemas} schemas and ${publishedOperations} operations to ${baseUrl}.`,
      )
    }).pipe(
      Effect.provide(clientLayerForInvocation(configFile, urlOverride)),
      Effect.provide(configLayer(configFile)),
    ),
).pipe(
  Command.withDescription(
    "Publish all Procedures and Schemas exported from a TS/JS spec file",
  ),
)

// ─── pact federation ───────────────────────────────────────────────────────

const peerUrlArgument = Argument.string("peer-url").pipe(
  Argument.withDescription("Peer PCT base URL, e.g. http://127.0.0.1:8081"),
)

const federationPeersCommand = Command.make(
  "peers",
  { config: configFileFlag, url: urlOverrideFlag },
  ({ config: configFile, url: urlOverride }) =>
    Effect.gen(function* () {
      const client = yield* PactClient
      const result = yield* client.federationPeers
      yield* Console.log(renderPeers(result.peers))
    }).pipe(
      Effect.provide(clientLayerForInvocation(configFile, urlOverride)),
      Effect.provide(configLayer(configFile)),
    ),
).pipe(Command.withDescription("List configured federation peers"))

const federationStatusCommand = Command.make(
  "status",
  { config: configFileFlag, url: urlOverrideFlag },
  ({ config: configFile, url: urlOverride }) =>
    Effect.gen(function* () {
      const client = yield* PactClient
      const result = yield* client.federationPeers
      yield* Console.log(renderPeers(result.peers))
    }).pipe(
      Effect.provide(clientLayerForInvocation(configFile, urlOverride)),
      Effect.provide(configLayer(configFile)),
    ),
).pipe(Command.withDescription("Alias for `pact federation peers`"))

const federationPeerCommand = Command.make(
  "peer",
  { peerUrl: peerUrlArgument, config: configFileFlag, url: urlOverrideFlag },
  ({ peerUrl, config: configFile, url: urlOverride }) =>
    Effect.gen(function* () {
      const client = yield* PactClient
      const result = yield* client.federationPeer(peerUrl)
      yield* Console.log(`Added federation peer ${peerUrl}.`)
      yield* Console.log(renderPeers(result.peers))
    }).pipe(
      Effect.provide(clientLayerForInvocation(configFile, urlOverride)),
      Effect.provide(configLayer(configFile)),
    ),
).pipe(Command.withDescription("Add a federation peer URL"))

const federationUnpeerCommand = Command.make(
  "unpeer",
  { peerUrl: peerUrlArgument, config: configFileFlag, url: urlOverrideFlag },
  ({ peerUrl, config: configFile, url: urlOverride }) =>
    Effect.gen(function* () {
      const client = yield* PactClient
      const result = yield* client.federationUnpeer(peerUrl)
      yield* Console.log(`Removed federation peer ${result.url}.`)
      yield* Console.log(renderPeers(result.peers))
    }).pipe(
      Effect.provide(clientLayerForInvocation(configFile, urlOverride)),
      Effect.provide(configLayer(configFile)),
    ),
).pipe(Command.withDescription("Remove a federation peer URL"))

const federationSyncCommand = Command.make(
  "sync",
  { peerUrl: peerUrlArgument, config: configFileFlag, url: urlOverrideFlag },
  ({ peerUrl, config: configFile, url: urlOverride }) =>
    Effect.gen(function* () {
      const client = yield* PactClient
      const result = yield* client.federationSync(peerUrl)
      yield* Console.log(
        `Synced ${peerUrl}: node=${result.peerNodeId} revision=${result.peerRevision} writes=${result.writes}`,
      )
      yield* Console.log(renderPeers(result.peers))
    }).pipe(
      Effect.provide(clientLayerForInvocation(configFile, urlOverride)),
      Effect.provide(configLayer(configFile)),
    ),
).pipe(Command.withDescription("Trigger a one-shot federation sync"))

const federationCommand = Command.make("federation").pipe(
  Command.withDescription("Inspect and manage Flow B federation peers"),
  Command.withSubcommands([
    federationPeersCommand,
    federationStatusCommand,
    federationPeerCommand,
    federationUnpeerCommand,
    federationSyncCommand,
  ]),
)

// ─── Root command ──────────────────────────────────────────────────────────

export const pact = Command.make("pact").pipe(
  Command.withDescription(
    "PCT — Pact Protocol CLI: author, publish, and inspect schemas",
  ),
  Command.withSubcommands([
    registryCommand,
    federationCommand,
    publishCommand,
    serveCommand,
  ]),
)

export { pactClientLayer }
