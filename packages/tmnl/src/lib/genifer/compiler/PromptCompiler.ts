/**
 * @fileoverview PromptCompiler — Context-enriched structured output compiler
 *
 * Uses generateText with a tightly constrained system prompt and golden examples
 * to produce genifer JSON. The system prompt includes:
 * - Full component catalog (types, descriptions, container/leaf)
 * - Golden examples showing exact output format
 * - Strict output rules (JSON only, no markdown, no explanation)
 *
 * Post-generation: validate via the normalization pipeline.
 *
 * Design choice: generateText over generateObject because:
 * - OpenAI structured output rejects Schema.Any/Schema.Unknown for props
 * - The normalization pipeline already validates + repairs the output
 * - generateText works identically across all providers
 *
 * @module genifer/compiler/PromptCompiler
 */
import { LanguageModel } from "@effect/ai"
import { Context, Effect, Layer } from "effect"
import * as Schema from "effect/Schema"

import { CatalogComponents } from "../core/CatalogService"
import { normalizeWithMeta, type NormalizeResult } from "../core/normalize"
import { BEHAVIOR_DSL_PROMPT } from "../decorators/generation-schema"
import { getComponentRegistry } from "../decorators/component"
import { getActionGroupRegistry } from "../decorators/action-group"
import { getRpcRegistry } from "../decorators/rpc"

// =============================================================================
// Types
// =============================================================================

export interface OperatingContext {
  readonly viewport?: { width: number; height: number }
  readonly themeTokens?: Record<string, string>
  readonly additionalContext?: string
  /** Enable behavior generation (Tier 1/2/3 DSL) */
  readonly interactive?: boolean
}

export interface CompiledPrompt {
  /** The raw model output text */
  readonly rawOutput: string
  /** Extracted JSON string (if found) */
  readonly extractedJson: string | null
  /** Whether the JSON passed normalization */
  readonly validated: boolean
  /** Component types found in the tree */
  readonly componentTypes: ReadonlyArray<string>
  /** Element count */
  readonly elementCount: number
  /** Duration of the model call in ms */
  readonly durationMs: number
  /** Normalization result (format, element count) */
  readonly normResult?: { format: string; elementCount: number }
}

// =============================================================================
// Service
// =============================================================================

export interface PromptCompilerShape {
  readonly compile: (
    input: string,
    context?: Partial<OperatingContext>
  ) => Effect.Effect<CompiledPrompt>
}

export class PromptCompiler extends Context.Tag("genifer/PromptCompiler")<
  PromptCompiler,
  PromptCompilerShape
>() {}

// =============================================================================
// Golden Examples
// =============================================================================

const EXAMPLE_DASHBOARD = `{
  "root": "layout",
  "elements": {
    "layout": { "type": "Grid", "props": { "template": "250px 1fr", "gap": 16 }, "children": ["sidebar", "main"] },
    "sidebar": { "type": "VStack", "props": { "gap": 8, "padding": 16 }, "children": ["nav-title", "nav-1", "nav-2"] },
    "nav-title": { "type": "Heading", "props": { "level": 3, "text": "Navigation" } },
    "nav-1": { "type": "Text", "props": { "content": "Overview" } },
    "nav-2": { "type": "Text", "props": { "content": "Settings" } },
    "main": { "type": "VStack", "props": { "gap": 16, "padding": 16 }, "children": ["header", "cards"] },
    "header": { "type": "Heading", "props": { "level": 1, "text": "Dashboard" } },
    "cards": { "type": "Grid", "props": { "template": "1fr 1fr", "gap": 16 }, "children": ["card-1", "card-2"] },
    "card-1": { "type": "Card", "props": { "padding": 16 }, "children": ["metric-1"] },
    "metric-1": { "type": "Text", "props": { "content": "Metric A: 1,234" } },
    "card-2": { "type": "Card", "props": { "padding": 16 }, "children": ["metric-2"] },
    "metric-2": { "type": "Text", "props": { "content": "Metric B: 5,678" } }
  }
}`

const EXAMPLE_FORM = `{
  "root": "form",
  "elements": {
    "form": { "type": "VStack", "props": { "gap": 16, "padding": 24 }, "children": ["title", "name-field", "email-field", "submit"] },
    "title": { "type": "Heading", "props": { "level": 2, "text": "Contact Form" } },
    "name-field": { "type": "VStack", "props": { "gap": 4 }, "children": ["name-label", "name-input"] },
    "name-label": { "type": "Text", "props": { "content": "Name" } },
    "name-input": { "type": "TextInput", "props": { "placeholder": "Enter your name" } },
    "email-field": { "type": "VStack", "props": { "gap": 4 }, "children": ["email-label", "email-input"] },
    "email-label": { "type": "Text", "props": { "content": "Email" } },
    "email-input": { "type": "TextInput", "props": { "placeholder": "you@example.com", "type": "email" } },
    "submit": { "type": "Button", "props": { "label": "Submit", "variant": "primary" } }
  }
}`

// =============================================================================
// Golden Behavioral Example
// =============================================================================

const EXAMPLE_INTERACTIVE_SEARCH = `{
  "root": "search-container",
  "elements": {
    "search-container": {
      "type": "VStack",
      "props": { "gap": 16, "padding": 24 },
      "behavior": {
        "name": "search",
        "state": [
          { "field": "query", "initial": "" },
          { "field": "results", "initial": [] },
          { "field": "loading", "initial": false },
          { "field": "error", "initial": null }
        ],
        "actions": {
          "search": {
            "_tag": "sequence",
            "actions": [
              { "_tag": "setState", "values": { "loading": true, "error": null } },
              { "_tag": "callRpc", "rpc": "search/query",
                "payload": { "q": "{{@state:query}}" },
                "resultField": "results", "loadingField": "loading", "errorField": "error" }
            ]
          },
          "clear": { "_tag": "setState", "values": { "query": "", "results": [], "error": null } }
        }
      },
      "children": ["search-bar", "results-list"]
    },
    "search-bar": {
      "type": "HStack",
      "props": { "gap": 8 },
      "children": ["query-input", "search-btn"]
    },
    "query-input": {
      "type": "TextInput",
      "props": { "value": "@state:query", "onChange": "@action:setQuery", "placeholder": "Search..." }
    },
    "search-btn": {
      "type": "Button",
      "props": { "onClick": "@action:search", "label": "Search", "disabled": "@state:loading" }
    },
    "results-list": {
      "type": "VStack",
      "props": { "gap": 8, "visible": "@state:results.length > 0" },
      "children": ["results-count"]
    },
    "results-count": {
      "type": "Text",
      "props": { "content": "{{@state:results.length}} results found" }
    }
  }
}`

// =============================================================================
// System Prompt Builder
// =============================================================================

function buildSystemPrompt(
  catalog: {
    schemas: ReadonlyMap<
      string,
      { description?: string; hasChildren?: boolean }
    >
  },
  context?: Partial<OperatingContext>
): string {
  const lines: string[] = []

  // Identity (required for Anthropic OAuth)
  lines.push("You are Claude Code.")
  lines.push("")

  // Core instruction — FIRST LINE after identity
  lines.push("OUTPUT ONLY A SINGLE JSON OBJECT. No markdown. No explanation. No text before or after the JSON.")
  lines.push("Use only component types listed in AVAILABLE COMPONENTS for the current request scope. Do not invent component names.")
  lines.push("")

  // Format spec
  lines.push("The JSON must be a genifer tree with this exact shape:")
  lines.push('{ "root": "<key>", "elements": { "<key>": { "type": "<ComponentType>", "props": {...}, "children": ["<key>", ...] }, ... } }')
  lines.push("")

  // Component catalog — compact
  lines.push("AVAILABLE COMPONENTS:")
  for (const [type, entry] of catalog.schemas) {
    const kind = entry.hasChildren ? "CONTAINER" : "LEAF"
    lines.push(`  ${type} (${kind})${entry.description ? ` — ${entry.description}` : ""}`)
  }
  lines.push("")

  // Rules
  lines.push("RULES:")
  lines.push("- root must reference an element key")
  lines.push("- Element keys: kebab-case (nav-title, card-1)")
  lines.push("- Only CONTAINER types can have children arrays")
  lines.push("- LEAF types must NOT have children")
  lines.push("- children values are keys of other elements in the same map")
  lines.push("- Use ONLY the component types listed above")
  lines.push("- Every referenced child key must exist in elements")
  lines.push("")

  // Examples
  lines.push("EXAMPLE 1 — Dashboard:")
  lines.push(EXAMPLE_DASHBOARD)
  lines.push("")
  lines.push("EXAMPLE 2 — Form:")
  lines.push(EXAMPLE_FORM)

  // --- Interactive Behavior DSL (Tier 1/2/3) ---
  if (context?.interactive) {
    lines.push("")
    lines.push(BEHAVIOR_DSL_PROMPT)

    // --- Available decorated components (Tier 1 references) ---
    const componentReg = getComponentRegistry()
    if (componentReg.size > 0) {
      lines.push("")
      lines.push("PRE-BUILT INTERACTIVE COMPONENTS (use via ref):")
      for (const [name, meta] of Array.from(componentReg.entries())) {
        lines.push(`  ${name} — ${(meta as any).description ?? "no description"}`)
      }
    }

    // --- Available ActionGroups ---
    const agReg = getActionGroupRegistry()
    if (agReg.size > 0) {
      lines.push("")
      lines.push("AVAILABLE ACTION GROUPS (attach to behavior blocks):")
      for (const [name, reg] of Array.from(agReg.entries())) {
        const stateFields = Array.from((reg as any).stateFields?.keys?.() ?? [])
        const actions = Array.from((reg as any).actions?.keys?.() ?? [])
        lines.push(`  ${name}: state=[${stateFields.join(", ")}] actions=[${actions.join(", ")}]`)
      }
    }

    // --- Available RPCs ---
    const rpcReg = getRpcRegistry()
    if (rpcReg.size > 0) {
      lines.push("")
      lines.push("AVAILABLE RPCs (use in callRpc actions):")
      for (const [tag, meta] of Array.from(rpcReg.entries())) {
        lines.push(`  ${tag} — ${(meta as any).description ?? "no description"}`)
      }
    }

    // --- Behavioral example ---
    lines.push("")
    lines.push("EXAMPLE 3 — Interactive Search:")
    lines.push(EXAMPLE_INTERACTIVE_SEARCH)
  }

  if (context?.viewport) {
    lines.push("")
    lines.push(`Viewport: ${context.viewport.width}x${context.viewport.height}px`)
  }
  if (context?.additionalContext) {
    lines.push("")
    lines.push(context.additionalContext)
  }

  return lines.join("\n")
}

// =============================================================================
// JSON Extraction
// =============================================================================

function extractJson(text: string): string | null {
  const trimmed = text.trim()

  // Try raw JSON first
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed
  }

  // Try markdown fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()

  // Try finding the outermost braces
  const first = trimmed.indexOf("{")
  const last = trimmed.lastIndexOf("}")
  if (first !== -1 && last > first) {
    return trimmed.slice(first, last + 1)
  }

  return null
}

// =============================================================================
// Implementation
// =============================================================================

export const PromptCompilerLive = Layer.effect(
  PromptCompiler,
  Effect.gen(function* () {
    const compile = (
      input: string,
      context?: Partial<OperatingContext>
    ): Effect.Effect<CompiledPrompt> =>
      Effect.gen(function* () {
        const catalog = yield* CatalogComponents
        const basePrompt = buildSystemPrompt(catalog, context)
        const scopedDisclosure = catalog.generateScopedPrompt({ tier: 'domain' })
        const systemPrompt = `${basePrompt}\n\n# Scoped Disclosure\n\n${scopedDisclosure}`

        const start = Date.now()
        const response = yield* LanguageModel.generateText({
          system: systemPrompt,
          prompt: input,
        })
        const durationMs = Date.now() - start

        const rawOutput = response.text
        const extractedJson = extractJson(rawOutput)

        let validated = false
        let componentTypes: string[] = []
        let elementCount = 0
        let normResult: CompiledPrompt["normResult"]

        if (extractedJson) {
          const result = yield* Effect.either(normalizeWithMeta(extractedJson))
          if (result._tag === "Right") {
            validated = true
            normResult = {
              format: result.right.format,
              elementCount: result.right.elementCount,
            }
            elementCount = result.right.elementCount

            // Extract component types from the parsed JSON
            try {
              const parsed = JSON.parse(extractedJson)
              if (parsed.elements) {
                const types = new Set<string>()
                for (const el of Object.values(parsed.elements) as any[]) {
                  if (el.type) types.add(el.type)
                }
                componentTypes = Array.from(types)
              }
            } catch { /* ignore parse errors — normalization already validated */ }
          }
        }

        return {
          rawOutput,
          extractedJson,
          validated,
          componentTypes,
          elementCount,
          durationMs,
          normResult,
        } satisfies CompiledPrompt
      })

    return { compile } satisfies PromptCompilerShape
  })
)
