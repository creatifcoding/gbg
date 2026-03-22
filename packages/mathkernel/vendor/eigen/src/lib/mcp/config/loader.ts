/**
 * MCP Config Loader
 *
 * Loads MCP server configurations from .mcp.json files.
 * Supports both project-level and global configurations.
 *
 * File format matches Claude Code's .mcp.json schema:
 * {
 *   "mcpServers": {
 *     "serverId": {
 *       "command": "./bin/osmmcp",
 *       "args": [],
 *       "env": {}
 *     }
 *   }
 * }
 */

import { Effect, Schema } from 'effect'
import type { MCPServerConfig } from '../schemas'

// =============================================================================
// File Schema
// =============================================================================

/**
 * Individual server entry in .mcp.json
 */
const MCPServerEntry = Schema.Struct({
  command: Schema.String,
  args: Schema.optional(Schema.Array(Schema.String)),
  env: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
})

/**
 * Root .mcp.json schema
 */
const MCPConfigFile = Schema.Struct({
  $schema: Schema.optional(Schema.String),
  mcpServers: Schema.Record({ key: Schema.String, value: MCPServerEntry }),
})

type MCPConfigFile = typeof MCPConfigFile.Type

// =============================================================================
// Loader Functions
// =============================================================================

/**
 * Parse .mcp.json content into server configs
 */
export function parseMCPConfig(content: string): Effect.Effect<MCPServerConfig[], Error> {
  return Effect.gen(function* () {
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch (e) {
      return yield* Effect.fail(new Error(`Invalid JSON in .mcp.json: ${e}`))
    }

    const decoded = Schema.decodeUnknownOption(MCPConfigFile)(parsed)
    if (decoded._tag === 'None') {
      return yield* Effect.fail(new Error('Invalid .mcp.json format'))
    }

    const config = decoded.value
    const servers: MCPServerConfig[] = []

    for (const [id, entry] of Object.entries(config.mcpServers)) {
      servers.push({
        id,
        name: id, // Use ID as name
        transport: 'stdio',
        command: entry.command,
        args: entry.args ?? [],
        env: entry.env ?? {},
        enabled: true,
        autoStart: true,
        source: 'user',
      })
    }

    return servers
  })
}

/**
 * Load MCP config from a file path (requires fetch or fs access)
 */
export function loadMCPConfigFromPath(path: string): Effect.Effect<MCPServerConfig[], Error> {
  return Effect.gen(function* () {
    // In browser context, we can't read local files directly
    // This would need to be called from Tauri context with fs access
    // For now, return a hardcoded osmmcp config as fallback

    console.log(`[MCP Config] Would load from: ${path}`)

    // Hardcoded osmmcp config for Terminal v3
    const osmmcpConfig: MCPServerConfig = {
      id: 'OSM',
      name: 'OpenStreetMap',
      transport: 'stdio',
      command: './bin/osmmcp',
      args: [],
      env: {},
      enabled: true,
      autoStart: true,
      source: 'user',
    }

    return [osmmcpConfig]
  })
}

/**
 * Get default MCP server configurations
 * These are always available regardless of .mcp.json
 */
export function getDefaultMCPConfigs(): MCPServerConfig[] {
  return [
    {
      id: 'OSM',
      name: 'OpenStreetMap',
      transport: 'stdio',
      command: './bin/osmmcp',
      args: [],
      env: {},
      enabled: true,
      autoStart: true,
      source: 'discovered',
    },
  ]
}

// =============================================================================
// Tauri-specific loader
// =============================================================================

/**
 * Load MCP config using Tauri filesystem API
 */
export function loadMCPConfigTauri(configPath: string): Effect.Effect<MCPServerConfig[], Error> {
  return Effect.gen(function* () {
    try {
      // Dynamic import Tauri fs
      const { readTextFile } = yield* Effect.tryPromise({
        try: () => import('@tauri-apps/plugin-fs'),
        catch: () => new Error('Tauri fs plugin not available'),
      })

      const content = yield* Effect.tryPromise({
        try: () => readTextFile(configPath),
        catch: (e) => new Error(`Failed to read ${configPath}: ${e}`),
      })

      return yield* parseMCPConfig(content)
    } catch (error) {
      console.log('[MCP Config] Tauri not available, using defaults')
      return getDefaultMCPConfigs()
    }
  })
}
