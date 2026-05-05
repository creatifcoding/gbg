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
 *     `Procedure` or `ProcedureGroup` values, and publish each schema
 *     to the configured node. The remote Notary auto-stamps origin + time.
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
import { type Manifest } from "../manifest/Manifest.js"
import { PactClient, layer as pactClientLayer } from "../client/PactClient.js"
import { type Procedure } from "../procedures/Procedure.js"
import { type ProcedureGroup } from "../procedures/ProcedureGroup.js"

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

const isProcedure = (v: unknown): v is Procedure =>
  typeof v === "object" &&
  v !== null &&
  "_tag" in v &&
  (v as { _tag: unknown })._tag === "Procedure"

const isProcedureGroup = (v: unknown): v is ProcedureGroup =>
  typeof v === "object" &&
  v !== null &&
  "_tag" in v &&
  (v as { _tag: unknown })._tag === "ProcedureGroup"

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
      let publishedCount = 0

      for (const [name, value] of Object.entries(moduleExports)) {
        if (isProcedureGroup(value)) {
          yield* Console.log(
            `  ProcedureGroup ${name} (${value.procedures.length} procedures)`,
          )
          for (const procedure of value.procedures) {
            const schemaId = `${procedure.name}@${procedure.version}`
            yield* Console.log(`    procedure ${schemaId}`)
            yield* client.publish(
              `${procedure.name}/Input`,
              procedure.version,
              procedure.input,
            )
            publishedCount++
            yield* client.publish(
              `${procedure.name}/Output`,
              procedure.version,
              procedure.output,
            )
            publishedCount++
            for (let i = 0; i < procedure.errors.length; i++) {
              yield* client.publish(
                `${procedure.name}/Error_${i}`,
                procedure.version,
                procedure.errors[i] as Schema.Top,
              )
              publishedCount++
            }
          }
        } else if (isProcedure(value)) {
          yield* Console.log(
            `  Procedure ${name} → ${value.name}@${value.version}`,
          )
          yield* client.publish(
            `${value.name}/Input`,
            value.version,
            value.input,
          )
          publishedCount++
          yield* client.publish(
            `${value.name}/Output`,
            value.version,
            value.output,
          )
          publishedCount++
        } else if (isSchema(value)) {
          yield* Console.log(`  Schema ${name} (defaulting to 1.0.0)`)
          yield* client.publish(name, "1.0.0", value)
          publishedCount++
        }
      }

      const baseUrl = yield* resolveBaseUrl(urlOverride)
      yield* Console.log("")
      yield* Console.log(`Published ${publishedCount} schemas to ${baseUrl}.`)
    }).pipe(
      Effect.provide(clientLayerForInvocation(configFile, urlOverride)),
      Effect.provide(configLayer(configFile)),
    ),
).pipe(
  Command.withDescription(
    "Publish all Procedures and Schemas exported from a TS/JS spec file",
  ),
)

// ─── Root command ──────────────────────────────────────────────────────────

export const pact = Command.make("pact").pipe(
  Command.withDescription(
    "PCT — Pact Protocol CLI: author, publish, and inspect schemas",
  ),
  Command.withSubcommands([registryCommand, publishCommand]),
)

export { pactClientLayer }
