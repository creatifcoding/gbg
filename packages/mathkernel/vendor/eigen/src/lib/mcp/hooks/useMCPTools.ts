/**
 * useMCPTools Hook
 *
 * React hook for accessing all tools from connected MCP servers.
 * Follows Atom-as-State doctrine from CLAUDE.md.
 */

import { useCallback, useMemo } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { Effect } from 'effect'
import type { MCPTool } from '../schemas'
import {
  // Derived atoms
  allMCPToolsAtom,
  mcpToolCountAtom,
  connectedMCPServersAtom,
  // Effect operations
  getAllMCPToolsOp,
  callMCPToolOp,
} from '../atoms'

// =============================================================================
// Hook Return Type
// =============================================================================

export interface UseMCPToolsResult {
  /** All tools from connected servers */
  tools: readonly { tool: MCPTool; serverId: string }[]

  /** Total tool count */
  toolCount: number

  /** Number of connected servers */
  serverCount: number

  /** Find tool by name (returns first match) */
  findTool: (name: string) => { tool: MCPTool; serverId: string } | undefined

  /** Find all tools matching a name pattern */
  searchTools: (pattern: string) => readonly { tool: MCPTool; serverId: string }[]

  /** Call a tool by name (uses first server that has it) */
  callTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>

  /** Call a tool on a specific server */
  callToolOnServer: (
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ) => Promise<unknown>

  /** Refresh tools from all connected servers */
  refresh: () => Promise<readonly { tool: MCPTool; serverId: string }[]>

  /** Group tools by server */
  toolsByServer: Map<string, MCPTool[]>

  /** Group tools by category (based on name prefix) */
  toolsByCategory: Map<string, { tool: MCPTool; serverId: string }[]>
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useMCPTools(): UseMCPToolsResult {
  // Subscribe to atoms
  const tools = useAtomValue(allMCPToolsAtom)
  const toolCount = useAtomValue(mcpToolCountAtom)
  const connectedServers = useAtomValue(connectedMCPServersAtom)

  // Server count
  const serverCount = connectedServers.length

  // Find tool by name
  const findTool = useCallback(
    (name: string) => tools.find((t) => t.tool.name === name),
    [tools]
  )

  // Search tools by pattern
  const searchTools = useCallback(
    (pattern: string) => {
      const lowerPattern = pattern.toLowerCase()
      return tools.filter(
        (t) =>
          t.tool.name.toLowerCase().includes(lowerPattern) ||
          t.tool.description?.toLowerCase().includes(lowerPattern)
      )
    },
    [tools]
  )

  // Call tool (find first server that has it)
  const callTool = useCallback(
    async (toolName: string, args: Record<string, unknown>) => {
      const entry = tools.find((t) => t.tool.name === toolName)
      if (!entry) {
        throw new Error(`Tool not found: ${toolName}`)
      }
      return Effect.runPromise(
        callMCPToolOp({
          serverId: entry.serverId,
          toolName,
          arguments: args,
        })
      )
    },
    [tools]
  )

  // Call tool on specific server
  const callToolOnServer = useCallback(
    async (serverId: string, toolName: string, args: Record<string, unknown>) => {
      return Effect.runPromise(
        callMCPToolOp({
          serverId,
          toolName,
          arguments: args,
        })
      )
    },
    []
  )

  // Refresh tools
  const refresh = useCallback(async () => {
    return Effect.runPromise(getAllMCPToolsOp(undefined))
  }, [])

  // Group by server
  const toolsByServer = useMemo(() => {
    const map = new Map<string, MCPTool[]>()
    for (const entry of tools) {
      const existing = map.get(entry.serverId) ?? []
      existing.push(entry.tool)
      map.set(entry.serverId, existing)
    }
    return map
  }, [tools])

  // Group by category (extract prefix before first underscore or colon)
  const toolsByCategory = useMemo(() => {
    const map = new Map<string, { tool: MCPTool; serverId: string }[]>()

    for (const entry of tools) {
      // Extract category from name (e.g., "mcp__github__" -> "github")
      const name = entry.tool.name
      let category = 'other'

      // Try common patterns
      const mcpMatch = name.match(/^mcp__([^_]+)__/)
      if (mcpMatch) {
        category = mcpMatch[1]
      } else {
        const underscoreMatch = name.match(/^([^_]+)_/)
        if (underscoreMatch) {
          category = underscoreMatch[1]
        } else {
          const colonMatch = name.match(/^([^:]+):/)
          if (colonMatch) {
            category = colonMatch[1]
          }
        }
      }

      const existing = map.get(category) ?? []
      existing.push(entry)
      map.set(category, existing)
    }

    return map
  }, [tools])

  return {
    tools,
    toolCount,
    serverCount,
    findTool,
    searchTools,
    callTool,
    callToolOnServer,
    refresh,
    toolsByServer,
    toolsByCategory,
  }
}
