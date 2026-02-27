import {
  getModel,
  getOAuthApiKey,
  type Model as PiAiModel,
  type OAuthCredentials,
  type SimpleStreamOptions,
} from '@mariozechner/pi-ai'
import { AuthStorage, ModelRegistry } from '@mariozechner/pi-coding-agent'
import { Config, Context, Effect, Layer, Option, Schema } from 'effect'

import type { HarnessThinkingLevel as ThinkingLevel } from './schemas'

export const PiAiCacheRetention = Schema.Literal('none', 'short', 'long')
export type PiAiCacheRetention = typeof PiAiCacheRetention.Type

export const PiAiReasoningLevel = Schema.Literal('minimal', 'low', 'medium', 'high', 'xhigh')
export type PiAiReasoningLevel = typeof PiAiReasoningLevel.Type

export class PiAiPolicyConfig extends Schema.Class<PiAiPolicyConfig>('PiAiPolicyConfig')({
  provider: Schema.String,
  model: Schema.String,
  systemPrompt: Schema.NonEmptyString,
  apiKey: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** @deprecated Legacy path for local auth.json. Use AuthStorage (~/.pi/agent/auth.json) instead. */
  oauthAuthFile: Schema.String,
  cacheRetention: PiAiCacheRetention,
  maxRetryDelayMs: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  requestTimeoutMs: Schema.Number.pipe(Schema.positive()),
  /** Per-tool execution timeout in ms. 0 = no timeout (default). Tools in unboundedToolPatterns are exempt when > 0. */
  toolTimeoutMs: Schema.Number.pipe(Schema.nonNegative()),
  /** Tool names exempt from toolTimeoutMs (they run unbounded). Default: interactive_shell, genifer_*, geoint_* */
  unboundedToolPatterns: Schema.Array(Schema.String),
  retryCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  maxConcurrentStreams: Schema.Number.pipe(Schema.int(), Schema.positive()),
  sessionIdPrefix: Schema.String,
  agentIdPrefix: Schema.String,
  defaultReasoning: Schema.optionalWith(PiAiReasoningLevel, { as: 'Option' }),
}) {}

export class PiAiPolicyError extends Schema.TaggedError<PiAiPolicyError>()('PiAiPolicyError', {
  code: Schema.String,
  message: Schema.String,
  cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
}) {}

export interface PiAiPolicyShape {
  readonly config: PiAiPolicyConfig
  readonly resolveModel: Effect.Effect<PiAiModel<any>, PiAiPolicyError>
  readonly makeStreamOptions: (params: {
    readonly thinkingLevel: Option.Option<ThinkingLevel>
    readonly sessionId: string
    readonly signal: AbortSignal | undefined
    /** Override the provider used for API key resolution (e.g. after model override) */
    readonly providerOverride?: string
    /** Whether the selected model supports reasoning controls */
    readonly supportsReasoning?: boolean
  }) => Effect.Effect<SimpleStreamOptions>
}

export const PiAiPolicy = Context.GenericTag<PiAiPolicyShape>('tmnl/harness/PiAiPolicy')

export const PiAiPolicyConfigTag = Context.GenericTag<PiAiPolicyConfig>('tmnl/harness/PiAiPolicyConfig')

const positiveIntegerConfig = (name: string, defaultValue: number) =>
  Config.integer(name).pipe(
    Config.withDefault(defaultValue),
    Config.validate({
      message: `${name} must be > 0`,
      validation: (value) => value > 0,
    }),
  )

const nonNegativeIntegerConfig = (name: string, defaultValue: number) =>
  Config.integer(name).pipe(
    Config.withDefault(defaultValue),
    Config.validate({
      message: `${name} must be >= 0`,
      validation: (value) => value >= 0,
    }),
  )

const PiAiPolicyConfigSource = Config.all({
  provider: Config.string('PI_HARNESS_PIAI_PROVIDER').pipe(Config.withDefault('openai-codex')),
  model: Config.string('PI_HARNESS_PIAI_MODEL').pipe(Config.withDefault('gpt-5.3-codex')),
  systemPrompt: Config.string('PI_HARNESS_PIAI_SYSTEM_PROMPT').pipe(
    Config.withDefault('You are TMNL Harness, a concise and reliable coding assistant.'),
  ),
  apiKey: Config.option(Config.string('PI_HARNESS_PIAI_API_KEY')),
  oauthAuthFile: Config.string('PI_HARNESS_PIAI_OAUTH_AUTH_FILE').pipe(Config.withDefault('auth.json')),
  cacheRetention: Config.literal('none', 'short', 'long')('PI_HARNESS_PIAI_CACHE_RETENTION').pipe(
    Config.withDefault('short' as const),
  ),
  maxRetryDelayMs: Config.option(
    Config.integer('PI_HARNESS_PIAI_MAX_RETRY_DELAY_MS').pipe(
      Config.validate({
        message: 'PI_HARNESS_PIAI_MAX_RETRY_DELAY_MS must be > 0',
        validation: (value) => value > 0,
      }),
    ),
  ),
  requestTimeoutMs: positiveIntegerConfig('PI_HARNESS_PIAI_REQUEST_TIMEOUT_MS', 120_000),
  toolTimeoutMs: nonNegativeIntegerConfig('PI_HARNESS_PIAI_TOOL_TIMEOUT_MS', 0),
  unboundedToolPatterns: Config.succeed([] as string[]),
  retryCount: nonNegativeIntegerConfig('PI_HARNESS_PIAI_RETRY_COUNT', 1),
  maxConcurrentStreams: positiveIntegerConfig('PI_HARNESS_PIAI_MAX_CONCURRENT_STREAMS', 8),
  sessionIdPrefix: Config.string('PI_HARNESS_PIAI_SESSION_PREFIX').pipe(Config.withDefault('chat-v2-piai')),
  agentIdPrefix: Config.string('PI_HARNESS_PIAI_AGENT_PREFIX').pipe(Config.withDefault('piai')),
  defaultReasoning: Config.option(
    Config.literal('minimal', 'low', 'medium', 'high', 'xhigh')('PI_HARNESS_PIAI_DEFAULT_REASONING'),
  ),
})

export const PiAiPolicyConfigDefault = Layer.effect(
  PiAiPolicyConfigTag,
  Effect.gen(function* () {
    const raw = yield* PiAiPolicyConfigSource
    return new PiAiPolicyConfig(raw)
  }),
)

const mapThinking = (
  configDefaultReasoning: Option.Option<PiAiReasoningLevel>,
  thinkingLevel: Option.Option<ThinkingLevel>,
): PiAiReasoningLevel | undefined =>
  Option.match(thinkingLevel, {
    onNone: () => Option.getOrUndefined(configDefaultReasoning),
    onSome: (thinking) => {
      switch (thinking) {
        case 'off':
          return undefined
        case 'minimal':
          return 'minimal'
        case 'low':
          return 'low'
        case 'medium':
          return 'medium'
        case 'high':
          return 'high'
      }
    },
  })

/**
 * @deprecated Use `AuthStorage.refreshOAuthTokenWithLock(provider)` instead.
 *
 * This function reads from a local `auth.json` file (via `oauthAuthFile` config),
 * which may not contain all OAuth providers. `AuthStorage` reads from
 * `~/.pi/agent/auth.json` and handles all registered OAuth providers (anthropic,
 * openai-codex, github-copilot, etc.) with proper token refresh.
 *
 * Kept as a legacy fallback — will be removed in a future version.
 */
const resolveOAuthApiKeyFromFile = (
  provider: string,
  authFile: string,
): Effect.Effect<Option.Option<string>> =>
  Effect.tryPromise({
    try: async () => {
      const fs = await import('node:fs')

      if (!fs.existsSync(authFile)) {
        return Option.none<string>()
      }

      const raw = JSON.parse(fs.readFileSync(authFile, 'utf-8')) as Record<string, OAuthCredentials>
      const oauth = await getOAuthApiKey(provider, raw)

      if (oauth === null) {
        return Option.none<string>()
      }

      raw[provider] = oauth.newCredentials
      fs.writeFileSync(authFile, JSON.stringify(raw, null, 2), 'utf-8')

      return Option.some(oauth.apiKey)
    },
    catch: () => Option.none<string>(),
  })

export const PiAiPolicyLive = Layer.effect(
  PiAiPolicy,
  Effect.gen(function* () {
    const config = yield* PiAiPolicyConfigTag

    const resolvedModel = yield* Effect.try({
      try: () => {
        const model = getModel(config.provider as any, config.model as any)
        if (!model) {
          throw new Error(`Unknown pi-ai model '${config.provider}/${config.model}'`)
        }
        return model as PiAiModel<any>
      },
      catch: (cause) =>
        new PiAiPolicyError({
          code: 'model-resolution-failed',
          message: `Failed to resolve pi-ai model '${config.provider}/${config.model}'`,
          cause: Option.some(cause),
        }),
    }).pipe(Effect.withSpan('tmnl.harness.policy.resolve-model'))

    // ── Unified auth: AuthStorage handles all OAuth refresh + static keys ──
    const authStorage = new AuthStorage()
    const modelRegistry = new ModelRegistry(authStorage)

    const resolveApiKeyForProvider = (provider: string): Effect.Effect<Option.Option<string>> =>
      Effect.tryPromise({
        try: async () => {
          // 1. Static API key from config takes absolute precedence
          if (Option.isSome(config.apiKey) && provider === config.provider) {
            return Option.some(config.apiKey.value)
          }

          // 2. Check if provider has OAuth credentials → refresh token
          const oauthProviders = authStorage.getOAuthProviders()
          const isOAuth = oauthProviders.some((p) => p.id === provider)

          if (isOAuth && authStorage.has(provider)) {
            const result = await authStorage.refreshOAuthTokenWithLock(provider)
            if (result?.apiKey) {
              return Option.some(result.apiKey)
            }
          }

          // 3. Fall back to ModelRegistry.getApiKey (checks env vars, stored static keys)
          const candidateModel = modelRegistry.getAvailable().find((m) => m.provider === provider)
          if (candidateModel) {
            const key = await modelRegistry.getApiKey(candidateModel)
            if (key) return Option.some(key)
          }

          // 4. Legacy fallback: resolveOAuthApiKeyFromFile (for oauthAuthFile compat)
          const legacyKey = await Effect.runPromise(resolveOAuthApiKeyFromFile(provider, config.oauthAuthFile))
          if (Option.isSome(legacyKey)) {
            console.warn(
              `[policy] DEPRECATED: API key for "${provider}" resolved via legacy oauthAuthFile (${config.oauthAuthFile}). ` +
              `Migrate to AuthStorage: bunx @mariozechner/pi-ai login ${provider}`,
            )
            return legacyKey
          }

          return Option.none<string>()
        },
        catch: () => Option.none<string>(),
      })

    const makeStreamOptions: PiAiPolicyShape['makeStreamOptions'] = ({
      thinkingLevel,
      sessionId,
      signal,
      providerOverride,
      supportsReasoning,
    }) =>
      Effect.gen(function* () {
        const requestedReasoning = mapThinking(config.defaultReasoning, thinkingLevel)
        const reasoning = supportsReasoning === false ? undefined : requestedReasoning
        const targetProvider = providerOverride ?? config.provider

        const resolvedApiKey = yield* resolveApiKeyForProvider(targetProvider)

        if (Option.isNone(resolvedApiKey)) {
          yield* Effect.logWarning(
            `[policy] No API key resolved for provider "${targetProvider}". ` +
            `OAuth: check \`bunx @mariozechner/pi-ai login ${targetProvider}\`. ` +
            `Static: set env var or PI_HARNESS_PIAI_API_KEY.`,
          )
        }

        if (supportsReasoning === false && requestedReasoning) {
          yield* Effect.logDebug(
            `[policy] Ignoring requested reasoning level "${requestedReasoning}" for model that does not support reasoning`,
          )
        }

        return {
          ...(Option.isSome(resolvedApiKey) ? { apiKey: resolvedApiKey.value } : {}),
          ...(reasoning ? { reasoning } : {}),
          cacheRetention: config.cacheRetention,
          sessionId,
          signal,
          ...(Option.isSome(config.maxRetryDelayMs) ? { maxRetryDelayMs: config.maxRetryDelayMs.value } : {}),
        } satisfies SimpleStreamOptions
      }).pipe(Effect.withSpan('tmnl.harness.policy.make-stream-options'))

    return PiAiPolicy.of({
      config,
      resolveModel: Effect.succeed(resolvedModel),
      makeStreamOptions,
    })
  }),
).pipe(Layer.provide(PiAiPolicyConfigDefault))
