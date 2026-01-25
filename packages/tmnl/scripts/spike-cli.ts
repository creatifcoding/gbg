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
import { execSync } from "node:child_process"
import * as fs from "node:fs/promises"
import * as path from "node:path"

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

// Setup schema for directory/file scaffolding
const SpikeFileTemplate = Schema.Struct({
  path: Schema.String.pipe(Schema.annotations({ description: "Relative file path to create" })),
  content: Schema.optional(Schema.String.pipe(Schema.annotations({ description: "File content (inline)" }))),
  template: Schema.optional(Schema.String.pipe(Schema.annotations({ description: "Template name (e.g., 'effect-service', 'react-component')" }))),
  vars: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
})

const SpikeSetup = Schema.Struct({
  directories: Schema.optional(Schema.Array(Schema.String).pipe(
    Schema.annotations({ description: "Directories to create (relative paths)" })
  )),
  files: Schema.optional(Schema.Array(SpikeFileTemplate).pipe(
    Schema.annotations({ description: "Files to generate as part of spike setup" })
  )),
  fixtures: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
    Schema.annotations({ description: "Test fixture data (JSON)" })
  )),
})

export const SpikeConfig = Schema.Struct({
  $schema: Schema.optional(Schema.String),
  metadata: SpikeMetadata,
  paths: Schema.optional(SpikePaths),
  setup: Schema.optional(SpikeSetup),
  hypotheses: Schema.Array(HypothesisConfig).pipe(Schema.annotations({ description: "Hypotheses to test (H1-H4+)" })),
})

export type SpikeConfig = typeof SpikeConfig.Type

// =============================================================================
// Pattern Storage Schema (Autopoietic System)
// =============================================================================

const SpikeFix = Schema.Struct({
  rootCause: Schema.String.pipe(Schema.annotations({ description: "What was the root cause" })),
  fix: Schema.String.pipe(Schema.annotations({ description: "How it was fixed" })),
  appliedAt: Schema.String.pipe(Schema.annotations({ description: "ISO date when fix was applied" })),
})

const SpikePattern = Schema.Struct({
  id: Schema.String.pipe(Schema.annotations({ description: "Unique pattern identifier" })),
  errorSignature: Schema.String.pipe(Schema.annotations({ description: "Regex pattern that triggers this" })),
  domain: Schema.String.pipe(Schema.annotations({ description: "Domain category (e.g., encoding, datetime)" })),
  hypothesisTemplate: Schema.Array(HypothesisConfig).pipe(Schema.annotations({ description: "H1-H4 templates" })),
  successCount: Schema.Number.pipe(Schema.annotations({ description: "Times this pattern led to a fix" })),
  failureCount: Schema.Number.pipe(Schema.annotations({ description: "Times this pattern didn't help" })),
  lastUsed: Schema.NullOr(Schema.String).pipe(Schema.annotations({ description: "ISO date of last use" })),
  fixes: Schema.Array(SpikeFix).pipe(Schema.annotations({ description: "Recorded fixes from this pattern" })),
  tags: Schema.Array(Schema.String).pipe(Schema.annotations({ description: "Searchable tags" })),
})

export type SpikePattern = typeof SpikePattern.Type

const SpikePatternStore = Schema.Struct({
  version: Schema.Literal("1.0"),
  patterns: Schema.Array(SpikePattern),
  lastEvolved: Schema.NullOr(Schema.String).pipe(Schema.annotations({ description: "ISO date of last evolution" })),
})

export type SpikePatternStore = typeof SpikePatternStore.Type

// =============================================================================
// Pattern Store Paths & Utilities
// =============================================================================

const PATTERN_STORE_PATH = ".claude/cache/spike-patterns.json"
const OPC_DIR = process.env.CLAUDE_PROJECT_DIR ? `${process.env.CLAUDE_PROJECT_DIR}/opc` : null

const loadPatternStore = (): Effect.Effect<SpikePatternStore, string> =>
  Effect.gen(function* () {
    const exists = yield* Effect.promise(async () => {
      try {
        await fs.access(PATTERN_STORE_PATH)
        return true
      } catch {
        return false
      }
    })

    if (!exists) {
      // Return default empty store
      return {
        version: "1.0" as const,
        patterns: [],
        lastEvolved: null,
      }
    }

    const content = yield* Effect.promise(() => fs.readFile(PATTERN_STORE_PATH, "utf-8")).pipe(
      Effect.mapError(() => `Could not read pattern store: ${PATTERN_STORE_PATH}`)
    )

    const raw = yield* Effect.try({
      try: () => JSON.parse(content),
      catch: () => `Invalid JSON in pattern store`,
    })

    return yield* Schema.decodeUnknown(SpikePatternStore)(raw).pipe(
      Effect.mapError((e) => `Pattern store validation failed: ${e.message}`)
    )
  })

const savePatternStore = (store: SpikePatternStore): Effect.Effect<void, string> =>
  Effect.gen(function* () {
    // Ensure directory exists
    const dir = path.dirname(PATTERN_STORE_PATH)
    yield* Effect.promise(() => fs.mkdir(dir, { recursive: true }))

    yield* Effect.promise(() =>
      fs.writeFile(PATTERN_STORE_PATH, JSON.stringify(store, null, 2))
    ).pipe(Effect.mapError(() => `Could not write pattern store: ${PATTERN_STORE_PATH}`))
  })

const successRate = (pattern: SpikePattern): number => {
  const total = pattern.successCount + pattern.failureCount
  return total > 0 ? pattern.successCount / total : 0
}

// Query opc memory for learnings related to an error
const queryOpcMemory = (query: string): Effect.Effect<string[], never> =>
  Effect.gen(function* () {
    if (!OPC_DIR) {
      return []
    }

    try {
      const result = execSync(
        `cd ${OPC_DIR} && PYTHONPATH=. uv run python scripts/core/recall_learnings.py --query "${query.replace(/"/g, '\\"')}" --k 3 --text-only`,
        { encoding: "utf-8", timeout: 10000 }
      )
      // Parse the output to extract relevant learnings
      const lines = result.split("\n").filter((l) => l.trim() && !l.startsWith("━"))
      return lines.slice(0, 5) // Limit to 5 relevant lines
    } catch {
      return []
    }
  })

// Store a learning to opc memory
const storeToOpcMemory = (params: {
  sessionId: string
  type: string
  content: string
  context: string
  tags: string[]
  confidence?: string
}): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    if (!OPC_DIR) {
      return false
    }

    try {
      const tagsArg = params.tags.join(",")
      const cmd = `cd ${OPC_DIR} && PYTHONPATH=. uv run python scripts/core/store_learning.py \
        --session-id "${params.sessionId}" \
        --type "${params.type}" \
        --content "${params.content.replace(/"/g, '\\"')}" \
        --context "${params.context.replace(/"/g, '\\"')}" \
        --tags "${tagsArg}" \
        --confidence ${params.confidence || "medium"}`

      execSync(cmd, { encoding: "utf-8", timeout: 10000 })
      return true
    } catch {
      return false
    }
  })

// Extract hypotheses from spike file content
const extractHypothesesFromContent = (content: string): string[] => {
  const hypotheses: string[] = []
  // Match hypothesis function names and their claims
  const funcRegex = /async function (h\d+_\w+)\(\)/g
  const claimRegex = /Hypothesis: ([^\n"]+)/g

  let match: RegExpExecArray | null
  while ((match = funcRegex.exec(content)) !== null) {
    hypotheses.push(match[1])
  }

  const claims: string[] = []
  while ((match = claimRegex.exec(content)) !== null) {
    claims.push(match[1])
  }

  return hypotheses.map((h, i) => `${h}: ${claims[i] || "No claim found"}`)
}

// Derive pattern from spike content
const deriveDomainFromContent = (content: string): string => {
  const lowerContent = content.toLowerCase()
  if (lowerContent.includes("datetime") || lowerContent.includes("timestamp")) return "datetime"
  if (lowerContent.includes("schema") && lowerContent.includes("encod")) return "encoding"
  if (lowerContent.includes("option") && (lowerContent.includes("null") || lowerContent.includes("none"))) return "option-encoding"
  if (lowerContent.includes("state") && (lowerContent.includes("pollut") || lowerContent.includes("shared"))) return "state-pollution"
  if (lowerContent.includes("import") || lowerContent.includes("circular")) return "import-issues"
  if (lowerContent.includes("layer") || lowerContent.includes("context")) return "effect-layer"
  return "general"
}

// =============================================================================
// Setup Execution (directory/file scaffolding)
// =============================================================================

const FILE_TEMPLATES: Record<string, (vars: Record<string, string>) => string> = {
  "effect-service": (vars) => `import { Effect, Context, Layer } from "effect"

export class ${vars.name || "MyService"} extends Context.Tag("${vars.name || "MyService"}")<
  ${vars.name || "MyService"},
  {
    readonly run: () => Effect.Effect<void>
  }
>() {
  static Default = Layer.succeed(this, {
    run: () => Effect.log("${vars.name || "MyService"} running"),
  })
}
`,
  "test-fixture": (vars) => `// Test fixture for ${vars.name || "spike"}
export const fixture = ${JSON.stringify(vars.data || {}, null, 2)}
`,
}

const executeSetup = (setup: typeof SpikeSetup.Type, baseDir: string): Effect.Effect<string[], string> =>
  Effect.gen(function* () {
    const created: string[] = []

    // 1. Create directories
    if (setup.directories?.length) {
      for (const dir of setup.directories) {
        const fullPath = path.join(baseDir, dir)
        yield* Effect.promise(() => fs.mkdir(fullPath, { recursive: true })).pipe(
          Effect.mapError(() => `Failed to create directory: ${fullPath}`)
        )
        created.push(`📁 ${dir}`)
      }
    }

    // 2. Create files
    if (setup.files?.length) {
      for (const file of setup.files) {
        const fullPath = path.join(baseDir, file.path)
        const dir = path.dirname(fullPath)

        // Ensure parent directory exists
        yield* Effect.promise(() => fs.mkdir(dir, { recursive: true })).pipe(
          Effect.catchAll(() => Effect.void)
        )

        let content = ""
        if (file.content) {
          content = file.content
        } else if (file.template && FILE_TEMPLATES[file.template]) {
          content = FILE_TEMPLATES[file.template](file.vars || {})
        } else {
          content = `// Generated file: ${file.path}\n`
        }

        yield* Effect.promise(() => fs.writeFile(fullPath, content)).pipe(
          Effect.mapError(() => `Failed to create file: ${fullPath}`)
        )
        created.push(`📄 ${file.path}`)
      }
    }

    // 3. Write fixtures file if provided
    if (setup.fixtures && Object.keys(setup.fixtures).length > 0) {
      const fixturesPath = path.join(baseDir, "fixtures.json")
      yield* Effect.promise(() =>
        fs.writeFile(fixturesPath, JSON.stringify(setup.fixtures, null, 2))
      ).pipe(Effect.mapError(() => `Failed to write fixtures: ${fixturesPath}`))
      created.push(`📄 fixtures.json`)
    }

    return created
  })

// =============================================================================
// Template Generators
// =============================================================================

function generateConfigTemplate(name: string, minified = false): string {
  const today = new Date().toISOString().split("T")[0]
  const config = {
    $schema: "./spike-config.schema.json",
    metadata: {
      name,
      topic: `Investigation: ${name}`,
      author: "Val",
      date: today,
      relatedFiles: [] as string[],
      expectedOutcome: "Identify root cause and extract fix",
    },
    paths: {
      outputDir: "scripts",
      outputFilename: `spike-${name}.ts`,
    },
    setup: {
      directories: [] as string[],
      files: [] as Array<{ path: string; content?: string; template?: string; vars?: Record<string, string> }>,
      fixtures: {} as Record<string, unknown>,
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
  }

  return minified ? JSON.stringify(config) : JSON.stringify(config, null, 2)
}

// Generate a minified single-line config (for embedding/piping)
function generateMinifiedConfig(name: string, topic: string, hypotheses: Array<{ id: string; desc: string; claim: string }>): string {
  return JSON.stringify({
    metadata: { name, topic },
    hypotheses: hypotheses.map((h) => ({ id: h.id, description: h.desc, claim: h.claim })),
  })
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

        // Execute setup if provided (create directories, files, fixtures)
        let setupResults: string[] = []
        if (config.setup) {
          const baseDir = config.paths?.outputDir || "scripts"
          setupResults = yield* executeSetup(config.setup, baseDir).pipe(
            Effect.catchAll((e) => {
              return Effect.gen(function* () {
                yield* Console.log(`⚠️  Setup error: ${e}`)
                return [] as string[]
              })
            })
          )
        }

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

        // Show setup results if any
        if (setupResults.length > 0) {
          yield* Console.log(``)
          yield* Console.log(`🏗️  SETUP SCAFFOLDING:`)
          for (const item of setupResults) {
            yield* Console.log(`   ${item}`)
          }
        }

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

        // Emit steering message for LLM/hook consumption
        yield* Console.log(``)
        yield* Console.log(`<!-- SPIKE_STEERING`)
        yield* Console.log(JSON.stringify({
          action: "IMPLEMENT_SPIKE",
          file: filename,
          hypotheses: config.hypotheses.map(h => h.id),
          nextCommand: `bun spike run ${filename} --verbose`,
          skills: ["spike-testing"],
        }))
        yield* Console.log(`-->`)
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
// spike learn <file> [--fix "description"]
// =============================================================================
const learnFile = Args.text({ name: "file" }).pipe(
  Args.withDescription("Path to completed spike file to extract learnings from")
)
const fixDescription = Options.text("fix").pipe(
  Options.withAlias("f"),
  Options.optional,
  Options.withDescription("Description of the fix that was applied")
)

const learnCommand = Command.make(
  "learn",
  { learnFile, fixDescription },
  ({ learnFile, fixDescription }) =>
    Effect.gen(function* () {
      yield* Console.log(``)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      yield* Console.log(`🧠 LEARNING EXTRACTION: ${learnFile}`)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

      // 1. Read spike file
      const content = yield* Effect.promise(() => fs.readFile(learnFile, "utf-8")).pipe(
        Effect.mapError(() => `Could not read spike file: ${learnFile}`)
      )

      // 2. Extract spike metadata
      const hypotheses = extractHypothesesFromContent(content)
      const domain = deriveDomainFromContent(content)

      // 3. Derive pattern ID from filename
      const filename = path.basename(learnFile, ".ts")
      const patternId = filename.replace(/^(spike-|diagnose-)/, "")

      yield* Console.log(``)
      yield* Console.log(`📊 PATTERN IDENTIFIED:`)
      yield* Console.log(`   ID: ${patternId}`)
      yield* Console.log(`   Domain: ${domain}`)
      yield* Console.log(`   Hypotheses found: ${hypotheses.length}`)

      // 4. Load existing store (convert to mutable)
      const loadedStore = yield* loadPatternStore().pipe(
        Effect.catchAll(() =>
          Effect.succeed({
            version: "1.0" as const,
            patterns: [],
            lastEvolved: null,
          })
        )
      )

      // Create mutable copy
      const store: {
        version: "1.0"
        patterns: SpikePattern[]
        lastEvolved: string | null
      } = {
        version: "1.0",
        patterns: [...loadedStore.patterns] as unknown as SpikePattern[],
        lastEvolved: loadedStore.lastEvolved,
      }

      // 5. Find or create pattern
      const existingIndex = store.patterns.findIndex((p) => p.id === patternId)
      const isNew = existingIndex === -1
      const today = new Date().toISOString().split("T")[0]

      // Create mutable pattern object
      type MutablePattern = {
        id: string
        errorSignature: string
        domain: string
        hypothesisTemplate: Array<{ id: string; description: string; claim: string; acceptanceCriteria?: string[] }>
        successCount: number
        failureCount: number
        lastUsed: string | null
        fixes: Array<{ rootCause: string; fix: string; appliedAt: string }>
        tags: string[]
      }

      let pattern: MutablePattern
      if (isNew) {
        // Create new pattern
        pattern = {
          id: patternId,
          errorSignature: domain,
          domain,
          hypothesisTemplate: hypotheses.map((h, i) => ({
            id: `H${i + 1}`,
            description: h.split(":")[0] || `Hypothesis ${i + 1}`,
            claim: h.split(":")[1]?.trim() || "No claim extracted",
          })),
          successCount: 0,
          failureCount: 0,
          lastUsed: null,
          fixes: [],
          tags: [domain, "spike"],
        }
        store.patterns.push(pattern as unknown as SpikePattern)
      } else {
        // Convert existing to mutable
        const existing = store.patterns[existingIndex]
        pattern = {
          ...existing,
          hypothesisTemplate: [...existing.hypothesisTemplate],
          fixes: [...existing.fixes],
          tags: [...existing.tags],
        } as MutablePattern
        store.patterns[existingIndex] = pattern as unknown as SpikePattern
      }

      // 6. Update pattern statistics (assume success if --fix provided)
      const fixText = Option.getOrElse(fixDescription, () => "")
      if (fixText) {
        pattern.successCount += 1
        pattern.fixes.push({
          rootCause: patternId,
          fix: fixText,
          appliedAt: today,
        })
      } else {
        // Without a fix, mark as a data point but don't count as success
        pattern.failureCount += 1
      }
      pattern.lastUsed = today

      // 7. Save updated store
      yield* savePatternStore(store).pipe(
        Effect.catchAll((e) => {
          return Console.log(`⚠️  Could not save pattern store: ${e}`)
        })
      )

      // 8. Calculate success rate
      const rate = successRate(pattern)
      const ratePercent = Math.round(rate * 100)

      yield* Console.log(``)
      yield* Console.log(`📈 STATISTICS UPDATED:`)
      yield* Console.log(`   Success count: ${pattern.successCount}`)
      yield* Console.log(`   Failure count: ${pattern.failureCount}`)
      yield* Console.log(`   Success rate: ${ratePercent}%`)
      yield* Console.log(`   Status: ${isNew ? "🆕 NEW" : "📝 UPDATED"}`)

      // 9. Store to opc memory if fix provided
      if (fixText) {
        yield* Console.log(``)
        const stored = yield* storeToOpcMemory({
          sessionId: `spike-${patternId}`,
          type: "WORKING_SOLUTION",
          content: fixText,
          context: `Spike debugging: ${domain}`,
          tags: [domain, "spike", patternId],
          confidence: "high",
        })

        if (stored) {
          yield* Console.log(`💾 STORED TO MEMORY:`)
          yield* Console.log(`   Type: WORKING_SOLUTION`)
          yield* Console.log(`   Tags: ${domain}, spike, ${patternId}`)
        } else {
          yield* Console.log(`ℹ️  Memory storage skipped (opc not available)`)
        }

        yield* Console.log(``)
        yield* Console.log(`📝 FIX RECORDED:`)
        yield* Console.log(`   "${fixText}"`)
      }

      yield* Console.log(``)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    })
).pipe(Command.withDescription("Extract learnings from a completed spike"))

// =============================================================================
// spike suggest "<error-message>"
// =============================================================================
const errorMessage = Args.text({ name: "error" }).pipe(
  Args.withDescription("Error message to analyze for suggestions")
)

const suggestCommand = Command.make(
  "suggest",
  { errorMessage },
  ({ errorMessage }) =>
    Effect.gen(function* () {
      yield* Console.log(``)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      yield* Console.log(`🔮 HYPOTHESIS SUGGESTIONS`)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      yield* Console.log(``)
      yield* Console.log(`Error: "${errorMessage}"`)

      // 1. Load pattern store
      const store = yield* loadPatternStore().pipe(
        Effect.catchAll(() =>
          Effect.succeed({
            version: "1.0" as const,
            patterns: [],
            lastEvolved: null,
          })
        )
      )

      // 2. Match error against pattern signatures
      const matches = store.patterns
        .filter((p) => {
          try {
            return new RegExp(p.errorSignature, "i").test(errorMessage)
          } catch {
            // If signature isn't valid regex, try simple includes
            return errorMessage.toLowerCase().includes(p.errorSignature.toLowerCase())
          }
        })
        .sort((a, b) => successRate(b) - successRate(a))

      // 3. Query opc memory for additional context
      const memories = yield* queryOpcMemory(errorMessage)

      if (matches.length === 0 && memories.length === 0) {
        yield* Console.log(``)
        yield* Console.log(`❌ NO MATCHING PATTERNS FOUND`)
        yield* Console.log(``)
        yield* Console.log(`📝 SUGGESTIONS:`)
        yield* Console.log(`   1. Create a new spike: bun spike init <descriptive-name>`)
        yield* Console.log(`   2. Define H1-H4 hypotheses based on the error`)
        yield* Console.log(`   3. After resolution: bun spike learn <file> --fix "..."`)
        yield* Console.log(``)
        yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        return
      }

      // 4. Display best match
      if (matches.length > 0) {
        const best = matches[0]
        const rate = Math.round(successRate(best) * 100)
        const uses = best.successCount + best.failureCount

        yield* Console.log(``)
        yield* Console.log(`🎯 BEST MATCH: ${best.id} (${rate}% success rate, ${uses} uses)`)
        yield* Console.log(``)
        yield* Console.log(`📋 SUGGESTED HYPOTHESES:`)
        yield* Console.log(``)

        for (const h of best.hypothesisTemplate) {
          yield* Console.log(`   ${h.id}: ${h.description}`)
          yield* Console.log(`       Claim: "${h.claim}"`)
          if (h.acceptanceCriteria?.length) {
            yield* Console.log(`       Test: ${h.acceptanceCriteria.join(", ")}`)
          }
          yield* Console.log(``)
        }

        // Show recent fixes from this pattern
        if (best.fixes.length > 0) {
          yield* Console.log(`📌 PREVIOUS FIXES FROM THIS PATTERN:`)
          for (const fix of best.fixes.slice(-3)) {
            yield* Console.log(`   • "${fix.fix}" (${fix.appliedAt})`)
          }
          yield* Console.log(``)
        }
      }

      // 5. Show related memories
      if (memories.length > 0) {
        yield* Console.log(`🧠 RELATED MEMORIES:`)
        for (const mem of memories) {
          yield* Console.log(`   • ${mem}`)
        }
        yield* Console.log(``)
      }

      // 6. Suggest next steps
      const suggestedName =
        matches.length > 0 ? matches[0].id : errorMessage.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)

      yield* Console.log(`📝 GENERATE SPIKE:`)
      yield* Console.log(`   bun spike init ${suggestedName}`)
      yield* Console.log(`   # Edit config with hypotheses above`)
      yield* Console.log(`   bun spike new --config spike-${suggestedName}.config.json`)
      yield* Console.log(``)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

      // Emit steering message for LLM/hook consumption
      const bestMatch = matches.length > 0 ? matches[0] : null
      yield* Console.log(``)
      yield* Console.log(`<!-- SPIKE_STEERING`)
      yield* Console.log(JSON.stringify({
        action: "CREATE_SPIKE",
        suggestedName,
        patternMatch: bestMatch?.id || null,
        hypotheses: bestMatch?.hypothesisTemplate.map(h => ({ id: h.id, claim: h.claim })) || [],
        nextCommand: `bun spike init ${suggestedName}`,
        skills: ["spike-testing"],
      }))
      yield* Console.log(`-->`)
    })
).pipe(Command.withDescription("Suggest hypotheses based on error message and past patterns"))

// =============================================================================
// spike stats [--evolve]
// =============================================================================
const evolve = Options.boolean("evolve").pipe(
  Options.withAlias("e"),
  Options.withDescription("Perform template evolution (prune bad patterns, promote good ones)")
)

const statsCommand = Command.make("stats", { evolve }, ({ evolve }) =>
  Effect.gen(function* () {
    yield* Console.log(``)
    yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    yield* Console.log(`📊 SPIKE PATTERN STATISTICS`)
    yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    // 1. Load pattern store
    const loadedStore = yield* loadPatternStore().pipe(
      Effect.catchAll(() =>
        Effect.succeed({
          version: "1.0" as const,
          patterns: [],
          lastEvolved: null,
        })
      )
    )

    if (loadedStore.patterns.length === 0) {
      yield* Console.log(``)
      yield* Console.log(`ℹ️  No patterns recorded yet.`)
      yield* Console.log(``)
      yield* Console.log(`📝 TO START:`)
      yield* Console.log(`   1. Run a spike: bun spike run <file>`)
      yield* Console.log(`   2. Record learning: bun spike learn <file> --fix "description"`)
      yield* Console.log(``)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      return
    }

    // Create mutable copy for evolution
    type MutableStore = {
      version: "1.0"
      patterns: Array<{
        id: string
        errorSignature: string
        domain: string
        hypothesisTemplate: Array<{ id: string; description: string; claim: string; acceptanceCriteria?: string[] }>
        successCount: number
        failureCount: number
        lastUsed: string | null
        fixes: Array<{ rootCause: string; fix: string; appliedAt: string }>
        tags: string[]
      }>
      lastEvolved: string | null
    }

    const store: MutableStore = {
      version: "1.0",
      patterns: loadedStore.patterns.map((p) => ({
        ...p,
        hypothesisTemplate: [...p.hypothesisTemplate],
        fixes: [...p.fixes],
        tags: [...p.tags],
      })),
      lastEvolved: loadedStore.lastEvolved,
    }

    // 2. Display statistics table
    yield* Console.log(``)
    yield* Console.log(`| Pattern             | Uses | Success | Rate  | Status     |`)
    yield* Console.log(`|---------------------|------|---------|-------|------------|`)

    let totalUses = 0
    let totalSuccess = 0
    const evolutionActions: string[] = []

    const sortedPatterns = store.patterns.slice().sort((a, b) => successRate(b as unknown as SpikePattern) - successRate(a as unknown as SpikePattern))

    for (const p of sortedPatterns) {
      const uses = p.successCount + p.failureCount
      const rate = Math.round(successRate(p as unknown as SpikePattern) * 100)
      totalUses += uses
      totalSuccess += p.successCount

      let status = "📝 ACTIVE"
      if (uses >= 5 && rate >= 70) {
        status = "⬆️ PROVEN"
        evolutionActions.push(`• Promote ${p.id} to default template`)
      } else if (uses >= 5 && rate < 30) {
        status = "⚠️ REVIEW"
        evolutionActions.push(`• Flag ${p.id} for review (low success rate)`)
      } else if (uses < 3) {
        status = "🆕 NEW"
      }

      const paddedId = p.id.slice(0, 19).padEnd(19)
      const paddedUses = String(uses).padStart(4)
      const paddedSuccess = String(p.successCount).padStart(7)
      const paddedRate = `${rate}%`.padStart(5)
      const paddedStatus = status.padEnd(10)

      yield* Console.log(`| ${paddedId} | ${paddedUses} | ${paddedSuccess} | ${paddedRate} | ${paddedStatus} |`)
    }

    yield* Console.log(``)
    yield* Console.log(`Total patterns: ${store.patterns.length}`)
    yield* Console.log(`Total spike runs: ${totalUses}`)
    yield* Console.log(`Overall success rate: ${totalUses > 0 ? Math.round((totalSuccess / totalUses) * 100) : 0}%`)

    // 3. Show evolution actions
    if (evolutionActions.length > 0) {
      yield* Console.log(``)
      yield* Console.log(`🧬 EVOLUTION ACTIONS${evolve ? "" : " (--evolve to apply)"}:`)
      for (const action of evolutionActions) {
        yield* Console.log(`   ${action}`)
      }
    }

    // 4. Perform evolution if requested
    if (evolve) {
      yield* Console.log(``)
      yield* Console.log(`🧬 PERFORMING EVOLUTION...`)

      const today = new Date().toISOString().split("T")[0]
      let evolved = false

      // Archive low-performing patterns (move to end, mark in domain)
      for (const p of store.patterns) {
        const uses = p.successCount + p.failureCount
        const rate = successRate(p as unknown as SpikePattern)

        if (uses >= 5 && rate < 0.3 && !p.domain.startsWith("[ARCHIVED]")) {
          p.domain = `[ARCHIVED] ${p.domain}`
          evolved = true
          yield* Console.log(`   📦 Archived: ${p.id} (${Math.round(rate * 100)}% success rate)`)
        }
      }

      store.lastEvolved = today

      yield* savePatternStore(store as unknown as SpikePatternStore).pipe(
        Effect.catchAll((e) => Console.log(`⚠️  Could not save: ${e}`))
      )

      if (evolved) {
        yield* Console.log(``)
        yield* Console.log(`✅ Evolution complete. Store updated.`)
      } else {
        yield* Console.log(``)
        yield* Console.log(`ℹ️  No evolution needed at this time.`)
      }
    }

    yield* Console.log(``)
    yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  })
).pipe(Command.withDescription("Show pattern statistics and optionally evolve templates"))

// =============================================================================
// Main CLI
// =============================================================================
const spike = Command.make("spike", {}, () =>
  Console.log(`TMNL Spike Runner - Hypothesis-driven debugging (Autopoietic)

Commands:
  run <file>           Execute a spike file
  list                 List spike files
  init <name>          Generate spike config JSON template
  new <name>           Generate simple spike template
  new --config <file>  Generate spike from config JSON

  learn <file>         Extract learnings from completed spike
  suggest "<error>"    Get hypothesis suggestions for error
  stats                View pattern statistics
  stats --evolve       Evolve templates based on success rates

Examples:
  bun spike list
  bun spike new datetime-binding
  bun spike init sqlite-issue
  bun spike new --config spike-sqlite-issue.config.json
  bun spike run scripts/spike-datetime-binding.ts --verbose

  # Autopoietic workflow
  bun spike suggest "SQLITE_CONSTRAINT: NOT NULL"
  bun spike learn scripts/spike-datetime.ts --fix "Use DateTimeInsert"
  bun spike stats

Use --help with any command for more details.`)
)

const command = spike.pipe(
  Command.withSubcommands([runCommand, listCommand, initCommand, newCommand, learnCommand, suggestCommand, statsCommand])
)

const cli = Command.run(command, {
  name: "spike",
  version: "1.0.0",
})

cli(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain)
