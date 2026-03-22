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
import { Effect } from 'effect'
import type {
  SubscriptionConfig,
  SubscriptionManagerServiceShape,
} from '../../panels/subscriptions/schemas'

// ─────────────────────────────────────────────────────────────────────────────
// TypeBox Parameter Schema
// ─────────────────────────────────────────────────────────────────────────────

export const SpawnPanelSubscriptionParams = Type.Object({
  mode: Type.Union([
    Type.Literal('poll'),
    Type.Literal('reactive'),
    Type.Literal('stream'),
  ], {
    description: 'Subscription mode for auto-regeneration.',
  }),
  intervalMs: Type.Optional(Type.Number({
    description: 'Poll interval (poll mode) or debounce interval (reactive mode).',
  })),
  dependsOn: Type.Optional(Type.Array(Type.String(), {
    description: 'Panel IDs to observe for dependency changes (reactive mode).',
  })),
  promptTemplate: Type.Optional(Type.String({
    description: 'Prompt template used when regeneration runs.',
  })),
  ttlMs: Type.Optional(Type.Number({
    description: 'Optional subscription TTL in milliseconds.',
  })),
})
export type SpawnPanelSubscriptionParams = Static<typeof SpawnPanelSubscriptionParams>

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
  subscription: Type.Optional(SpawnPanelSubscriptionParams),
})
export type SpawnPanelParams = Static<typeof SpawnPanelParams>

// ─────────────────────────────────────────────────────────────────────────────
// Tool Details (returned in tool result)
// ─────────────────────────────────────────────────────────────────────────────

export interface SpawnPanelDetails {
  surfaceId?: string
  panelId?: string
  operation: 'spawn' | 'update' | 'close' | 'display'
  subscriptionAttached?: boolean
  subscriptionError?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Bridge interface — injected by harness wiring
// ─────────────────────────────────────────────────────────────────────────────

export interface SpawnPanelBridge {
  /** Generate a new Genifer surface from a prompt (fire-and-forget: resolves immediately with surfaceId) */
  generate: (prompt: string, threadId?: string) => Promise<{ surfaceId: string; surface?: unknown }>
  /**
   * Kick off generation in background — returns immediately with a pre-allocated surfaceId.
   * Generation runs as a detached fiber. Panel renders incrementally via atom subscription.
   * Falls back to `generate` if not provided (for backward compat).
   */
  generateAsync?: (prompt: string, threadId?: string) => { surfaceId: string }
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
    surface?: unknown
  }) => string | null
  /** Close a floating panel */
  closePanel: (panelId: string) => void
  /** Optional subscription manager for post-spawn auto-regeneration wiring */
  subscriptionManager?: SubscriptionManagerServiceShape | null
}

interface SubscriptionAttachResult {
  readonly attached: boolean
  readonly error?: string
}

const maybeAttachSubscription = async (
  bridge: SpawnPanelBridge,
  panelId: string | null,
  surfaceId: string,
  subscription?: SpawnPanelSubscriptionParams,
): Promise<SubscriptionAttachResult> => {
  if (!subscription) {
    return { attached: false }
  }

  if (!panelId) {
    return {
      attached: false,
      error: 'Subscription requested but panel spawn did not return a panelId.',
    }
  }

  if (!bridge.subscriptionManager) {
    return {
      attached: false,
      error: 'Subscription requested but SubscriptionManagerService is unavailable.',
    }
  }

  try {
    await Effect.runPromise(
      bridge.subscriptionManager.attach(panelId, surfaceId, subscription as SubscriptionConfig),
    )
    return { attached: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      attached: false,
      error: `Failed to attach subscription for panel ${panelId}: ${message}`,
    }
  }
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
    description: `Spawn a floating UI panel with AI-generated content. Use 'prompt' to generate new UI, 'surfaceId' to display an existing surface, 'update' to refine a surface, or 'close' to dismiss a panel. Panels are interactive, draggable, and resizable. You can optionally pass a 'subscription' config to auto-attach panel regeneration behavior after spawn. The agent can push updates to panels by calling spawn_panel again with the surfaceId and an update instruction.`,
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

        const subscription = await maybeAttachSubscription(
          bridge,
          panelId,
          params.surfaceId,
          params.subscription,
        )
        const suffix = subscription.error
          ? ` Subscription not attached: ${subscription.error}`
          : subscription.attached
            ? ' Subscription attached.'
            : ''

        return {
          content: [{ type: 'text', text: `Displayed surface ${params.surfaceId} in panel ${panelId}.${suffix}` }],
          details: {
            surfaceId: params.surfaceId,
            panelId: panelId ?? undefined,
            operation: 'display',
            subscriptionAttached: subscription.attached ? true : undefined,
            subscriptionError: subscription.error,
          },
        }
      }

      // ── Generate new surface → spawn panel (fire-and-forget) ────
      if (params.prompt) {
        // Fire-and-forget: allocate surfaceId + panelId synchronously,
        // kick off generation in background, return immediately.
        // The panel renders incrementally via atom subscription as
        // Genifer streams tokens → partial UITrees → final surface.
        if (bridge.generateAsync) {
          const { surfaceId } = bridge.generateAsync(params.prompt, params.threadId)

          const panelId = bridge.spawnPanel(surfaceId, {
            title: params.title ?? params.prompt.slice(0, 50),
            prompt: params.prompt,
            threadId: params.threadId,
            width: params.width,
            height: params.height,
            mode: params.mode,
            // No surface yet — panel shows spinner, then streams content
          })

          const subscription = await maybeAttachSubscription(
            bridge,
            panelId,
            surfaceId,
            params.subscription,
          )
          const suffix = subscription.error
            ? ` Subscription not attached: ${subscription.error}`
            : subscription.attached
              ? ' Subscription attached.'
              : ''

          return {
            content: [{ type: 'text', text: `Panel ${panelId} spawning with surface ${surfaceId}. Content will render incrementally — no need to wait. You can update it later with spawn_panel({ surfaceId: "${surfaceId}", update: "..." }).${suffix}` }],
            details: {
              surfaceId,
              panelId: panelId ?? undefined,
              operation: 'spawn',
              async: true,
              subscriptionAttached: subscription.attached ? true : undefined,
              subscriptionError: subscription.error,
            },
          }
        }

        // Fallback: synchronous generate (legacy path / tests without generateAsync)
        onUpdate?.({
          content: [{ type: 'text', text: `Generating UI: "${params.prompt}"…` }],
        })

        const { surfaceId, surface } = await bridge.generate(params.prompt, params.threadId)

        const panelId = bridge.spawnPanel(surfaceId, {
          title: params.title ?? params.prompt.slice(0, 50),
          prompt: params.prompt,
          threadId: params.threadId,
          width: params.width,
          height: params.height,
          mode: params.mode,
          surface,
        })

        const subscription = await maybeAttachSubscription(
          bridge,
          panelId,
          surfaceId,
          params.subscription,
        )
        const suffix = subscription.error
          ? ` Subscription not attached: ${subscription.error}`
          : subscription.attached
            ? ' Subscription attached.'
            : ''

        return {
          content: [{ type: 'text', text: `Panel spawned with surface ${surfaceId}. Panel ID: ${panelId}. You can update it with spawn_panel({ surfaceId: "${surfaceId}", update: "..." }).${suffix}` }],
          details: {
            surfaceId,
            panelId: panelId ?? undefined,
            operation: 'spawn',
            subscriptionAttached: subscription.attached ? true : undefined,
            subscriptionError: subscription.error,
          },
        }
      }

      return {
        content: [{ type: 'text', text: 'No operation specified. Provide either prompt, surfaceId, or panelId + close.' }],
        isError: true,
      }
    },
  }
}
