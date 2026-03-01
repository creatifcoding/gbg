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
import { createElement as h } from "react"

import { CatalogComponents, type ComponentRenderProps } from "../core/CatalogService"
import { normalizeWithMeta } from "../core/normalize"

// =============================================================================
// Tool: CatalogQuery
// =============================================================================

/**
 * CatalogQuery — List available components with progressive disclosure filters.
 *
 * Works with tier/domain scoping when additional catalogs are registered.
 */
export const CatalogQueryTool = Tool.make("CatalogQuery", {
  description:
    "List available UI components in the currently registered catalog set. Supports tier/domain/keyword filtering. " +
    "Returns component names, prop schemas, descriptions, compound relationships, and tier/domain metadata.",
  parameters: {
    tier: Schema.optional(
      Schema.Literal("core", "domain", "discovery").annotations({
        description:
          "Visibility tier. 'core' = foundational only, 'domain' = core + scoped domain entries, 'discovery' = all registered entries.",
      })
    ),
    domains: Schema.optional(
      Schema.Array(Schema.String).annotations({
        description:
          "Domain tags to filter by (components matching ANY domain are included).",
      })
    ),
    filter: Schema.optional(
      Schema.String.annotations({
        description:
          "Optional keyword filter — component type prefix or keyword (e.g., 'button', 'card', 'input').",
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
// Tool: ComponentDefine
// =============================================================================

/**
 * ComponentDefine — Register a custom component mid-generation.
 *
 * The LLM can define a new component type with a props schema,
 * description, and whether it accepts children. The component
 * is registered into the active catalog session so subsequent
 * tool calls and the final tree can reference it.
 *
 * The renderer is auto-generated as a generic Box with the
 * component's props displayed as data attributes. Custom
 * renderers can be attached post-generation by the agent.
 */
export const ComponentDefineTool = Tool.make("ComponentDefine", {
  description:
    "Define and register a custom component type mid-generation. " +
    "The component becomes immediately available in CatalogQuery and SchemaCheck. " +
    "Use when the existing catalog lacks a component needed for the current UI shape. " +
    "The component gets a generic Box renderer that displays its props — " +
    "custom renderers can be attached later via the decorator system.",
  parameters: {
    type: Schema.String.annotations({
      description: 'Unique component type name (PascalCase, e.g., "SensorReadout", "FlightPath")',
    }),
    description: Schema.String.annotations({
      description: "Human-readable description of what this component renders and when to use it",
    }),
    hasChildren: Schema.optional(
      Schema.Boolean.annotations({
        description: "Whether this component accepts children elements (default: false)",
      })
    ),
    props: Schema.Record({ key: Schema.String, value: Schema.String }).annotations({
      description:
        'Prop definitions as { name: type } pairs. Supported types: ' +
        '"string", "number", "boolean", "string[]", "number[]". ' +
        'Example: { "label": "string", "value": "number", "active": "boolean" }',
    }),
    domains: Schema.optional(
      Schema.Array(Schema.String).annotations({
        description: 'Domain tags (e.g., ["data", "iiot"]). Default: ["ui"]',
      })
    ),
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
  ExampleLookupTool,
  ComponentDefineTool,
)

/**
 * Live layer implementing all compiler tool handlers.
 *
 * Requires CatalogComponents in context for CatalogQuery and SchemaCheck.
 */
export const CompilerToolkitLive = CompilerToolkit.toLayer({
  // ── CatalogQuery (tier/domain/keyword progressive disclosure) ──
  CatalogQuery: ({ tier, domains, filter }) =>
    Effect.gen(function* () {
      const catalog = yield* CatalogComponents

      const requestedTier = tier ?? 'discovery'
      const requestedDomains = domains as ReadonlyArray<string> | undefined

      const scopedTypes = catalog.listComponents({
        tier: requestedTier,
        domains: requestedDomains,
      })
      const scopedSet = new Set(scopedTypes)

      const entries: Array<{
        type: string
        description?: string
        hasChildren: boolean
        tier: string
        domains: ReadonlyArray<string>
        compound?: { parent: string; slots: ReadonlyArray<string>; strict?: boolean }
        propsSchema: unknown
      }> = []

      for (const [type, entry] of catalog.schemas) {
        if (!scopedSet.has(type)) continue

        // Keyword filter
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
          tier: entry.tier,
          domains: entry.domains,
          compound: entry.compound ? {
            parent: entry.compound.parent,
            slots: entry.compound.slots,
            strict: entry.compound.strict,
          } : undefined,
          propsSchema,
        })
      }

      return JSON.stringify(
        {
          mode: 'catalog-scoped',
          componentCount: entries.length,
          filters: {
            tier: requestedTier,
            domains: requestedDomains ?? 'all',
            keyword: filter ?? null,
          },
          components: entries,
        },
        null,
        2,
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

  // ── ComponentDefine ──
  ComponentDefine: ({ type, description, hasChildren, props, domains: domainTags }) =>
    Effect.gen(function* () {
      const catalog = yield* CatalogComponents

      // Guard: PascalCase and no collision
      if (!/^[A-Z][A-Za-z0-9]+$/.test(type)) {
        return JSON.stringify({
          success: false,
          error: `Type must be PascalCase (e.g., "SensorReadout"). Got: "${type}"`,
        })
      }
      if (catalog.schemas.has(type)) {
        return JSON.stringify({
          success: false,
          error: `Component "${type}" already exists in the catalog. Choose a different name.`,
        })
      }

      // Build Effect.Schema fields from prop definitions
      const SCHEMA_MAP: Record<string, Schema.Schema<any, any, never>> = {
        string: Schema.String,
        number: Schema.Number,
        boolean: Schema.Boolean,
        'string[]': Schema.Array(Schema.String),
        'number[]': Schema.Array(Schema.Number),
      }

      const schemaFields: Record<string, Schema.Schema<any, any, never>> = {
        className: Schema.optional(Schema.String),
      }
      const unknownProps: string[] = []

      for (const [propName, propType] of Object.entries(props)) {
        const s = SCHEMA_MAP[propType]
        if (s) {
          schemaFields[propName] = s
        } else {
          unknownProps.push(`${propName}: ${propType}`)
          schemaFields[propName] = Schema.Unknown
        }
      }

      const componentSchema = Schema.Struct(schemaFields as any)

      // Register into catalog as a runtime domain catalog
      const resolvedDomains = (domainTags as string[] | undefined) ?? ['ui']
      catalog.register({
        name: `Dynamic: ${type}`,
        defaultTier: 'domain',
        defaultDomains: resolvedDomains,
        components: {
          [type]: {
            schema: componentSchema,
            renderer: ({ element, children }: ComponentRenderProps<any>) => {
              const p = element.props as Record<string, unknown>
              const style: Record<string, unknown> = {
                display: hasChildren ? 'flex' : 'inline-flex',
                flexDirection: 'column',
                gap: 8,
                padding: hasChildren ? 12 : '4px 8px',
                borderRadius: 6,
                border: `1px solid rgba(34,211,238,0.2)`,
                background: 'rgba(14,14,14,0.95)',
                fontFamily: 'monospace',
                fontSize: 'var(--tmnl-text-xs, 10px)',
                color: 'rgb(163,163,163)',
              }
              const propEntries = Object.entries(p).filter(
                ([k]) => k !== 'className' && k !== 'children',
              )

              return h(
                'div',
                {
                  className: p['className'] ?? '',
                  style,
                  'data-genifer-dynamic': type,
                },
                h('span', {
                  style: { color: 'rgb(34,211,238)', fontSize: 'var(--tmnl-text-xs, 10px)', fontWeight: 600 },
                }, `‹${type}›`),
                propEntries.length > 0 && h('div', {
                  style: { display: 'flex', flexWrap: 'wrap', gap: '4px 8px' },
                }, ...propEntries.map(([k, v]) =>
                  h('span', { key: k, style: { color: 'rgb(115,115,115)' } },
                    h('span', { style: { color: 'rgb(163,163,163)' } }, `${k}=`),
                    h('span', { style: { color: 'rgb(212,212,212)' } }, String(v)),
                  ),
                )),
                children,
              )
            },
            description,
            hasChildren: hasChildren ?? false,
            defaultEntrance: { property: 'opacity+scale', easing: 'out-quart', duration: 'fast' },
            tier: 'domain',
            domains: resolvedDomains,
          },
        },
      })

      return JSON.stringify({
        success: true,
        type,
        description,
        hasChildren: hasChildren ?? false,
        propsRegistered: Object.keys(props),
        unknownTypes: unknownProps.length > 0 ? unknownProps : undefined,
        domains: resolvedDomains,
        note: 'Component registered with generic renderer. Use the decorator system to attach a custom renderer later.',
      })
    }),
})
