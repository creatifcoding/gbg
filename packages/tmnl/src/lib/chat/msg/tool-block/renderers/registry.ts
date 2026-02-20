/**
 * Tool Renderer Registry — dispatches tool output rendering by toolName.
 *
 * Each SDK tool (read, bash, edit, write, grep, find, ls) can register
 * a specialized renderer. Unknown tools fall back to GenericToolRenderer.
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

const renderers = new Map<string, ComponentType<ToolRendererProps>>()

/** Register a specialized renderer for a tool name */
export function registerToolRenderer(
  toolName: string,
  component: ComponentType<ToolRendererProps>,
): void {
  renderers.set(toolName, component)
}

/** Get the renderer for a tool name, or null for generic fallback */
export function getToolRenderer(
  toolName: string,
): ComponentType<ToolRendererProps> | null {
  return renderers.get(toolName) ?? null
}

/** Check if a tool has a specialized renderer */
export function hasToolRenderer(toolName: string): boolean {
  return renderers.has(toolName)
}
