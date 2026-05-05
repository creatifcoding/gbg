/**
 * pact CLI command definitions.
 *
 * Two commands for the tracer-bullet milestone:
 *
 *   pact registry status [--url <baseUrl>]
 *     Fetch /capabilities from the remote node and print the Manifest.
 *
 *   pact publish <spec-file> [--url <baseUrl>]
 *     Dynamically import the spec file (TS/JS), look for exported
 *     `Procedure` or `ProcedureGroup` values, and publish each schema
 *     to the remote node. The remote Notary auto-stamps origin + time.
 *
 * @module @tmnl/pct/cli/commands
 */

import { resolve as resolvePath } from "node:path"
import { pathToFileURL } from "node:url"

import * as Console from "effect-v4/Console"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Schema from "effect-v4/Schema"
import { Argument, Command, Flag } from "effect-v4/unstable/cli"
import * as FetchHttpClient from "effect-v4/unstable/http/FetchHttpClient"

import { type Manifest } from "../manifest/Manifest.js"
import { PactClient, layer as pactClientLayer } from "../client/PactClient.js"
import { type Procedure } from "../procedures/Procedure.js"
import { type ProcedureGroup } from "../procedures/ProcedureGroup.js"

// ─── Shared flags ───────────────────────────────────────────────────────────

const baseUrlFlag = Flag.string("url").pipe(
  Flag.withDescription("Base URL of the PCT node to talk to"),
  Flag.withDefault("http://localhost:8080"),
)

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Render a Manifest as the colorless terminal status report shown in
 * the tracer documentation.
 *
 * Format roughly:
 *   Manifest ─ node: pct:abc12345 (https://...)
 *              revision: 4   asOf: 2026-05-04T...
 *   Schemas (3 live):
 *     ✓ orders/Order@1.0.0  registered <date> by <node>
 *   Operations (1 live):
 *     ✓ orders.create@1.0.0  mutation
 */
const renderManifest = (manifest: Manifest): string => {
  const liveSchemas = manifest.schemas.filter((s) => s.deprecated === null)
  const liveOps = manifest.operations.filter((o) => o.deprecated === null)
  const lines: Array<string> = []
  const nodeUrl = manifest.nodeUrl !== undefined
    ? ` (${manifest.nodeUrl})`
    : ""
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
    lines.push(
      `  ✓ ${o.name}@${o.version}    ${o.kind}`,
    )
    lines.push(`      in:  ${o.inputSchemaId}`)
    lines.push(`      out: ${o.outputSchemaId}`)
    if (o.errorSchemaIds.length > 0) {
      lines.push(`      err: ${o.errorSchemaIds.join(", ")}`)
    }
  }
  if (liveOps.length === 0) {
    lines.push("  (none)")
  }
  // Render deprecated count as a footer.
  const depCount =
    manifest.schemas.length - liveSchemas.length +
    (manifest.operations.length - liveOps.length)
  if (depCount > 0) {
    lines.push(``)
    lines.push(`(${depCount} deprecated entries hidden — pass --include-deprecated to show)`)
  }
  return lines.join("\n")
}

/**
 * Type guard: does the imported value look like a Procedure?
 */
const isProcedure = (v: unknown): v is Procedure =>
  typeof v === "object" &&
  v !== null &&
  "_tag" in v &&
  (v as { _tag: unknown })._tag === "Procedure"

/**
 * Type guard: does the imported value look like a ProcedureGroup?
 */
const isProcedureGroup = (v: unknown): v is ProcedureGroup =>
  typeof v === "object" &&
  v !== null &&
  "_tag" in v &&
  (v as { _tag: unknown })._tag === "ProcedureGroup"

/**
 * Type guard: does the imported value look like an Effect Schema?
 *
 * Exported standalone schemas (not inside a procedure) are also
 * publishable. We detect these by the presence of `.ast` plus
 * a runtime property unique to Schema instances.
 */
const isSchema = (v: unknown): v is Schema.Top =>
  typeof v === "object" &&
  v !== null &&
  "ast" in v &&
  // Filter out schemas that lack a proper AST shape.
  typeof (v as { ast: unknown }).ast === "object"

// ─── pact registry status ──────────────────────────────────────────────────

const statusCommand = Command.make(
  "status",
  {
    url: baseUrlFlag,
  },
  ({ url }) =>
    Effect.gen(function* () {
      yield* Console.log(`Fetching manifest from ${url}…`)
      yield* Console.log("")
      const client = yield* PactClient
      const manifest = yield* client.capabilities
      yield* Console.log(renderManifest(manifest))
    }).pipe(
      Effect.provide(pactClientLayer({ baseUrl: url })),
      Effect.provide(FetchHttpClient.layer),
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
    url: baseUrlFlag,
  },
  ({ file, url }) =>
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
            // Each procedure has input/output/error schemas — for the
            // tracer, publish each as standalone-named schemas. (The
            // full procedure-document publish lands in 3.5.1.)
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
          // Standalone schema — needs a name + version. We use the
          // export name + a default version. Authors who want
          // explicit versioning should wrap in a Procedure.
          yield* Console.log(`  Schema ${name} (defaulting to 1.0.0)`)
          yield* client.publish(name, "1.0.0", value)
          publishedCount++
        }
      }

      yield* Console.log("")
      yield* Console.log(`Published ${publishedCount} schemas to ${url}.`)
    }).pipe(
      Effect.provide(pactClientLayer({ baseUrl: url })),
      Effect.provide(FetchHttpClient.layer),
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

// Re-export the layer constructor for test harnesses to swap fetch impl.
export { pactClientLayer }
