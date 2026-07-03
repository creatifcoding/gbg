/**
 * Harness adapter types — interfaces, type aliases, constants.
 *
 * Pure leaf module: no runtime dependencies.
 *
 * @module morphchat/hooks/harness-adapter/types
 */

import type { Effect } from 'effect'
import type { PanelEvent } from '@/lib/genifer/harness/panel-events'
import type { HarnessRole, HarnessSessionId } from '@/lib/harness/schemas'
import type { MorphChatAdapter } from '../../schemas/adapter-types'

// ─── Constants ────────────────────────────────────────────────────────────────

export const HARNESS_ROLES = ['scada-analyst', 'code-assistant', 'navigator', 'inspector', 'general'] as const

// ─── Data Interfaces ──────────────────────────────────────────────────────────

export interface HarnessModelOption {
  readonly id: string
  readonly modelId: string
  readonly label: string
  readonly provider: string
  readonly description?: string
  readonly color?: string
  readonly reasoning?: boolean
  /** False when Pi knows the model but this provider is not authenticated. */
  readonly available?: boolean
}

export interface HarnessStatusRow {
  readonly id: string
  readonly tone: 'info' | 'warn' | 'error'
  readonly text: string
  readonly code?: string
  readonly details?: unknown
  readonly source?: 'harness' | 'surface' | 'mock'
}

export interface ContextUsage {
  readonly contextTokens: number
  readonly contextWindow: number
  readonly contextPercent: number
  readonly totalInput: number
  readonly totalOutput: number
  readonly totalCacheRead: number
  readonly totalCacheWrite: number
  readonly totalCost: number
  readonly compactionMode: 'auto' | 'manual' | 'disabled'
  readonly compactionStatus: 'idle' | 'compacting' | 'completed'
  readonly compactionCount: number
}

export interface HarnessInstanceConfig {
  readonly nodeId: string
  readonly role: HarnessRole
  readonly agentName: string
}

// ─── Panel Replay Deps ────────────────────────────────────────────────────────

export interface ReplaySafePanelEventDeps {
  registerGeniferPanelVisitor: () => void
  setGeniferPanelSurface: (surfaceId: string, surface: unknown) => void
  spawnPanel: (visitorId: string, opts: {
    mode?: 'floating' | 'tiled'
    title?: string
    data?: unknown
    accent?: string
  }) => string | null
  closePanel: (panelId: string) => void
  remoteToLocalPanelIds: Map<string, string>
  panelExists?: (panelId: string) => boolean
  remotePanelSurfaceIds?: Map<string, string>
  surfaceToLocalPanelIds?: Map<string, string>
}

// ─── Hook Config / Result ─────────────────────────────────────────────────────

export interface UseHarnessAdapterConfig {
  /** Unique instance ID — each ID gets fully isolated state (Cursor-style) */
  readonly instanceId: string
  readonly nodeId: string
  readonly role: HarnessRole
  readonly agentName?: string
  readonly autoConnect?: boolean
}

export type HarnessAdapterStatus = 'idle' | 'connecting' | 'connected' | 'error'

export interface UseHarnessAdapterResult {
  readonly adapter: MorphChatAdapter
  readonly status: HarnessAdapterStatus
  readonly error: string | null
  readonly connect: (args: { nodeId: string; role: HarnessRole; agentName: string }) => void
  readonly newSession: () => void
  readonly resumeSession: (sessionId: string) => void
  readonly resumePiSession: (path: string, sessionId?: string) => void
  readonly hardReconnect: () => void
}
