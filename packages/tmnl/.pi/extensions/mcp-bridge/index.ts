/**
 * MCP Bridge Extension for Pi
 * 
 * Bridges Model Context Protocol servers to pi tools.
 * 
 * ARCHITECTURE:
 * 1. Tools discovered dynamically from MCP servers (no hardcoded manifest)
 * 2. Discovery results cached to .pi/mcp-tools-cache.json
 * 3. At load time: register from cache (sync) → tools available immediately
 * 4. At session_start: refresh cache in background for next session
 * 5. If no cache exists: run discovery script, write cache, register tools
 * 
 * @module
 */

import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import { Type, type TObject } from '@sinclair/typebox'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { execSync } from 'node:child_process'
import { getSourceLogger } from '../shared/logging/index.ts'

// =============================================================================
// Logging (shared Effect-first service)
// =============================================================================

const logger = getSourceLogger('mcp-bridge')

function log(msg: string) {
  logger.info(msg)
}

function logError(msg: string, e?: unknown) {
  const detail = e instanceof Error ? e.message : e ? String(e) : ''
  const full = `${msg}${detail ? ' — ' + detail : ''}`
  logger.error(full)
}

// =============================================================================
// Types
// =============================================================================

interface MCPServerConfigStdio {
  type?: 'stdio'
  command: string
  args?: string[]
  env?: Record<string, string>
  disabled?: boolean
}

interface MCPServerConfigHttp {
  type: 'http'
  url: string
  headers?: Record<string, string>
  disabled?: boolean
}

interface MCPServerConfigSSE {
  type: 'sse'
  url: string
  headers?: Record<string, string>
  disabled?: boolean
}

type MCPServerConfig = MCPServerConfigStdio | MCPServerConfigHttp | MCPServerConfigSSE

interface MCPJsonConfig {
  mcpServers?: Record<string, MCPServerConfig>
}

interface CachedTool {
  name: string
  description: string
  params: Record<string, { type: string; description?: string; required: boolean }>
}

interface ToolCache {
  version: 2
  timestamp: string
  servers: Record<string, CachedTool[]>
}

interface ConnectedServer {
  client: Client
  transport: StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport
}

// =============================================================================
// Paths
// =============================================================================

const CWD = process.cwd()
const MCP_CONFIG_PATH = path.join(CWD, '.pi', 'mcp.json')
const CACHE_PATH = path.join(CWD, '.pi', 'mcp-tools-cache.json')
const DISCOVERY_TIMEOUT = 15_000

// =============================================================================
// Lazy Connection Cache
// =============================================================================

const connectionCache = new Map<string, ConnectedServer>()
const connectionPromises = new Map<string, Promise<ConnectedServer>>()

// =============================================================================
// Config Loading
// =============================================================================

function loadMCPConfig(): Map<string, MCPServerConfig> {
  const servers = new Map<string, MCPServerConfig>()

  if (!fs.existsSync(MCP_CONFIG_PATH)) {
    log(`No .pi/mcp.json found`)
    return servers
  }

  try {
    const content = fs.readFileSync(MCP_CONFIG_PATH, 'utf-8')
    const config = JSON.parse(content) as MCPJsonConfig

    if (config.mcpServers) {
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        if (!serverConfig.disabled) {
          servers.set(name, serverConfig)
        }
      }
    }
  } catch (e) {
    logError(`Failed to parse .pi/mcp.json:`, e)
  }

  return servers
}

// =============================================================================
// Cache Read/Write
// =============================================================================

function readCache(): ToolCache | null {
  if (!fs.existsSync(CACHE_PATH)) return null

  try {
    const content = fs.readFileSync(CACHE_PATH, 'utf-8')
    const cache = JSON.parse(content) as ToolCache
    if (cache.version !== 2) return null
    return cache
  } catch {
    return null
  }
}

function writeCache(cache: ToolCache): void {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2))
    log(`Cache written: ${Object.keys(cache.servers).length} servers`)
  } catch (e) {
    logError(`Failed to write cache:`, e)
  }
}

// =============================================================================
// Tool Discovery (runs as subprocess for first-run)
// =============================================================================

function discoverToolsSync(servers: Map<string, MCPServerConfig>): ToolCache {
  const serverEntries = JSON.stringify(Object.fromEntries(servers))
  const extDir = path.join(CWD, '.pi', 'extensions', 'mcp-bridge')
  const scriptPath = path.join(extDir, '_discover.ts')

  // Write discovery script to temp file (avoids shell escaping issues)
  const script = [
    `import { Client } from '@modelcontextprotocol/sdk/client/index.js'`,
    `import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'`,
    `import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'`,
    `import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'`,
    ``,
    `const servers = ${serverEntries}`,
    `const result: Record<string, any[]> = {}`,
    `const TIMEOUT = ${DISCOVERY_TIMEOUT}`,
    ``,
    `for (const [name, cfg] of Object.entries(servers) as any[]) {`,
    `  try {`,
    `    let transport: any`,
    `    if (cfg.type === 'http') {`,
    `      transport = new StreamableHTTPClientTransport(new URL(cfg.url), {`,
    `        requestInit: cfg.headers ? { headers: cfg.headers } : undefined,`,
    `      })`,
    `    } else if (cfg.type === 'sse') {`,
    `      transport = new SSEClientTransport(new URL(cfg.url), {`,
    `        requestInit: cfg.headers ? { headers: cfg.headers } : undefined,`,
    `      })`,
    `    } else {`,
    `      transport = new StdioClientTransport({`,
    `        command: cfg.command,`,
    `        args: cfg.args ?? [],`,
    `        env: { ...process.env, ...cfg.env },`,
    `      })`,
    `    }`,
    ``,
    `    const client = new Client(`,
    `      { name: 'pi-mcp-discovery', version: '0.1.0' },`,
    `      { capabilities: {} }`,
    `    )`,
    ``,
    `    await Promise.race([`,
    `      client.connect(transport),`,
    `      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT))`,
    `    ])`,
    ``,
    `    const toolsResult: any = await Promise.race([`,
    `      client.listTools(),`,
    `      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))`,
    `    ])`,
    ``,
    `    result[name] = (toolsResult.tools ?? []).map((t: any) => ({`,
    `      name: t.name,`,
    `      description: t.description ?? '',`,
    `      params: Object.fromEntries(`,
    `        Object.entries(t.inputSchema?.properties ?? {}).map(([k, v]: any) => [`,
    `          k,`,
    `          {`,
    `            type: v.type ?? 'string',`,
    `            description: v.description ?? undefined,`,
    `            required: (t.inputSchema?.required ?? []).includes(k),`,
    `          }`,
    `        ])`,
    `      ),`,
    `    }))`,
    ``,
    `    try { await transport.close() } catch {}`,
    `  } catch (e) {`,
    `    result[name] = []`,
    `  }`,
    `}`,
    ``,
    `console.log('__MCP_DISCOVERY_RESULT__' + JSON.stringify(result))`,
    `process.exit(0)`,
  ].join('\n')

  try {
    log(`Running tool discovery for ${servers.size} servers...`)
    fs.writeFileSync(scriptPath, script)

    const output = execSync(
      `cd ${JSON.stringify(extDir)} && bun run _discover.ts`,
      { timeout: 90_000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim()

    // Clean up temp script
    try { fs.unlinkSync(scriptPath) } catch {}

    // Find the sentinel-marked JSON line
    const marker = '__MCP_DISCOVERY_RESULT__'
    const markerIdx = output.indexOf(marker)
    if (markerIdx === -1) {
      logError(`Discovery returned no result marker`)
      return { version: 2, timestamp: new Date().toISOString(), servers: {} }
    }

    const jsonStr = output.slice(markerIdx + marker.length).split('\n')[0]
    const discovered = JSON.parse(jsonStr) as Record<string, CachedTool[]>
    const cache: ToolCache = {
      version: 2,
      timestamp: new Date().toISOString(),
      servers: discovered,
    }

    writeCache(cache)
    return cache
  } catch (e) {
    // Clean up temp script on error too
    try { fs.unlinkSync(scriptPath) } catch {}
    logError(`Discovery failed:`, e instanceof Error ? e.message : e)
    return { version: 2, timestamp: new Date().toISOString(), servers: {} }
  }
}

// =============================================================================
// Lazy Connection
// =============================================================================

async function getConnection(
  name: string,
  config: MCPServerConfig
): Promise<ConnectedServer> {
  if (connectionCache.has(name)) return connectionCache.get(name)!
  if (connectionPromises.has(name)) return connectionPromises.get(name)!

  const promise = connectServer(name, config)
  connectionPromises.set(name, promise)

  try {
    const server = await promise
    connectionCache.set(name, server)
    connectionPromises.delete(name)
    return server
  } catch (e) {
    connectionPromises.delete(name)
    throw e
  }
}

async function connectServer(
  name: string,
  config: MCPServerConfig
): Promise<ConnectedServer> {
  let transport: StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport

  if (config.type === 'http') {
    transport = new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: config.headers ? { headers: config.headers } : undefined,
    })
  } else if (config.type === 'sse') {
    transport = new SSEClientTransport(new URL(config.url), {
      requestInit: config.headers ? { headers: config.headers } : undefined,
    })
  } else {
    const stdioConfig = config as MCPServerConfigStdio
    transport = new StdioClientTransport({
      command: stdioConfig.command,
      args: stdioConfig.args ?? [],
      env: { ...process.env, ...stdioConfig.env } as Record<string, string>,
    })
  }

  const client = new Client(
    { name: `pi-mcp-bridge/${name}`, version: '0.1.0' },
    { capabilities: {} }
  )

  await client.connect(transport)
  return { client, transport }
}

// =============================================================================
// TypeBox Schema Generation from Cached Params
// =============================================================================

function buildParamsSchema(params: CachedTool['params']): TObject {
  const properties: Record<string, any> = {}

  for (const [key, info] of Object.entries(params)) {
    const opts: Record<string, any> = {}
    if (info.description) opts.description = info.description

    let schema: any
    switch (info.type) {
      case 'number':
      case 'integer':
        schema = Type.Number(opts)
        break
      case 'boolean':
        schema = Type.Boolean(opts)
        break
      case 'array':
        schema = Type.Array(Type.Any(), opts)
        break
      case 'object':
        schema = Type.Any(opts)
        break
      default:
        schema = Type.String(opts)
    }

    properties[key] = info.required ? schema : Type.Optional(schema)
  }

  return Type.Object(properties)
}

// =============================================================================
// Tool Registration + Diffing + Live Mutation
// =============================================================================

interface ServerToolDiff {
  added: CachedTool[]
  removed: CachedTool[]
  updated: Array<{ before: CachedTool; after: CachedTool }>
}

interface ToolCacheDiff {
  servers: Record<string, ServerToolDiff>
  totals: {
    added: number
    removed: number
    updated: number
  }
}

interface MutationApplySummary {
  supported: boolean
  applied: number
  queued: number
  skipped: number
  failed: number
  notes: string[]
}

interface DynamicToolRuntimeAPI {
  addTool?: (tool: unknown, options?: Record<string, unknown>) => unknown
  removeTool?: (toolName: string) => unknown
  updateTool?: (tool: unknown, options?: Record<string, unknown>) => unknown
}

function buildToolRuntimeName(serverName: string, toolName: string): string {
  return toolName.startsWith(`${serverName}_`) ? toolName : `${serverName}_${toolName}`
}

function serializeToolShape(tool: CachedTool): string {
  return JSON.stringify({
    description: tool.description,
    params: tool.params,
  })
}

function countTools(cache: ToolCache): number {
  return Object.values(cache.servers).reduce((sum, tools) => sum + tools.length, 0)
}

function computeToolCacheDiff(previous: ToolCache, next: ToolCache): ToolCacheDiff {
  const allServerNames = new Set([
    ...Object.keys(previous.servers),
    ...Object.keys(next.servers),
  ])

  const result: ToolCacheDiff = {
    servers: {},
    totals: { added: 0, removed: 0, updated: 0 },
  }

  for (const serverName of allServerNames) {
    const prevTools = previous.servers[serverName] ?? []
    const nextTools = next.servers[serverName] ?? []

    const prevMap = new Map(
      prevTools.map((tool) => [buildToolRuntimeName(serverName, tool.name), tool])
    )
    const nextMap = new Map(
      nextTools.map((tool) => [buildToolRuntimeName(serverName, tool.name), tool])
    )

    const added: CachedTool[] = []
    const removed: CachedTool[] = []
    const updated: Array<{ before: CachedTool; after: CachedTool }> = []

    for (const [runtimeName, nextTool] of nextMap) {
      const prevTool = prevMap.get(runtimeName)
      if (!prevTool) {
        added.push(nextTool)
        continue
      }
      if (serializeToolShape(prevTool) !== serializeToolShape(nextTool)) {
        updated.push({ before: prevTool, after: nextTool })
      }
    }

    for (const [runtimeName, prevTool] of prevMap) {
      if (!nextMap.has(runtimeName)) {
        removed.push(prevTool)
      }
    }

    if (added.length === 0 && removed.length === 0 && updated.length === 0) {
      continue
    }

    result.servers[serverName] = { added, removed, updated }
    result.totals.added += added.length
    result.totals.removed += removed.length
    result.totals.updated += updated.length
  }

  return result
}

function detectDynamicToolAPI(pi: ExtensionAPI): DynamicToolRuntimeAPI {
  return pi as unknown as DynamicToolRuntimeAPI
}

function hasDynamicToolAPI(pi: ExtensionAPI): boolean {
  const api = detectDynamicToolAPI(pi)
  return (
    typeof api.addTool === 'function' ||
    typeof api.removeTool === 'function' ||
    typeof api.updateTool === 'function'
  )
}

function buildToolDefinition(
  serverName: string,
  serverConfig: MCPServerConfig,
  tool: CachedTool
) {
  const toolName = buildToolRuntimeName(serverName, tool.name)
  const paramsSchema = buildParamsSchema(tool.params)

  return {
    name: toolName,
    label: `${serverName}: ${tool.name}`,
    description: tool.description || `Tool from ${serverName}`,
    parameters: paramsSchema,

    async execute(_toolCallId: string, params: Record<string, unknown>, _signal: AbortSignal | undefined, onUpdate: ((result: unknown) => void) | undefined, _ctx: unknown) {
      try {
        onUpdate?.({
          content: [{ type: 'text', text: `Connecting to ${serverName}...` }],
        })

        const server = await getConnection(serverName, serverConfig)

        onUpdate?.({
          content: [{ type: 'text', text: `Calling ${tool.name}...` }],
        })

        const cleanParams = Object.fromEntries(
          Object.entries(params).filter(([_, v]) => v !== undefined && v !== '')
        )

        const result = await server.client.callTool({
          name: tool.name,
          arguments: cleanParams,
        })

        const textContent = result.content
          ?.filter((c: any): c is { type: 'text'; text: string } => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n') ?? 'No response'

        return {
          content: [{ type: 'text', text: textContent }],
          details: { server: serverName, tool: tool.name },
        }
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e)
        return {
          content: [{ type: 'text', text: `MCP Error (${serverName}/${tool.name}): ${error}` }],
          isError: true,
        }
      }
    },
  }
}

function registerTool(
  pi: ExtensionAPI,
  serverName: string,
  serverConfig: MCPServerConfig,
  tool: CachedTool
) {
  pi.registerTool(buildToolDefinition(serverName, serverConfig, tool))
}

async function applyToolCacheDiffLive(
  pi: ExtensionAPI,
  servers: Map<string, MCPServerConfig>,
  diff: ToolCacheDiff
): Promise<MutationApplySummary> {
  const runtime = detectDynamicToolAPI(pi)
  const notes: string[] = []

  if (!hasDynamicToolAPI(pi)) {
    return {
      supported: false,
      applied: 0,
      queued: 0,
      skipped: 0,
      failed: 0,
      notes: ['runtime API missing: addTool/removeTool/updateTool'],
    }
  }

  let applied = 0
  let queued = 0
  let skipped = 0
  let failed = 0

  const foldResult = (opLabel: string, runtimeName: string, result: unknown) => {
    const normalized = (result ?? {}) as {
      queued?: boolean
      applied?: boolean
      reason?: string
    }

    if (normalized.queued === true) {
      queued++
      return
    }

    if (normalized.applied === true) {
      applied++
      return
    }

    if (normalized.applied === false) {
      skipped++
      if (normalized.reason) {
        notes.push(`${opLabel} ${runtimeName} skipped: ${normalized.reason}`)
      }
      return
    }

    // Legacy/unknown return shape: treat as applied for backward compatibility
    applied++
  }

  for (const [serverName, changes] of Object.entries(diff.servers)) {
    const serverConfig = servers.get(serverName)
    if (!serverConfig) continue

    for (const tool of changes.added) {
      const runtimeName = buildToolRuntimeName(serverName, tool.name)
      if (typeof runtime.addTool !== 'function') {
        failed++
        notes.push(`add ${runtimeName} failed: addTool unavailable`)
        continue
      }

      try {
        const result = await Promise.resolve(
          runtime.addTool(buildToolDefinition(serverName, serverConfig, tool), {
            activate: true,
            onConflict: 'replace',
          })
        )
        foldResult('add', runtimeName, result)
      } catch (e) {
        failed++
        notes.push(`add ${runtimeName} failed: ${String(e)}`)
      }
    }

    for (const tool of changes.removed) {
      const runtimeName = buildToolRuntimeName(serverName, tool.name)
      if (typeof runtime.removeTool !== 'function') {
        failed++
        notes.push(`remove ${runtimeName} failed: removeTool unavailable`)
        continue
      }

      try {
        const result = await Promise.resolve(runtime.removeTool(runtimeName))
        foldResult('remove', runtimeName, result)
      } catch (e) {
        failed++
        notes.push(`remove ${runtimeName} failed: ${String(e)}`)
      }
    }

    for (const pair of changes.updated) {
      const tool = pair.after
      const runtimeName = buildToolRuntimeName(serverName, tool.name)

      try {
        if (typeof runtime.updateTool === 'function') {
          const result = await Promise.resolve(
            runtime.updateTool(buildToolDefinition(serverName, serverConfig, tool), {
              preserveActive: true,
              onMissing: 'add',
            })
          )
          foldResult('update', runtimeName, result)
        } else if (
          typeof runtime.removeTool === 'function' &&
          typeof runtime.addTool === 'function'
        ) {
          const removeResult = await Promise.resolve(runtime.removeTool(runtimeName))
          foldResult('update-remove', runtimeName, removeResult)
          const addResult = await Promise.resolve(
            runtime.addTool(buildToolDefinition(serverName, serverConfig, tool), {
              activate: true,
              onConflict: 'replace',
            })
          )
          foldResult('update-add', runtimeName, addResult)
        } else {
          failed++
          notes.push(`update ${runtimeName} failed: no update/remove+add API`)
        }
      } catch (e) {
        failed++
        notes.push(`update ${runtimeName} failed: ${String(e)}`)
      }
    }
  }

  return { supported: true, applied, queued, skipped, failed, notes }
}

function formatDiffSummary(diff: ToolCacheDiff): string {
  return `+${diff.totals.added} ~${diff.totals.updated} -${diff.totals.removed}`
}

// =============================================================================
// Extension Entry Point
// =============================================================================

export default function mcpBridgeExtension(pi: ExtensionAPI) {
  let servers = loadMCPConfig()

  if (servers.size === 0) {
    log('No servers configured')
    return
  }

  let lastRefreshSummary:
    | {
        at: string
        trigger: 'session_start' | 'manual'
        diff: ToolCacheDiff
        apply: MutationApplySummary
      }
    | undefined


  // Step 1: Try to load from cache
  let cache = readCache()

  // Step 2: If no cache, run synchronous discovery
  if (!cache || Object.keys(cache.servers).length === 0) {
    log('No cache found, running discovery...')
    cache = discoverToolsSync(servers)
  }

  // Step 3: Register tools from cache (SYNCHRONOUS)
  for (const [serverName, tools] of Object.entries(cache.servers)) {
    const serverConfig = servers.get(serverName)
    if (!serverConfig) continue
    if (tools.length === 0) continue

    for (const tool of tools) {
      registerTool(pi, serverName, serverConfig, tool)
    }
    log(`[${serverName}] ${tools.length} tools registered`)
  }

  log(`Total: ${countTools(cache)} tools from ${Object.keys(cache.servers).length} servers`)

  const refreshCacheAndApplyLive = async (
    trigger: 'session_start' | 'manual'
  ): Promise<{ diff: ToolCacheDiff; apply: MutationApplySummary }> => {
    servers = loadMCPConfig()
    const previous = cache
    const fresh = discoverToolsSync(servers)
    const diff = computeToolCacheDiff(previous, fresh)

    cache = fresh

    let apply: MutationApplySummary = {
      supported: hasDynamicToolAPI(pi),
      applied: 0,
      queued: 0,
      skipped: 0,
      failed: 0,
      notes: [],
    }

    const hasChanges =
      diff.totals.added > 0 || diff.totals.updated > 0 || diff.totals.removed > 0

    if (hasChanges) {
      apply = await applyToolCacheDiffLive(pi, servers, diff)
    }

    lastRefreshSummary = {
      at: new Date().toISOString(),
      trigger,
      diff,
      apply,
    }

    const liveSummary = apply.supported
      ? `live applied=${apply.applied} queued=${apply.queued} skipped=${apply.skipped} failed=${apply.failed}`
      : 'live apply unsupported (requires runtime mutation API)'

    log(
      `[refresh/${trigger}] ${formatDiffSummary(diff)} | ${liveSummary}`
    )

    return { diff, apply }
  }

  // Step 4: Refresh cache on every session_start and try live apply.
  pi.on('session_start', async () => {
    try {
      await refreshCacheAndApplyLive('session_start')
    } catch {
      // Swallow - best effort startup refresh
    }
  })

  // Cleanup
  pi.on('session_shutdown', async () => {
    for (const [name, server] of connectionCache) {
      try { await server.transport.close() } catch {}
    }
    connectionCache.clear()
  })

  // /mcp command
  pi.registerCommand('mcp', {
    description: 'Show MCP server status and tools',
    handler: async (_args, ctx) => {
      const lines: string[] = [
        `MCP Bridge (${servers.size} servers configured)`,
        `Dynamic runtime mutation API: ${hasDynamicToolAPI(pi) ? 'available' : 'unavailable'}`,
      ]

      for (const [name] of servers) {
        const connected = connectionCache.has(name) ? '✓' : '○'
        const tools = cache.servers[name] ?? []
        lines.push(`  ${connected} ${name}: ${tools.length} tools`)
        for (const t of tools) {
          lines.push(`    • ${buildToolRuntimeName(name, t.name)}`)
        }
      }

      lines.push(`\nCache: ${cache.timestamp}`)

      if (lastRefreshSummary) {
        lines.push(
          `Last refresh (${lastRefreshSummary.trigger} @ ${lastRefreshSummary.at}): ${formatDiffSummary(lastRefreshSummary.diff)} | applied=${lastRefreshSummary.apply.applied} queued=${lastRefreshSummary.apply.queued} skipped=${lastRefreshSummary.apply.skipped} failed=${lastRefreshSummary.apply.failed}`
        )
      }

      ctx.ui.notify(lines.join('\n'), 'info')
    },
  })

  // /mcp-refresh command
  pi.registerCommand('mcp-refresh', {
    description: 'Force refresh MCP tool cache',
    handler: async (_args, ctx) => {
      ctx.ui.notify('Refreshing MCP tool cache...', 'info')

      const { diff, apply } = await refreshCacheAndApplyLive('manual')
      const hasChanges =
        diff.totals.added > 0 || diff.totals.updated > 0 || diff.totals.removed > 0

      const lines: string[] = [
        `Cache refreshed: ${countTools(cache)} tools (${formatDiffSummary(diff)})`,
      ]

      if (!hasChanges) {
        lines.push('No tool changes detected.')
      } else if (apply.supported) {
        lines.push(`Live mutation summary (in-session): applied=${apply.applied}, queued=${apply.queued}, skipped=${apply.skipped}, failed=${apply.failed}`)
      } else {
        lines.push('Runtime does not support live add/remove/update yet. Restart pi to register new named tools.')
      }

      if (apply.notes.length > 0) {
        lines.push(`Notes: ${apply.notes.slice(0, 3).join(' | ')}`)
      }

      ctx.ui.notify(lines.join('\n'), 'info')
    },
  })
}
