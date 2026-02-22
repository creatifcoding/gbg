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
} from './tools'
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

  return [generateTool, refineTool, queryTool, defineRpcTool, defineEventTool, defineToolTool]
}
