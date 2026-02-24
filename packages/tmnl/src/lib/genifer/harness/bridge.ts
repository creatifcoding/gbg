/**
 * Bridge — Connects ToolDefinition.execute to GeniferHarnessService
 *
 * This is the wiring layer. It:
 *   1. Creates bridge functions for each tool's execute
 *   2. Bridges Promise-based ToolDefinition.execute to Effect-based GeniferHarnessService
 *   3. Formats results as { content: [{type:'text', text}], details: TDetails }
 *   4. Drives onUpdate callbacks for streaming progress
 *
 * @module genifer/harness/bridge
 */

import { Effect } from 'effect'
import { Type } from '@sinclair/typebox'
import type { GeniferHarnessServiceShape } from './GeniferHarnessService'
import type {
  GeniferGenerateParams,
  GeniferRefineParams,
  GeniferQueryParams,
  GeniferGenerateDetails,
  GeniferRefineDetails,
  GeniferQueryDetails,
  GeniferDefineRpcParams,
  GeniferDefineRpcDetails,
  GeniferDefineEventParams,
  GeniferDefineEventDetails,
  GeniferDefineToolParams,
  GeniferDefineToolDetails,
} from './tools'
import {
  createGeniferGenerateTool,
  createGeniferRefineTool,
  createGeniferQueryTool,
  createGeniferDefineRpcTool,
  createGeniferDefineEventTool,
  createGeniferDefineToolTool,
  createGeniferCodeTool,
  createGeniferExportExtensionTool,
} from './tools'
import { executeCodeMode } from '../code-mode/executor'
import { getDynamicTools as getCodeModeDynamicTools } from '../code-mode/sandbox'
import {
  registerDynamicRpc,
  callDynamicRpc,
} from '../services/DynamicRpcService'
import {
  defineDynamicEvent,
} from '../services/DynamicEventService'
import { RpcDefinition, type RpcHandler } from '../services/DynamicRpcSchemas'
import { EventDefinition } from '../services/DynamicEventSchemas'
import type { ToolDefinition } from '@mariozechner/pi-coding-agent'
import type { GeointHarnessServiceShape } from '@/lib/geoint/harness'

// =============================================================================
// Bridge Factory
// =============================================================================

/**
 * Create all three genifer ToolDefinitions wired to a GeniferHarnessService instance.
 *
 * Called at harness initialization when the service is available.
 * Returns tool definitions ready to inject into PiAiToolRuntimeBuiltins.
 */
export function createGeniferTools(
  service: GeniferHarnessServiceShape,
  sessionId: string,
  options?: {
    readonly geointService?: GeointHarnessServiceShape
  },
): ToolDefinition[] {
  const generateTool = createGeniferGenerateTool({
    async execute(callId, params, signal, onUpdate) {
      const result = await Effect.runPromise(
        service.generate({
          prompt: params.prompt,
          sessionId,
          threadId: params.threadId,
          rootClassName: params.rootClassName,
          persist: params.persist ?? true,
          onProgress: onUpdate
            ? (status, elementCount) => {
                onUpdate({
                  content: [{ type: 'text', text: `Generating... ${elementCount} elements (${status})` }],
                  details: {
                    stage: status as any,
                    surfaceId: callId,
                    elementCount,
                  },
                })
              }
            : undefined,
        }),
      )

      const summary = result.treeId
        ? `Generated UI surface with ${result.elementCount} elements. Quality: ${(result.qualityScore * 100).toFixed(0)}%. ${result.repairCount} repairs. Model: ${result.model}. Duration: ${result.durationMs}ms. Tree ID: ${result.treeId}. Surface ID: ${result.surfaceId}. Thread: ${result.threadId}.`
        : `Generated UI surface with ${result.elementCount} elements. Quality: ${(result.qualityScore * 100).toFixed(0)}%. Model: ${result.model}. Duration: ${result.durationMs}ms. Surface ID: ${result.surfaceId}. Thread: ${result.threadId}. (not persisted)`

      return {
        content: [{ type: 'text', text: summary }],
        details: {
          stage: 'complete',
          surfaceId: result.surfaceId,
          elementCount: result.elementCount,
          qualityScore: result.qualityScore,
          repairCount: result.repairCount,
          durationMs: result.durationMs,
          treeId: result.treeId,
          threadId: result.threadId,
        },
      }
    },
  })

  const refineTool = createGeniferRefineTool({
    async execute(callId, params, signal, onUpdate) {
      const result = await Effect.runPromise(
        service.refine({
          surfaceId: params.surfaceId,
          instruction: params.instruction,
          sessionId,
          persist: params.persist ?? true,
          onProgress: onUpdate
            ? (status, elementCount) => {
                onUpdate({
                  content: [{ type: 'text', text: `Refining... ${elementCount} elements (${status})` }],
                  details: {
                    stage: status as any,
                    surfaceId: callId,
                    sourceSurfaceId: params.surfaceId,
                    elementCount,
                  },
                })
              }
            : undefined,
        }),
      )

      const summary = `Refined surface ${result.sourceSurfaceId} → ${result.surfaceId}. ${result.elementCount} elements. +${result.addedElements} added, -${result.removedElements} removed, ~${result.modifiedElements} modified. Quality: ${(result.qualityScore * 100).toFixed(0)}%. Duration: ${result.durationMs}ms.`

      return {
        content: [{ type: 'text', text: summary }],
        details: {
          stage: 'complete',
          surfaceId: result.surfaceId,
          sourceSurfaceId: result.sourceSurfaceId,
          elementCount: result.elementCount,
          addedElements: result.addedElements,
          removedElements: result.removedElements,
          modifiedElements: result.modifiedElements,
          qualityScore: result.qualityScore,
          treeId: result.treeId,
        },
      }
    },
  })

  const queryTool = createGeniferQueryTool({
    async execute(callId, params, _signal, _onUpdate) {
      const result = await Effect.runPromise(
        service.query(params.operation as any, params.args as any),
      )

      const dataStr = JSON.stringify(result.data, null, 2)
      const truncated = dataStr.length > 4000 ? dataStr.slice(0, 4000) + '\n... (truncated)' : dataStr

      return {
        content: [{ type: 'text', text: `Query ${params.operation}:\n${truncated}` }],
        details: {
          operation: params.operation,
          data: result.data,
        },
      }
    },
  })

  // ── Meta-Tools ──

  const defineRpcTool = createGeniferDefineRpcTool({
    async execute(_callId, params) {
      try {
        const def = new RpcDefinition({
          tag: params.tag,
          description: params.description ?? '',
          handler: params.handler as any as RpcHandler,
          payloadSchema: params.payloadSchema,
          resultSchema: params.responseSchema,
          source: 'dynamic',
          registeredAt: Date.now(),
        })
        registerDynamicRpc(params.tag, def)
        return {
          content: [{ type: 'text', text: `RPC '${params.tag}' registered. ActionGroups can now reference it via callRpc("${params.tag}", payload).` }],
          details: { tag: params.tag, registered: true },
        }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Failed to register RPC '${params.tag}': ${e instanceof Error ? e.message : e}` }],
          details: { tag: params.tag, registered: false },
        }
      }
    },
  })

  const defineEventTool = createGeniferDefineEventTool({
    async execute(_callId, params) {
      try {
        const def = new EventDefinition({
          tag: params.tag,
          description: params.description ?? '',
          payloadSchema: params.payloadSchema,
          source: 'dynamic',
          definedAt: Date.now(),
        })
        defineDynamicEvent(params.tag, def)
        return {
          content: [{ type: 'text', text: `Event '${params.tag}' registered. ActionGroups can now emit it via emitEvent("${params.tag}", payload).` }],
          details: { tag: params.tag, registered: true },
        }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Failed to register event '${params.tag}': ${e instanceof Error ? e.message : e}` }],
          details: { tag: params.tag, registered: false },
        }
      }
    },
  })

  /**
   * Dynamic tools registered during this session.
   * The LLM can call these in subsequent turns.
   */
  const dynamicTools = new Map<string, ToolDefinition>()

  const defineToolTool = createGeniferDefineToolTool({
    async execute(_callId, params) {
      try {
        // Create a ToolDefinition that dispatches based on handler type
        const newTool: ToolDefinition = {
          name: params.name,
          label: params.label,
          description: params.description,
          parameters: Type.Record(Type.String(), Type.Unknown()),
          async execute(toolCallId, toolParams, _signal, _onUpdate, _ctx) {
            const handler = params.handler
            switch (handler.type) {
              case 'http': {
                const resp = await fetch(handler.url, {
                  method: handler.method ?? 'GET',
                  headers: handler.headers ?? {},
                  ...(handler.method !== 'GET' ? { body: JSON.stringify(toolParams) } : {}),
                })
                const text = await resp.text()
                return { content: [{ type: 'text', text }] }
              }
              case 'rpc': {
                const result = callDynamicRpc(handler.target, toolParams)
                return { content: [{ type: 'text', text: JSON.stringify(result) }] }
              }
              case 'genifer_generate': {
                // Delegate to the generate tool
                const genResult = await Effect.runPromise(
                  service.generate({
                    prompt: handler.prompt,
                    sessionId,
                    persist: false,
                  }),
                )
                return { content: [{ type: 'text', text: `Generated surface ${genResult.surfaceId} with ${genResult.elementCount} elements.` }] }
              }
              case 'script': {
                return { content: [{ type: 'text', text: `Script execution not yet implemented: ${handler.command}` }] }
              }
              default:
                return { content: [{ type: 'text', text: `Unknown handler type` }] }
            }
          },
        }

        dynamicTools.set(params.name, newTool)

        return {
          content: [{ type: 'text', text: `Tool '${params.name}' registered. You can now call it as a tool in subsequent turns.` }],
          details: { name: params.name, registered: true },
        }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Failed to register tool '${params.name}': ${e instanceof Error ? e.message : e}` }],
          details: { name: params.name, registered: false },
        }
      }
    },
  })

  const codeTool = createGeniferCodeTool({
    async execute(_callId, params) {
      try {
        const result = await Effect.runPromise(
          executeCodeMode(params, { geointService: options?.geointService }),
        )
        const summary = result.success
          ? `Code executed successfully (${result.mode}, ${result.durationMs}ms).${
              result.exposed ? ` Exposed: ${JSON.stringify(result.exposed)}` : ''
            }${result.result !== null && result.result !== undefined ? `\nResult: ${JSON.stringify(result.result).slice(0, 500)}` : ''}`
          : `Code execution failed: ${result.error}`

        return {
          content: [{ type: 'text', text: summary }],
          details: {
            mode: result.mode,
            success: result.success,
            result: result.result,
            exposed: result.exposed as any,
            durationMs: result.durationMs,
            error: result.error,
          },
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return {
          content: [{ type: 'text', text: `Code mode error: ${msg}` }],
          details: {
            mode: params.mode,
            success: false,
            durationMs: 0,
            error: msg,
          },
        }
      }
    },
  })

  const exportTool = createGeniferExportExtensionTool({
    async execute(_callId, params) {
      try {
        const surface = service.getSurface(params.surfaceId)
        if (!surface) {
          return {
            content: [{ type: 'text', text: `Surface '${params.surfaceId}' not found. Use genifer_generate first.` }],
            details: { name: params.name, surfaceId: params.surfaceId, bundled: { rpcs: 0, events: 0, tools: 0, atoms: 0, elements: 0 } },
          }
        }

        // Count what we're bundling
        const { getDynamicRpcs } = await import('../services/DynamicRpcService')
        const { getDynamicEventDefinitions } = await import('../services/DynamicEventService')
        const { getDynamicTools: getCodeTools } = await import('../code-mode/sandbox')

        const rpcs = (params.includeRpcs !== false) ? getDynamicRpcs() : new Map()
        const events = (params.includeEvents !== false) ? getDynamicEventDefinitions() : new Map()
        const tools = (params.includeTools !== false) ? getCodeTools() : new Map()
        const elementCount = surface.treeSnapshot
          ? Object.keys(surface.treeSnapshot.elements ?? {}).length
          : 0

        const bundled = {
          rpcs: rpcs.size,
          events: events.size,
          tools: tools.size,
          atoms: 0, // TODO: if includeAtoms, count session atoms
          elements: elementCount,
        }

        // Build extension manifest (portable JSON)
        const manifest = {
          name: params.name,
          description: params.description ?? '',
          version: '0.1.0',
          surfaceId: params.surfaceId,
          surface: surface.treeSnapshot,
          registrations: {
            rpcs: params.includeRpcs !== false ? Array.from(rpcs.entries()).map(([tag, def]) => ({ tag, description: (def as any).description ?? '' })) : [],
            events: params.includeEvents !== false ? Array.from(events.entries()).map(([tag, def]) => ({ tag, description: (def as any).description ?? '' })) : [],
            tools: params.includeTools !== false ? Array.from(tools.entries()).map(([name, spec]) => ({ name, label: spec.label, description: spec.description })) : [],
          },
          exportedAt: Date.now(),
        }

        return {
          content: [{ type: 'text', text: `Extension '${params.name}' bundled: ${bundled.elements} elements, ${bundled.rpcs} RPCs, ${bundled.events} events, ${bundled.tools} tools.\n\nManifest:\n${JSON.stringify(manifest, null, 2).slice(0, 2000)}` }],
          details: { name: params.name, surfaceId: params.surfaceId, bundled },
        }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Export failed: ${e instanceof Error ? e.message : e}` }],
          details: { name: params.name, surfaceId: params.surfaceId, bundled: { rpcs: 0, events: 0, tools: 0, atoms: 0, elements: 0 } },
        }
      }
    },
  })

  return [generateTool, refineTool, queryTool, defineRpcTool, defineEventTool, defineToolTool, codeTool, exportTool]
}

// =============================================================================
// Dynamic Tool Definitions — reads from code-mode sandbox
// =============================================================================

/**
 * Get ToolDefinitions for dynamically registered tools.
 * Call this at turn boundaries to merge into the LLM's tool manifest.
 *
 * Tools registered via:
 *   - genifer_define_tool (bridge.ts dynamicTools Map)
 *   - sdk.register.tool() (code-mode sandbox dynamicTools Map)
 */
export function getDynamicToolDefinitions(): ToolDefinition[] {
  const tools = getCodeModeDynamicTools() as ReadonlyMap<string, {
    name: string
    label: string
    description: string
    execute: (params: any) => Promise<any>
  }>

  const defs: ToolDefinition[] = []
  for (const [, spec] of tools) {
    defs.push({
      name: spec.name,
      label: spec.label,
      description: spec.description,
      parameters: Type.Record(Type.String(), Type.Unknown()),
      async execute(toolCallId, params, _signal, _onUpdate, _ctx) {
        try {
          const result = await spec.execute(params)
          return {
            content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result) }],
          }
        } catch (e) {
          return {
            content: [{ type: 'text', text: `Dynamic tool error: ${e instanceof Error ? e.message : e}` }],
          }
        }
      },
    })
  }

  return defs
}
