#!/usr/bin/env bun
/**
 * Debug: Fetch the same prompt and inspect the raw JSON structure
 */
import { Effect } from "effect"
import { UIElement, UITree } from "../../src/lib/genifer/core/schemas"
import { createCatalogLayer, getSystemPrompt, type DomainCatalog } from "../../src/lib/genifer/core/CatalogService"

const apiKey = process.env.OPENAI_API_KEY!
const MODEL = "gpt-4o-mini"

const catalog: DomainCatalog = {
  components: {
    Page: { description: "Top-level page. Children: Section", props: "title: string", hasChildren: true, renderer: () => null, defaultEntrance: { type: "fade", duration: 300 } },
    Section: { description: "Section. Children: Card, Grid", props: "title: string", hasChildren: true, renderer: () => null, defaultEntrance: { type: "fade", duration: 200 } },
    Card: { description: "Card. Children: Text, MetricCard", props: "title?: string", hasChildren: true, renderer: () => null, defaultEntrance: { type: "scale", duration: 200 } },
    MetricCard: { description: "KPI metric. Leaf.", props: "label: string, value: string", hasChildren: false, renderer: () => null, defaultEntrance: { type: "scale", duration: 150 } },
    Text: { description: "Text paragraph. Leaf.", props: "text: string", hasChildren: false, renderer: () => null, defaultEntrance: { type: "fade", duration: 100 } },
  },
}

const layer = createCatalogLayer(catalog)
const systemPrompt = Effect.runSync(getSystemPrompt.pipe(Effect.provide(layer)))

const prompt = `You are a JSON-only UI engine. Return ONLY valid JSON.

${systemPrompt}

Generate a Page with 2 Sections, each containing a Card with 2 MetricCards.
Every node needs type, key, props. Minimum 8 components.
JSON only, no markdown.`

const resp = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({
    model: MODEL,
    messages: [
      { role: "system", content: "JSON only." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 2000,
  }),
})

const data = await resp.json() as any
const raw = data.choices[0].message.content
console.log("=== RAW LLM OUTPUT ===")
console.log(raw)

// Parse and walk
let clean = raw.trim()
if (clean.startsWith("```")) clean = clean.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```\s*$/, "")

const parsed = JSON.parse(clean)
console.log("\n=== STRUCTURE WALK ===")
function walk(node: any, depth = 0) {
  const pad = "  ".repeat(depth)
  const nChildren = node.children?.length ?? 0
  console.log(`${pad}${node.type} key="${node.key}" children=${nChildren}`)
  if (node.children) for (const c of node.children) walk(c, depth + 1)
}
walk(parsed)

// Count total
let total = 0
function count(n: any) { total++; (n.children||[]).forEach(count) }
count(parsed)
console.log(`\nTotal nodes: ${total}`)

// Build tree
function buildTree(json: any): UITree {
  const rootKey = json.key ?? "root"
  let tree = UITree.empty().setRoot(rootKey)
  function addNode(node: any, parent?: string) {
    const key = node.key ?? `auto-${Math.random().toString(36).slice(2,6)}`
    const childKeys = (node.children ?? []).map((c: any) => c.key ?? `auto-${Math.random().toString(36).slice(2,6)}`)
    tree = tree.setElement(key, new UIElement({
      key, type: node.type ?? "Unknown", props: node.props ?? {},
      children: node.children ? childKeys : undefined, parentKey: parent,
    }))
    if (node.children) for (const child of node.children) addNode(child, key)
  }
  addNode(json)
  return tree
}

const uiTree = buildTree(parsed)
console.log(`\nUITree size: ${uiTree.size}`)
for (const [k, el] of uiTree.elements) {
  console.log(`  ${k}: type=${el.type}`)
}
