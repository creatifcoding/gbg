/**
 * MCP Atoms
 *
 * Effect-atom integration for MCP state management.
 * Follows Atom-as-State doctrine from CLAUDE.md.
 */

import { Atom } from '@effect-atom/atom-react'
import { Effect, Layer, Option } from 'effect'
import { MCPClientRegistry } from '../services/MCPClientRegistry'
import type {
  MCPServerConfig,
  MCPServerStatus,
  MCPTool,
  MCPConnectionStatus,
} from '../schemas'

// =============================================================================
// Runtime Atom
// =============================================================================

/**
 * MCP runtime combining all service layers.
 */
export const mcpRuntimeAtom = Atom.runtime(
  Layer.mergeAll(MCPClientRegistry.Live)
)

// =============================================================================
// State Atoms
// =============================================================================

/**
 * Configured MCP servers
 */
export const mcpServersAtom = Atom.make<readonly MCPServerConfig[]>([])

/**
 * Server statuses keyed by server ID
 */
export const mcpServerStatusesAtom = Atom.make<Map<string, MCPServerStatus>>(new Map())

/**
 * Currently selected server ID
 */
export const selectedMCPServerIdAtom = Atom.make<string | null>(null)

/**
 * Whether server discovery is in progress
 */
export const isMCPDiscoveringAtom = Atom.make<boolean>(false)

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * All connected servers
 */
export const connectedMCPServersAtom = Atom.make((get) => {
  const statuses = get(mcpServerStatusesAtom)
  const servers = get(mcpServersAtom)

  return servers.filter((server) => {
    const status = statuses.get(server.id)
    return status?.status === 'connected'
  })
})

/**
 * All tools from connected servers
 */
export const allMCPToolsAtom = Atom.make((get) => {
  const statuses = get(mcpServerStatusesAtom)
  const allTools: { tool: MCPTool; serverId: string }[] = []

  for (const [serverId, status] of statuses) {
    if (status.status === 'connected') {
      for (const tool of status.tools) {
        allTools.push({ tool, serverId })
      }
    }
  }

  return allTools
})

/**
 * Tool count across all servers
 */
export const mcpToolCountAtom = Atom.make((get) => {
  return get(allMCPToolsAtom).length
})

/**
 * Selected server status
 */
export const selectedMCPServerStatusAtom = Atom.make((get) => {
  const selectedId = get(selectedMCPServerIdAtom)
  if (!selectedId) return null

  const statuses = get(mcpServerStatusesAtom)
  return statuses.get(selectedId) ?? null
})

/**
 * Connection status of selected server
 */
export const selectedMCPConnectionStatusAtom = Atom.make((get): MCPConnectionStatus => {
  const status = get(selectedMCPServerStatusAtom)
  return status?.status ?? 'disconnected'
})

// =============================================================================
// Operations (Synchronous)
// =============================================================================

/**
 * Add a server configuration
 */
export const addMCPServer = (config: MCPServerConfig) => {
  Atom.set(mcpServersAtom, (prev) => [...prev, config])
}

/**
 * Remove a server configuration
 */
export const removeMCPServer = (serverId: string) => {
  Atom.set(mcpServersAtom, (prev) => prev.filter((s) => s.id !== serverId))
  Atom.set(mcpServerStatusesAtom, (prev) => {
    const next = new Map(prev)
    next.delete(serverId)
    return next
  })

  if (Atom.get(selectedMCPServerIdAtom) === serverId) {
    Atom.set(selectedMCPServerIdAtom, null)
  }
}

/**
 * Update server configuration
 */
export const updateMCPServer = (serverId: string, update: Partial<MCPServerConfig>) => {
  Atom.set(mcpServersAtom, (prev) =>
    prev.map((s) => (s.id === serverId ? { ...s, ...update } : s))
  )
}

/**
 * Select a server
 */
export const selectMCPServer = (serverId: string | null) => {
  Atom.set(selectedMCPServerIdAtom, serverId)
}

/**
 * Update server status
 */
export const updateMCPServerStatus = (serverId: string, update: Partial<MCPServerStatus>) => {
  Atom.set(mcpServerStatusesAtom, (prev) => {
    const existing = prev.get(serverId)
    const base: MCPServerStatus = existing ?? {
      id: serverId,
      status: 'disconnected',
      tools: [],
      resources: [],
      prompts: [],
    }

    const next = new Map(prev)
    next.set(serverId, { ...base, ...update })
    return next
  })
}

// =============================================================================
// Effect Operations (via runtime)
// =============================================================================

/**
 * Connect to an MCP server
 */
export const connectMCPServerOp = mcpRuntimeAtom.fn<{ config: MCPServerConfig }>()((args, ctx) =>
  Effect.gen(function* () {
    ctx.set(mcpServerStatusesAtom, (prev) => {
      const next = new Map(prev)
      next.set(args.config.id, {
        id: args.config.id,
        status: 'connecting',
        tools: [],
        resources: [],
        prompts: [],
      })
      return next
    })

    try {
      const registry = yield* MCPClientRegistry
      const client = yield* registry.connect(args.config)

      // Get tools after connection
      const tools = yield* client.getTools()

      ctx.set(mcpServerStatusesAtom, (prev) => {
        const next = new Map(prev)
        next.set(args.config.id, {
          id: args.config.id,
          status: 'connected',
          tools: [...tools],
          resources: [],
          prompts: [],
          lastConnected: Date.now(),
        })
        return next
      })

      return client
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      ctx.set(mcpServerStatusesAtom, (prev) => {
        const next = new Map(prev)
        next.set(args.config.id, {
          id: args.config.id,
          status: 'error',
          error: errorMsg,
          tools: [],
          resources: [],
          prompts: [],
        })
        return next
      })
      throw error
    }
  })
)

/**
 * Disconnect from an MCP server
 */
export const disconnectMCPServerOp = mcpRuntimeAtom.fn<{ serverId: string }>()((args, ctx) =>
  Effect.gen(function* () {
    const registry = yield* MCPClientRegistry
    yield* registry.disconnect(args.serverId)

    ctx.set(mcpServerStatusesAtom, (prev) => {
      const next = new Map(prev)
      const existing = next.get(args.serverId)
      if (existing) {
        next.set(args.serverId, {
          ...existing,
          status: 'disconnected',
          tools: [],
          resources: [],
          prompts: [],
        })
      }
      return next
    })
  })
)

/**
 * Call a tool on an MCP server
 */
export const callMCPToolOp = mcpRuntimeAtom.fn<{
  serverId: string
  toolName: string
  arguments: Record<string, unknown>
}>()((args, _ctx) =>
  Effect.gen(function* () {
    const registry = yield* MCPClientRegistry
    return yield* registry.callTool(args.serverId, args.toolName, args.arguments)
  })
)

/**
 * Refresh tools for a connected server
 */
export const refreshMCPToolsOp = mcpRuntimeAtom.fn<{ serverId: string }>()((args, ctx) =>
  Effect.gen(function* () {
    const registry = yield* MCPClientRegistry
    const maybeClient = yield* registry.getClient(args.serverId)

    if (Option.isNone(maybeClient)) {
      return
    }

    const tools = yield* maybeClient.value.getTools()
    const resources = yield* maybeClient.value.getResources()
    const prompts = yield* maybeClient.value.getPrompts()

    ctx.set(mcpServerStatusesAtom, (prev) => {
      const next = new Map(prev)
      const existing = next.get(args.serverId)
      if (existing) {
        next.set(args.serverId, {
          ...existing,
          tools: [...tools],
          resources: [...resources],
          prompts: [...prompts],
        })
      }
      return next
    })
  })
)

/**
 * Get all tools from all connected servers
 */
export const getAllMCPToolsOp = mcpRuntimeAtom.fn<void>()((_args, _ctx) =>
  Effect.gen(function* () {
    const registry = yield* MCPClientRegistry
    return yield* registry.getAllTools()
  })
)
