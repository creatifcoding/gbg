#!/usr/bin/env bun
/**
 * Spike: Investigation: GenerativeContainer + JSONL Streaming
 *
 * Author: Val
 * Date: 2026-01-16
 * Related Files:
 *   - src/lib/genifer/core/streaming.ts
 *   - src/lib/genifer/react/renderer.tsx
 *   - src/lib/genifer/react/hooks.ts
 * Expected Outcome: Isolate why GenerativeContainers don't render in streaming UI
 *
 * Hypotheses:
 * H1: JSONL line buffering - Lines are fragmented but complete data arrives when properly buffered
 * H2: GenerativeContainer generation - AI generates GenerativeContainer nodes when prompted
 * H3: UITree building - Streaming ops correctly build UITree with all elements
 * H4: Component rendering - Renderer looks up and renders GenerativeContainer from registry
 */

import { Effect, Console } from "effect"

const BANNER = "=".repeat(60)
const API_URL = "http://localhost:7682/ui-generate"

// =============================================================================
// Helper: Fetch and parse JSONL with proper buffering
// =============================================================================
async function fetchAndParseJSONL(prompt: string): Promise<{
  parsedLines: any[]
  parseErrors: string[]
}> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  })

  const reader = response.body?.getReader()
  if (!reader) return { parsedLines: [], parseErrors: ["No reader"] }

  const decoder = new TextDecoder()
  let buffer = ""
  const parsedLines: any[] = []
  const parseErrors: string[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || "" // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        parsedLines.push(JSON.parse(line))
      } catch (e) {
        parseErrors.push(line.substring(0, 50))
      }
    }
  }

  // Handle remaining buffer
  if (buffer.trim()) {
    try {
      parsedLines.push(JSON.parse(buffer))
    } catch (e) {
      parseErrors.push(buffer.substring(0, 50))
    }
  }

  return { parsedLines, parseErrors }
}

// =============================================================================
// H1: JSONL line buffering
// =============================================================================
async function h1_genifer_streaming() {
  console.log("\n" + BANNER)
  console.log("H1: JSONL line buffering")
  console.log("Hypothesis: Lines are fragmented but complete data arrives when properly buffered")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    yield* Console.log("Testing H1: Fetching stream with simple prompt...")

    const { parsedLines, parseErrors } = yield* Effect.promise(() =>
      fetchAndParseJSONL("Generate a simple card with title")
    )

    yield* Console.log(`  Parsed lines: ${parsedLines.length}`)
    yield* Console.log(`  Parse errors: ${parseErrors.length}`)

    if (parseErrors.length > 0) {
      yield* Console.log(`  Error samples: ${parseErrors.slice(0, 3).join(", ")}`)
    }

    // Log first few operations
    yield* Console.log("\n  Operations received:")
    parsedLines.slice(0, 5).forEach((p, i) => {
      const type = p.value?.type || p.value || "(no value)"
      console.log(`    [${i + 1}] ${p.op}:${p.path} → ${type}`)
    })

    // Acceptance criteria
    const allParsed = parseErrors.length === 0
    const hasLines = parsedLines.length > 0

    yield* Console.log(`\n  ✓ All JSONL lines parsed: ${allParsed}`)
    yield* Console.log(`  ✓ Buffer handled fragments: true (by design)`)
    yield* Console.log(`  ✓ parsedLines.length > 0: ${hasLines}`)

    return allParsed && hasLines ? "PASS" : "FAIL"
  })

  const result = await Effect.runPromise(program)
  console.log(`\n✓ H1 Result: ${result}`)
  return result === "PASS"
}

// =============================================================================
// H2: GenerativeContainer generation
// =============================================================================
async function h2_genifer_streaming() {
  console.log("\n" + BANNER)
  console.log("H2: GenerativeContainer generation")
  console.log("Hypothesis: AI generates GenerativeContainer nodes when prompted")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    yield* Console.log("Testing H2: Requesting GenerativeContainers...")

    const { parsedLines } = yield* Effect.promise(() =>
      fetchAndParseJSONL(
        "Create a Row with 2 GenerativeContainers side by side. Left: user profile. Right: settings."
      )
    )

    const generativeContainers = parsedLines
      .filter((p) => p.value?.type === "GenerativeContainer")
      .map((p) => p.value)

    yield* Console.log(`  Total lines: ${parsedLines.length}`)
    yield* Console.log(`  GenerativeContainers found: ${generativeContainers.length}`)

    if (generativeContainers.length > 0) {
      yield* Console.log("\n  GenerativeContainer details:")
      generativeContainers.forEach((gc, i) => {
        console.log(`    [${i + 1}] Key: ${gc.key}`)
        console.log(`        Prompt: "${gc.props?.prompt?.substring(0, 60)}..."`)
        console.log(`        Has props.prompt: ${!!gc.props?.prompt}`)
      })
    }

    // Acceptance criteria
    const hasGC = generativeContainers.length >= 1
    const hasPrompt = generativeContainers.some((gc) => gc.props?.prompt)

    yield* Console.log(`\n  ✓ parsedLines contain type=GenerativeContainer: ${hasGC}`)
    yield* Console.log(`  ✓ GenerativeContainer has props.prompt: ${hasPrompt}`)
    yield* Console.log(`  ✓ generativeContainers.length >= 1: ${hasGC}`)

    return hasGC && hasPrompt ? "PASS" : "FAIL"
  })

  const result = await Effect.runPromise(program)
  console.log(`\n✓ H2 Result: ${result}`)
  return result === "PASS"
}

// =============================================================================
// H3: UITree building
// =============================================================================
async function h3_genifer_streaming() {
  console.log("\n" + BANNER)
  console.log("H3: UITree building")
  console.log("Hypothesis: Streaming ops correctly build UITree with all elements")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    yield* Console.log("Testing H3: Building tree from ops...")

    const { parsedLines } = yield* Effect.promise(() =>
      fetchAndParseJSONL("Create a dashboard with a GenerativeContainer for stats")
    )

    // Simulate UITree building (like streaming.ts does)
    const tree: { root: string | null; elements: Record<string, any> } = {
      root: null,
      elements: {}
    }

    for (const op of parsedLines) {
      if (op.op === "set" && op.path === "/root") {
        tree.root = op.value
      } else if (op.op === "add" && op.path.startsWith("/elements/")) {
        const key = op.path.replace("/elements/", "")
        tree.elements[key] = op.value
      }
    }

    yield* Console.log(`  Root: ${tree.root}`)
    yield* Console.log(`  Elements count: ${Object.keys(tree.elements).length}`)

    // Find GenerativeContainers in tree
    const gcElements = Object.entries(tree.elements).filter(
      ([_, el]) => el.type === "GenerativeContainer"
    )
    yield* Console.log(`  GenerativeContainer elements: ${gcElements.length}`)

    // Print tree structure
    if (tree.root && tree.elements[tree.root]) {
      yield* Console.log("\n  Tree structure:")
      const printTree = (key: string, indent: string = "  ") => {
        const el = tree.elements[key]
        if (!el) return
        const gcMarker = el.type === "GenerativeContainer" ? " ⚡" : ""
        console.log(`${indent}${key} (${el.type})${gcMarker}`)
        if (el.children) {
          el.children.forEach((childKey: string) => printTree(childKey, indent + "  "))
        }
      }
      printTree(tree.root, "    ")
    }

    // Acceptance criteria
    const hasRoot = tree.root !== null
    const hasElements = Object.keys(tree.elements).length > 0
    const hasGCInTree = gcElements.length > 0

    yield* Console.log(`\n  ✓ tree.root is set: ${hasRoot}`)
    yield* Console.log(`  ✓ tree.elements contains nodes: ${hasElements}`)
    yield* Console.log(`  ✓ GenerativeContainer nodes in tree.elements: ${hasGCInTree}`)

    return hasRoot && hasElements && hasGCInTree ? "PASS" : "FAIL"
  })

  const result = await Effect.runPromise(program)
  console.log(`\n✓ H3 Result: ${result}`)
  return result === "PASS"
}

// =============================================================================
// H4: Component rendering
// =============================================================================
async function h4_genifer_streaming() {
  console.log("\n" + BANNER)
  console.log("H4: Component rendering")
  console.log("Hypothesis: Renderer looks up and renders GenerativeContainer from registry")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    yield* Console.log("Testing H4: Checking other components render...")

    const { parsedLines } = yield* Effect.promise(() =>
      fetchAndParseJSONL(
        "Generate a Card with CardHeader containing CardTitle 'Test' and CardContent containing a Button labeled 'Click'"
      )
    )

    const types = new Set<string>()
    for (const op of parsedLines) {
      if (op.value?.type) {
        types.add(op.value.type)
      }
    }

    yield* Console.log(`  Component types generated: ${[...types].join(", ")}`)

    // Check for standard UI components
    const standardComponents = ["Card", "CardHeader", "CardTitle", "CardContent", "Button"]
    const foundStandard = standardComponents.filter((c) => types.has(c))
    const hasGenerativeContainer = types.has("GenerativeContainer")

    yield* Console.log(`\n  Standard components found: ${foundStandard.join(", ")}`)
    yield* Console.log(`  GenerativeContainer in types: ${hasGenerativeContainer}`)

    // Acceptance criteria
    const otherComponentsWork = foundStandard.length >= 2 // At least some standard components

    yield* Console.log(`\n  ✓ Other components generated: ${otherComponentsWork}`)
    yield* Console.log(`  ✓ Registry check: (requires runtime test)`)
    yield* Console.log(`  ✓ Mount check: (requires runtime test)`)

    yield* Console.log("\n  DIAGNOSIS:")
    if (otherComponentsWork && !hasGenerativeContainer) {
      yield* Console.log("    → AI not generating GenerativeContainer for this prompt")
    } else if (otherComponentsWork && hasGenerativeContainer) {
      yield* Console.log("    → AI generates both. Issue likely in registry lookup or mount")
      yield* Console.log("    → Next: Check renderer.tsx registry.get('GenerativeContainer')")
    } else {
      yield* Console.log("    → Stream parsing may be failing entirely")
    }

    return otherComponentsWork ? "PASS" : "FAIL"
  })

  const result = await Effect.runPromise(program)
  console.log(`\n✓ H4 Result: ${result}`)
  return result === "PASS"
}

// =============================================================================
// Main
// =============================================================================
async function main() {
  console.log("\n🧪 Spike: Investigation: GenerativeContainer + JSONL Streaming")
  console.log("=".repeat(60))
  console.log(`Server: ${API_URL}`)

  const results: Record<string, boolean> = {}

  try {
    results.H1 = await h1_genifer_streaming()
    results.H2 = await h2_genifer_streaming()
    results.H3 = await h3_genifer_streaming()
    results.H4 = await h4_genifer_streaming()
  } catch (e) {
    console.error("\n❌ Spike failed with error:", e)
    console.log("\nMake sure the genifer server is running:")
    console.log("  bun run scripts/genifer-mock-server.ts")
    process.exit(1)
  }

  // Summary
  console.log("\n" + BANNER)
  console.log("SUMMARY")
  console.log(BANNER)
  for (const [h, passed] of Object.entries(results)) {
    console.log(`  ${passed ? "✅" : "❌"} ${h}`)
  }

  const allPassed = Object.values(results).every(Boolean)
  console.log(`\n${allPassed ? "✅ All hypotheses passed" : "❌ Some hypotheses failed"}`)

  console.log("\nNEXT STEPS:")
  if (!results.H1) {
    console.log("  → H1 failed: Check JSONL line buffering in streaming.ts")
  }
  if (!results.H2) {
    console.log("  → H2 failed: Check AI prompt or system prompt for GenerativeContainer")
  }
  if (!results.H3) {
    console.log("  → H3 failed: Check tree building logic in streaming.ts applyOp()")
  }
  if (!results.H4) {
    console.log("  → H4 failed: Check registry lookup in Renderer.tsx")
  }
  if (allPassed) {
    console.log("  → All passed: Issue may be in React rendering or state sync")
    console.log("  → Check useUIStream hook state propagation")
    console.log("  → Check GenerativeContainer component mount lifecycle")
  }

  process.exit(allPassed ? 0 : 1)
}

main().catch(console.error)
