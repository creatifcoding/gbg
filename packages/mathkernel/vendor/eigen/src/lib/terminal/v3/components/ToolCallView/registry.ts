/**
 * Tool Component Registry
 *
 * Maps tool names to specialized React components for rendering.
 * Falls back to generic ToolCallView for unknown tools.
 */

import type { ComponentType } from 'react'
import type { ToolCallComplete, ToolResult } from '@/lib/ai-core/schemas'

// =============================================================================
// Types
// =============================================================================

/**
 * Props passed to all tool view components
 */
export interface ToolViewProps {
  /** The completed tool call with args */
  call: ToolCallComplete
  /** The tool result, if available */
  result: ToolResult | null
  /** Whether the tool is still executing */
  isPending: boolean
  /** Optional className for styling */
  className?: string
}

/**
 * Registry entry for a tool component
 */
interface ToolRegistryEntry {
  /** The React component to render */
  component: ComponentType<ToolViewProps>
  /** Human-readable display name */
  displayName: string
  /** Icon name (lucide-react) */
  icon?: string
  /** Tool description */
  description?: string
}

// =============================================================================
// Registry
// =============================================================================

const registry = new Map<string, ToolRegistryEntry>()

/**
 * Register a tool component
 */
export function registerToolComponent(
  toolName: string,
  entry: ToolRegistryEntry
): void {
  registry.set(toolName, entry)
}

/**
 * Get a tool component by name
 */
export function getToolComponent(toolName: string): ToolRegistryEntry | null {
  return registry.get(toolName) ?? null
}

/**
 * Get all registered tool names
 */
export function getRegisteredToolNames(): string[] {
  return Array.from(registry.keys())
}

/**
 * Check if a tool has a specialized component
 */
export function hasToolComponent(toolName: string): boolean {
  return registry.has(toolName)
}

// =============================================================================
// Tool Categories (for grouping in UI)
// =============================================================================

export type ToolCategory = 'filesystem' | 'search' | 'shell' | 'ai' | 'genifer' | 'mcp' | 'other'

const toolCategories: Record<string, ToolCategory> = {
  Read: 'filesystem',
  Write: 'filesystem',
  Edit: 'filesystem',
  Glob: 'search',
  Grep: 'search',
  Bash: 'shell',
  Task: 'ai',
  WebFetch: 'mcp',
  WebSearch: 'mcp',
  genifer_generate: 'genifer',
  genifer_refine: 'genifer',
  genifer_query: 'genifer',
}

/**
 * Get the category for a tool
 */
export function getToolCategory(toolName: string): ToolCategory {
  // Handle MCP tool names (e.g., "mcp__firecrawl__firecrawl_scrape")
  if (toolName.startsWith('mcp__')) {
    return 'mcp'
  }
  return toolCategories[toolName] ?? 'other'
}

/**
 * Get category display info
 */
export function getCategoryInfo(category: ToolCategory): { label: string; color: string } {
  switch (category) {
    case 'filesystem':
      return { label: 'Filesystem', color: 'text-green-400' }
    case 'search':
      return { label: 'Search', color: 'text-cyan-400' }
    case 'shell':
      return { label: 'Shell', color: 'text-orange-400' }
    case 'ai':
      return { label: 'AI', color: 'text-magenta-400' }
    case 'genifer':
      return { label: 'Genifer', color: 'text-cyan-400' }
    case 'mcp':
      return { label: 'MCP', color: 'text-blue-400' }
    case 'other':
      return { label: 'Tool', color: 'text-white/60' }
  }
}
