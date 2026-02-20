#!/usr/bin/env bun
/**
 * Debug: trace exactly what findJsonBlocks produces for truncated input
 */
import { Effect } from "effect"
import { extractJson } from "../../src/lib/genifer/core/normalize"

const truncated = `{
  "type": "Page",
  "key": "dashboard",
  "props": { "title": "DevOps" },
  "children": [
    { "type": "Card", "key": "c1", "props": { "title": "Stats" } },
    { "type": "Card", "key": "c2", "props": { "title": "Char`

console.log("=== Input (truncated) ===")
console.log(truncated)
console.log("\n=== extractJson output ===")
try {
  const result = Effect.runSync(extractJson(truncated))
  console.log(result)
  console.log("\n=== JSON.parse attempt ===")
  try {
    const parsed = JSON.parse(result)
    console.log("SUCCESS:", JSON.stringify(parsed, null, 2).slice(0, 500))
  } catch (e: any) {
    console.log("PARSE FAIL:", e.message)
    // Show the tail where it breaks
    console.log("Last 80 chars:", JSON.stringify(result.slice(-80)))
  }
} catch (e: any) {
  console.log("EXTRACT FAIL:", e.message ?? String(e))
}
