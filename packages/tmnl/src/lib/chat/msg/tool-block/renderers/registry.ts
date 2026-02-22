/**
 * Tool Renderer Registry — reactive, extensible dispatch for tool rendering.
 *
 * **Extension-ready**: Any code (barrel imports, pi extensions, MCP tool
 * discovery, consumer components) can register renderers at any time. React
 * components subscribing via `useToolRenderer()` re-render automatically.
 *
 * Backed by `useSyncExternalStore` — no effect-atom dependency. The registry
 * is infrastructure, not domain state.
 *
 * ## Registration
 *
 * ```ts
 * // Single call — renderer + header meta bundled
 * registerToolRenderer('Read', ReadToolRenderer, ReadHeaderMeta)
 *
 * // Definition object — cleaner for extensions
 * registerToolDefinition({
 *   name: 'my-custom-tool',
 *   aliases: ['MyCustomTool'],
 *   renderer: MyCustomRenderer,
 *   headerMeta: MyCustomHeaderMeta,
 * })
 * ```
 *
 * ## Consumption
 *
 * ```tsx
 * // Reactive hook — re-renders when registry changes
 * const entry = useToolRenderer('Read')
 * const Renderer = entry?.renderer ?? GenericToolRenderer
 * const HeaderMeta = entry?.headerMeta
 *
 * // Static lookup (non-React, barrel imports, SSR)
 * const Renderer = getToolRenderer('Read')
 * ```
 *
 * @module chat/msg/tool-block/renderers/registry
 */

import { type ComponentType, useSyncExternalStore } from 'react'

// =============================================================================
// Renderer Props Contract
// =============================================================================

export interface ToolRendererProps {
  /** Tool invocation input (parsed JSON) */
  input?: unknown
  /** Tool invocation output (parsed JSON or string) */
  output?: unknown
  /** Error text if tool failed */
  errorText?: string
  /** Tool lifecycle state */
  state: string
  /** Tool call ID */
  toolCallId: string
}

// =============================================================================
// Entry + Definition shapes
// =============================================================================

export interface ToolRendererEntry {
  readonly renderer: ComponentType<ToolRendererProps>
  readonly headerMeta: ComponentType<ToolRendererProps> | null
}

/**
 * Extension-friendly definition object. Bundle renderer + header meta +
 * name aliases in a single declaration.
 */
export interface ToolRendererDefinition {
  /** Primary tool name (used as registry key) */
  readonly name: string
  /** Additional names that resolve to the same renderer (e.g. cased variants) */
  readonly aliases?: readonly string[]
  /** Expanded detail renderer */
  readonly renderer: ComponentType<ToolRendererProps>
  /** Collapsed header metadata component (optional) */
  readonly headerMeta?: ComponentType<ToolRendererProps>
}

// =============================================================================
// Reactive store (useSyncExternalStore compatible)
// =============================================================================

const entries = new Map<string, ToolRendererEntry>()
const listeners = new Set<() => void>()
let snapshot = 0

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function getSnapshot(): number {
  return snapshot
}

// SSR: same as client — registry is module-scoped singleton
const getServerSnapshot = getSnapshot

function notify(): void {
  snapshot++
  listeners.forEach(fn => fn())
}

// =============================================================================
// Registration API
// =============================================================================

/**
 * Register a tool renderer — and optionally its header meta.
 *
 * Triggers reactive update: components using `useToolRenderer()` re-render.
 *
 * ```ts
 * registerToolRenderer('Read', ReadToolRenderer, ReadHeaderMeta)
 * ```
 */
export function registerToolRenderer(
  toolName: string,
  renderer: ComponentType<ToolRendererProps>,
  headerMeta?: ComponentType<ToolRendererProps>,
): void {
  entries.set(toolName, { renderer, headerMeta: headerMeta ?? null })
  notify()
}

/**
 * Register from a definition object — cleaner for extensions.
 *
 * Automatically registers all aliases to the same entry.
 *
 * ```ts
 * registerToolDefinition({
 *   name: 'my-tool',
 *   aliases: ['MyTool', 'MY_TOOL'],
 *   renderer: MyToolRenderer,
 *   headerMeta: MyToolHeaderMeta,
 * })
 * ```
 */
export function registerToolDefinition(def: ToolRendererDefinition): void {
  const entry: ToolRendererEntry = {
    renderer: def.renderer,
    headerMeta: def.headerMeta ?? null,
  }
  entries.set(def.name, entry)
  if (def.aliases) {
    for (const alias of def.aliases) {
      entries.set(alias, entry)
    }
  }
  notify()
}

/**
 * Unregister a tool renderer (and all its aliases).
 *
 * Useful for extension teardown / hot-reload.
 */
export function unregisterToolRenderer(toolName: string): boolean {
  const existed = entries.delete(toolName)
  if (existed) notify()
  return existed
}

/**
 * Batch-register multiple definitions without triggering per-item re-renders.
 *
 * Single notification at the end.
 */
export function registerToolDefinitions(defs: readonly ToolRendererDefinition[]): void {
  for (const def of defs) {
    const entry: ToolRendererEntry = {
      renderer: def.renderer,
      headerMeta: def.headerMeta ?? null,
    }
    entries.set(def.name, entry)
    if (def.aliases) {
      for (const alias of def.aliases) {
        entries.set(alias, entry)
      }
    }
  }
  notify()
}

// =============================================================================
// Static lookups (non-React, barrel imports, render-time)
// =============================================================================

/** Get the renderer for a tool name, or null for generic fallback */
export function getToolRenderer(
  toolName: string,
): ComponentType<ToolRendererProps> | null {
  return entries.get(toolName)?.renderer ?? null
}

/** Get the header meta for a tool name, or null */
export function getToolHeaderMeta(
  toolName: string,
): ComponentType<ToolRendererProps> | null {
  return entries.get(toolName)?.headerMeta ?? null
}

/** Get the full entry (renderer + headerMeta), or null */
export function getToolRendererEntry(
  toolName: string,
): ToolRendererEntry | null {
  return entries.get(toolName) ?? null
}

/** Check if a tool has a specialized renderer */
export function hasToolRenderer(toolName: string): boolean {
  return entries.has(toolName)
}

/** Get all registered tool names */
export function getRegisteredToolNames(): readonly string[] {
  return [...entries.keys()]
}

// =============================================================================
// React hooks (reactive — re-render on registry changes)
// =============================================================================

/**
 * Subscribe to the full registry entry for a tool.
 *
 * Re-renders when any renderer is registered/unregistered.
 *
 * ```tsx
 * const entry = useToolRenderer('Read')
 * const Renderer = entry?.renderer ?? GenericToolRenderer
 * const HeaderMeta = entry?.headerMeta // nullable
 * ```
 */
export function useToolRenderer(
  toolName: string,
): ToolRendererEntry | null {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return entries.get(toolName) ?? null
}

/**
 * Subscribe to the renderer component for a tool.
 *
 * Convenience — returns just the renderer, not the full entry.
 */
export function useToolRendererComponent(
  toolName: string,
): ComponentType<ToolRendererProps> | null {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return entries.get(toolName)?.renderer ?? null
}

/**
 * Subscribe to the header meta component for a tool.
 *
 * Convenience — returns just the header meta, not the full entry.
 */
export function useToolHeaderMeta(
  toolName: string,
): ComponentType<ToolRendererProps> | null {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return entries.get(toolName)?.headerMeta ?? null
}

// =============================================================================
// Deprecated — kept for backward compat
// =============================================================================

/** @deprecated Use registerToolRenderer(name, renderer, headerMeta) or registerToolDefinition(). */
export function registerToolHeaderMeta(
  toolName: string,
  component: ComponentType<ToolRendererProps>,
): void {
  const existing = entries.get(toolName)
  if (existing) {
    entries.set(toolName, { ...existing, headerMeta: component })
  } else {
    entries.set(toolName, { renderer: component, headerMeta: component })
  }
  notify()
}
