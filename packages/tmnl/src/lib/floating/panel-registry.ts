/**
 * Panel Content Registry
 *
 * Global registry mapping visitorId → React component factories.
 * Panels with a `visitorId` render the registered component instead
 * of empty space. This enables spawning live content (MorphChat,
 * conductor, terminal, etc.) into any panel.
 *
 * Usage:
 *   // Register at module load
 *   panelRegistry.register('morphchat', {
 *     label: 'MorphChat',
 *     icon: '💬',
 *     component: lazy(() => import('./morphchat/MorphChatPanel')),
 *   })
 *
 *   // Spawn a panel with that content
 *   spawnPanel('morphchat')
 *
 * @module
 */

import { type ComponentType, type LazyExoticComponent } from 'react'
import type { StateTier } from './types/strip'

// =============================================================================
// Types
// =============================================================================

export interface PanelContentEntry {
  /** Human-readable label for the panel spawner UI */
  label: string
  /** Optional icon (emoji or component) */
  icon?: string
  /** Optional description */
  description?: string
  /** Optional category for grouping in spawn menu */
  category?: string
  /** The React component to render inside the panel */
  component: ComponentType<PanelContentProps> | LazyExoticComponent<ComponentType<PanelContentProps>>
  /**
   * State preservation tier for virtualization.
   *   full     — always mounted, never unmounted (WebSocket panels, live streams)
   *   partial  — state snapshot on unmount, restore on remount
   *   stateless — free to destroy and reconstruct
   * Default: 'stateless'
   */
  stateTier?: StateTier
  /** Default panel config overrides */
  defaults?: {
    width?: number
    height?: number
    mode?: 'tiled' | 'floating'
    accent?: string
  }
}

export interface PanelContentProps {
  /** Panel ID this content is mounted in */
  panelId: string
  /** Arbitrary data passed via visitorData */
  data?: unknown
}

// =============================================================================
// Registry
// =============================================================================

const entries = new Map<string, PanelContentEntry>()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach(fn => fn())
}

export const panelRegistry = {
  /** Register a panel content type */
  register(visitorId: string, entry: PanelContentEntry): void {
    entries.set(visitorId, entry)
    notify()
  },

  /** Unregister a panel content type */
  unregister(visitorId: string): void {
    entries.delete(visitorId)
    notify()
  },

  /** Get a registered entry */
  get(visitorId: string): PanelContentEntry | undefined {
    return entries.get(visitorId)
  },

  /** Check if a visitorId is registered */
  has(visitorId: string): boolean {
    return entries.has(visitorId)
  },

  /** Get all registered entries */
  getAll(): Map<string, PanelContentEntry> {
    return new Map(entries)
  },

  /** Get entries as array for iteration */
  list(): Array<{ id: string } & PanelContentEntry> {
    return Array.from(entries.entries()).map(([id, entry]) => ({ id, ...entry }))
  },

  /** Subscribe to registry changes */
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
} as const
