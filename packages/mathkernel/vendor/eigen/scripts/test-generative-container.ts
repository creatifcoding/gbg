#!/usr/bin/env bun
/**
 * Test script for GenerativeContainer flow
 *
 * Tests:
 * 1. Direct API call to /ui-generate
 * 2. Nested prompt generation (simulating what GenerativeContainer does)
 * 3. Error handling and response parsing
 */

const API_URL = "http://localhost:7682/ui-generate"

// =============================================================================
// Test 1: Basic UI generation (parent level)
// =============================================================================

async function testBasicGeneration() {
  console.log("\n" + "=".repeat(60))
  console.log("TEST 1: Basic UI Generation")
  console.log("=".repeat(60))

  const prompt = "Generate a simple card with a title and button"

  console.log(`\nPrompt: "${prompt}"`)
  console.log("\nSending request...")

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    })

    console.log(`Response status: ${response.status}`)
    console.log(`Content-Type: ${response.headers.get("content-type")}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Error response:", errorText)
      return null
    }

    // Read streaming response
    const reader = response.body?.getReader()
    if (!reader) {
      console.error("No response body")
      return null
    }

    const decoder = new TextDecoder()
    let fullResponse = ""
    let lineCount = 0

    console.log("\nStreaming JSONL lines:")
    console.log("-".repeat(40))

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      fullResponse += chunk

      // Parse and display each line
      const lines = chunk.split("\n").filter(l => l.trim())
      for (const line of lines) {
        lineCount++
        try {
          const parsed = JSON.parse(line)
          console.log(`[${lineCount}] ${JSON.stringify(parsed)}`)
        } catch {
          console.log(`[${lineCount}] (parse error) ${line}`)
        }
      }
    }

    console.log("-".repeat(40))
    console.log(`Total lines: ${lineCount}`)

    return fullResponse
  } catch (error) {
    console.error("Request failed:", error)
    return null
  }
}

// =============================================================================
// Test 2: GenerativeContainer-style nested prompt
// =============================================================================

async function testNestedPrompt() {
  console.log("\n" + "=".repeat(60))
  console.log("TEST 2: Nested Prompt (GenerativeContainer style)")
  console.log("=".repeat(60))

  // This simulates what GenerativeContainer does internally
  const prompt = "Generate 3 metric cards in a Row: (1) Followers with count 1,234, (2) Posts with count 56, (3) Engagement Rate at 4.2%"
  const context = {
    _depth: 1,
    _parentPrompts: ["Generate a dashboard with analytics"]
  }

  console.log(`\nPrompt: "${prompt}"`)
  console.log(`Context: ${JSON.stringify(context)}`)
  console.log("\nSending request...")

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, context })
    })

    console.log(`Response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Error response:", errorText)
      return null
    }

    const reader = response.body?.getReader()
    if (!reader) return null

    const decoder = new TextDecoder()
    let lineCount = 0
    let hasGenerativeContainer = false

    console.log("\nStreaming JSONL lines:")
    console.log("-".repeat(40))

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split("\n").filter(l => l.trim())

      for (const line of lines) {
        lineCount++
        try {
          const parsed = JSON.parse(line)

          // Check if any element is a GenerativeContainer
          if (parsed.value?.type === "GenerativeContainer") {
            hasGenerativeContainer = true
            console.log(`[${lineCount}] ⚠️  NESTED GenerativeContainer: ${JSON.stringify(parsed)}`)
          } else {
            console.log(`[${lineCount}] ${JSON.stringify(parsed)}`)
          }
        } catch {
          console.log(`[${lineCount}] (parse error) ${line}`)
        }
      }
    }

    console.log("-".repeat(40))
    console.log(`Total lines: ${lineCount}`)
    console.log(`Contains nested GenerativeContainer: ${hasGenerativeContainer}`)

    return { lineCount, hasGenerativeContainer }
  } catch (error) {
    console.error("Request failed:", error)
    return null
  }
}

// =============================================================================
// Test 3: Request that SHOULD trigger GenerativeContainer
// =============================================================================

async function testDashboardWithContainers() {
  console.log("\n" + "=".repeat(60))
  console.log("TEST 3: Dashboard with GenerativeContainers")
  console.log("=".repeat(60))

  const prompt = "Create a dashboard with 3 side-by-side panels using GenerativeContainer. Left panel: user stats. Center panel: activity feed. Right panel: quick actions."

  console.log(`\nPrompt: "${prompt}"`)
  console.log("\nSending request...")

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    })

    console.log(`Response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Error response:", errorText)
      return null
    }

    const reader = response.body?.getReader()
    if (!reader) return null

    const decoder = new TextDecoder()
    let lineCount = 0
    const generativeContainers: any[] = []

    console.log("\nStreaming JSONL lines:")
    console.log("-".repeat(40))

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split("\n").filter(l => l.trim())

      for (const line of lines) {
        lineCount++
        try {
          const parsed = JSON.parse(line)

          if (parsed.value?.type === "GenerativeContainer") {
            generativeContainers.push(parsed.value)
            console.log(`[${lineCount}] 🎯 GenerativeContainer: prompt="${parsed.value.props?.prompt?.substring(0, 50)}..."`)
          } else {
            console.log(`[${lineCount}] ${parsed.op}:${parsed.path} → ${parsed.value?.type || parsed.value}`)
          }
        } catch {
          console.log(`[${lineCount}] (parse error) ${line.substring(0, 80)}...`)
        }
      }
    }

    console.log("-".repeat(40))
    console.log(`Total lines: ${lineCount}`)
    console.log(`GenerativeContainers found: ${generativeContainers.length}`)

    if (generativeContainers.length > 0) {
      console.log("\nGenerativeContainer prompts:")
      generativeContainers.forEach((gc, i) => {
        console.log(`  ${i + 1}. "${gc.props?.prompt}"`)
      })
    }

    return { lineCount, generativeContainers }
  } catch (error) {
    console.error("Request failed:", error)
    return null
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("GenerativeContainer Flow Test")
  console.log("Server:", API_URL)

  // Run tests sequentially
  await testBasicGeneration()
  await testNestedPrompt()
  const dashboardResult = await testDashboardWithContainers()

  // Summary
  console.log("\n" + "=".repeat(60))
  console.log("SUMMARY")
  console.log("=".repeat(60))

  if (dashboardResult && dashboardResult.generativeContainers.length > 0) {
    console.log("✅ GenerativeContainers ARE being generated by the AI")
    console.log("   Issue is likely in the React rendering/registry side")
  } else {
    console.log("❌ GenerativeContainers are NOT being generated")
    console.log("   Issue is in the system prompt or AI generation")
  }
}

main().catch(console.error)
