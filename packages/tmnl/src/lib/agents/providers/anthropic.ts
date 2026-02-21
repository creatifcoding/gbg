/**
 * Anthropic LanguageModel layer factories.
 *
 * Two auth paths:
 *
 * 1. **OAuth** (`makeAnthropicLayer`) — Pi's OAuth token → api.anthropic.com
 *    with Bearer auth + Claude Code identity headers. Requires Claude Pro/Max.
 *    Uses transformClient middleware to swap x-api-key → Authorization: Bearer.
 *
 * 2. **Env var** (`makeAnthropicLayerFromEnv`) — ANTHROPIC_API_KEY → standard auth.
 */
import { AnthropicClient, AnthropicLanguageModel } from "@effect/ai-anthropic"
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  Headers,
} from "@effect/platform"
import { Effect, Layer, Redacted } from "effect"

import { PiAuthBridge } from "../auth/PiAuthBridge"

// ── Constants ──

const PROVIDER_ID = "anthropic"

/**
 * Anthropic beta features required for OAuth tokens.
 * - claude-code-20250219: Claude Code identity recognition
 * - oauth-2025-04-20: OAuth token support
 * - fine-grained-tool-streaming-2025-05-14: Streaming tool use
 * - interleaved-thinking-2025-05-14: Extended thinking
 */
const ANTHROPIC_OAUTH_BETAS = [
  "claude-code-20250219",
  "oauth-2025-04-20",
  "fine-grained-tool-streaming-2025-05-14",
  "interleaved-thinking-2025-05-14",
].join(",")

const CLAUDE_CODE_VERSION = "2.1.2"

// ── OAuth Middleware ──

/**
 * Build an AnthropicClient layer with OAuth Bearer auth.
 *
 * @effect/ai-anthropic uses `x-api-key` header by default. For OAuth tokens
 * (sk-ant-oat01-*), the API requires:
 * - `Authorization: Bearer <token>` (not x-api-key)
 * - `anthropic-beta` with claude-code and oauth flags
 * - Claude Code identity headers (user-agent, x-app)
 *
 * The system prompt MUST include "You are Claude Code" for OAuth tokens
 * to be accepted by the API.
 */
function makeOAuthClientLayer(token: string): Layer.Layer<AnthropicClient.Service> {
  return AnthropicClient.layer({
    apiKey: Redacted.make("oauth-replaced-by-transform"),
    transformClient: (client) =>
      HttpClient.mapRequest(client, (req) => {
        // Remove x-api-key, replace with Bearer auth
        const cleaned = {
          ...req,
          headers: Headers.remove(req.headers, "x-api-key"),
        } as typeof req

        let r = cleaned
        r = HttpClientRequest.setHeader(r, "authorization", "Bearer " + token)
        r = HttpClientRequest.setHeader(
          r,
          "anthropic-beta",
          ANTHROPIC_OAUTH_BETAS
        )
        r = HttpClientRequest.setHeader(
          r,
          "anthropic-dangerous-direct-browser-access",
          "true"
        )
        r = HttpClientRequest.setHeader(
          r,
          "user-agent",
          `claude-cli/${CLAUDE_CODE_VERSION} (external, cli)`
        )
        r = HttpClientRequest.setHeader(r, "x-app", "cli")
        return r
      }),
  }).pipe(Layer.provide(FetchHttpClient.layer))
}

// ── Layer Factories ──

/**
 * Create an Anthropic LanguageModel layer using PiAuthBridge for OAuth tokens.
 *
 * Uses Bearer auth with Claude Code identity headers.
 * Requires active Claude Pro/Max subscription logged in via Pi.
 *
 * ⚠️ OAuth system prompts MUST include "You are Claude Code, Anthropic's
 * official CLI for Claude." as a prefix — the API validates this for OAuth.
 *
 * @param modelId - Anthropic model identifier (e.g., 'claude-sonnet-4-20250514')
 * @param config - Optional Anthropic-specific configuration
 */
export const makeAnthropicLayer = (
  modelId: string = "claude-sonnet-4-20250514",
  config?: Omit<AnthropicLanguageModel.Config.Service, "model">
) => {
  return Layer.unwrapEffect(
    Effect.gen(function* () {
      const bridge = yield* PiAuthBridge
      const token = yield* bridge.getApiKeyRaw(PROVIDER_ID)

      const clientLayer = makeOAuthClientLayer(token)

      const languageModelLayer = AnthropicLanguageModel.layer({
        model: modelId,
        config,
      })

      return languageModelLayer.pipe(Layer.provide(clientLayer))
    })
  )
}

/**
 * Create an Anthropic LanguageModel layer using ANTHROPIC_API_KEY env var.
 *
 * Standard x-api-key auth. No OAuth, no Claude Code identity required.
 *
 * @param modelId - Anthropic model identifier
 * @param config - Optional configuration
 */
export const makeAnthropicLayerFromEnv = (
  modelId: string = "claude-sonnet-4-20250514",
  config?: Omit<AnthropicLanguageModel.Config.Service, "model">
) => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set")

  const clientLayer = AnthropicClient.layer({
    apiKey: Redacted.make(apiKey),
  }).pipe(Layer.provide(FetchHttpClient.layer))

  const languageModelLayer = AnthropicLanguageModel.layer({
    model: modelId,
    config,
  })

  return languageModelLayer.pipe(Layer.provide(clientLayer))
}

/**
 * Pre-built layer for Claude Sonnet 4 (balanced speed + capability).
 */
export const ClaudeSonnet4Layer = makeAnthropicLayer("claude-sonnet-4-20250514")

/**
 * Pre-built layer for Claude Haiku 3.5 (fast, cheap).
 */
export const ClaudeHaiku35Layer = makeAnthropicLayer("claude-3-5-haiku-20241022")

/**
 * Pre-built layer for Claude Opus 4 (maximum capability).
 */
export const ClaudeOpus4Layer = makeAnthropicLayer("claude-opus-4-20250514")

// ── Type exports ──

export { PROVIDER_ID as ANTHROPIC_PROVIDER_ID }
