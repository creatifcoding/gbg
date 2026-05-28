/**
 * Extension tool discovery and wrapping.
 *
 * Scans `.pi/extensions/` directories, wraps RegisteredTools with
 * a minimal headless ExtensionContext, and returns them as HarnessTools.
 *
 * @module harness/tools/extension-tools
 */

import { discoverAndLoadExtensions } from '@mariozechner/pi-coding-agent'
import type { RegisteredTool, ExtensionContext } from '@mariozechner/pi-coding-agent'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

/**
 * Create a minimal ExtensionContext for harness-side tool execution.
 *
 * Extension tools receive `ctx: ExtensionContext` as their last argument.
 * The full SDK provides this via `ExtensionRunner.createContext()`, but
 * the harness doesn't have a full runner. We provide a minimal context
 * with `cwd`, `hasUI: false`, and stub methods for UI/session operations
 * that aren't available in the headless harness environment.
 */
function createMinimalExtensionContext(cwd: string): ExtensionContext {
  const stubUI = {
    select: async () => undefined,
    confirm: async () => false,
    input: async () => undefined,
    notify: () => {},
    onTerminalInput: () => () => {},
    setStatus: () => {},
    setWorkingMessage: () => {},
    setWidget: () => {},
    setFooter: () => {},
    setHeader: () => {},
    setTitle: () => {},
    custom: async () => { throw new Error('UI not available in harness mode') },
    pasteToEditor: () => {},
    setEditorText: () => {},
    getEditorText: () => '',
    editor: async () => undefined,
    setEditorComponent: () => {},
    theme: {} as any,
    getAllThemes: () => [],
    getTheme: () => undefined,
    setTheme: () => ({ success: false, error: 'Not available in harness mode' }),
    getToolsExpanded: () => false,
    setToolsExpanded: () => {},
  }

  return {
    ui: stubUI as any,
    hasUI: false,
    cwd,
    sessionManager: {} as any, // Extensions that need session access will fail gracefully
    modelRegistry: {} as any,
    model: undefined,
    isIdle: () => true,
    abort: () => {},
    hasPendingMessages: () => false,
    shutdown: () => {},
    getContextUsage: () => undefined,
    compact: () => {},
    getSystemPrompt: () => '',
  }
}

/**
 * Wrap a RegisteredTool into a harness-compatible tool using a minimal ExtensionContext.
 */
function wrapRegisteredToolForHarness(
  registeredTool: RegisteredTool,
  ctx: ExtensionContext,
) {
  const { definition } = registeredTool
  return {
    name: definition.name,
    label: definition.label,
    description: definition.description,
    parameters: definition.parameters,
    execute: (
      toolCallId: string,
      params: Record<string, unknown>,
      signal: AbortSignal | undefined,
      onUpdate?: (partial: { content: Array<{ type: string; text: string }>; details?: unknown }) => void,
    ) => definition.execute(toolCallId, params, signal, onUpdate, ctx),
  }
}

const parseExtensionAllowlist = () => {
  const raw = process.env.TMNL_HARNESS_PI_EXTENSIONS
    ?? process.env.TMNL_HARNESS_PI_EXTENSION_ALLOWLIST
    ?? ''

  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const expandHomePath = (value: string) =>
  value.startsWith('~/') ? path.join(os.homedir(), value.slice(2)) : value

const resolveApprovedExtensionPaths = (cwd: string) => {
  const approved = parseExtensionAllowlist()
  const defaultAgentDir = process.env.TMNL_GLOBAL_PI_AGENT_DIR
    ?? path.join(os.homedir(), '.pi', 'agent')

  return approved.flatMap((entry) => {
    const expanded = expandHomePath(entry)
    const candidates = path.isAbsolute(expanded) || expanded.includes('/')
      ? [path.resolve(cwd, expanded)]
      : [
          path.join(cwd, '.pi', 'extensions', expanded),
          path.join(defaultAgentDir, 'extensions', expanded),
        ]

    const match = candidates.find((candidate) => fs.existsSync(candidate))
    if (!match) {
      console.warn(`[harness] approved pi extension '${entry}' was not found; checked ${candidates.join(', ')}`)
      return []
    }

    return [match]
  })
}

const ensureHarnessAgentDir = (cwd: string) => {
  const agentDir = path.resolve(
    cwd,
    process.env.TMNL_HARNESS_PI_AGENT_DIR ?? '.pi/harness-agent',
  )
  fs.mkdirSync(path.join(agentDir, 'extensions'), { recursive: true })
  return agentDir
}

/**
 * Discover and load approved extension tools from a harness-local pi agent dir.
 */
export async function loadExtensionTools(cwd: string) {
  const resolvedCwd = path.resolve(cwd)
  const harnessAgentDir = ensureHarnessAgentDir(resolvedCwd)
  const harnessDiscoveryCwd = path.join(harnessAgentDir, 'discovery-cwd')
  fs.mkdirSync(path.join(harnessDiscoveryCwd, '.pi', 'extensions'), { recursive: true })

  const configuredPaths = resolveApprovedExtensionPaths(resolvedCwd)

  const result = await discoverAndLoadExtensions(
    configuredPaths,
    harnessDiscoveryCwd,
    harnessAgentDir,
  )

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.warn(`[harness] extension load error: ${err.path} — ${err.error}`)
    }
  }

  // Create a shared minimal context for all extension tools
  const ctx = createMinimalExtensionContext(resolvedCwd)

  // Collect all registered tools from all extensions
  const wrappedTools: ReturnType<typeof wrapRegisteredToolForHarness>[] = []

  for (const ext of result.extensions) {
    for (const [_name, registeredTool] of ext.tools) {
      try {
        const wrapped = wrapRegisteredToolForHarness(registeredTool, ctx)
        wrappedTools.push(wrapped)
      } catch (err) {
        console.warn(`[harness] failed to wrap tool '${_name}': ${err}`)
      }
    }
  }

  console.info(
    `[harness] loaded ${wrappedTools.length} approved extension tool(s) `
      + `from ${result.extensions.length} extension(s) `
      + `(agentDir=${harnessAgentDir}, allowlist=${parseExtensionAllowlist().join(',') || '<none>'})`,
  )
  return { tools: wrappedTools, extensions: result.extensions }
}
