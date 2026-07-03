/**
 * PiAuthBridge — Effect.Service wrapper around Pi's AuthStorage.
 *
 * Intercepts Pi's existing OAuth infrastructure (AuthStorage) and lifts it
 * into Effect for DI, testability, and composition with @effect/ai layers.
 *
 * Pi already handles:
 * - Token storage in ~/.pi/agent/auth.json
 * - Auto-refresh with file locking (race-condition safe across instances)
 * - 5 built-in OAuth providers (openai-codex, anthropic, github-copilot, gemini-cli, antigravity)
 *
 * This service simply bridges that infrastructure into Effect programs.
 */
import { AuthStorage, type OAuthCredential } from '@mariozechner/pi-coding-agent'
import { Context, Effect, Layer, Option, Redacted, Schema } from 'effect'

// ── Error hierarchy ──

export class AuthError extends Schema.TaggedError<AuthError>()('AuthError', {
  code: Schema.Literal('no_credentials', 'refresh_failed', 'login_failed', 'unknown_provider'),
  message: Schema.String,
  providerId: Schema.String,
  cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
}) {}

// ── Provider info ──

export const ProviderStatus = Schema.Literal('authenticated', 'expired', 'none')
export type ProviderStatus = typeof ProviderStatus.Type

export const ProviderInfo = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  status: ProviderStatus,
})
export type ProviderInfo = typeof ProviderInfo.Type

// ── Service shape ──

export interface PiAuthBridgeShape {
  /**
   * Get API key for a provider. Auto-refreshes expired OAuth tokens.
   * Returns Redacted<string> to prevent accidental logging.
   */
  readonly getApiKey: (providerId: string) => Effect.Effect<Redacted.Redacted<string>, AuthError>

  /**
   * Get raw API key string for header injection.
   * Convenience method — unwraps Redacted for use in HTTP headers.
   */
  readonly getApiKeyRaw: (providerId: string) => Effect.Effect<string, AuthError>

  /**
   * Check if any form of auth is configured for a provider.
   * Does NOT trigger token refresh.
   */
  readonly hasAuth: (providerId: string) => Effect.Effect<boolean>

  /**
   * List all providers with their current auth status.
   */
  readonly listProviders: () => Effect.Effect<ReadonlyArray<ProviderInfo>>

  /**
   * Get the underlying AuthStorage instance.
   * Escape hatch for direct Pi API access (login flows, etc.)
   */
  readonly authStorage: AuthStorage
}

export class PiAuthBridge extends Context.Tag('tmnl/agents/PiAuthBridge')<
  PiAuthBridge,
  PiAuthBridgeShape
>() {}

// ── Helpers ──

const getProviderStatus = (authStorage: AuthStorage, providerId: string): ProviderStatus => {
  const cred = authStorage.get(providerId)
  if (!cred) return 'none'
  if (cred.type === 'api_key') return 'authenticated'
  if (cred.type === 'oauth') {
    const oauthCred = cred as OAuthCredential
    return Date.now() < oauthCred.expires ? 'authenticated' : 'expired'
  }
  return 'none'
}

const makeGetApiKey = (authStorage: AuthStorage) => (providerId: string) =>
  Effect.tryPromise({
    try: () => authStorage.getApiKey(providerId),
    catch: (error) =>
      new AuthError({
        code: 'refresh_failed',
        message: `Failed to get API key for ${providerId}: ${error}`,
        providerId,
        cause: Option.some(error),
      }),
  }).pipe(
    Effect.flatMap((key) =>
      key
        ? Effect.succeed(Redacted.make(key))
        : Effect.fail(
            new AuthError({
              code: 'no_credentials',
              message: `No credentials found for provider: ${providerId}`,
              providerId,
              cause: Option.none(),
            }),
          ),
    ),
    Effect.withSpan('PiAuthBridge.getApiKey', { attributes: { providerId } }),
  )

const makeGetApiKeyRaw = (authStorage: AuthStorage) => (providerId: string) =>
  Effect.tryPromise({
    try: () => authStorage.getApiKey(providerId),
    catch: (error) =>
      new AuthError({
        code: 'refresh_failed',
        message: `Failed to get API key for ${providerId}: ${error}`,
        providerId,
        cause: Option.some(error),
      }),
  }).pipe(
    Effect.flatMap((key) =>
      key
        ? Effect.succeed(key)
        : Effect.fail(
            new AuthError({
              code: 'no_credentials',
              message: `No credentials found for provider: ${providerId}`,
              providerId,
              cause: Option.none(),
            }),
          ),
    ),
    Effect.withSpan('PiAuthBridge.getApiKeyRaw', { attributes: { providerId } }),
  )

const makeBridgeShape = (authStorage: AuthStorage): PiAuthBridgeShape => ({
  getApiKey: makeGetApiKey(authStorage),
  getApiKeyRaw: makeGetApiKeyRaw(authStorage),

  hasAuth: (providerId: string) =>
    Effect.sync(() => authStorage.hasAuth(providerId)),

  listProviders: () =>
    Effect.sync(() => {
      const oauthProviders = authStorage.getOAuthProviders()
      return oauthProviders.map((p) => ({
        id: p.id,
        name: p.name,
        status: getProviderStatus(authStorage, p.id),
      }))
    }),

  authStorage,
})

// ── Live layer ──

export const PiAuthBridgeLive = Layer.succeed(
  PiAuthBridge,
  PiAuthBridge.of(makeBridgeShape(AuthStorage.create())),
)

/**
 * Create a PiAuthBridge layer with a custom auth.json path.
 * Useful for testing or alternative credential storage.
 */
export const PiAuthBridgeFrom = (authPath: string) =>
  Layer.succeed(
    PiAuthBridge,
    PiAuthBridge.of(makeBridgeShape(AuthStorage.create(authPath))),
  )
