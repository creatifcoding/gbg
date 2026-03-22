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
import { Effect, HashSet, Layer, Option, Schema } from 'effect'
import { PiAiToolRuntime, PiAiToolRuntimeError, type OnToolStreamChunk, type ToolName, ToolName as ToolNameSchema } from './PiAiToolRuntime'
import { AgentHarnessConfig, AgentHarnessConfigTag } from '@/lib/agents/AgentHarnessConfig'
import type { ToolStreamChunk } from './schemas'
import * as path from 'node:path'

// Interactive shell tool
import {
  INTERACTIVE_SHELL_TOOL_NAME,
  interactiveShellToolParameters,
  executeInteractiveShell,
  InteractiveShellService,
} from './interactive-shell'

// Genifer harness integration
import { createGeniferTools } from '@/lib/genifer/harness/bridge'
import { createSpawnPanelTool } from '@/lib/genifer/harness/spawn-panel-tool'
import { GeniferHarnessServiceTag, GeniferHarnessServiceLive } from '@/lib/genifer/harness/GeniferHarnessService'
import { GeniferServiceLive } from '@/lib/genifer/services/GeniferService'
import { GeniferDevDbLayer } from '@/lib/genifer/migrations/runner'
import { makeSessionId, makePanelId, type SurfaceId, type PanelId } from '@/lib/genifer/identifiers'
import { setGeniferPanelSurface, registerGeniferPanelVisitor } from '@/lib/genifer/harness/panel-visitor'
import { spawnPanel as spawnFloatingPanel, closePanel as closeFloatingPanel } from '@/lib/floating'

// LanguageModel layer for genifer generation (uses Pi OAuth auth)
import { makeAnthropicLayer } from '@/lib/agents/providers/anthropic'
import { PiAuthBridgeLive } from '@/lib/agents/auth/PiAuthBridge'

// GEOINT harness integration
import { createGeointTools, GeointHarnessService, GeointHarnessServiceLive } from '@/lib/geoint/harness'
import type { GeointHarnessServiceShape } from '@/lib/geoint/harness'
import { PanelEventBus } from './panel-events/PanelEventBus'
import { SubscriptionManagerService } from '@/lib/panels/subscriptions/schemas'

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

        // Wire LanguageModel layer for genifer generation via Pi OAuth
        // makeAnthropicLayer requires PiAuthBridge → uses Pi's OAuth token
        const geniferModelLayer = makeAnthropicLayer('claude-sonnet-4-20250514')
          .pipe(Layer.provide(PiAuthBridgeLive))
        service.setModelLayer(geniferModelLayer)

        let geointService: GeointHarnessServiceShape | undefined
        try {
          geointService = await Effect.runPromise(
            Effect.gen(function* () {
              return yield* GeointHarnessService
            }).pipe(
              Effect.provide(GeointHarnessServiceLive),
            ),
          )
        } catch {
          geointService = undefined
        }

        // sessionId is overridden per-call in bridge, but we need a default
        const sessionId = `harness-${Date.now()}`
        return createGeniferTools(service, sessionId, { geointService })
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
      allToolNames.add(geniferTool.name)
    }

    // 4b. spawn_panel tool (Genifer surface → floating panel via panel event bus)
    const panelBusOpt = yield* PanelEventBus.pipe(
      Effect.option,
      Effect.catchAll(() => Effect.succeed(Option.none())),
    )

    const geniferServiceOpt = yield* Effect.tryPromise({
      try: async () => {
        const service = await Effect.runPromise(
          Effect.gen(function* () {
            return yield* GeniferHarnessServiceTag
          }).pipe(
            Effect.provide(GeniferHarnessServiceLive),
            Effect.provide(GeniferServiceLive),
            Effect.provide(GeniferDevDbLayer),
          ),
        )
        const geniferModelLayer = makeAnthropicLayer('claude-sonnet-4-20250514')
          .pipe(Layer.provide(PiAuthBridgeLive))
        service.setModelLayer(geniferModelLayer)
        return Option.some(service)
      },
      catch: () => Option.none<typeof GeniferHarnessServiceTag.Service>(),
    }).pipe(Effect.orElseSucceed(() => Option.none()))

    const subscriptionManager = yield* Effect.serviceOption(SubscriptionManagerService).pipe(
      Effect.map(Option.getOrNull),
    )

    if (Option.isSome(panelBusOpt) && Option.isSome(geniferServiceOpt) && !allToolNames.has('spawn_panel')) {
      let panelCounter = 0
      const geniferSvc = geniferServiceOpt.value
      const panelBus = panelBusOpt.value
      const spawnPanelTool = createSpawnPanelTool({
        // ── Fire-and-forget: allocate a real streaming GeniferSurface ──
        // The service creates a proper GeniferSurface in status:'streaming'
        // and registers it in the atom registry. Then generation runs as
        // a detached fiber. As tokens stream in, onSurfaceUpdate fires
        // panel:surface_updated events — the panel visitor subscribes to
        // these via geniferPanelSurfaces atom and renders incrementally.
        // On completion, the surface promotes to status:'complete' with
        // materialized bindings. The panel re-renders with full
        // SurfaceProvider + BehaviorProvider + ElementRenderer stack.
        generateAsync: (prompt, threadId) => {
          const sessionId = makeSessionId()
          const { surfaceId, threadId: resolvedThreadId } = geniferSvc.allocateStreamingSurface({
            prompt,
            sessionId,
            // Bridge boundary: tool params are raw strings, service expects branded.
            // ThreadId is optional — if provided from tool, cast at the boundary.
            ...(threadId ? { threadId: threadId as unknown as import('@/lib/genifer/identifiers').ThreadId } : {}),
          })

          // Detached fiber: generation runs in background
          Effect.runFork(
            geniferSvc.generateInBackground({
              prompt,
              sessionId,
              surfaceId,
              threadId: resolvedThreadId,
              persist: true,
              onSurfaceUpdate: (sid, surface) => {
                // Direct atom write — instant panel reactivity, no indirection
                setGeniferPanelSurface(sid, surface)
                // Event bus relay — observability + remote sync
                Effect.runFork(
                  panelBus.emit({
                    _tag: 'panel:surface_updated',
                    surfaceId: sid,
                    surface,
                  }),
                )
              },
            }).pipe(
              Effect.catchAll((error) =>
                Effect.sync(() => {
                  console.error(`[spawn_panel] background generation failed for ${surfaceId}:`, error)
                }),
              ),
            ),
          )

          return { surfaceId }
        },

        // ── Legacy synchronous generate (fallback for tests/compat) ──
        generate: async (prompt, threadId) => {
          const result = await Effect.runPromise(
            geniferSvc.generate({
              prompt,
              sessionId: `harness-${Date.now()}`,
              threadId,
              persist: true,
            }),
          )
          const surface = geniferSvc.getSurface(result.surfaceId)
          return { surfaceId: result.surfaceId, surface: surface ?? undefined }
        },
        refine: async (surfaceId, instruction) => {
          await Effect.runPromise(
            geniferSvc.refine({
              surfaceId,
              instruction,
              sessionId: `harness-${Date.now()}`,
              persist: true,
            }),
          )
          const updatedSurface = geniferSvc.getSurface(surfaceId)
          if (updatedSurface) {
            Effect.runFork(
              panelBus.emit({
                _tag: 'panel:surface_updated',
                surfaceId,
                surface: updatedSurface,
              }),
            )
          }
        },
        spawnPanel: (surfaceId, opts) => {
          const remotePanelId = makePanelId() as unknown as string
          // For async path: surface is already in registry as streaming.
          // For legacy path: opts.surface carries the completed surface.
          const surface = (opts.surface ?? geniferSvc.getSurface(surfaceId)) as unknown

          // ── Direct local spawn (works without WS round-trip) ──
          // Register the panel visitor, write the surface to the panel
          // atom, and spawn the floating panel directly. This ensures
          // panels render in local/embedded mode where the event bus
          // → WS → transport stream loop isn't connected.
          registerGeniferPanelVisitor()
          if (surface) {
            setGeniferPanelSurface(surfaceId, surface as any)
          }
          const localPanelId = spawnFloatingPanel('genifer:surface', {
            mode: opts.mode ?? 'floating',
            title: opts.title,
            data: {
              surfaceId,
              prompt: opts.prompt,
              threadId: opts.threadId,
            },
            accent: '#22d3ee',
          })

          // ── Event bus relay (for remote/WS consumers + observability) ──
          Effect.runFork(
            panelBus.emit({
              _tag: 'panel:spawned',
              surfaceId,
              panelId: remotePanelId,
              title: opts.title,
              prompt: opts.prompt,
              threadId: opts.threadId,
              width: opts.width,
              height: opts.height,
              mode: opts.mode,
              surface,
            }),
          )

          return localPanelId ?? remotePanelId
        },
        closePanel: (panelId) => {
          closeFloatingPanel(panelId)
          Effect.runFork(
            panelBus.emit({
              _tag: 'panel:closed',
              panelId,
            }),
          )
        },
        subscriptionManager,
      })
      tools.push(spawnPanelTool as any)
      allToolNames.add('spawn_panel')
      console.info('[harness] spawn_panel tool registered')
    }

    // 5. GEOINT tools — entity spawn/select/search/summary via GeointHarnessService
    const geointResult = yield* Effect.tryPromise({
      try: async () => {
        const service = await Effect.runPromise(
          Effect.gen(function* () {
            return yield* GeointHarnessService
          }).pipe(
            Effect.provide(GeointHarnessServiceLive),
          ),
        )
        return createGeointTools(service)
      },
      catch: (error) => error,
    }).pipe(
      Effect.orElseSucceed(() => {
        console.warn(`[harness] geoint tools unavailable`)
        return [] as ReturnType<typeof createGeointTools>
      }),
    )

    for (const geointTool of geointResult) {
      if (allToolNames.has(geointTool.name)) {
        console.warn(`[harness] geoint tool '${geointTool.name}' shadows existing — skipping`)
        continue
      }
      tools.push(geointTool as any)
      allToolNames.add(geointTool.name)
    }

    // 6. Interactive shell tool (PTY-backed terminal sessions)
    //    InteractiveShellService is a sibling in the HarnessRuntimeLive Layer
    //    graph — shared singleton between tool execution and WS event relay.
    //    We yield it from context here; tool execute runs via Effect.runPromise
    //    with InteractiveShellServiceLive provided.
    const shellService = yield* InteractiveShellService.pipe(
      Effect.option,
      Effect.catchAll(() => Effect.succeed(Option.none())),
    )

    if (Option.isSome(shellService)) {
      tools.push({
        name: INTERACTIVE_SHELL_TOOL_NAME,
        description:
          'Start and interact with interactive terminal sessions. Spawn shells, send input, read output, and kill sessions. Supports long-running processes, interactive programs (vim, htop, etc.), and multi-session management.',
        parameters: interactiveShellToolParameters as any,
        execute: (
          toolCallId: string,
          params: Record<string, unknown>,
          signal: AbortSignal | undefined,
          onUpdate?: (partial: { content: Array<{ type: string; text: string }>; details?: unknown }) => void,
        ) =>
          Effect.runPromise(
            executeInteractiveShell(toolCallId, params, signal, onUpdate).pipe(
              Effect.provideService(InteractiveShellService, shellService.value),
            ),
          ),
      } as any)
      console.info(`[harness] interactive_shell tool registered`)
    } else {
      console.warn(`[harness] interactive shell service unavailable`)
    }

    const map = new Map(tools.map((t) => [t.name, t]))

    const execute = (
      toolCall: PiAiToolCall,
      onStreamChunk?: OnToolStreamChunk,
      signal?: AbortSignal,
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
        // Track latest details from onUpdate for the progress event
        let latestDetails: unknown = undefined
        const sdkOnUpdate = onStreamChunk
          ? (partial: { content: Array<{ type: string; text: string }>; details?: unknown }) => {
              // Capture details (e.g., treeSnapshot from genifer streaming)
              if (partial.details) {
                latestDetails = partial.details
              }

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

              if (!delta && !partial.details) return

              chunkSeq++
              const chunk: ToolStreamChunk = {
                toolCallId: toolCall.id,
                seq: chunkSeq,
                chunk: delta || '',
                kind: 'stdout',
                details: partial.details,
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
              signal, // AbortSignal from session AbortController
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
          details: (result as any).details,
          isError: false,
          timestamp: Date.now(),
        }
      })

    // ── Concurrent-friendly tool set ──
    // Tools that opt in to parallel execution within a single tool-call round.
    // Default is sequential (safe). Only tools that return instantly (e.g.
    // spawn_panel with fire-and-forget generation) should be listed here.
    // Brand at the TMNL boundary — pi-ai uses raw string for Tool.name.
    const brandName = (name: string) => Schema.decodeSync(ToolNameSchema)(name)
    const concurrentFriendlyNames: ToolName[] = []
    if (allToolNames.has('spawn_panel')) concurrentFriendlyNames.push(brandName('spawn_panel'))
    const concurrentFriendly = HashSet.fromIterable(concurrentFriendlyNames)

    return PiAiToolRuntime.of({
      tools: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) as any,
      maxToolRounds: config.maxToolRounds,
      concurrentFriendlyTools: concurrentFriendly,
      execute: (toolCall, onStreamChunk, signal) =>
        execute(toolCall, onStreamChunk, signal).pipe(
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
