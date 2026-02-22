/**
 * Genifer ToolDefinitions — TypeBox params for pi harness registration
 *
 * Eight tools exposed to the LLM:
 *   genifer_generate      — Create UI from natural language prompt
 *   genifer_refine        — Modify an existing surface
 *   genifer_query         — Read/search/rate persisted trees and composites
 *   genifer_define_rpc    — Register a runtime RPC with handler
 *   genifer_define_event  — Register a custom event type
 *   genifer_define_tool   — Register a new callable tool (meta-tool)
 *   genifer_code          — Write + execute Effect code in sandbox (planned)
 *   genifer_export_extension — Bundle surface + registrations (planned)
 *
 * Uses SDK's ToolDefinition interface:
 *   { name, label, description, parameters: TSchema, execute(...) }
 *
 * Parameters use TypeBox (constraint D3 from pi-sdk-ref).
 * Execute bridges to GeniferHarnessService, DynamicRpc/EventService, or CodeModeExecutor.
 *
 * @module genifer/harness/tools
 */

import { Type, type Static, type TObject } from '@sinclair/typebox'
import type { ToolDefinition } from '@mariozechner/pi-coding-agent'
import { GeniferCodeParams as GeniferCodeParamsSchema, type GeniferCodeDetails } from '../code-mode/schemas'

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

// =============================================================================
// Meta-Tool: genifer_define_rpc
// =============================================================================

export const GeniferDefineRpcParams = Type.Object({
  tag: Type.String({
    description: 'RPC tag (e.g., "opensky/SearchFlights"). Used to callRpc from ActionGroups.',
  }),
  description: Type.Optional(Type.String({
    description: 'Human-readable description of what this RPC does',
  })),
  handler: Type.Object({
    _tag: Type.Union([
      Type.Literal('http'),
      Type.Literal('service'),
      Type.Literal('llm'),
      Type.Literal('script'),
      Type.Literal('custom'),
    ], { description: 'Handler type' }),
    url: Type.Optional(Type.String({ description: 'URL for http handlers' })),
    method: Type.Optional(Type.String({ description: 'HTTP method (default: GET)' })),
    headers: Type.Optional(Type.Record(Type.String(), Type.String(), {
      description: 'HTTP headers',
    })),
    target: Type.Optional(Type.String({ description: 'Target for service/llm handlers' })),
    command: Type.Optional(Type.String({ description: 'Command for script handlers' })),
  }, { description: 'How this RPC executes' }),
  payloadSchema: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
    description: 'JSON schema for the RPC payload (validates input)',
  })),
  responseSchema: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
    description: 'JSON schema for the RPC response (validates output)',
  })),
})
export type GeniferDefineRpcParams = Static<typeof GeniferDefineRpcParams>

export interface GeniferDefineRpcDetails {
  readonly tag: string
  readonly registered: boolean
}

export function createGeniferDefineRpcTool(bridge: {
  execute: (
    callId: string,
    params: GeniferDefineRpcParams,
  ) => Promise<{ content: Array<{ type: string; text: string }>; details?: GeniferDefineRpcDetails }>
}): ToolDefinition<typeof GeniferDefineRpcParams, GeniferDefineRpcDetails> {
  return {
    name: 'genifer_define_rpc',
    label: 'Define RPC',
    description: `Register a runtime RPC that ActionGroups can call via callRpc. Handlers:
- http: Makes an HTTP request to a URL
- service: Calls an internal Effect service
- llm: Delegates to another LLM call
- script: Runs a shell command
- custom: Custom handler registered imperatively
The registered RPC is immediately available for genifer_generate to reference in behavior blocks.`,
    parameters: GeniferDefineRpcParams,
    async execute(toolCallId, params, _signal, _onUpdate, _ctx) {
      return bridge.execute(toolCallId, params)
    },
  }
}

// =============================================================================
// Meta-Tool: genifer_define_event
// =============================================================================

export const GeniferDefineEventParams = Type.Object({
  tag: Type.String({
    description: 'Event tag (e.g., "flight/selected"). Used to emitEvent from ActionGroups.',
  }),
  description: Type.Optional(Type.String({
    description: 'Human-readable description of when this event fires',
  })),
  payloadSchema: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
    description: 'JSON schema for the event payload (validates before emission)',
  })),
})
export type GeniferDefineEventParams = Static<typeof GeniferDefineEventParams>

export interface GeniferDefineEventDetails {
  readonly tag: string
  readonly registered: boolean
}

export function createGeniferDefineEventTool(bridge: {
  execute: (
    callId: string,
    params: GeniferDefineEventParams,
  ) => Promise<{ content: Array<{ type: string; text: string }>; details?: GeniferDefineEventDetails }>
}): ToolDefinition<typeof GeniferDefineEventParams, GeniferDefineEventDetails> {
  return {
    name: 'genifer_define_event',
    label: 'Define Event',
    description: `Register a custom event type. ActionGroups can emit this event via emitEvent actions. Other surfaces or services can subscribe to receive it. Events are session-scoped by default.`,
    parameters: GeniferDefineEventParams,
    async execute(toolCallId, params, _signal, _onUpdate, _ctx) {
      return bridge.execute(toolCallId, params)
    },
  }
}

// =============================================================================
// Meta-Tool: genifer_define_tool
// =============================================================================

export const GeniferDefineToolParams = Type.Object({
  name: Type.String({
    description: 'Tool name (e.g., "search_opensky"). Must be unique in this session.',
  }),
  label: Type.String({
    description: 'Human-readable label shown in tool manifest',
  }),
  description: Type.String({
    description: 'What this tool does — the LLM reads this to decide when to call it',
  }),
  parameters: Type.Record(Type.String(), Type.Unknown(), {
    description: 'TypeBox-compatible parameter schema as JSON',
  }),
  handler: Type.Union([
    Type.Object({
      type: Type.Literal('http'),
      url: Type.String(),
      method: Type.Optional(Type.String()),
      headers: Type.Optional(Type.Record(Type.String(), Type.String())),
    }),
    Type.Object({
      type: Type.Literal('rpc'),
      target: Type.String({ description: 'DynamicRpc tag to delegate to' }),
    }),
    Type.Object({
      type: Type.Literal('genifer_generate'),
      prompt: Type.String({ description: 'Prompt to pass to genifer_generate' }),
    }),
    Type.Object({
      type: Type.Literal('script'),
      command: Type.String({ description: 'Shell command to execute' }),
    }),
  ], { description: 'How this tool executes when called' }),
  renderer: Type.Optional(Type.Object({
    style: Type.Optional(Type.Union([
      Type.Literal('card'),
      Type.Literal('inline'),
      Type.Literal('table'),
      Type.Literal('terminal'),
    ])),
    icon: Type.Optional(Type.String()),
    color: Type.Optional(Type.String()),
  }, { description: 'How the tool result renders in chat' })),
})
export type GeniferDefineToolParams = Static<typeof GeniferDefineToolParams>

export interface GeniferDefineToolDetails {
  readonly name: string
  readonly registered: boolean
}

export function createGeniferDefineToolTool(bridge: {
  execute: (
    callId: string,
    params: GeniferDefineToolParams,
  ) => Promise<{ content: Array<{ type: string; text: string }>; details?: GeniferDefineToolDetails }>
}): ToolDefinition<typeof GeniferDefineToolParams, GeniferDefineToolDetails> {
  return {
    name: 'genifer_define_tool',
    label: 'Define Tool',
    description: `Register a new tool that becomes available in subsequent turns. This is a meta-tool: the LLM can create new capabilities on the fly. Handlers:
- http: Makes an HTTP request to a URL
- rpc: Delegates to a registered DynamicRpc
- genifer_generate: Triggers a genifer UI generation
- script: Runs a shell command
The new tool appears in the tool manifest and can be called in later turns.`,
    parameters: GeniferDefineToolParams,
    async execute(toolCallId, params, _signal, _onUpdate, _ctx) {
      return bridge.execute(toolCallId, params)
    },
  }
}

// =============================================================================
// Meta-Tool: genifer_code
// =============================================================================

// Re-export the TypeBox schema from code-mode/schemas
export { GeniferCodeParamsSchema as GeniferCodeToolParams }

export function createGeniferCodeTool(bridge: {
  execute: (
    callId: string,
    params: Static<typeof GeniferCodeParamsSchema>,
  ) => Promise<{ content: Array<{ type: string; text: string }>; details?: GeniferCodeDetails }>
}): ToolDefinition<typeof GeniferCodeParamsSchema, GeniferCodeDetails> {
  return {
    name: 'genifer_code',
    label: 'Execute Code',
    description: `Write and execute Effect-TS code in a sandboxed environment with access to genifer services.

Modes:
- define: Register new handlers, renderers, or services (no return value expected)
- execute: Run code and return the result
- pipe: Create a streaming transform pipeline

The \`sdk\` global provides:
- sdk.atoms.get/set/subscribe — read/write dynamic state
- sdk.register.tool/rpc/event/component — register new capabilities
- sdk.http.get/post — make HTTP requests (allowlisted domains)
- sdk.emit/on — emit and subscribe to events
- sdk.callRpc — call registered RPCs
- sdk.log/warn/error — logging

Use \`expose\` to register the result as a reusable capability:
- asRpc: Register as callable RPC
- asTool: Register as tool for future turns
- asAtom: Store as subscribable state
- asEvent: Register as event type`,
    parameters: GeniferCodeParamsSchema,
    async execute(toolCallId, params, _signal, _onUpdate, _ctx) {
      return bridge.execute(toolCallId, params)
    },
  }
}
