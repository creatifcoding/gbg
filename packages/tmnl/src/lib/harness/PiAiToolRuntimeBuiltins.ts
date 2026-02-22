/**
 * PiAiToolRuntimeBuiltins — Wires the pi-coding-agent SDK's 7 built-in tools
 * (read, bash, edit, write, grep, ls, find) AND discovered extension tools
 * into PiAiToolRuntime.
 *
 * Extension loading:
 *   - Uses `discoverAndLoadExtensions()` to scan `.pi/extensions/` dirs
 *   - Wraps each extension's RegisteredTool via `wrapRegisteredTool()`
 *   - Merges extension tools into the same dispatch map as built-ins
 *   - Extension tools flow through `tool_manifest` event → ExtensionToolBridge
 *
 * Bridges from AgentTool.execute (Promise-based) to PiAiToolRuntime.execute (Effect-based).
 *
 * @module harness/PiAiToolRuntimeBuiltins
 */

import {
  createReadTool,
  createBashTool,
  createEditTool,
  createWriteTool,
  createGrepTool,
  createFindTool,
  createLsTool,
  discoverAndLoadExtensions,
} from '@mariozechner/pi-coding-agent'
import type { RegisteredTool, ExtensionContext } from '@mariozechner/pi-coding-agent'
import type { ToolCall as PiAiToolCall, ToolResultMessage as PiAiToolResultMessage } from '@mariozechner/pi-ai'
import { Effect, Layer, Option } from 'effect'
import { PiAiToolRuntime, PiAiToolRuntimeError, type OnToolStreamChunk } from './PiAiToolRuntime'
import { AgentHarnessConfig, AgentHarnessConfigTag } from '@/lib/agents/AgentHarnessConfig'
import type { ToolStreamChunk } from './schemas'
import * as path from 'node:path'

// Genifer harness integration
import { createGeniferTools } from '@/lib/genifer/harness/bridge'
import { GeniferHarnessServiceTag, GeniferHarnessServiceLive } from '@/lib/genifer/harness/GeniferHarnessService'
import { GeniferServiceLive } from '@/lib/genifer/services/GeniferService'
import { GeniferDevDbLayer } from '@/lib/genifer/migrations/runner'

// =============================================================================
// Create SDK tools configured for project CWD
// =============================================================================

function createSdkTools(config: AgentHarnessConfig) {
  const cwd = path.resolve(config.cwd)
  return [
    createReadTool(cwd),
    createBashTool(cwd, { timeout: config.bashTimeoutMs }),
    createEditTool(cwd),
    createWriteTool(cwd),
    createGrepTool(cwd),
    createFindTool(cwd),
    createLsTool(cwd),
  ]
}

// =============================================================================
// Discover and load extension tools
// =============================================================================

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
 * Wrap a RegisteredTool into an AgentTool using a minimal ExtensionContext.
 *
 * Replaces `wrapRegisteredTool(tool, runner)` from the SDK which requires
 * a full ExtensionRunner. Our version bakes in a headless context.
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

async function loadExtensionTools(cwd: string) {
  const resolvedCwd = path.resolve(cwd)

  const result = await discoverAndLoadExtensions(
    [], // configuredPaths — let it discover from standard locations
    resolvedCwd,
    undefined, // agentDir — uses default ~/.pi/agent
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

  console.info(`[harness] loaded ${wrappedTools.length} extension tool(s) from ${result.extensions.length} extension(s)`)
  return { tools: wrappedTools, extensions: result.extensions }
}

// =============================================================================
// Layer Factory + Default
// =============================================================================

/**
 * Create a PiAiToolRuntime Layer from AgentHarnessConfig.
 *
 * Requires `AgentHarnessConfigTag` in the Layer dependency graph.
 * Use `AgentHarnessConfigDefault` for env-sourced defaults (Infinity rounds).
 */
export const PiAiToolRuntimeWithBuiltins = Layer.effect(
  PiAiToolRuntime,
  Effect.gen(function* () {
    const config = yield* AgentHarnessConfigTag

    // 1. Built-in tools (always available)
    const builtinTools = createSdkTools(config)

    // 2. Extension tools (discovered from .pi/extensions/)
    //    NOTE: Effect.tryPromise `catch` is an error MAPPER, not recovery.
    const extensionResult = yield* Effect.tryPromise({
      try: () => loadExtensionTools(config.cwd),
      catch: (error) => error,
    }).pipe(
      Effect.orElseSucceed(() => {
        console.warn(`[harness] extension discovery failed, continuing with built-ins only`)
        return { tools: [] as ReturnType<typeof createSdkTools>, extensions: [], runtime: undefined }
      }),
    )

    // 3. Merge into unified tool map (built-ins take precedence on name collision)
    const tools = [...builtinTools]
    const builtinNames = new Set(builtinTools.map((t) => t.name))
    for (const extTool of extensionResult.tools) {
      if (builtinNames.has(extTool.name)) {
        console.warn(`[harness] extension tool '${extTool.name}' shadows built-in — skipping`)
        continue
      }
      tools.push(extTool)
    }

    // 4. Genifer tools (generate, refine, query) — optional, requires GeniferHarnessService
    //    NOTE: Effect.tryPromise `catch` is an error MAPPER, not a recovery handler.
    //    Use .pipe(Effect.orElseSucceed(...)) to actually swallow the failure.
    const geniferResult = yield* Effect.tryPromise({
      try: async () => {
        // Construct GeniferHarnessService — depends on GeniferService (needs DB)
        const service = await Effect.runPromise(
          Effect.gen(function* () {
            return yield* GeniferHarnessServiceTag
          }).pipe(
            Effect.provide(GeniferHarnessServiceLive),
            Effect.provide(GeniferServiceLive),
            Effect.provide(GeniferDevDbLayer),
          ),
        )
        // sessionId is overridden per-call in bridge, but we need a default
        const sessionId = `harness-${Date.now()}`
        return createGeniferTools(service, sessionId)
      },
      catch: (error) => error,
    }).pipe(
      Effect.orElseSucceed(() => {
        console.warn(`[harness] genifer tools unavailable (DB may not be connected)`)
        return [] as ReturnType<typeof createGeniferTools>
      }),
    )

    const allToolNames = new Set(tools.map((t) => t.name))
    for (const geniferTool of geniferResult) {
      if (allToolNames.has(geniferTool.name)) {
        console.warn(`[harness] genifer tool '${geniferTool.name}' shadows existing — skipping`)
        continue
      }
      tools.push(geniferTool as any)
    }

    const map = new Map(tools.map((t) => [t.name, t]))

    const execute = (
      toolCall: PiAiToolCall,
      onStreamChunk?: OnToolStreamChunk,
    ): Effect.Effect<PiAiToolResultMessage, PiAiToolRuntimeError> =>
      Effect.gen(function* () {
        const agentTool = map.get(toolCall.name)
        if (!agentTool) {
          return yield* Effect.fail(
            new PiAiToolRuntimeError({
              code: 'tool-not-found',
              message: `No built-in tool registered for '${toolCall.name}'. Available: ${[...map.keys()].join(', ')}`,
              cause: Option.none(),
            }),
          )
        }

        // Bridge SDK's sync onUpdate callback to our Effect-based onStreamChunk.
        //
        // SDK calls onUpdate with the FULL rolling buffer each time (not deltas).
        // The rolling buffer is a sliding window that drops old data when it exceeds
        // ~2x DEFAULT_MAX_BYTES (~400KB). We diff against prevLength to extract the
        // NEW bytes since the last callback.
        //
        // Edge cases handled:
        //   1. Buffer truncation: fullText.length < prevLength → SDK dropped old chunks.
        //      We can't recover the lost data, so reset the pointer and emit whatever's new.
        //   2. No new data: delta is empty → skip (SDK may re-emit same buffer).
        //   3. Async Effect: onStreamChunk returns appendEvent(...) which is async.
        //      SDK's onUpdate is synchronous — fire-and-forget with runPromise.
        let chunkSeq = 0
        let prevLength = 0
        const sdkOnUpdate = onStreamChunk
          ? (partial: { content: Array<{ type: string; text: string }>; details?: unknown }) => {
              const fullText = partial.content
                .filter((c) => c.type === 'text')
                .map((c) => c.text)
                .join('')

              let delta: string
              if (fullText.length < prevLength) {
                delta = fullText
                prevLength = fullText.length
              } else {
                delta = fullText.slice(prevLength)
                prevLength = fullText.length
              }

              if (!delta) return

              chunkSeq++
              const chunk: ToolStreamChunk = {
                toolCallId: toolCall.id,
                seq: chunkSeq,
                chunk: delta,
                kind: 'stdout', // SDK merges stdout+stderr into one stream
              }
              // Fire-and-forget — don't block SDK's exec loop.
              Effect.runPromise(onStreamChunk(chunk)).catch(() => {})
            }
          : undefined

        const result = yield* Effect.tryPromise({
          try: () =>
            agentTool.execute(
              toolCall.id,
              toolCall.arguments as Record<string, unknown>,
              undefined, // signal (TODO: wire AbortController)
              sdkOnUpdate,
            ),
          catch: (error) =>
            new PiAiToolRuntimeError({
              code: 'tool-execution-failed',
              message: `Tool '${toolCall.name}' failed: ${error instanceof Error ? error.message : String(error)}`,
              cause: Option.some(error),
            }),
        })
        return {
          role: 'toolResult' as const,
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          content: result.content,
          isError: false,
          timestamp: Date.now(),
        }
      })

    return PiAiToolRuntime.of({
      tools: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) as any,
      maxToolRounds: config.maxToolRounds,
      execute: (toolCall, onStreamChunk) =>
        execute(toolCall, onStreamChunk).pipe(
          Effect.catchTag('PiAiToolRuntimeError', (error) =>
            Effect.succeed({
              role: 'toolResult' as const,
              toolCallId: toolCall.id,
              toolName: toolCall.name,
              content: [{ type: 'text' as const, text: `Tool execution error: ${error.message}` }],
              isError: true,
              timestamp: Date.now(),
            }),
          ),
        ),
    })
  }),
)
