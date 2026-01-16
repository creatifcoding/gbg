#!/usr/bin/env bun
/**
 * Diagnostic spikes for GenerativeContainer issues
 *
 * Hypotheses:
 * H1: JSONL buffering in streaming.ts doesn't handle cross-chunk lines
 * H2: GenerativeContainer not in registry (silent failure)
 * H3: Renderer can't find GenerativeContainer component
 * H4: useUIStream not properly accumulating tree state
 */

const API_URL = "http://localhost:7682/ui-generate"

// =============================================================================
// SPIKE 1: Test if complete JSONL lines arrive when we buffer properly
// =============================================================================

async function spike1_properBuffering() {
  console.log("\n" + "=".repeat(60))
  console.log("SPIKE 1: Proper JSONL Buffering")
  console.log("Hypothesis: Lines are fragmented but complete data arrives")
  console.log("=".repeat(60))

  const prompt = "Generate a simple card with title"

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  })

  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ""  // Accumulate partial lines
  const parsedLines: any[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Split on newlines but keep incomplete last line in buffer
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""  // Keep incomplete line

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line)
        parsedLines.push(parsed)
      } catch (e) {
        console.log(`  PARSE ERROR: ${line.substring(0, 50)}...`)
      }
    }
  }

  // Handle any remaining buffer
  if (buffer.trim()) {
    try {
      parsedLines.push(JSON.parse(buffer))
    } catch (e) {
      console.log(`  FINAL PARSE ERROR: ${buffer.substring(0, 50)}...`)
    }
  }

  console.log(`\n✓ Successfully parsed ${parsedLines.length} JSONL lines`)
  console.log("\nParsed operations:")
  parsedLines.forEach((p, i) => {
    const type = p.value?.type || p.value
    console.log(`  [${i + 1}] ${p.op}:${p.path} → ${type}`)
  })

  return parsedLines
}

// =============================================================================
// SPIKE 2: Test GenerativeContainer generation with buffering
// =============================================================================

async function spike2_checkGenerativeContainerGeneration() {
  console.log("\n" + "=".repeat(60))
  console.log("SPIKE 2: Check GenerativeContainer Generation")
  console.log("Hypothesis: AI generates GenerativeContainer when asked")
  console.log("=".repeat(60))

  const prompt = "Create a Row with 2 GenerativeContainers side by side. Left: user profile. Right: settings."

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  })

  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ""
  const parsedLines: any[] = []
  const generativeContainers: any[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line)
        parsedLines.push(parsed)
        if (parsed.value?.type === "GenerativeContainer") {
          generativeContainers.push(parsed.value)
        }
      } catch (e) {
        // Skip parse errors
      }
    }
  }

  console.log(`\n✓ Parsed ${parsedLines.length} lines`)
  console.log(`✓ Found ${generativeContainers.length} GenerativeContainers`)

  if (generativeContainers.length > 0) {
    console.log("\nGenerativeContainer details:")
    generativeContainers.forEach((gc, i) => {
      console.log(`\n  [${i + 1}] Key: ${gc.key}`)
      console.log(`      Prompt: "${gc.props?.prompt?.substring(0, 60)}..."`)
    })
  }

  return { parsedLines, generativeContainers }
}

// =============================================================================
// SPIKE 3: Simulate what useUIStream does - apply ops to tree
// =============================================================================

async function spike3_simulateUITree() {
  console.log("\n" + "=".repeat(60))
  console.log("SPIKE 3: Simulate UITree Building")
  console.log("Hypothesis: Tree building from ops works correctly")
  console.log("=".repeat(60))

  const prompt = "Create a dashboard with a GenerativeContainer for stats"

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  })

  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ""

  // Simulate UITree
  const tree: { root: string | null; elements: Record<string, any> } = {
    root: null,
    elements: {}
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const op = JSON.parse(line)

        // Apply operation to tree (simulate applyOp from streaming.ts)
        if (op.op === "set" && op.path === "/root") {
          tree.root = op.value
        } else if (op.op === "add" && op.path.startsWith("/elements/")) {
          const key = op.path.replace("/elements/", "")
          tree.elements[key] = op.value
        }
      } catch (e) {
        // Skip
      }
    }
  }

  console.log(`\n✓ Tree built:`)
  console.log(`  Root: ${tree.root}`)
  console.log(`  Elements: ${Object.keys(tree.elements).length}`)

  // Find GenerativeContainers in tree
  const gcElements = Object.entries(tree.elements)
    .filter(([_, el]) => el.type === "GenerativeContainer")

  console.log(`\n  GenerativeContainer elements: ${gcElements.length}`)
  gcElements.forEach(([key, el]) => {
    console.log(`    - ${key}: prompt="${el.props?.prompt?.substring(0, 50)}..."`)
  })

  // Check tree structure
  console.log("\n  Tree structure:")
  if (tree.root && tree.elements[tree.root]) {
    const printTree = (key: string, indent: string = "  ") => {
      const el = tree.elements[key]
      if (!el) return
      const gcMarker = el.type === "GenerativeContainer" ? " ⚡" : ""
      console.log(`${indent}${key} (${el.type})${gcMarker}`)
      if (el.children) {
        el.children.forEach((childKey: string) => printTree(childKey, indent + "  "))
      }
    }
    printTree(tree.root)
  }

  return tree
}

// =============================================================================
// SPIKE 4: Check if simple non-GenerativeContainer rendering works
// =============================================================================

async function spike4_simpleRendering() {
  console.log("\n" + "=".repeat(60))
  console.log("SPIKE 4: Simple Component Check")
  console.log("Hypothesis: Other components render, only GenerativeContainer fails")
  console.log("=".repeat(60))

  const prompt = "Generate a Card with CardHeader containing CardTitle 'Test' and CardContent containing a Button labeled 'Click'"

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  })

  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ""
  const types = new Set<string>()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const op = JSON.parse(line)
        if (op.value?.type) {
          types.add(op.value.type)
        }
      } catch (e) {}
    }
  }

  console.log(`\n✓ Component types generated: ${[...types].join(", ")}`)
  console.log("\nIf these render but GenerativeContainer doesn't, the issue is:")
  console.log("  → Registry lookup for 'GenerativeContainer'")
  console.log("  → Or GenerativeContainer component itself")
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("GenerativeContainer Diagnostic Spikes")
  console.log("Server:", API_URL)

  await spike1_properBuffering()
  await spike2_checkGenerativeContainerGeneration()
  await spike3_simulateUITree()
  await spike4_simpleRendering()

  console.log("\n" + "=".repeat(60))
  console.log("DIAGNOSTIC SUMMARY")
  console.log("=".repeat(60))
  console.log(`
If Spike 1 shows successful parsing → JSONL buffering in test was wrong
If Spike 2 shows GenerativeContainers → AI generation is working
If Spike 3 shows proper tree → streaming.ts tree building works
If Spike 4 shows other components → Registry/component issue

Next steps if GenerativeContainers ARE generated but don't render:
1. Check registry lookup in Renderer.tsx
2. Check GenerativeContainer component mounting
3. Add logging to Renderer when it looks up components
`)
}

main().catch(console.error)
