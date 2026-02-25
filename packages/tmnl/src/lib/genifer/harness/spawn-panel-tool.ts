/**
 * spawn_panel Tool — Agent-callable tool that creates a Genifer surface
 * and spawns it in a floating panel.
 *
 * Operations:
 *   - command (with prompt): Generate surface → spawn panel
 *   - surfaceId (without prompt): Spawn existing surface in panel
 *   - surfaceId + update: Refine existing surface (panel auto-updates via atom)
 *   - panelId + close: Close a panel
 *
 * @module genifer/harness/spawn-panel-tool
 */

import { Type, type Static } from '@sinclair/typebox'
import type { ToolDefinition } from '@mariozechner/pi-coding-agent'

// ─────────────────────────────────────────────────────────────────────────────
// TypeBox Parameter Schema
// ─────────────────────────────────────────────────────────────────────────────

export const SpawnPanelParams = Type.Object({
  prompt: Type.Optional(Type.String({
    description: 'Natural language description of the UI to generate and display in a panel.',
  })),
  surfaceId: Type.Optional(Type.String({
    description: 'Existing surface ID to display in a panel, or to update.',
  })),
  update: Type.Optional(Type.String({
    description: 'Refinement instruction for an existing surface (requires surfaceId).',
  })),
  panelId: Type.Optional(Type.String({
    description: 'Panel ID to operate on (for close, resize, etc.).',
  })),
  close: Type.Optional(Type.Boolean({
    description: 'Close the panel identified by panelId.',
  })),
  title: Type.Optional(Type.String({
    description: 'Title for the floating panel.',
  })),
  width: Type.Optional(Type.Number({
    description: 'Panel width in pixels (default: 480).',
  })),
  height: Type.Optional(Type.Number({
    description: 'Panel height in pixels (default: 400).',
  })),
  mode: Type.Optional(Type.Union([
    Type.Literal('floating'),
    Type.Literal('tiled'),
  ], {
    description: 'Panel display mode. Default: floating.',
  })),
  threadId: Type.Optional(Type.String({
    description: 'Conversation thread ID for context continuity.',
  })),
})
export type SpawnPanelParams = Static<typeof SpawnPanelParams>

// ─────────────────────────────────────────────────────────────────────────────
// Tool Details (returned in tool result)
// ─────────────────────────────────────────────────────────────────────────────

export interface SpawnPanelDetails {
  surfaceId?: string
  panelId?: string
  operation: 'spawn' | 'update' | 'close' | 'display'
}

// ─────────────────────────────────────────────────────────────────────────────
// Bridge interface — injected by harness wiring
// ─────────────────────────────────────────────────────────────────────────────

export interface SpawnPanelBridge {
  /** Generate a new Genifer surface from a prompt */
  generate: (prompt: string, threadId?: string) => Promise<{ surfaceId: string }>
  /** Refine an existing surface */
  refine: (surfaceId: string, instruction: string) => Promise<void>
  /** Spawn a floating panel with a Genifer surface */
  spawnPanel: (surfaceId: string, opts: {
    title?: string
    prompt?: string
    threadId?: string
    width?: number
    height?: number
    mode?: 'floating' | 'tiled'
  }) => string | null
  /** Close a floating panel */
  closePanel: (panelId: string) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Factory
// ─────────────────────────────────────────────────────────────────────────────

export function createSpawnPanelTool(
  bridge: SpawnPanelBridge,
): ToolDefinition<typeof SpawnPanelParams, SpawnPanelDetails> {
  return {
    name: 'spawn_panel',
    label: 'Spawn Panel',
    description: `Spawn a floating UI panel with AI-generated content. Use 'prompt' to generate new UI, 'surfaceId' to display an existing surface, 'update' to refine a surface, or 'close' to dismiss a panel. Panels are interactive, draggable, and resizable. The agent can push updates to panels by calling spawn_panel again with the surfaceId and an update instruction.`,
    parameters: SpawnPanelParams,
    async execute(_toolCallId, params, _signal, onUpdate) {
      // ── Close operation ─────────────────────────────────────────
      if (params.panelId && params.close) {
        bridge.closePanel(params.panelId)
        return {
          content: [{ type: 'text', text: `Panel ${params.panelId} closed.` }],
          details: { panelId: params.panelId, operation: 'close' },
        }
      }

      // ── Update existing surface ─────────────────────────────────
      if (params.surfaceId && params.update) {
        await bridge.refine(params.surfaceId, params.update)
        return {
          content: [{ type: 'text', text: `Surface ${params.surfaceId} updated: "${params.update}"` }],
          details: { surfaceId: params.surfaceId, operation: 'update' },
        }
      }

      // ── Display existing surface ────────────────────────────────
      if (params.surfaceId && !params.prompt) {
        const panelId = bridge.spawnPanel(params.surfaceId, {
          title: params.title,
          width: params.width,
          height: params.height,
          mode: params.mode,
        })
        return {
          content: [{ type: 'text', text: `Displayed surface ${params.surfaceId} in panel ${panelId}.` }],
          details: { surfaceId: params.surfaceId, panelId: panelId ?? undefined, operation: 'display' },
        }
      }

      // ── Generate new surface → spawn panel ──────────────────────
      if (params.prompt) {
        onUpdate?.({
          content: [{ type: 'text', text: `Generating UI: "${params.prompt}"…` }],
        })

        const { surfaceId } = await bridge.generate(params.prompt, params.threadId)

        const panelId = bridge.spawnPanel(surfaceId, {
          title: params.title ?? params.prompt.slice(0, 50),
          prompt: params.prompt,
          threadId: params.threadId,
          width: params.width,
          height: params.height,
          mode: params.mode,
        })

        return {
          content: [{ type: 'text', text: `Panel spawned with surface ${surfaceId}. Panel ID: ${panelId}. You can update it with spawn_panel({ surfaceId: "${surfaceId}", update: "..." }).` }],
          details: { surfaceId, panelId: panelId ?? undefined, operation: 'spawn' },
        }
      }

      return {
        content: [{ type: 'text', text: 'No operation specified. Provide either prompt, surfaceId, or panelId + close.' }],
        isError: true,
      }
    },
  }
}
