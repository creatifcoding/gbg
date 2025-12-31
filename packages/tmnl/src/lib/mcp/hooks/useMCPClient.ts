/**
 * useMCPClient Hook
 *
 * React hook for managing a single MCP server connection.
 * Follows Atom-as-State doctrine from CLAUDE.md.
 */

import { useCallback, useMemo } from 'react'
import { useAtomValue, Atom } from '@effect-atom/atom-react'
import { Effect } from 'effect'
import type { MCPServerConfig, MCPServerStatus, MCPTool, MCPConnectionStatus } from '../schemas'
import {
  // State atoms
  mcpServersAtom,
  mcpServerStatusesAtom,
  selectedMCPServerIdAtom,
  // Sync operations
  addMCPServer,
  removeMCPServer,
  updateMCPServer,
  selectMCPServer,
  updateMCPServerStatus,
  // Effect operations
  connectMCPServerOp,
  disconnectMCPServerOp,
  callMCPToolOp,
  refreshMCPToolsOp,
} from '../atoms'

// =============================================================================
// Hook Return Type
// =============================================================================

export interface UseMCPClientResult {
  // Server info
  serverId: string
  config: MCPServerConfig | null
  status: MCPServerStatus | null
  connectionStatus: MCPConnectionStatus
  isConnected: boolean
  isConnecting: boolean
  tools: readonly MCPTool[]
  error: string | null

  // Operations
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  callTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>
  refreshTools: () => Promise<void>

  // Selection
  select: () => void
  isSelected: boolean
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useMCPClient(serverId: string): UseMCPClientResult {
  // Get server config
  const servers = useAtomValue(mcpServersAtom)
  const config = useMemo(
    () => servers.find((s) => s.id === serverId) ?? null,
    [servers, serverId]
  )

  // Get server status
  const statuses = useAtomValue(mcpServerStatusesAtom)
  const status = useMemo(() => statuses.get(serverId) ?? null, [statuses, serverId])

  // Connection status
  const connectionStatus: MCPConnectionStatus = status?.status ?? 'disconnected'
  const isConnected = connectionStatus === 'connected'
  const isConnecting = connectionStatus === 'connecting'
  const tools = status?.tools ?? []
  const error = status?.error ?? null

  // Selection
  const selectedId = useAtomValue(selectedMCPServerIdAtom)
  const isSelected = selectedId === serverId

  // Connect
  const connect = useCallback(async () => {
    if (!config) {
      throw new Error(`Server not found: ${serverId}`)
    }
    await Effect.runPromise(connectMCPServerOp({ config }))
  }, [config, serverId])

  // Disconnect
  const disconnect = useCallback(async () => {
    await Effect.runPromise(disconnectMCPServerOp({ serverId }))
  }, [serverId])

  // Call tool
  const callTool = useCallback(
    async (toolName: string, args: Record<string, unknown>) => {
      return Effect.runPromise(
        callMCPToolOp({
          serverId,
          toolName,
          arguments: args,
        })
      )
    },
    [serverId]
  )

  // Refresh tools
  const refreshTools = useCallback(async () => {
    await Effect.runPromise(refreshMCPToolsOp({ serverId }))
  }, [serverId])

  // Select
  const select = useCallback(() => {
    selectMCPServer(serverId)
  }, [serverId])

  return {
    // Server info
    serverId,
    config,
    status,
    connectionStatus,
    isConnected,
    isConnecting,
    tools,
    error,

    // Operations
    connect,
    disconnect,
    callTool,
    refreshTools,

    // Selection
    select,
    isSelected,
  }
}

// =============================================================================
// Server Management Hook
// =============================================================================

export interface UseMCPServersResult {
  servers: readonly MCPServerConfig[]
  addServer: (config: MCPServerConfig) => void
  removeServer: (serverId: string) => void
  updateServer: (serverId: string, update: Partial<MCPServerConfig>) => void
  selectedServerId: string | null
  selectServer: (serverId: string | null) => void
}

export function useMCPServers(): UseMCPServersResult {
  const servers = useAtomValue(mcpServersAtom)
  const selectedServerId = useAtomValue(selectedMCPServerIdAtom)

  return {
    servers,
    addServer: addMCPServer,
    removeServer: removeMCPServer,
    updateServer: updateMCPServer,
    selectedServerId,
    selectServer: selectMCPServer,
  }
}
