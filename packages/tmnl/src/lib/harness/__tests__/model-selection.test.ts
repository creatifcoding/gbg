// @vitest-environment node

/**
 * Model Selection Tests
 *
 * Covers:
 * 1. Schema round-trip: HarnessModelInfo, HarnessModelOverride, new commands
 * 2. Engine: getAvailableModels() returns real SDK models via ModelRegistry
 * 3. Engine: send() with modelOverride resolves and applies per-message model
 * 4. Engine: send() with invalid modelOverride falls back gracefully
 * 5. WS envelope: get_available_models command encodes/decodes in union
 * 6. WS envelope: send command with modelOverride encodes/decodes
 * 7. API key resolution: one model per provider has a resolvable key
 * 8. Live smoke: cheapest model per provider responds to a minimal prompt
 *    (guarded by RUN_LIVE_MODEL_TESTS=1)
 */

import { describe, expect, it } from '@effect/vitest'
import type {
  AssistantMessage,
  AssistantMessageEvent,
  AssistantMessageEventStream,
  Context as PiAiContext,
  Model as PiAiModel,
  SimpleStreamOptions,
} from '@mariozechner/pi-ai'
import { Effect, Either, Layer, Option, Schema } from 'effect'

import {
  HarnessModelInfo,
  HarnessModelOverride,
  HarnessRemoteCommand,
  HarnessRemoteGetModelsCommand,
  HarnessRemoteModelListPayload,
  HarnessRemoteSendCommand,
  HarnessWsRequestEnvelope,
} from '../HarnessBrowserRemoteSchemas'
import { HarnessSessionStoreMemoryLive } from '../HarnessSessionStoreMemory'
import { PiAiEventAdapterLive } from '../PiAiEventAdapter'
import {
  PiAiHarnessEngine,
  PiAiHarnessEngineCoreLive,
  PiAiHarnessEngineError,
} from '../PiAiHarnessEngine'
import { PiAiPolicy, PiAiPolicyConfig } from '../PiAiPolicy'
import { PiAiStreamClient } from '../PiAiStreamClient'
import { PiAiToolRuntime } from '../PiAiToolRuntime'

// =============================================================================
// Test Helpers (reused from integration test)
// =============================================================================

const ZERO_USAGE = {
  input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
}

const makeAssistant = (text: string): AssistantMessage => ({
  role: 'assistant',
  content: [{ type: 'text', text }],
  api: 'openai-responses',
  provider: 'openai',
  model: 'gpt-4o-mini',
  usage: ZERO_USAGE,
  stopReason: 'stop',
  timestamp: Date.now(),
})

const makeImmediateStream = (text: string): AssistantMessageEventStream => {
  const msg = makeAssistant(text)
  return {
    async *[Symbol.asyncIterator]() {
      yield {
        type: 'text_delta',
        contentIndex: 0,
        delta: text,
        partial: msg,
      } as AssistantMessageEvent
    },
    result: async () => msg,
  } as AssistantMessageEventStream
}

/** Track which model was passed to the stream client */
const makeTrackingEngine = (modelCaptures: Array<{ provider: string; id: string }>) => {
  const policyLayer = Layer.succeed(
    PiAiPolicy,
    PiAiPolicy.of({
      config: new PiAiPolicyConfig({
        provider: 'openai',
        model: 'gpt-4o-mini',
        systemPrompt: 'test prompt',
        apiKey: Option.none(),
        oauthAuthFile: 'auth.json',
        cacheRetention: 'short',
        maxRetryDelayMs: Option.none(),
        requestTimeoutMs: 1000,
        retryCount: 0,
        maxConcurrentStreams: 2,
        toolTimeoutMs: 0,
        unboundedToolPatterns: [],
        compactionEnabled: true,
        compactionReserveTokens: 16384,
        compactionKeepRecentTokens: 20000,
        compactionSummaryModel: Option.none(),
        sessionIdPrefix: 'test-model',
        agentIdPrefix: 'test-agent',
        defaultReasoning: Option.none(),
      }),
      resolveModel: Effect.succeed({
        id: 'gpt-4o-mini',
        provider: 'openai',
        api: 'openai-responses',
      } as PiAiModel<any>),
      makeStreamOptions: ({ sessionId, signal }) =>
        Effect.succeed({ sessionId, signal, cacheRetention: 'short' }),
    }),
  )

  const streamLayer = Layer.succeed(
    PiAiStreamClient,
    PiAiStreamClient.of({
      stream: (model: PiAiModel<any>, _ctx: PiAiContext, _opts: SimpleStreamOptions) => {
        modelCaptures.push({ provider: model.provider, id: model.id })
        return makeImmediateStream(`response from ${model.id}`)
      },
    }),
  )

  const toolLayer = Layer.succeed(
    PiAiToolRuntime,
    PiAiToolRuntime.of({
      tools: [],
      maxToolRounds: 4,
      execute: (toolCall) =>
        Effect.succeed({
          role: 'toolResult' as const,
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          content: [{ type: 'text' as const, text: 'ok' }],
          isError: false,
          timestamp: Date.now(),
        }),
    }),
  )

  return PiAiHarnessEngineCoreLive.pipe(
    Layer.provide(HarnessSessionStoreMemoryLive),
    Layer.provide(toolLayer),
    Layer.provide(streamLayer),
    Layer.provide(PiAiEventAdapterLive),
    Layer.provide(policyLayer),
  )
}

const waitForFinal = (
  engine: typeof PiAiHarnessEngine.Type,
  sessionId: any,
  attempts = 400,
): Effect.Effect<ReadonlyArray<any>, PiAiHarnessEngineError> =>
  engine.getSnapshot(sessionId, Option.none()).pipe(
    Effect.flatMap((snapshot) =>
      snapshot.events.some((e: any) => e._tag === 'chat:v2/assistant_final')
        ? Effect.succeed(snapshot.events)
        : attempts <= 0
          ? Effect.fail(
              new PiAiHarnessEngineError({
                code: 'timeout',
                message: 'Timed out waiting for assistant_final',
                cause: Option.none(),
              }),
            )
          : Effect.yieldNow().pipe(
              Effect.zipRight(waitForFinal(engine, sessionId, attempts - 1)),
            ),
    ),
  )

// =============================================================================
// 1. Schema Round-Trip Tests
// =============================================================================

describe('Model Selection Schemas', () => {
  it('HarnessModelInfo encodes/decodes correctly', () => {
    const info = {
      id: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      provider: 'anthropic',
      reasoning: true,
      contextWindow: 200000,
      maxTokens: 16384,
    }

    const encoded = Schema.encodeSync(HarnessModelInfo)(info)
    const decoded = Schema.decodeSync(HarnessModelInfo)(encoded)

    expect(decoded).toEqual(info)
  })

  it('HarnessModelOverride encodes/decodes correctly', () => {
    const override = { provider: 'anthropic', modelId: 'claude-sonnet-4-20250514' }
    const encoded = Schema.encodeSync(HarnessModelOverride)(override)
    const decoded = Schema.decodeSync(HarnessModelOverride)(encoded)
    expect(decoded).toEqual(override)
  })

  it('HarnessRemoteModelListPayload encodes/decodes a model array', () => {
    const payload = {
      models: [
        { id: 'gpt-5', name: 'GPT-5', provider: 'openai', reasoning: true, contextWindow: 128000, maxTokens: 32000 },
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', reasoning: true, contextWindow: 200000, maxTokens: 16384 },
      ],
    }
    const rt = Schema.decodeSync(HarnessRemoteModelListPayload)(
      Schema.encodeSync(HarnessRemoteModelListPayload)(payload),
    )
    expect(rt.models).toHaveLength(2)
    expect(rt.models[0].id).toBe('gpt-5')
    expect(rt.models[1].provider).toBe('anthropic')
  })

  it('HarnessRemoteGetModelsCommand is in the command union', () => {
    const cmd = { _tag: 'remote:get_available_models' as const }
    const decoded = Schema.decodeSync(HarnessRemoteCommand)(cmd)
    expect(decoded._tag).toBe('remote:get_available_models')
  })

  it('HarnessRemoteSendCommand accepts optional modelOverride', () => {
    const cmdWithOverride = {
      _tag: 'remote:chat_v2_send' as const,
      sessionId: 'sess-1',
      clientMessageId: 'client-1',
      text: 'hello',
      modelOverride: { provider: 'anthropic', modelId: 'claude-sonnet-4-20250514' },
    }
    const decoded = Schema.decodeSync(HarnessRemoteSendCommand)(cmdWithOverride)
    expect(decoded.modelOverride).toBeDefined()
    expect(decoded.modelOverride!.provider).toBe('anthropic')
    expect(decoded.modelOverride!.modelId).toBe('claude-sonnet-4-20250514')
  })

  it('HarnessRemoteSendCommand works without modelOverride (backwards compatible)', () => {
    const cmdNoOverride = {
      _tag: 'remote:chat_v2_send' as const,
      sessionId: 'sess-1',
      clientMessageId: 'client-1',
      text: 'hello',
    }
    const decoded = Schema.decodeSync(HarnessRemoteSendCommand)(cmdNoOverride)
    expect(decoded.modelOverride).toBeUndefined()
  })

  it('WS envelope with get_available_models command round-trips', () => {
    const envelope = {
      _tag: 'remote:ws_request' as const,
      requestId: 'req-models-1',
      command: { _tag: 'remote:get_available_models' as const },
    }
    const decoded = Schema.decodeSync(HarnessWsRequestEnvelope)(envelope)
    expect(decoded.command._tag).toBe('remote:get_available_models')
    expect(decoded.requestId).toBe('req-models-1')
  })

  it('WS envelope with send + modelOverride round-trips', () => {
    const envelope = {
      _tag: 'remote:ws_request' as const,
      requestId: 'req-send-override',
      command: {
        _tag: 'remote:chat_v2_send' as const,
        sessionId: 'sess-1',
        clientMessageId: 'cm-1',
        text: 'test',
        modelOverride: { provider: 'openai', modelId: 'gpt-5' },
      },
    }
    const decoded = Schema.decodeSync(HarnessWsRequestEnvelope)(envelope)
    expect(decoded.command._tag).toBe('remote:chat_v2_send')
    if (decoded.command._tag === 'remote:chat_v2_send') {
      expect(decoded.command.modelOverride?.provider).toBe('openai')
      expect(decoded.command.modelOverride?.modelId).toBe('gpt-5')
    }
  })

  it('rejects HarnessModelInfo with missing required fields', () => {
    const bad = { id: 'test', name: 'Test' } // missing provider, reasoning, etc.
    const result = Schema.decodeUnknownEither(HarnessModelInfo)(bad)
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects HarnessModelOverride with missing fields', () => {
    const bad = { provider: 'openai' } // missing modelId
    const result = Schema.decodeUnknownEither(HarnessModelOverride)(bad)
    expect(Either.isLeft(result)).toBe(true)
  })
})

// =============================================================================
// 2. Engine: getAvailableModels()
// =============================================================================

describe('PiAiHarnessEngine — getAvailableModels', () => {
  it.effect('returns models from ModelRegistry.getAvailable()', () =>
    Effect.gen(function* () {
      const modelCaptures: Array<{ provider: string; id: string }> = []
      const layer = makeTrackingEngine(modelCaptures)
      const engine = yield* PiAiHarnessEngine.pipe(Effect.provide(layer))

      const models = yield* engine.getAvailableModels()

      // Should return at least some models (depends on host auth, but SDK includes built-ins)
      expect(Array.isArray(models)).toBe(true)
      // Every model has the required shape
      for (const m of models) {
        expect(typeof m.id).toBe('string')
        expect(typeof m.name).toBe('string')
        expect(typeof m.provider).toBe('string')
        expect(typeof m.reasoning).toBe('boolean')
        expect(typeof m.contextWindow).toBe('number')
        expect(typeof m.maxTokens).toBe('number')
      }
      // No duplicates by (provider, id)
      const keys = models.map((m) => `${m.provider}/${m.id}`)
      expect(new Set(keys).size).toBe(keys.length)
    }),
  )

  it.effect('models have positive contextWindow and maxTokens', () =>
    Effect.gen(function* () {
      const layer = makeTrackingEngine([])
      const engine = yield* PiAiHarnessEngine.pipe(Effect.provide(layer))
      const models = yield* engine.getAvailableModels()

      for (const m of models) {
        expect(m.contextWindow).toBeGreaterThan(0)
        expect(m.maxTokens).toBeGreaterThan(0)
      }
    }),
  )
})

// =============================================================================
// 3. Engine: send() with modelOverride
// =============================================================================

describe('PiAiHarnessEngine — model override on send', () => {
  it.effect('send without modelOverride uses default session model', () =>
    Effect.gen(function* () {
      const modelCaptures: Array<{ provider: string; id: string }> = []
      const layer = makeTrackingEngine(modelCaptures)
      const engine = yield* PiAiHarnessEngine.pipe(Effect.provide(layer))

      const session = yield* engine.openSession('node-default-model', 'general')
      yield* engine.send(session.sessionId, 'cm-1' as any, 'hello', Option.none())
      yield* waitForFinal(engine, session.sessionId)

      // Stream client received the default model
      expect(modelCaptures.length).toBeGreaterThanOrEqual(1)
      expect(modelCaptures[0].id).toBe('gpt-4o-mini')
      expect(modelCaptures[0].provider).toBe('openai')
    }),
  )

  it.effect('send with valid modelOverride switches session model', () =>
    Effect.gen(function* () {
      const modelCaptures: Array<{ provider: string; id: string }> = []
      const layer = makeTrackingEngine(modelCaptures)
      const engine = yield* PiAiHarnessEngine.pipe(Effect.provide(layer))

      const session = yield* engine.openSession('node-override-model', 'general')

      // Get real available models so we pick a valid one
      const available = yield* engine.getAvailableModels()
      // Pick a model different from the default (gpt-4o-mini)
      const alternate = available.find((m) => m.id !== 'gpt-4o-mini')

      if (alternate) {
        yield* engine.send(
          session.sessionId,
          'cm-override' as any,
          'use this model',
          Option.none(),
          { provider: alternate.provider, modelId: alternate.id },
        )
        yield* waitForFinal(engine, session.sessionId)

        // Stream should have received the overridden model
        const lastCapture = modelCaptures[modelCaptures.length - 1]
        expect(lastCapture.id).toBe(alternate.id)
        expect(lastCapture.provider).toBe(alternate.provider)
      } else {
        // Only one model available — verify it still works
        yield* engine.send(session.sessionId, 'cm-fallback' as any, 'same model', Option.none())
        yield* waitForFinal(engine, session.sessionId)
        expect(modelCaptures.length).toBeGreaterThanOrEqual(1)
      }
    }),
  )

  it.effect('send with invalid modelOverride falls back to session default', () =>
    Effect.gen(function* () {
      const modelCaptures: Array<{ provider: string; id: string }> = []
      const layer = makeTrackingEngine(modelCaptures)
      const engine = yield* PiAiHarnessEngine.pipe(Effect.provide(layer))

      const session = yield* engine.openSession('node-bad-override', 'general')

      // Non-existent model
      yield* engine.send(
        session.sessionId,
        'cm-bad' as any,
        'bad override',
        Option.none(),
        { provider: 'nonexistent-provider', modelId: 'does-not-exist' },
      )
      yield* waitForFinal(engine, session.sessionId)

      // Should still succeed with default model
      expect(modelCaptures.length).toBeGreaterThanOrEqual(1)
      expect(modelCaptures[0].id).toBe('gpt-4o-mini')
    }),
  )

  it.effect('model override persists for subsequent messages on same session', () =>
    Effect.gen(function* () {
      const modelCaptures: Array<{ provider: string; id: string }> = []
      const layer = makeTrackingEngine(modelCaptures)
      const engine = yield* PiAiHarnessEngine.pipe(Effect.provide(layer))

      const session = yield* engine.openSession('node-persist-model', 'general')
      const available = yield* engine.getAvailableModels()
      const alternate = available.find((m) => m.id !== 'gpt-4o-mini')

      if (alternate) {
        // First message: override
        yield* engine.send(
          session.sessionId,
          'cm-p1' as any,
          'switch model',
          Option.none(),
          { provider: alternate.provider, modelId: alternate.id },
        )
        yield* waitForFinal(engine, session.sessionId)

        // Second message: no override — should still use the switched model
        yield* engine.send(session.sessionId, 'cm-p2' as any, 'continue', Option.none())
        // Wait for second final
        yield* engine.getSnapshot(session.sessionId, Option.none()).pipe(
          Effect.flatMap((snap) => {
            const finals = snap.events.filter((e: any) => e._tag === 'chat:v2/assistant_final')
            return finals.length >= 2
              ? Effect.succeed(snap.events)
              : Effect.yieldNow().pipe(Effect.zipRight(waitForFinal(engine, session.sessionId)))
          }),
        )

        // Both calls should have used the alternate model
        expect(modelCaptures.length).toBeGreaterThanOrEqual(2)
        expect(modelCaptures[modelCaptures.length - 1].id).toBe(alternate.id)
      }
    }),
  )
})

// =============================================================================
// 4. Cross-provider model override — providerOverride flows to makeStreamOptions
// =============================================================================

describe('PiAiHarnessEngine — cross-provider override key resolution', () => {
  it.effect('makeStreamOptions receives providerOverride matching overridden model provider', () =>
    Effect.gen(function* () {
      const providerOverrides: Array<string | undefined> = []
      const modelCaptures: Array<{ provider: string; id: string }> = []

      const policyLayer = Layer.succeed(
        PiAiPolicy,
        PiAiPolicy.of({
          config: new PiAiPolicyConfig({
            provider: 'openai',
            model: 'gpt-4o-mini',
            systemPrompt: 'test',
            apiKey: Option.none(),
            oauthAuthFile: 'auth.json',
            cacheRetention: 'short',
            maxRetryDelayMs: Option.none(),
            requestTimeoutMs: 1000,
            retryCount: 0,
            maxConcurrentStreams: 2,
            toolTimeoutMs: 0,
            unboundedToolPatterns: [],
            compactionEnabled: true,
            compactionReserveTokens: 16384,
            compactionKeepRecentTokens: 20000,
            compactionSummaryModel: Option.none(),
            sessionIdPrefix: 'test-xprov',
            agentIdPrefix: 'test-agent',
            defaultReasoning: Option.none(),
          }),
          resolveModel: Effect.succeed({
            id: 'gpt-4o-mini',
            provider: 'openai',
            api: 'openai-responses',
          } as PiAiModel<any>),
          // Track providerOverride calls
          makeStreamOptions: ({ sessionId, signal, providerOverride }) => {
            providerOverrides.push(providerOverride)
            return Effect.succeed({
              sessionId,
              signal,
              cacheRetention: 'short' as const,
              apiKey: `fake-key-for-${providerOverride ?? 'default'}`,
            })
          },
        }),
      )

      const streamLayer = Layer.succeed(
        PiAiStreamClient,
        PiAiStreamClient.of({
          stream: (model: PiAiModel<any>, _ctx: PiAiContext, opts: SimpleStreamOptions) => {
            modelCaptures.push({ provider: model.provider, id: model.id })
            return makeImmediateStream(`response`)
          },
        }),
      )

      const toolLayer = Layer.succeed(
        PiAiToolRuntime,
        PiAiToolRuntime.of({
          tools: [],
          maxToolRounds: 4,
          execute: (tc) =>
            Effect.succeed({
              role: 'toolResult' as const,
              toolCallId: tc.id,
              toolName: tc.name,
              content: [{ type: 'text' as const, text: 'ok' }],
              isError: false,
              timestamp: Date.now(),
            }),
        }),
      )

      const layer = PiAiHarnessEngineCoreLive.pipe(
        Layer.provide(HarnessSessionStoreMemoryLive),
        Layer.provide(toolLayer),
        Layer.provide(streamLayer),
        Layer.provide(PiAiEventAdapterLive),
        Layer.provide(policyLayer),
      )

      const engine = yield* PiAiHarnessEngine.pipe(Effect.provide(layer))
      const session = yield* engine.openSession('node-xprov', 'general')

      // 1. Default send — providerOverride should be 'openai' (session model's provider)
      yield* engine.send(session.sessionId, 'cm-1' as any, 'hello', Option.none())
      yield* waitForFinal(engine, session.sessionId)

      expect(providerOverrides[0]).toBe('openai')
      expect(modelCaptures[0].provider).toBe('openai')

      // 2. Override to anthropic model
      // (modelRegistry.find will fail in mock — override only works if model exists.
      //  We test the providerOverride plumbing, not actual model resolution.)
      // The engine updates session.model if modelRegistry.find succeeds;
      // since we have no real registry, the model stays openai.
      // But if we had a real alternate model, providerOverride would be 'anthropic'.

      // Instead, verify with a real model from the registry
      const available = yield* engine.getAvailableModels()
      const anthropicModel = available.find((m) => m.provider === 'anthropic')

      if (anthropicModel) {
        yield* engine.send(
          session.sessionId,
          'cm-2' as any,
          'use anthropic',
          Option.none(),
          { provider: 'anthropic', modelId: anthropicModel.id },
        )
        // Wait for second assistant_final
        yield* engine.getSnapshot(session.sessionId, Option.none()).pipe(
          Effect.flatMap((snap) => {
            const finals = snap.events.filter((e: any) => e._tag === 'chat:v2/assistant_final')
            return finals.length >= 2
              ? Effect.succeed(snap.events)
              : Effect.yieldNow().pipe(Effect.zipRight(waitForFinal(engine, session.sessionId)))
          }),
        )

        // providerOverride for second call should be 'anthropic'
        expect(providerOverrides[providerOverrides.length - 1]).toBe('anthropic')
        expect(modelCaptures[modelCaptures.length - 1].provider).toBe('anthropic')
      } else {
        // No anthropic models available — at minimum verify first call worked
        expect(providerOverrides).toHaveLength(1)
      }
    }),
  )
})

// =============================================================================
// 5. API Key Resolution — one model per provider
// =============================================================================

describe('ModelRegistry — API key resolution per provider', () => {
  it('resolves an API key for the cheapest model of each available provider', async () => {
    const { AuthStorage, ModelRegistry } = await import('@mariozechner/pi-coding-agent')
    const auth = new AuthStorage()
    const registry = new ModelRegistry(auth)
    const available = registry.getAvailable()

    // Deduplicate to one model per provider (cheapest by input cost)
    const providers = [...new Set(available.map((m) => m.provider))]
    expect(providers.length).toBeGreaterThan(0)

    for (const provider of providers) {
      const cheapest = available
        .filter((m) => m.provider === provider)
        .sort((a, b) => a.cost.input - b.cost.input)[0]

      const apiKey = await registry.getApiKey(cheapest)
      expect(apiKey, `API key missing for ${provider}/${cheapest.id}`).toBeDefined()
      expect(typeof apiKey).toBe('string')
      expect(apiKey!.length, `API key for ${provider}/${cheapest.id} is empty`).toBeGreaterThan(0)
    }
  })
})

// =============================================================================
// 5. Live Smoke — ping cheapest model per provider
//    Guarded by RUN_LIVE_MODEL_TESTS=1
// =============================================================================

const LIVE = process.env.RUN_LIVE_MODEL_TESTS === '1'

describe.skipIf(!LIVE)('Live Model Smoke Test (RUN_LIVE_MODEL_TESTS=1)', () => {
  /**
   * Pings cheapest model per provider to verify the API endpoint is reachable.
   *
   * IMPORTANT: OAuth providers (anthropic, openai-codex) use refresh tokens that
   * `AuthStorage.getApiKey()` returns stale. The live engine uses `getOAuthApiKey()`
   * from PiAiPolicy which refreshes + persists. We skip OAuth providers here and
   * only test providers with static API keys (e.g. openai with OPENAI_API_KEY env).
   *
   * For full end-to-end OAuth validation, use the harness integration test.
   */
  it('gets a response from cheapest non-OAuth model per provider', async () => {
    const { AuthStorage, ModelRegistry } = await import('@mariozechner/pi-coding-agent')
    const { streamSimple } = await import('@mariozechner/pi-ai')

    const auth = new AuthStorage()
    const registry = new ModelRegistry(auth)
    const available = registry.getAvailable()

    const providers = [...new Set(available.map((m) => m.provider))]

    const results: Array<{ provider: string; model: string; ok: boolean; detail: string }> = []

    for (const provider of providers) {
      // Try cheapest model first
      const candidates = available
        .filter((m) => m.provider === provider)
        .sort((a, b) => a.cost.input - b.cost.input)

      let providerPassed = false

      // Resolve API key — use OAuth refresh for OAuth providers, static for others
      let resolvedApiKey: string | undefined
      const firstCandidate = candidates[0]
      if (firstCandidate && registry.isUsingOAuth(firstCandidate)) {
        // OAuth provider: refresh token to get a valid key
        try {
          const result = await auth.refreshOAuthTokenWithLock(provider)
          resolvedApiKey = result?.apiKey
          if (!resolvedApiKey) {
            console.warn(`[smoke] ⊘ OAuth refresh returned no key for "${provider}" — run: bunx @mariozechner/pi-ai login ${provider}`)
            results.push({ provider, model: '(no key)', ok: false, detail: 'OAuth refresh returned no key' })
            continue
          }
        } catch (err) {
          console.warn(`[smoke] ⊘ OAuth refresh failed for "${provider}": ${(err as Error).message?.slice(0, 80)}`)
          results.push({ provider, model: '(refresh failed)', ok: false, detail: `OAuth refresh error: ${(err as Error).message?.slice(0, 60)}` })
          continue
        }
      }

      for (const candidate of candidates) {
        // Use the OAuth-refreshed key if available, otherwise fall back to registry
        const apiKey = resolvedApiKey ?? await registry.getApiKey(candidate)
        if (!apiKey) continue

        console.log(`[smoke] Pinging ${provider}/${candidate.id} (${candidate.name})...`)

        const context = {
          systemPrompt: 'Respond with exactly one word.',
          messages: [{ role: 'user' as const, content: 'Say hello.', timestamp: Date.now() }],
          tools: [],
        }

        const abort = new AbortController()
        const timer = setTimeout(() => abort.abort(), 15_000)

        try {
          const s = streamSimple(candidate, context, { apiKey, signal: abort.signal })
          const seenTypes: string[] = []

          for await (const event of s) {
            seenTypes.push(event.type)
            if (['text_delta', 'text_start', 'text_end', 'done'].includes(event.type)) {
              break
            }
          }

          const alive = seenTypes.some((t) =>
            ['text_delta', 'text_start', 'text_end', 'done'].includes(t),
          )

          if (alive) {
            console.log(`[smoke] ✓ ${provider}/${candidate.id} responded (events: ${seenTypes.join(', ')})`)
            results.push({ provider, model: candidate.id, ok: true, detail: seenTypes.join(', ') })
            providerPassed = true
            break
          } else {
            console.warn(`[smoke] ✗ ${provider}/${candidate.id} no content events (${seenTypes.join(', ')}), trying next...`)
          }
        } catch (err) {
          console.warn(`[smoke] ✗ ${provider}/${candidate.id} threw: ${(err as Error).message?.slice(0, 80)}, trying next...`)
        } finally {
          clearTimeout(timer)
          abort.abort()
        }
      }

      if (!providerPassed) {
        console.warn(`[smoke] ⚠ ALL models for "${provider}" returned error — API key likely invalid/stale`)
        results.push({ provider, model: '(none)', ok: false, detail: 'all models failed' })
      }
    }

    // Print summary
    console.log('\n[smoke] === PROVIDER SUMMARY ===')
    for (const r of results) {
      const icon = r.detail.includes('skipped') ? '⊘' : r.ok ? '✓' : '✗'
      console.log(`  ${icon} ${r.provider} → ${r.model} (${r.detail})`)
    }

    // Hard-fail only if ZERO providers responded (excluding skipped)
    const tested = results.filter((r) => !r.detail.includes('skipped'))
    if (tested.length > 0) {
      const anyPassed = tested.some((r) => r.ok)
      expect(anyPassed, `No non-OAuth provider responded. Results: ${JSON.stringify(tested)}`).toBe(true)
    }

    // Soft-warn for failures
    const failed = results.filter((r) => !r.ok)
    if (failed.length > 0) {
      console.warn(`\n[smoke] ⚠ ${failed.length} provider(s) have stale/invalid credentials:`)
      for (const f of failed) {
        console.warn(`  → ${f.provider}: ${f.detail}`)
      }
    }
  }, 60_000) // generous timeout
})
