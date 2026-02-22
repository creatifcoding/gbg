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
import type { GeniferHarnessServiceShape } from './GeniferHarnessService'
import type {
  GeniferGenerateParams,
  GeniferRefineParams,
  GeniferQueryParams,
  GeniferGenerateDetails,
  GeniferRefineDetails,
  GeniferQueryDetails,
} from './tools'
import {
  createGeniferGenerateTool,
  createGeniferRefineTool,
  createGeniferQueryTool,
} from './tools'
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

  return [generateTool, refineTool, queryTool]
}
