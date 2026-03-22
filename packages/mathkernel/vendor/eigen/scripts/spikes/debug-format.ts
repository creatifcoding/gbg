#!/usr/bin/env bun
// Quick: fetch same prompt, dump children structure
import { Effect } from "effect"
import { createCatalogLayer, getSystemPrompt, type DomainCatalog } from "../../src/lib/genifer/core/CatalogService"

const apiKey = process.env.OPENAI_API_KEY!

const catalog: DomainCatalog = {
  components: {
    Page: { description: "Top-level page. Children: Section, Card", props: "title: string", hasChildren: true, renderer: () => null, defaultEntrance: { type: "fade", duration: 300 } },
    Section: { description: "Section. Children: Grid, Card", props: "title: string", hasChildren: true, renderer: () => null, defaultEntrance: { type: "fade", duration: 200 } },
    Grid: { description: "Grid layout. Children: Card, MetricCard", props: "columns: number", hasChildren: true, renderer: () => null, defaultEntrance: { type: "fade", duration: 200 } },
    Card: { description: "Card. Children: Text, MetricCard", props: "title?: string", hasChildren: true, renderer: () => null, defaultEntrance: { type: "scale", duration: 200 } },
    MetricCard: { description: "KPI. Leaf.", props: "label: string, value: string", hasChildren: false, renderer: () => null, defaultEntrance: { type: "scale", duration: 150 } },
    Text: { description: "Text. Leaf.", props: "text: string", hasChildren: false, renderer: () => null, defaultEntrance: { type: "fade", duration: 100 } },
  },
}

const layer = createCatalogLayer(catalog)
const sysPrompt = Effect.runSync(getSystemPrompt.pipe(Effect.provide(layer)))

const resp = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "JSON only. No explanation." },
      { role: "user", content: `${sysPrompt}\n\nGenerate a Page with 2 Sections. Each Section has a Grid with 2 MetricCards.\nJSON structure: {"type":"...", "key":"...", "props":{...}, "children":[{...}]}\nEvery child must be a full object, NOT a string reference. Return ONLY JSON.` },
    ],
    temperature: 0.2,
    max_tokens: 2000,
  }),
})

const data = await resp.json() as any
const raw = data.choices[0].message.content
console.log(raw)
console.log("\n--- Structure ---")
const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```\s*$/, ""))
console.log("Root type:", parsed.type, "key:", parsed.key)
console.log("Children type:", typeof parsed.children?.[0], "count:", parsed.children?.length)
if (parsed.children?.[0]) {
  console.log("First child:", JSON.stringify(parsed.children[0]).slice(0, 200))
}
