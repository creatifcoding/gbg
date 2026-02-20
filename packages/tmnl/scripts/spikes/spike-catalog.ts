#!/usr/bin/env bun
/**
 * Spike 1: CatalogService + System Prompt Generation
 *
 * Tests that CatalogService builds component documentation
 * without any React/browser dependencies.
 *
 * Run: bun run scripts/spikes/spike-catalog.ts
 */

import { Effect, Layer } from "effect"
import {
  CatalogComponents,
  createCatalogLayer,
  getSystemPrompt,
  getSchemasRecord,
  getRenderersRecord,
  getRegister,
  type DomainCatalog,
} from "../../src/lib/genifer/core/CatalogService"

// === Fake domain catalog (no React renderers) ===
const testCatalog: DomainCatalog = {
  components: {
    Card: {
      description: "A card container with title, body, and optional footer",
      props: "title: string, subtitle?: string, variant?: 'default' | 'outline'",
      hasChildren: true,
      renderer: () => null, // stub — not rendering in this spike
      defaultEntrance: { type: "fade", duration: 300 },
    },
    Button: {
      description: "A clickable button with label and optional icon",
      props: "label: string, variant?: 'primary' | 'secondary' | 'ghost', disabled?: boolean",
      hasChildren: false,
      renderer: () => null,
      defaultEntrance: { type: "scale", duration: 200 },
    },
    DataTable: {
      description: "Tabular data display with sortable columns",
      props: "columns: Array<{ field: string, header: string }>, rows: Array<Record<string, unknown>>",
      hasChildren: false,
      renderer: () => null,
      defaultEntrance: { type: "fade", duration: 400 },
    },
    Chart: {
      description: "Visualization chart (bar, line, pie)",
      props: "type: 'bar' | 'line' | 'pie', data: Array<{ label: string, value: number }>, title?: string",
      hasChildren: false,
      renderer: () => null,
      defaultEntrance: { type: "slide", duration: 300 },
    },
  },
}

// === Run ===
const program = Effect.gen(function* () {
  console.log("─── Spike 1: CatalogService ───\n")

  // Get system prompt
  const prompt = yield* getSystemPrompt
  console.log("📋 System Prompt Length:", prompt.length, "chars")
  console.log("─── First 500 chars ───")
  console.log(prompt.slice(0, 500))
  console.log("───")

  // Get schemas
  const schemas = yield* getSchemasRecord
  console.log("\n📐 Registered Schemas:", Object.keys(schemas))

  // Get renderers
  const renderers = yield* getRenderersRecord
  console.log("🎨 Registered Renderers:", Object.keys(renderers))

  // Dynamic registration
  const register = yield* getRegister
  register({
    components: {
      Alert: {
        description: "An alert banner with severity level",
        props: "message: string, severity: 'info' | 'warning' | 'error'",
        hasChildren: false,
        renderer: () => null,
        defaultEntrance: { type: "fade", duration: 200 },
      },
    },
  })

  // Re-read after dynamic registration
  const promptAfter = yield* getSystemPrompt
  const schemasAfter = yield* getSchemasRecord
  console.log("\n✅ After dynamic registration:")
  console.log("   Prompt length:", promptAfter.length, "chars (was", prompt.length, ")")
  console.log("   Schemas:", Object.keys(schemasAfter))
  console.log("   Contains 'Alert':", promptAfter.includes("Alert"))
})

const layer = createCatalogLayer(testCatalog)
Effect.runPromise(program.pipe(Effect.provide(layer))).catch(console.error)
