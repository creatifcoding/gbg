/**
 * Spike Template Generators
 *
 * Functions for generating spike files, configs, and scaffolding.
 *
 * @skill spikectl/core
 */

import type { SpikeConfig, SpikeSetup } from "../schemas/index.js"

// =============================================================================
// File Templates
// =============================================================================

export const FILE_TEMPLATES: Record<string, (vars: Record<string, string>) => string> = {
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

// =============================================================================
// Config Template Generator
// =============================================================================

export const generateConfigTemplate = (name: string, minified = false): string => {
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

// =============================================================================
// Simple Spike Template
// =============================================================================

export const generateSpikeTemplate = (name: string, topic: string): string => {
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

// =============================================================================
// Config-Based Spike Generator
// =============================================================================

export const generateSpikeFromConfig = (config: SpikeConfig): string => {
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
// Content Analysis Utilities
// =============================================================================

export const extractHypothesesFromContent = (content: string): string[] => {
  const hypotheses: string[] = []
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

export const deriveDomainFromContent = (content: string): string => {
  const lowerContent = content.toLowerCase()
  if (lowerContent.includes("datetime") || lowerContent.includes("timestamp")) return "datetime"
  if (lowerContent.includes("schema") && lowerContent.includes("encod")) return "encoding"
  if (lowerContent.includes("option") && (lowerContent.includes("null") || lowerContent.includes("none"))) return "option-encoding"
  if (lowerContent.includes("state") && (lowerContent.includes("pollut") || lowerContent.includes("shared"))) return "state-pollution"
  if (lowerContent.includes("import") || lowerContent.includes("circular")) return "import-issues"
  if (lowerContent.includes("layer") || lowerContent.includes("context")) return "effect-layer"
  return "general"
}
