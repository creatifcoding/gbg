/**
 * Genifer tool group — genifer_generate, genifer_refine, genifer_query + spawn_panel.
 *
 * Resolves GeniferHarnessService, PanelEventBus, and SubscriptionManagerService.
 * Returns a ToolContribution with all successfully created tools.
 *
 * @module harness/tools/genifer-tools
 */

import { Effect, Layer, Option } from 'effect'
import type { ToolContribution } from './types'
import { emptyContribution } from './types'
import type { HarnessTool } from './types'

import { createGeniferTools } from '@/lib/genifer/harness/bridge'
import { createSpawnPanelTool } from '@/lib/genifer/harness/spawn-panel-tool'
import { GeniferHarnessServiceTag, GeniferHarnessServiceLive } from '@/lib/genifer/harness/GeniferHarnessService'
import { GeniferServiceLive } from '@/lib/genifer/services/GeniferService'
import { GeniferDevDbLayer } from '@/lib/genifer/migrations/runner'
import { makeSessionId, makePanelId } from '@/lib/genifer/identifiers'
import { setGeniferPanelSurface, registerGeniferPanelVisitor } from '@/lib/genifer/harness/panel-visitor'
import { spawnPanel as spawnFloatingPanel, closePanel as closeFloatingPanel } from '@/lib/floating'
import { makeAnthropicLayer } from '@/lib/agents/providers/anthropic'
import { PiAuthBridgeLive } from '@/lib/agents/auth/PiAuthBridge'
import { PanelEventBus } from '../panel-events/PanelEventBus'
import { SubscriptionManagerService } from '@/lib/panels/subscriptions/schemas'
import { GeointHarnessService, GeointHarnessServiceLive } from '@/lib/geoint/harness'
import type { GeointHarnessServiceShape } from '@/lib/geoint/harness'

// ── Helpers ──────────────────────────────────────────────────

async function resolveGeniferService() {
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
  return service
}

async function resolveGeointService(): Promise<GeointHarnessServiceShape | undefined> {
  try {
    return await Effect.runPromise(
      Effect.gen(function* () {
        return yield* GeointHarnessService
      }).pipe(Effect.provide(GeointHarnessServiceLive)),
    )
  } catch {
    return undefined
  }
}

// ── Core genifer tools (generate, refine, query) ────────────

function createCoreGeniferContribution(
  service: typeof GeniferHarnessServiceTag.Service,
  geointService: GeointHarnessServiceShape | undefined,
): ToolContribution {
  const sessionId = `harness-${Date.now()}`
  const tools = createGeniferTools(service, sessionId, { geointService })
  return {
    tools: tools as unknown as HarnessTool[],
    concurrentFriendly: [],
  }
}

// ── spawn_panel tool ────────────────────────────────────────

function createSpawnPanelContribution(
  geniferSvc: typeof GeniferHarnessServiceTag.Service,
  panelBus: typeof PanelEventBus.Service,
  subscriptionManager: InstanceType<typeof SubscriptionManagerService> | null,
): ToolContribution {
  const spawnPanelTool = createSpawnPanelTool({
    // Fire-and-forget: allocate a real streaming GeniferSurface.
    // The service creates a proper GeniferSurface in status:'streaming'
    // and registers it in the atom registry. Then generation runs as
    // a detached fiber. As tokens stream in, onSurfaceUpdate fires
    // panel:surface_updated events — the panel visitor subscribes to
    // these via geniferPanelSurfaces atom and renders incrementally.
    generateAsync: (prompt, threadId) => {
      const sessionId = makeSessionId()
      const { surfaceId, threadId: resolvedThreadId } = geniferSvc.allocateStreamingSurface({
        prompt,
        sessionId,
        ...(threadId ? { threadId: threadId as unknown as import('@/lib/genifer/identifiers').ThreadId } : {}),
      })

      Effect.runFork(
        geniferSvc.generateInBackground({
          prompt,
          sessionId,
          surfaceId,
          threadId: resolvedThreadId,
          persist: true,
          onSurfaceUpdate: (sid, surface) => {
            setGeniferPanelSurface(sid, surface)
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

    // Legacy synchronous generate (fallback for tests/compat)
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
      const surface = (opts.surface ?? geniferSvc.getSurface(surfaceId)) as unknown

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

  return {
    tools: [spawnPanelTool as unknown as HarnessTool],
    concurrentFriendly: ['spawn_panel'],
  }
}

// ── Public: resolve all genifer-family tools ─────────────────

export const resolveGeniferToolContribution = Effect.gen(function* () {
  // Core genifer tools (generate, refine, query)
  const coreResult = yield* Effect.tryPromise({
    try: async () => {
      const service = await resolveGeniferService()
      const geointService = await resolveGeointService()
      return createCoreGeniferContribution(service, geointService)
    },
    catch: (error) => error,
  }).pipe(
    Effect.orElseSucceed(() => {
      console.warn('[harness] genifer tools unavailable (DB may not be connected)')
      return emptyContribution
    }),
  )

  // spawn_panel (needs PanelEventBus + GeniferService)
  const panelBusOpt = yield* PanelEventBus.pipe(
    Effect.option,
    Effect.catchAll(() => Effect.succeed(Option.none())),
  )

  const subscriptionManager = yield* Effect.serviceOption(SubscriptionManagerService).pipe(
    Effect.map(Option.getOrNull),
  )

  const spawnResult = yield* Effect.tryPromise({
    try: async () => {
      if (Option.isNone(panelBusOpt)) return emptyContribution
      const service = await resolveGeniferService()
      return createSpawnPanelContribution(service, panelBusOpt.value, subscriptionManager)
    },
    catch: () => emptyContribution,
  }).pipe(Effect.orElseSucceed(() => emptyContribution))

  return {
    tools: [...coreResult.tools, ...spawnResult.tools],
    concurrentFriendly: [...coreResult.concurrentFriendly, ...spawnResult.concurrentFriendly],
  } satisfies ToolContribution
})
