/**
 * Genifer ↔ @effect/ai Tool Bridge
 *
 * Creates tools that work with both genifer's ToolRegistryService AND
 * the canonical @effect/ai Tool.make / Toolkit patterns.
 *
 * Usage:
 *   const Search = makeGeniferTool("Search", {
 *     description: "Search the knowledge base",
 *     parameters: { query: Schema.String, limit: Schema.optional(Schema.Number) },
 *     success: Schema.Struct({ results: Schema.Array(Schema.String) }),
 *   })
 *
 *   // Use with genifer registry
 *   toolRegistry.register(Search.geniferDef)
 *
 *   // Use with @effect/ai Toolkit
 *   const toolkit = Toolkit.make(Search.effectAiTool)
 *
 * @module genifer/core/tool-bridge
 */

import { Schema, Effect } from "effect"
import { Tool } from "@effect/ai"
import type { GeniferToolDefinition } from "./tools.js"

// =============================================================================
// Types
// =============================================================================

export interface GeniferToolConfig<
  Params extends Schema.Struct.Fields,
  Success extends Schema.Schema.Any,
  Failure extends Schema.Schema.Any,
> {
  readonly description?: string
  readonly parameters: Params
  readonly success: Success
  readonly failure?: Failure
}

export interface GeniferToolBridge<
  Name extends string,
  Params extends Schema.Struct.Fields,
  Success extends Schema.Schema.Any,
  Failure extends Schema.Schema.Any,
> {
  /** The tool name */
  readonly name: Name
  /** @effect/ai Tool.make compatible tool */
  readonly effectAiTool: Tool.Tool<Name, {
    readonly parameters: Schema.Struct<Params>
    readonly success: Success
    readonly failure: Failure
  }>
  /** Genifer-native tool definition for ToolRegistryService */
  readonly geniferDef: GeniferToolDefinition
  /** The parameters schema */
  readonly parametersSchema: Schema.Struct<Params>
  /** The success schema */
  readonly successSchema: Success
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a tool definition compatible with both genifer and @effect/ai.
 *
 * Produces:
 *   - `.effectAiTool` — for @effect/ai Toolkit / LanguageModel.generateText
 *   - `.geniferDef` — for genifer's ToolRegistryService
 *   - `.parametersSchema` / `.successSchema` — raw schemas for validation
 */
export function makeGeniferTool<
  const Name extends string,
  Params extends Schema.Struct.Fields,
  Success extends Schema.Schema.Any = typeof Schema.Unknown,
  Failure extends Schema.Schema.Any = typeof Schema.Never,
>(
  name: Name,
  config: GeniferToolConfig<Params, Success, Failure>,
): GeniferToolBridge<Name, Params, Success, Failure> {
  const parametersSchema = Schema.Struct(config.parameters)
  const successSchema = config.success
  const failureSchema = (config.failure ?? Schema.Never) as Failure

  // @effect/ai Tool
  const effectAiTool = Tool.make(name, {
    description: config.description ?? "",
    parameters: config.parameters,
    success: successSchema,
    failure: failureSchema,
  })

  // Genifer tool definition (for existing ToolRegistryService)
  const geniferDef: GeniferToolDefinition = {
    name,
    description: config.description ?? "",
    parametersSchema: parametersSchema as any,
    handler: async (_args: unknown) => {
      // Default no-op handler — register actual handler via ToolRegistryService
      return JSON.stringify({ _tag: "unimplemented", tool: name })
    },
  }

  return {
    name,
    effectAiTool: effectAiTool as any,
    geniferDef,
    parametersSchema,
    successSchema,
  }
}
