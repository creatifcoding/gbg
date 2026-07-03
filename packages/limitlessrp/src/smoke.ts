import { readFile } from "node:fs/promises"
import { createEmptyIridiumIntake, buildAnalysisMemo, renderMarkdownMemo, type SourceRegistryEntry } from "./index.js"

const registryText = await readFile(new URL("../data/sources/iridium.sources.json", import.meta.url), "utf8")
const registry = JSON.parse(registryText) as SourceRegistryEntry[]

if (!Array.isArray(registry) || registry.length < 5) {
  throw new Error(`Expected at least 5 source registry entries, got ${Array.isArray(registry) ? registry.length : "non-array"}`)
}

const intake = createEmptyIridiumIntake()
const memo = buildAnalysisMemo(intake)
const markdown = renderMarkdownMemo(memo)

if (!markdown.includes("Non-Advisory Notice")) throw new Error("memo missing non-advisory notice")
if (memo.redFlags.length < 3) throw new Error("expected red flags for empty intake")

console.log(JSON.stringify({ ok: true, sources: registry.length, missing: memo.missingDetails.length, redFlags: memo.redFlags.length }, null, 2))
