/**
 * @fileoverview Compiler Tools — LLM-callable tools for structural prompt refinement
 *
 * These tools are given to a fast/cheap model (Haiku) so it can:
 * 1. Query the component catalog (what's available, what props they take)
 * 2. Validate component props against Effect.Schema
 * 3. Preview normalization on draft JSON (dry-run diagnostics)
 * 4. Look up known-good examples by UI pattern
 *
 * Each tool is an @effect/ai Tool definition. Combined into a Toolkit
 * that the LanguageModel can call during a tool-use loop.
 *
 * @module genifer/compiler/tools
 */
import { Tool, Toolkit } from "@effect/ai"
import { Effect, JSONSchema } from "effect"
import * as Schema from "effect/Schema"

import { CatalogComponents } from "../core/CatalogService"
import { normalizeWithMeta } from "../core/normalize"

// =============================================================================
// Tool: CatalogQuery
// =============================================================================

/**
 * CatalogQuery — List available components with their schemas and nesting rules.
 */
export const CatalogQueryTool = Tool.make("CatalogQuery", {
  description:
    "List available UI components in the genifer catalog. Returns component names, " +
    "their prop schemas (as JSON Schema), descriptions, and whether they can have children. " +
    "Use this to discover what components are available before building a UI tree.",
  parameters: {
    filter: Schema.optional(
      Schema.String.annotations({
        description:
          "Optional filter — component type prefix or keyword (e.g., 'layout', 'chart'). Omit for all.",
      })
    ),
  },
  success: Schema.String,
})

// =============================================================================
// Tool: SchemaCheck
// =============================================================================

/**
 * SchemaCheck — Validate a component's props against its Effect.Schema.
 */
export const SchemaCheckTool = Tool.make("SchemaCheck", {
  description:
    "Validate a component's props against its registered schema. " +
    "Pass the component type and a props object. Returns whether the props " +
    "are valid, and if not, what fields are wrong and why.",
  parameters: {
    componentType: Schema.String.annotations({
      description:
        'The component type to validate against (e.g., "Grid", "Heading")',
    }),
    props: Schema.Unknown.annotations({
      description: "The props object to validate",
    }),
  },
  success: Schema.String,
})

// =============================================================================
// Tool: NormalizePreview
// =============================================================================

/**
 * NormalizePreview — Dry-run the normalization pipeline on draft JSON.
 */
export const NormalizePreviewTool = Tool.make("NormalizePreview", {
  description:
    "Run the genifer normalization pipeline on a draft JSON string. " +
    "Returns diagnostics: whether the JSON parses, what format was detected " +
    "(nested/flat/hybrid), the resulting tree structure, and any errors. " +
    "Use this to verify your output before finalizing.",
  parameters: {
    json: Schema.String.annotations({
      description: "The draft genifer JSON string to validate",
    }),
  },
  success: Schema.String,
})

// =============================================================================
// Tool: ExampleLookup
// =============================================================================

/**
 * Golden examples indexed by UI pattern.
 * These are known-good genifer outputs that produce clean UI trees.
 */
const GOLDEN_EXAMPLES: Record<string, { description: string; json: string }> = {
  dashboard: {
    description:
      "A dashboard layout with header, sidebar, and main content area",
    json: JSON.stringify({
      root: "layout",
      elements: {
        layout: {
          type: "Grid",
          props: { template: "250px 1fr", gap: 16, minHeight: "100vh" },
          children: ["sidebar", "main"],
        },
        sidebar: {
          type: "VStack",
          props: { gap: 8, padding: 16 },
          children: ["nav-title", "nav-items"],
        },
        "nav-title": {
          type: "Heading",
          props: { level: 3, text: "Navigation" },
        },
        "nav-items": {
          type: "VStack",
          props: { gap: 4 },
          children: ["nav-1", "nav-2", "nav-3"],
        },
        "nav-1": { type: "Text", props: { content: "Overview" } },
        "nav-2": { type: "Text", props: { content: "Analytics" } },
        "nav-3": { type: "Text", props: { content: "Settings" } },
        main: {
          type: "VStack",
          props: { gap: 16, padding: 16 },
          children: ["header", "content"],
        },
        header: { type: "Heading", props: { level: 1, text: "Dashboard" } },
        content: {
          type: "Grid",
          props: { template: "1fr 1fr", gap: 16 },
          children: ["card-1", "card-2"],
        },
        "card-1": { type: "Text", props: { content: "Metric A: 1,234" } },
        "card-2": { type: "Text", props: { content: "Metric B: 5,678" } },
      },
    }),
  },
  form: {
    description: "A simple form with labeled inputs and a submit button",
    json: JSON.stringify({
      root: "form",
      elements: {
        form: {
          type: "VStack",
          props: { gap: 16, padding: 24, maxWidth: 480 },
          children: ["title", "name-field", "email-field", "submit"],
        },
        title: {
          type: "Heading",
          props: { level: 2, text: "Contact Form" },
        },
        "name-field": {
          type: "VStack",
          props: { gap: 4 },
          children: ["name-label", "name-input"],
        },
        "name-label": { type: "Text", props: { content: "Name" } },
        "name-input": {
          type: "TextInput",
          props: { placeholder: "Enter your name" },
        },
        "email-field": {
          type: "VStack",
          props: { gap: 4 },
          children: ["email-label", "email-input"],
        },
        "email-label": { type: "Text", props: { content: "Email" } },
        "email-input": {
          type: "TextInput",
          props: { placeholder: "you@example.com" },
        },
        submit: {
          type: "Button",
          props: { label: "Submit", variant: "primary" },
        },
      },
    }),
  },
  "split-view": {
    description: "A side-by-side split view with two equal panels",
    json: JSON.stringify({
      root: "layout",
      elements: {
        layout: {
          type: "Grid",
          props: { template: "1fr 1fr", gap: 16, minHeight: "100vh" },
          children: ["left", "right"],
        },
        left: {
          type: "VStack",
          props: { gap: 8, padding: 16 },
          children: ["left-title", "left-content"],
        },
        "left-title": {
          type: "Heading",
          props: { level: 2, text: "Panel A" },
        },
        "left-content": {
          type: "Text",
          props: { content: "Left panel content" },
        },
        right: {
          type: "VStack",
          props: { gap: 8, padding: 16 },
          children: ["right-title", "right-content"],
        },
        "right-title": {
          type: "Heading",
          props: { level: 2, text: "Panel B" },
        },
        "right-content": {
          type: "Text",
          props: { content: "Right panel content" },
        },
      },
    }),
  },
}

/**
 * ExampleLookup — Retrieve known-good genifer output examples.
 */
export const ExampleLookupTool = Tool.make("ExampleLookup", {
  description:
    "Look up known-good genifer JSON examples by UI pattern. " +
    'Available patterns: dashboard, form, split-view. Pass "list" to see all.',
  parameters: {
    pattern: Schema.String.annotations({
      description:
        'UI pattern to look up (e.g., "dashboard", "form", "split-view", "list")',
    }),
  },
  success: Schema.String,
})

// =============================================================================
// Toolkit + Handlers
// =============================================================================

/**
 * Combined toolkit of all compiler tools.
 */
export const CompilerToolkit = Toolkit.make(
  CatalogQueryTool,
  SchemaCheckTool,
  NormalizePreviewTool,
  ExampleLookupTool
)

/**
 * Live layer implementing all compiler tool handlers.
 *
 * Requires CatalogComponents in context for CatalogQuery and SchemaCheck.
 */
export const CompilerToolkitLive = CompilerToolkit.toLayer({
  // ── CatalogQuery ──
  CatalogQuery: ({ filter }) =>
    Effect.gen(function* () {
      const catalog = yield* CatalogComponents
      const entries: Array<{
        type: string
        description?: string
        hasChildren: boolean
        propsSchema: unknown
      }> = []

      for (const [type, entry] of catalog.schemas) {
        if (filter) {
          const f = filter.toLowerCase()
          if (
            !type.toLowerCase().includes(f) &&
            !(entry.description ?? "").toLowerCase().includes(f)
          )
            continue
        }

        let propsSchema: unknown
        try {
          propsSchema = JSONSchema.make(entry.schema)
        } catch {
          propsSchema = { note: "Schema not JSON-serializable" }
        }

        entries.push({
          type,
          description: entry.description,
          hasChildren: entry.hasChildren ?? false,
          propsSchema,
        })
      }

      return JSON.stringify(
        { componentCount: entries.length, components: entries },
        null,
        2
      )
    }),

  // ── SchemaCheck ──
  SchemaCheck: ({ componentType, props }) =>
    Effect.gen(function* () {
      const catalog = yield* CatalogComponents
      const entry = catalog.schemas.get(componentType)

      if (!entry) {
        return JSON.stringify({
          valid: false,
          error: `Unknown component type: "${componentType}"`,
          availableTypes: Array.from(catalog.schemas.keys()).slice(0, 20),
        })
      }

      const decode = Schema.decodeUnknownEither(entry.schema)
      const result = decode(props)

      if (result._tag === "Right") {
        return JSON.stringify({ valid: true, componentType })
      }

      return JSON.stringify({
        valid: false,
        componentType,
        error: result.left.message,
      })
    }),

  // ── NormalizePreview ──
  NormalizePreview: ({ json }) =>
    Effect.gen(function* () {
      const result = yield* Effect.either(normalizeWithMeta(json))

      if (result._tag === "Left") {
        return JSON.stringify({
          valid: false,
          stage: (result.left as any).stage ?? "unknown",
          error: result.left.message,
        })
      }

      const { tree, meta } = result.right
      const types = new Set<string>()
      for (const el of tree.elements.values()) {
        types.add(el.type)
      }

      return JSON.stringify({
        valid: true,
        format: meta.format,
        root: tree.root,
        elementCount: tree.elements.size,
        componentTypes: Array.from(types),
        depth: meta.maxDepth ?? "unknown",
        repairsApplied: meta.repairs ?? 0,
      })
    }),

  // ── ExampleLookup ──
  ExampleLookup: ({ pattern }) =>
    Effect.succeed(
      pattern === "list"
        ? JSON.stringify({
            patterns: Object.keys(GOLDEN_EXAMPLES),
            descriptions: Object.fromEntries(
              Object.entries(GOLDEN_EXAMPLES).map(([k, v]) => [
                k,
                v.description,
              ])
            ),
          })
        : GOLDEN_EXAMPLES[pattern]
          ? JSON.stringify(GOLDEN_EXAMPLES[pattern], null, 2)
          : JSON.stringify({
              error: `Unknown pattern: "${pattern}"`,
              available: Object.keys(GOLDEN_EXAMPLES),
            })
    ),
})
