/**
 * Genifer ToolDefinitions — TypeBox params for pi harness registration
 *
 * Three tools exposed to the LLM:
 *   genifer_generate — Create UI from natural language prompt
 *   genifer_refine   — Modify an existing surface
 *   genifer_query    — Read/search/rate persisted trees and composites
 *
 * Uses SDK's ToolDefinition interface:
 *   { name, label, description, parameters: TSchema, execute(...) }
 *
 * Parameters use TypeBox (constraint D3 from pi-sdk-ref).
 * Execute bridges to GeniferHarnessService.
 *
 * @module genifer/harness/tools
 */

import { Type, type Static, type TObject } from '@sinclair/typebox'
import type { ToolDefinition } from '@mariozechner/pi-coding-agent'

// =============================================================================
// TypeBox Parameter Schemas
// =============================================================================

export const GeniferGenerateParams = Type.Object({
  prompt: Type.String({
    description: 'Natural language description of the UI to generate',
  }),
  threadId: Type.Optional(Type.String({
    description: 'Conversation thread ID for context continuity across refinements',
  })),
  rootClassName: Type.Optional(Type.String({
    description: 'Tailwind className applied to the root element (e.g., "p-8 bg-gray-900 rounded-xl")',
  })),
  persist: Type.Optional(Type.Boolean({
    description: 'Save generated tree to database (default: true)',
  })),
})
export type GeniferGenerateParams = Static<typeof GeniferGenerateParams>

export const GeniferRefineParams = Type.Object({
  surfaceId: Type.String({
    description: 'ID of the surface to refine (from a previous genifer_generate result)',
  }),
  instruction: Type.String({
    description: 'What to change (e.g., "add a search bar above the grid", "change heading to Mission Control")',
  }),
  persist: Type.Optional(Type.Boolean({
    description: 'Save refined tree to database (default: true)',
  })),
})
export type GeniferRefineParams = Static<typeof GeniferRefineParams>

export const GeniferQueryParams = Type.Object({
  operation: Type.Union([
    Type.Literal('list_recent'),
    Type.Literal('list_by_quality'),
    Type.Literal('list_by_thread'),
    Type.Literal('get_tree'),
    Type.Literal('rate_tree'),
    Type.Literal('list_composites'),
    Type.Literal('top_composites'),
    Type.Literal('rate_composite'),
    Type.Literal('get_signals'),
  ], { description: 'Query operation to perform on the genifer persistence layer' }),
  args: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
    description: 'Operation-specific arguments: treeId, threadId, rating (1-5), compositeId, minScore, limit, targetType, targetId',
  })),
})
export type GeniferQueryParams = Static<typeof GeniferQueryParams>

// =============================================================================
// Tool Details (TDetails for onUpdate + result)
// =============================================================================

export interface GeniferGenerateDetails {
  readonly stage: 'streaming' | 'normalizing' | 'persisting' | 'complete' | 'error'
  readonly surfaceId: string
  readonly elementCount: number
  readonly qualityScore?: number
  readonly repairCount?: number
  readonly durationMs?: number
  readonly treeId?: string | null
  readonly threadId?: string
  readonly treeSnapshot?: unknown
}

export interface GeniferRefineDetails {
  readonly stage: 'streaming' | 'normalizing' | 'persisting' | 'complete' | 'error'
  readonly surfaceId: string
  readonly sourceSurfaceId: string
  readonly elementCount: number
  readonly addedElements?: number
  readonly removedElements?: number
  readonly modifiedElements?: number
  readonly qualityScore?: number
  readonly treeId?: string | null
  readonly treeSnapshot?: unknown
}

export interface GeniferQueryDetails {
  readonly operation: string
  readonly data: unknown
}

// =============================================================================
// ToolDefinition Factories
// =============================================================================

/**
 * Create the genifer_generate ToolDefinition.
 *
 * Requires a bridge function that connects to GeniferHarnessService.
 * The bridge is injected at harness initialization (not at import time).
 */
export function createGeniferGenerateTool(bridge: {
  execute: (
    callId: string,
    params: GeniferGenerateParams,
    signal: AbortSignal | undefined,
    onUpdate: ((partial: { content: Array<{ type: string; text: string }>; details?: GeniferGenerateDetails }) => void) | undefined,
  ) => Promise<{ content: Array<{ type: string; text: string }>; details?: GeniferGenerateDetails }>
}): ToolDefinition<typeof GeniferGenerateParams, GeniferGenerateDetails> {
  return {
    name: 'genifer_generate',
    label: 'Generate UI',
    description: `Generate a UI component tree from a natural language prompt. Returns a structured tree with elements (Card, Grid, Heading, Button, etc.) that renders as a live, interactive surface inline in the chat. Use threadId for conversation continuity across refinements. The generated surface supports data bindings and bidirectional interaction.`,
    parameters: GeniferGenerateParams,
    async execute(toolCallId, params, signal, onUpdate, _ctx) {
      return bridge.execute(toolCallId, params, signal, onUpdate)
    },
  }
}

/**
 * Create the genifer_refine ToolDefinition.
 */
export function createGeniferRefineTool(bridge: {
  execute: (
    callId: string,
    params: GeniferRefineParams,
    signal: AbortSignal | undefined,
    onUpdate: ((partial: { content: Array<{ type: string; text: string }>; details?: GeniferRefineDetails }) => void) | undefined,
  ) => Promise<{ content: Array<{ type: string; text: string }>; details?: GeniferRefineDetails }>
}): ToolDefinition<typeof GeniferRefineParams, GeniferRefineDetails> {
  return {
    name: 'genifer_refine',
    label: 'Refine UI',
    description: `Modify an existing genifer surface. Provide the surfaceId from a previous genifer_generate result and an instruction describing what to change. Creates a new version linked to the original. Supports structural changes (add/remove elements), content changes (update text/props), and style changes (modify className).`,
    parameters: GeniferRefineParams,
    async execute(toolCallId, params, signal, onUpdate, _ctx) {
      return bridge.execute(toolCallId, params, signal, onUpdate)
    },
  }
}

/**
 * Create the genifer_query ToolDefinition.
 */
export function createGeniferQueryTool(bridge: {
  execute: (
    callId: string,
    params: GeniferQueryParams,
    signal: AbortSignal | undefined,
    onUpdate: undefined,
  ) => Promise<{ content: Array<{ type: string; text: string }>; details?: GeniferQueryDetails }>
}): ToolDefinition<typeof GeniferQueryParams, GeniferQueryDetails> {
  return {
    name: 'genifer_query',
    label: 'Query UI Library',
    description: `Query the genifer persistence layer. Operations:
- list_recent: Recent trees (args: { limit })
- list_by_quality: Trees by min quality (args: { minScore, limit })
- list_by_thread: Trees in a thread (args: { threadId })
- get_tree: Load full tree (args: { treeId })
- rate_tree: Rate a tree 1-5 (args: { treeId, rating })
- list_composites: All named composites (args: { limit })
- top_composites: Best ranked composites (args: { limit })
- rate_composite: Rate a composite 1-5 (args: { compositeId, rating })
- get_signals: Quality signals for a target (args: { targetType, targetId })`,
    parameters: GeniferQueryParams,
    async execute(toolCallId, params, signal, onUpdate, _ctx) {
      return bridge.execute(toolCallId, params, signal, undefined)
    },
  }
}
