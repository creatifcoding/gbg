#!/usr/bin/env bun
/**
 * Test raw JSONL streaming from cursor-server
 *
 * Shows exactly what bytes/lines are received and when
 */

const SERVER_URL = "http://localhost:7682/ui-generate"

async function main() {
  console.log("=== Raw JSONL Streaming Test ===")
  console.log(`Hitting: ${SERVER_URL}`)

  const startTime = Date.now()
  let lineCount = 0
  let totalBytes = 0

  const response = await fetch(SERVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "Create a simple card with a button" }),
  })

  if (!response.ok) {
    console.error(`HTTP error: ${response.status}`)
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    console.error("No response body")
    return
  }

  const decoder = new TextDecoder()
  let buffer = ""

  console.log("\n--- Streaming JSONL lines ---\n")

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const elapsed = Date.now() - startTime
    totalBytes += chunk.length

    // Show raw chunk info
    console.log(`[${elapsed}ms] CHUNK: ${chunk.length} bytes`)

    buffer += chunk

    // Process complete lines
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      lineCount++

      try {
        const parsed = JSON.parse(trimmed)
        const preview = parsed.path || "unknown"
        console.log(`  LINE ${lineCount}: ${preview} (${trimmed.length} chars)`)
      } catch {
        // Not valid JSON - might be partial or SSE format
        console.log(`  LINE ${lineCount}: [not JSON] "${trimmed.slice(0, 60)}..."`)
      }
    }
  }

  // Handle remaining buffer
  if (buffer.trim()) {
    try {
      const parsed = JSON.parse(buffer.trim())
      lineCount++
      console.log(`  LINE ${lineCount}: ${parsed.path || "unknown"} (final)`)
    } catch {
      console.log(`  REMAINING: "${buffer.trim().slice(0, 60)}..."`)
    }
  }

  const elapsed = Date.now() - startTime
  console.log("\n--- Summary ---")
  console.log(`Total time: ${elapsed}ms`)
  console.log(`Total bytes: ${totalBytes}`)
  console.log(`Total lines: ${lineCount}`)
  console.log(`Progressive: ${lineCount > 1 ? "YES ✓" : "NO ✗"}`)
}

main().catch(console.error)
