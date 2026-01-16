#!/usr/bin/env bun
/**
 * TMNL Spike CLI
 *
 * Hypothesis-driven debugging tool using @effect/cli.
 * Progressive isolation (H1 → H2 → H3 → H4) for debugging complex integrations.
 *
 * Commands:
 *   bun spike run <file> [--verbose]      - Execute a spike file
 *   bun spike list [--pattern <glob>]     - List spike files
 *   bun spike new <name> [--topic]        - Generate spike template (simple)
 *   bun spike new --config <file>         - Generate spike from JSON config
 *   bun spike init <name>                 - Generate spike config JSON
 */

import { Args, Command, Options } from "@effect/cli"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect, Option, Schema } from "effect"

// =============================================================================
// Spike Config Schema (Effect Schema)
// =============================================================================

const HypothesisConfig = Schema.Struct({
  id: Schema.String.pipe(Schema.annotations({ description: "Hypothesis ID (e.g., H1, H2)" })),
  description: Schema.String.pipe(Schema.annotations({ description: "Short description of the hypothesis" })),
  claim: Schema.String.pipe(Schema.annotations({ description: "Falsifiable claim to test" })),
  acceptanceCriteria: Schema.optional(
    Schema.Array(Schema.String).pipe(Schema.annotations({ description: "Criteria for pass/fail" }))
  ),
})

const SpikeMetadata = Schema.Struct({
  name: Schema.String.pipe(Schema.annotations({ description: "Spike name (used for function names)" })),
  topic: Schema.String.pipe(Schema.annotations({ description: "Topic description" })),
  author: Schema.optional(Schema.String),
  date: Schema.optional(Schema.String),
  issueRef: Schema.optional(Schema.String.pipe(Schema.annotations({ description: "Related issue ID (e.g., beads-123)" }))),
  relatedFiles: Schema.optional(Schema.Array(Schema.String)),
  expectedOutcome: Schema.optional(Schema.String),
})

const SpikePaths = Schema.Struct({
  outputDir: Schema.optional(Schema.String.pipe(Schema.annotations({ description: "Output directory (default: scripts/)" }))),
  outputFilename: Schema.optional(Schema.String.pipe(Schema.annotations({ description: "Output filename (default: spike-<name>.ts)" }))),
})

export const SpikeConfig = Schema.Struct({
  $schema: Schema.optional(Schema.String),
  metadata: SpikeMetadata,
  paths: Schema.optional(SpikePaths),
  hypotheses: Schema.Array(HypothesisConfig).pipe(Schema.annotations({ description: "Hypotheses to test (H1-H4+)" })),
})

export type SpikeConfig = typeof SpikeConfig.Type

// =============================================================================
// Template Generators
// =============================================================================

function generateConfigTemplate(name: string): string {
  const today = new Date().toISOString().split("T")[0]
  return JSON.stringify(
    {
      $schema: "./spike-config.schema.json",
      metadata: {
        name,
        topic: `Investigation: ${name}`,
        author: "Val",
        date: today,
        relatedFiles: [],
        expectedOutcome: "Identify root cause and extract fix",
      },
      paths: {
        outputDir: "scripts",
        outputFilename: `spike-${name}.ts`,
      },
      hypotheses: [
        {
          id: "H1",
          description: "Schema encoding",
          claim: "Schema encodes value to expected type",
          acceptanceCriteria: ["typeof encoded === 'string'", "encoded !== undefined"],
        },
        {
          id: "H2",
          description: "Model layer",
          claim: "Model.insert produces correct encoded payload",
          acceptanceCriteria: ["All fields have expected types"],
        },
        {
          id: "H3",
          description: "Repository",
          claim: "Repository accepts encoded payload without error",
          acceptanceCriteria: ["No SQL binding errors", "Insert returns result"],
        },
        {
          id: "H4",
          description: "Full integration",
          claim: "End-to-end flow works correctly",
          acceptanceCriteria: ["Insert → findById returns matching data"],
        },
      ],
    },
    null,
    2
  )
}

function generateSpikeTemplate(name: string, topic: string): string {
  const safeName = name.replace(/-/g, "_")
  return `#!/usr/bin/env bun
/**
 * Spike: ${topic}
 *
 * Hypotheses:
 * H1: [First hypothesis - simplest case]
 * H2: [Second hypothesis - add one layer]
 * H3: [Third hypothesis - add another layer]
 * H4: [Fourth hypothesis - full integration]
 */

import { Effect, Console } from "effect"

const BANNER = "=".repeat(60)

// =============================================================================
// H1: [Describe hypothesis]
// =============================================================================
async function h1_${safeName}() {
  console.log("\\n" + BANNER)
  console.log("H1: [Description]")
  console.log("Hypothesis: [Falsifiable claim]")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    yield* Console.log("Testing H1...")
    // TODO: Implement hypothesis test
    // Assert outcomes
    return "PASS"
  })

  const result = await Effect.runPromise(program)
  console.log(\`\\n✓ H1 Result: \${result}\`)
  return result === "PASS"
}

// =============================================================================
// H2: [Describe hypothesis]
// =============================================================================
async function h2_${safeName}() {
  console.log("\\n" + BANNER)
  console.log("H2: [Description]")
  console.log("Hypothesis: [Falsifiable claim]")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    yield* Console.log("Testing H2...")
    // TODO: Implement hypothesis test
    return "PASS"
  })

  const result = await Effect.runPromise(program)
  console.log(\`\\n✓ H2 Result: \${result}\`)
  return result === "PASS"
}

// =============================================================================
// H3: [Describe hypothesis]
// =============================================================================
async function h3_${safeName}() {
  console.log("\\n" + BANNER)
  console.log("H3: [Description]")
  console.log("Hypothesis: [Falsifiable claim]")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    yield* Console.log("Testing H3...")
    // TODO: Implement hypothesis test
    return "PASS"
  })

  const result = await Effect.runPromise(program)
  console.log(\`\\n✓ H3 Result: \${result}\`)
  return result === "PASS"
}

// =============================================================================
// H4: [Describe hypothesis - full integration]
// =============================================================================
async function h4_${safeName}() {
  console.log("\\n" + BANNER)
  console.log("H4: [Full Integration]")
  console.log("Hypothesis: [Falsifiable claim about full integration]")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    yield* Console.log("Testing H4...")
    // TODO: Implement full integration test
    return "PASS"
  })

  const result = await Effect.runPromise(program)
  console.log(\`\\n✓ H4 Result: \${result}\`)
  return result === "PASS"
}

// =============================================================================
// Main
// =============================================================================
async function main() {
  console.log("\\n🧪 Spike: ${topic}")
  console.log("=".repeat(60))

  const results: Record<string, boolean> = {}

  results.H1 = await h1_${safeName}()
  results.H2 = await h2_${safeName}()
  results.H3 = await h3_${safeName}()
  results.H4 = await h4_${safeName}()

  // Summary
  console.log("\\n" + BANNER)
  console.log("SUMMARY")
  console.log(BANNER)
  for (const [h, passed] of Object.entries(results)) {
    console.log(\`  \${passed ? "✅" : "❌"} \${h}\`)
  }

  const allPassed = Object.values(results).every(Boolean)
  console.log(\`\\n\${allPassed ? "✅ All hypotheses passed" : "❌ Some hypotheses failed"}\`)

  process.exit(allPassed ? 0 : 1)
}

main().catch(console.error)
`
}

function generateSpikeFromConfig(config: SpikeConfig): string {
  const { metadata, hypotheses } = config
  const safeName = metadata.name.replace(/-/g, "_")

  const hypothesesDocs = hypotheses
    .map((h) => ` * ${h.id}: ${h.description} - ${h.claim}`)
    .join("\n")

  const relatedFilesDoc = metadata.relatedFiles?.length
    ? `\n * Related Files:\n${metadata.relatedFiles.map((f) => ` *   - ${f}`).join("\n")}`
    : ""

  const issueRefDoc = metadata.issueRef ? `\n * Issue: ${metadata.issueRef}` : ""

  const hypothesisFunctions = hypotheses
    .map((h) => {
      const funcName = `${h.id.toLowerCase()}_${safeName}`
      const acceptanceCriteriaComment = h.acceptanceCriteria?.length
        ? `\n    // Acceptance criteria:\n${h.acceptanceCriteria.map((c) => `    //   - ${c}`).join("\n")}`
        : ""

      return `// =============================================================================
// ${h.id}: ${h.description}
// =============================================================================
async function ${funcName}() {
  console.log("\\n" + BANNER)
  console.log("${h.id}: ${h.description}")
  console.log("Hypothesis: ${h.claim}")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    yield* Console.log("Testing ${h.id}...")${acceptanceCriteriaComment}
    // TODO: Implement hypothesis test
    return "PASS"
  })

  const result = await Effect.runPromise(program)
  console.log(\`\\n✓ ${h.id} Result: \${result}\`)
  return result === "PASS"
}`
    })
    .join("\n\n")

  const hypothesisCalls = hypotheses
    .map((h) => `  results.${h.id} = await ${h.id.toLowerCase()}_${safeName}()`)
    .join("\n")

  return `#!/usr/bin/env bun
/**
 * Spike: ${metadata.topic}
 *
 * Author: ${metadata.author || "Unknown"}
 * Date: ${metadata.date || new Date().toISOString().split("T")[0]}${issueRefDoc}${relatedFilesDoc}
 * Expected Outcome: ${metadata.expectedOutcome || "Identify root cause"}
 *
 * Hypotheses:
${hypothesesDocs}
 */

import { Effect, Console } from "effect"

const BANNER = "=".repeat(60)

${hypothesisFunctions}

// =============================================================================
// Main
// =============================================================================
async function main() {
  console.log("\\n🧪 Spike: ${metadata.topic}")
  console.log("=".repeat(60))

  const results: Record<string, boolean> = {}

${hypothesisCalls}

  // Summary
  console.log("\\n" + BANNER)
  console.log("SUMMARY")
  console.log(BANNER)
  for (const [h, passed] of Object.entries(results)) {
    console.log(\`  \${passed ? "✅" : "❌"} \${h}\`)
  }

  const allPassed = Object.values(results).every(Boolean)
  console.log(\`\\n\${allPassed ? "✅ All hypotheses passed" : "❌ Some hypotheses failed"}\`)

  process.exit(allPassed ? 0 : 1)
}

main().catch(console.error)
`
}

// =============================================================================
// spike run <file> [--verbose]
// =============================================================================
const spikeFile = Args.text({ name: "file" }).pipe(
  Args.withDescription("Path to spike file to execute")
)
const verbose = Options.boolean("verbose").pipe(
  Options.withAlias("v"),
  Options.withDescription("Show verbose output from spike execution")
)

const runCommand = Command.make(
  "run",
  { spikeFile, verbose },
  ({ spikeFile, verbose }) =>
    Effect.gen(function* () {
      yield* Console.log(``)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      yield* Console.log(`🧪 EXECUTING SPIKE: ${spikeFile}`)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

      // Execute via Bun.spawn
      const proc = Bun.spawn(["bun", "run", spikeFile], {
        stdout: verbose ? "inherit" : "pipe",
        stderr: "inherit",
        cwd: process.cwd(),
      })

      const exitCode = yield* Effect.promise(() => proc.exited)

      if (!verbose && proc.stdout) {
        const output = yield* Effect.promise(async () => {
          const reader = proc.stdout as ReadableStream<Uint8Array>
          const chunks: Uint8Array[] = []
          const readerInstance = reader.getReader()
          let done = false
          while (!done) {
            const result = await readerInstance.read()
            if (result.done) {
              done = true
            } else {
              chunks.push(result.value)
            }
          }
          return new TextDecoder().decode(
            Uint8Array.from(chunks.flatMap((chunk) => Array.from(chunk)))
          )
        })
        yield* Console.log(output)
      }

      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      if (exitCode === 0) {
        yield* Console.log(`✅ SPIKE PASSED - All hypotheses validated`)
        yield* Console.log(``)
        yield* Console.log(`📝 NEXT STEPS:`)
        yield* Console.log(`   1. Extract successful patterns to production code`)
        yield* Console.log(`   2. Document learning in .edin/ if significant`)
        yield* Console.log(`   3. Delete spike file if no longer needed`)
      } else {
        yield* Console.log(`❌ SPIKE FAILED - One or more hypotheses invalidated`)
        yield* Console.log(``)
        yield* Console.log(`📝 NEXT STEPS:`)
        yield* Console.log(`   1. IDENTIFY - Find FIRST failing hypothesis (that's the bug layer)`)
        yield* Console.log(`   2. ANALYZE - Check actual values vs expected in output above`)
        yield* Console.log(`   3. ROOT CAUSE - The difference reveals the bug`)
        yield* Console.log(`   4. FIX - Apply fix to production code`)
        yield* Console.log(`   5. RE-RUN - bun spike run ${spikeFile} --verbose`)
      }
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    })
).pipe(Command.withDescription("Execute a spike file"))

// =============================================================================
// spike list [--pattern <glob>]
// =============================================================================
const pattern = Options.text("pattern").pipe(
  Options.withAlias("p"),
  Options.withDefault("scripts/spike-*.ts"),
  Options.withDescription("Glob pattern to match spike files")
)

const listCommand = Command.make("list", { pattern }, ({ pattern }) =>
  Effect.gen(function* () {
    const glob = new Bun.Glob(pattern)
    const files = yield* Effect.sync(() => [...glob.scanSync(".")])

    yield* Console.log(`📋 Spikes matching "${pattern}":`)
    if (files.length === 0) {
      yield* Console.log("  (no spikes found)")
    } else {
      for (const file of files.sort()) {
        yield* Console.log(`  - ${file}`)
      }
    }
    yield* Console.log(`\nTotal: ${files.length} spikes`)
  })
).pipe(Command.withDescription("List spike files matching pattern"))

// =============================================================================
// spike init <name> - Generate spike config JSON
// =============================================================================
const initName = Args.text({ name: "name" }).pipe(
  Args.withDescription("Name for the spike config")
)

const initCommand = Command.make("init", { initName }, ({ initName }) =>
  Effect.gen(function* () {
    const filename = `spike-${initName}.config.json`

    // Check if file exists
    const exists = yield* Effect.sync(() => Bun.file(filename).size > 0).pipe(
      Effect.catchAll(() => Effect.succeed(false))
    )

    if (exists) {
      yield* Console.log(`⚠️  File already exists: ${filename}`)
      yield* Console.log(`   Use a different name or delete the existing file.`)
      return
    }

    const config = generateConfigTemplate(initName)
    yield* Effect.promise(() => Bun.write(filename, config))

    yield* Console.log(``)
    yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    yield* Console.log(`✨ SPIKE CONFIG CREATED: ${filename}`)
    yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    yield* Console.log(``)
    yield* Console.log(`📝 NEXT STEPS:`)
    yield* Console.log(``)
    yield* Console.log(`   1. EDIT CONFIG - Customize hypotheses for your issue:`)
    yield* Console.log(`      - Update metadata.topic with specific issue description`)
    yield* Console.log(`      - Update metadata.issueRef if you have a beads issue`)
    yield* Console.log(`      - Update metadata.relatedFiles with files to investigate`)
    yield* Console.log(`      - Rewrite hypotheses[].claim with falsifiable statements`)
    yield* Console.log(`      - Add specific acceptanceCriteria for each hypothesis`)
    yield* Console.log(``)
    yield* Console.log(`   2. GENERATE SPIKE:`)
    yield* Console.log(`      bun spike new --config ${filename}`)
    yield* Console.log(``)
    yield* Console.log(`   3. Config will be auto-cleaned after spike generation.`)
    yield* Console.log(``)
    yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  })
).pipe(Command.withDescription("Generate a spike config JSON template"))

// =============================================================================
// spike new <name> [--topic] [--config]
// =============================================================================
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
  Options.withDescription("Keep config file after generation (default: auto-cleanup)")
)

const newCommand = Command.make(
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
        yield* Console.log(``)
        yield* Console.log(`   1. IMPLEMENT - Open ${filename} and fill in test logic:`)
        yield* Console.log(`      - For each hypothesis function, add Effect.gen code`)
        yield* Console.log(`      - Log actual values with types: console.log(\`value: \${x} (type: \${typeof x})\`)`)
        yield* Console.log(`      - Return "PASS" if acceptance criteria met, "FAIL" otherwise`)
        yield* Console.log(``)
        yield* Console.log(`   2. RUN SPIKE:`)
        yield* Console.log(`      bun spike run ${filename} --verbose`)
        yield* Console.log(``)
        yield* Console.log(`   3. ANALYZE OUTPUT - Look for first failing hypothesis`)
        yield* Console.log(`      - That layer is where the bug lives`)
        yield* Console.log(`      - Extract fix to production code`)
        yield* Console.log(``)
        if (!keepConfig) {
          yield* Console.log(`   ✓ Config file cleaned up: ${configPath}`)
        }
        yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        return
      }

      // Simple mode: name required
      if (Option.isNone(spikeName)) {
        yield* Console.log(`⚠️  Name required. Usage:`)
        yield* Console.log(`   bun spike new <name>`)
        yield* Console.log(`   bun spike new --config <file>`)
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
      yield* Console.log(``)
      yield* Console.log(`   1. EDIT SPIKE - Replace placeholders in ${filename}:`)
      yield* Console.log(`      - Update [Description] with what you're testing`)
      yield* Console.log(`      - Update [Falsifiable claim] with specific assertion`)
      yield* Console.log(`      - Implement test logic in Effect.gen`)
      yield* Console.log(``)
      yield* Console.log(`   2. RUN:`)
      yield* Console.log(`      bun spike run ${filename} --verbose`)
      yield* Console.log(``)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    })
).pipe(Command.withDescription("Generate a new spike template (simple or from config)"))

// =============================================================================
// Main CLI
// =============================================================================
const spike = Command.make("spike", {}, () =>
  Console.log(`TMNL Spike Runner - Hypothesis-driven debugging

Commands:
  run <file>           Execute a spike file
  list                 List spike files
  init <name>          Generate spike config JSON template
  new <name>           Generate simple spike template
  new --config <file>  Generate spike from config JSON

Examples:
  bun spike list
  bun spike new datetime-binding
  bun spike init sqlite-issue
  bun spike new --config spike-sqlite-issue.config.json
  bun spike run scripts/spike-datetime-binding.ts --verbose

Use --help with any command for more details.`)
)

const command = spike.pipe(
  Command.withSubcommands([runCommand, listCommand, initCommand, newCommand])
)

const cli = Command.run(command, {
  name: "spike",
  version: "1.0.0",
})

cli(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain)
