/**
 * useMCPAutoConnect Hook
 *
 * Automatically connects to configured MCP servers on mount.
 * Reads from getDefaultMCPConfigs() or loads from .mcp.json in Tauri.
 */

import { useEffect, useRef, useState } from 'react'
import { Effect } from 'effect'
import { mcpRuntimeAtom, connectMCPServerOp, addMCPServer } from '../atoms'
import { getDefaultMCPConfigs, loadMCPConfigTauri } from '../config'
import type { MCPServerConfig } from '../schemas'

export interface UseMCPAutoConnectOptions {
  /** Config file path (for Tauri) */
  configPath?: string
  /** Whether to auto-connect on mount */
  enabled?: boolean
  /** Callback when connection completes */
  onConnected?: (serverId: string) => void
  /** Callback on connection error */
  onError?: (serverId: string, error: string) => void
}

export interface UseMCPAutoConnectResult {
  /** Whether auto-connect is in progress */
  isConnecting: boolean
  /** Connected server IDs */
  connectedServers: string[]
  /** Any connection errors */
  errors: Record<string, string>
  /** Manually trigger reconnect */
  reconnect: () => void
}

export function useMCPAutoConnect(
  options: UseMCPAutoConnectOptions = {}
): UseMCPAutoConnectResult {
  const {
    configPath = '.mcp.json',
    enabled = true,
    onConnected,
    onError,
  } = options

  const [isConnecting, setIsConnecting] = useState(false)
  const [connectedServers, setConnectedServers] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const hasConnected = useRef(false)

  const connectServers = async () => {
    if (!enabled || hasConnected.current) return

    setIsConnecting(true)
    setErrors({})

    try {
      // Get configs - try Tauri first, fallback to defaults
      let configs: MCPServerConfig[]

      const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
      if (isTauri) {
        configs = await Effect.runPromise(
          loadMCPConfigTauri(configPath).pipe(
            Effect.catchAll(() => Effect.succeed(getDefaultMCPConfigs()))
          )
        )
      } else {
        configs = getDefaultMCPConfigs()
      }

      console.log('[MCP AutoConnect] Found configs:', configs.map(c => c.id))

      // Connect to each server
      const connected: string[] = []
      const newErrors: Record<string, string> = {}

      for (const config of configs) {
        if (!config.enabled) continue

        try {
          // Register the server
          addMCPServer(config)

          // Connect
          console.log(`[MCP AutoConnect] Connecting to ${config.id}...`)
          await connectMCPServerOp({ config })

          connected.push(config.id)
          onConnected?.(config.id)
          console.log(`[MCP AutoConnect] Connected to ${config.id}`)
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          newErrors[config.id] = msg
          onError?.(config.id, msg)
          console.error(`[MCP AutoConnect] Failed to connect to ${config.id}:`, msg)
        }
      }

      setConnectedServers(connected)
      setErrors(newErrors)
      hasConnected.current = true
    } finally {
      setIsConnecting(false)
    }
  }

  useEffect(() => {
    connectServers()
  }, [enabled])

  const reconnect = () => {
    hasConnected.current = false
    connectServers()
  }

  return {
    isConnecting,
    connectedServers,
    errors,
    reconnect,
  }
}
