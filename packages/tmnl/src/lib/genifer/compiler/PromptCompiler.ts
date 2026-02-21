/**
 * @fileoverview PromptCompiler — Stage 1 of the two-stage genifer pipeline
 *
 * Takes natural language + operating context, runs a fast model (Haiku) with
 * structural tools (CatalogQuery, SchemaCheck, NormalizePreview, ExampleLookup),
 * and produces a refined, structurally-aware prompt for the generator model.
 *
 * The compiler model is NOT generating the final UI tree — it's preparing
 * the instructions for a stronger model that will.
 *
 * @module genifer/compiler/PromptCompiler
 */
import { LanguageModel } from "@effect/ai"
import { Context, Effect, Layer, Stream } from "effect"

import { CompilerToolkit } from "./tools"
import { CatalogComponents } from "../core/CatalogService"

// =============================================================================
// Types
// =============================================================================

/**
 * Operating context collected for prompt enrichment.
 */
export interface OperatingContext {
  /** Available component types from the catalog */
  readonly availableComponents: ReadonlyArray<string>
  /** The full catalog system prompt (component schemas + composition rules) */
  readonly catalogPrompt: string
  /** Optional: current viewport/screen constraints */
  readonly viewport?: { width: number; height: number }
  /** Optional: active theme tokens */
  readonly themeTokens?: Record<string, string>
  /** Optional: additional context from the application */
  readonly additionalContext?: string
}

/**
 * Result from the prompt compiler.
 */
export interface CompiledPrompt {
  /** The refined system prompt for the generator model */
  readonly systemPrompt: string
  /** The refined user prompt with structural guidance */
  readonly userPrompt: string
  /** Component types the compiler determined are needed */
  readonly requiredComponents: ReadonlyArray<string>
  /** Whether the compiler validated the structure via tools */
  readonly validated: boolean
  /** Raw compiler model output (for debugging/eval) */
  readonly compilerTrace: string
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
// Compiler System Prompt
// =============================================================================

const COMPILER_SYSTEM_PROMPT = `You are a UI Structure Compiler. Your job is to take a natural language UI description and produce a precise, structurally-valid genifer JSON specification.

You have four tools:
1. **CatalogQuery** — Discover available components, their props schemas, and nesting rules
2. **SchemaCheck** — Validate that specific props are valid for a component type
3. **NormalizePreview** — Test if a draft JSON structure would survive the normalization pipeline
4. **ExampleLookup** — See known-good examples of common UI patterns

## Your Process
1. Call \`CatalogQuery\` to see what components are available
2. Call \`ExampleLookup\` with a relevant pattern to see the expected JSON format
3. Draft a genifer JSON tree using exact component types from the catalog
4. Call \`NormalizePreview\` with your draft JSON to validate it
5. If validation fails, fix the issues and re-validate
6. Output the final validated JSON

## Output Format
Your final message MUST contain a JSON code block with the genifer tree:

\`\`\`json
{
  "root": "layout",
  "elements": {
    "layout": { "type": "Grid", "props": { ... }, "children": ["a", "b"] },
    "a": { "type": "Heading", "props": { "level": 1, "text": "..." } },
    "b": { "type": "Text", "props": { "content": "..." } }
  }
}
\`\`\`

Rules:
- Every element needs a unique key in the \`elements\` object
- The \`root\` key must reference an existing element
- Use exact component types from the catalog (case-sensitive)
- Props must match the component's schema
- Container components (hasChildren: true) use a \`children\` array of keys`

// =============================================================================
// Implementation
// =============================================================================

/**
 * Build the PromptCompiler live layer.
 *
 * Requires:
 * - LanguageModel.LanguageModel (the compiler model, e.g., Haiku)
 * - CatalogComponents (component registry)
 * - CompilerToolkit handlers (via CompilerToolkitLive)
 */
export const PromptCompilerLive = Layer.effect(
  PromptCompiler,
  Effect.gen(function* () {
    const compile = (
      input: string,
      context?: Partial<OperatingContext>
    ): Effect.Effect<CompiledPrompt> =>
      Effect.gen(function* () {
        const model = yield* LanguageModel.LanguageModel
        const catalog = yield* CatalogComponents

        // Build enriched context
        const catalogPrompt = catalog.generatePrompt()
        const availableComponents = Array.from(catalog.schemas.keys())

        // Build system prompt with context
        let systemPrompt = COMPILER_SYSTEM_PROMPT
        if (context?.additionalContext) {
          systemPrompt += `\n\n## Additional Context\n${context.additionalContext}`
        }
        if (context?.viewport) {
          systemPrompt += `\n\nViewport: ${context.viewport.width}x${context.viewport.height}px`
        }
        systemPrompt += `\n\n## Available Components\n${availableComponents.join(", ")}`

        // Run the compiler model with tools via streamText
        const toolkit = yield* CompilerToolkit

        const stream = LanguageModel.streamText({
          system: systemPrompt,
          prompt: `Create a UI for the following request:\n\n${input}`,
          toolkit,
        })

        // Collect the full response, consuming tool calls automatically
        let compilerOutput = ""
        yield* Stream.runForEach(stream, (chunk) =>
          Effect.sync(() => {
            const part = chunk as any
            if (part.type === "text-delta" && part.delta) {
              compilerOutput += part.delta
            }
          })
        )

        // Parse the compiler output
        const requiredComponents = extractComponentTypes(
          compilerOutput,
          availableComponents
        )
        const hasJson = compilerOutput.includes("```json")
        const validated =
          compilerOutput.includes("NormalizePreview") || hasJson

        // Build the refined prompt for the generator
        const generatorSystemPrompt = `You are a UI generator. Output ONLY valid genifer JSON — no markdown, no explanation.

${catalogPrompt}

Generate a genifer JSON tree following the specification below. Output raw JSON only.`

        const generatorUserPrompt = hasJson
          ? extractJsonBlock(compilerOutput)
          : `Based on this specification, generate genifer JSON:\n\n${compilerOutput}`

        return {
          systemPrompt: generatorSystemPrompt,
          userPrompt: generatorUserPrompt,
          requiredComponents,
          validated,
          compilerTrace: compilerOutput,
        } satisfies CompiledPrompt
      })

    return { compile } satisfies PromptCompilerShape
  })
)

// =============================================================================
// Helpers
// =============================================================================

function extractComponentTypes(
  output: string,
  available: ReadonlyArray<string>
): ReadonlyArray<string> {
  const found = new Set<string>()
  for (const type of available) {
    if (output.includes(type)) found.add(type)
  }
  return Array.from(found)
}

function extractJsonBlock(output: string): string {
  const match = output.match(/```json\s*([\s\S]*?)```/)
  return match ? match[1].trim() : output
}
