/**
 * new command - Generate spike template
 *
 * @skill spikectl/core
 */

import { Args, Command, Options } from "@effect/cli"
import { Effect, Console, Option, Schema } from "effect"
import { SpikeConfig } from "../schemas/index.js"
import { generateSpikeTemplate, generateSpikeFromConfig } from "../services/generators.js"

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

export const newCommand = Command.make(
  "new",
  { spikeName, topic, configFile, keepConfig },
  ({ spikeName, topic, configFile, keepConfig }) =>
    Effect.gen(function* () {
      // If config file provided, use config-based generation
      if (Option.isSome(configFile)) {
        const configPath = configFile.value
        yield* Console.log(`📄 Reading config: ${configPath}`)

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
          yield* Console.log(`⚠️  File already exists: ${filename}`)
          yield* Console.log(`   Use a different name or delete the existing file.`)
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

        yield* Console.log(``)
        yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        yield* Console.log(`✨ SPIKE GENERATED: ${filename}`)
        yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        yield* Console.log(``)
        yield* Console.log(`📋 HYPOTHESES TO IMPLEMENT:`)
        for (const h of config.hypotheses) {
          yield* Console.log(`   ${h.id}: ${h.description}`)
          yield* Console.log(`       Claim: "${h.claim}"`)
          if (h.acceptanceCriteria?.length) {
            yield* Console.log(`       Pass if: ${h.acceptanceCriteria.join(", ")}`)
          }
        }
        yield* Console.log(``)
        yield* Console.log(`📝 NEXT STEPS:`)
        yield* Console.log(`   1. IMPLEMENT - Open ${filename} and fill in test logic`)
        yield* Console.log(`   2. RUN: spikectl run ${filename} --verbose`)
        yield* Console.log(``)
        if (!keepConfig) {
          yield* Console.log(`   ✓ Config file cleaned up: ${configPath}`)
        }
        yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

        // Emit steering message for LLM/hook consumption
        yield* Console.log(``)
        yield* Console.log(`<!-- SPIKE_STEERING`)
        yield* Console.log(JSON.stringify({
          action: "IMPLEMENT_SPIKE",
          file: filename,
          hypotheses: config.hypotheses.map(h => h.id),
          nextCommand: `spikectl run ${filename} --verbose`,
          skills: ["spike-testing"],
        }))
        yield* Console.log(`-->`)
        return
      }

      // Simple mode: name required
      if (Option.isNone(spikeName)) {
        yield* Console.log(`⚠️  Name required. Usage:`)
        yield* Console.log(`   spikectl new <name>`)
        yield* Console.log(`   spikectl new --config <file>`)
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
        yield* Console.log(`⚠️  File already exists: ${filename}`)
        yield* Console.log(`   Use a different name or delete the existing file.`)
        return
      }

      yield* Effect.promise(() => Bun.write(filename, template))
      yield* Console.log(``)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      yield* Console.log(`✨ SPIKE CREATED: ${filename}`)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      yield* Console.log(``)
      yield* Console.log(`📝 NEXT STEPS:`)
      yield* Console.log(`   1. EDIT SPIKE - Replace placeholders in ${filename}`)
      yield* Console.log(`   2. RUN: spikectl run ${filename} --verbose`)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    })
).pipe(Command.withDescription("Generate a new spike template (simple or from config)"))
