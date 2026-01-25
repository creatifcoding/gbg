/**
 * new command - Generate spike template
 *
 * @skill spikectl/core
 */

import { Args, Command, Options } from "@effect/cli"
import { Effect, Option, Schema } from "effect"
import { SpikeConfig } from "../schemas/index.js"
import { generateSpikeTemplate, generateSpikeFromConfig } from "../services/generators.js"
import {
  section,
  sectionEnd,
  subSection,
  spikeWarning,
  spikeSuccess,
  emitSteering,
  printKv,
  printList,
  NextSteps,
  type OutputMode,
} from "../output.js"

const spikeName = Args.text({ name: "name" }).pipe(
  Args.withDescription("Name for the spike file (used in filename)"),
  Args.optional
)

const topic = Options.text("topic").pipe(
  Options.withAlias("t"),
  Options.optional,
  Options.withDescription("Topic description for the spike header")
)

const configFile = Options.text("config").pipe(
  Options.withAlias("c"),
  Options.optional,
  Options.withDescription("Path to spike config JSON file")
)

const keepConfig = Options.boolean("keep-config").pipe(
  Options.withAlias("k"),
  Options.withDefault(false),
  Options.withDescription("Keep config file after generation (default: auto-cleanup)")
)

const agentMode = Options.boolean("agent").pipe(
  Options.withAlias("a"),
  Options.withDefault(false),
  Options.withDescription("Output structured JSON for agent consumption")
)

export const newCommand = Command.make(
  "new",
  { spikeName, topic, configFile, keepConfig, agentMode },
  ({ spikeName, topic, configFile, keepConfig, agentMode }) =>
    Effect.gen(function* () {
      const mode: OutputMode = agentMode ? "agent" : "console"

      // If config file provided, use config-based generation
      if (Option.isSome(configFile)) {
        const configPath = configFile.value
        yield* printKv("Reading config", configPath)

        const configContent = yield* Effect.promise(async () => {
          const file = Bun.file(configPath)
          return file.text()
        }).pipe(
          Effect.catchAll(() => Effect.fail(`Could not read config file: ${configPath}`))
        )

        const rawConfig = yield* Effect.try({
          try: () => JSON.parse(configContent),
          catch: () => `Invalid JSON in config file`,
        })

        // Validate with Effect Schema
        const config = yield* Schema.decodeUnknown(SpikeConfig)(rawConfig).pipe(
          Effect.mapError((e) => `Config validation failed: ${e.message}`)
        )

        const outputDir = config.paths?.outputDir || "scripts"
        const outputFilename = config.paths?.outputFilename || `spike-${config.metadata.name}.ts`
        const filename = `${outputDir}/${outputFilename}`

        // Check if file exists
        const exists = yield* Effect.sync(() => Bun.file(filename).size > 0).pipe(
          Effect.catchAll(() => Effect.succeed(false))
        )

        if (exists) {
          yield* spikeWarning(
            `File already exists: ${filename}`,
            "Use a different name or delete the existing file."
          )
          return
        }

        const template = generateSpikeFromConfig(config)
        yield* Effect.promise(() => Bun.write(filename, template))

        // Auto-cleanup config file unless --keep-config
        if (!keepConfig) {
          yield* Effect.promise(async () => {
            const fs = await import("node:fs/promises")
            await fs.unlink(configPath)
          }).pipe(Effect.catchAll(() => Effect.void))
        }

        yield* section("SPIKE GENERATED", filename)

        yield* subSection("HYPOTHESES TO IMPLEMENT", "")
        yield* printList(
          config.hypotheses.map(h => {
            const criteria = h.acceptanceCriteria?.length
              ? ` [Pass if: ${h.acceptanceCriteria.join(", ")}]`
              : ""
            return `${h.id}: ${h.description} - "${h.claim}"${criteria}`
          })
        )

        yield* spikeSuccess(
          "Spike generated",
          {
            file: filename,
            hypotheses: String(config.hypotheses.length),
            ...(keepConfig ? {} : { "config cleaned": configPath }),
          },
          [`IMPLEMENT - Open ${filename} and fill in test logic`, `RUN: spikectl run ${filename} --verbose`]
        )

        yield* sectionEnd()

        // Emit steering message for LLM/hook consumption
        yield* emitSteering("new", {
          action: "IMPLEMENT_SPIKE",
          file: filename,
          hypotheses: config.hypotheses.map(h => ({ id: h.id, claim: h.claim })),
          nextCommand: `spikectl run ${filename} --verbose`,
          skills: ["spike-testing"],
        }, mode)
        return
      }

      // Simple mode: name required
      if (Option.isNone(spikeName)) {
        yield* spikeWarning("Name required.", "Usage: spikectl new <name> or spikectl new --config <file>")
        return
      }

      const name = spikeName.value
      const filename = `scripts/spike-${name}.ts`
      const topicText = Option.getOrElse(topic, () => name)
      const template = generateSpikeTemplate(name, topicText)

      // Check if file exists
      const exists = yield* Effect.sync(() => Bun.file(filename).size > 0).pipe(
        Effect.catchAll(() => Effect.succeed(false))
      )

      if (exists) {
        yield* spikeWarning(
          `File already exists: ${filename}`,
          "Use a different name or delete the existing file."
        )
        return
      }

      yield* Effect.promise(() => Bun.write(filename, template))

      yield* section("SPIKE CREATED", filename)
      yield* spikeSuccess(
        "Spike created",
        { file: filename },
        NextSteps.afterSpikeCreate(filename)
      )
      yield* sectionEnd()
    })
).pipe(Command.withDescription("Generate a new spike template (simple or from config)"))
