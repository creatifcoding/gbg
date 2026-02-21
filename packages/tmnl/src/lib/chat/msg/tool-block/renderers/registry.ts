/**
 * Tool Renderer Registry — dispatches tool output rendering by toolName.
 *
 * Each SDK tool (read, bash, edit, write, grep, find, ls) can register:
 * - A **renderer** — the expanded detail view
 * - A **header meta** — a small component rendered inline in the collapsed
 *   tool-block header. Receives the same props. Renderer decides what to
 *   surface (file path, command, pattern, line range — anything).
 *
 * Unknown tools fall back to GenericToolRenderer with no header meta.
 *
 * @module chat/msg/tool-block/renderers/registry
 */

import type { ComponentType } from 'react'

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
// Registry
// =============================================================================

// =============================================================================
// Registration entry — renderer + optional header meta
// =============================================================================

interface ToolRendererEntry {
  renderer: ComponentType<ToolRendererProps>
  headerMeta: ComponentType<ToolRendererProps> | null
}

const entries = new Map<string, ToolRendererEntry>()

/**
 * Register a tool renderer — and optionally its header meta in the same call.
 *
 * HeaderMeta is a small component rendered inline in the collapsed tool-block
 * header. Each tool decides what contextual metadata to surface there.
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
}

/** @deprecated Use the 3-arg registerToolRenderer. Kept for incremental migration. */
export function registerToolHeaderMeta(
  toolName: string,
  component: ComponentType<ToolRendererProps>,
): void {
  const existing = entries.get(toolName)
  if (existing) {
    existing.headerMeta = component
  } else {
    // Shouldn't happen — renderer should be registered first
    entries.set(toolName, { renderer: component, headerMeta: component })
  }
}

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

/** Check if a tool has a specialized renderer */
export function hasToolRenderer(toolName: string): boolean {
  return entries.has(toolName)
}
