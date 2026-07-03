/**
 * OpenAI LanguageModel layer factories.
 *
 * Three auth paths:
 *
 * 1. **Codex OAuth** (`makeOpenAiCodexLayer`) — Pi's OAuth JWT → Codex endpoint
 *    (chatgpt.com/backend-api/codex/responses). Requires ChatGPT Plus/Pro.
 *    Uses HttpClient middleware to translate @effect/ai's standard Responses API
 *    format into Codex's dialect (instructions, headers, SSE normalization).
 *
 * 2. **Standard OAuth** (`makeOpenAiLayer`) — Pi's OAuth JWT → api.openai.com.
 *    ⚠️ Codex subscription tokens lack `api.responses.write` scope — this will
 *    fail with 401 unless the OAuth provider changes.
 *
 * 3. **Env var** (`makeOpenAiLayerFromEnv`) — OPENAI_API_KEY → api.openai.com.
 *    The most reliable path for standard OpenAI API access.
 */
import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai"
import {
  FetchHttpClient,
  HttpClient,
  HttpClientResponse,
} from "@effect/platform"
import { Config, Effect, Layer, Redacted } from "effect"

import { PiAuthBridge } from "../auth/PiAuthBridge"

// ── Constants ──

const PROVIDER_ID = "openai-codex"
const CODEX_API_URL = "https://chatgpt.com/backend-api/codex"

// ── Codex Middleware ──

/**
 * Normalize Codex SSE response fields to match @effect/ai-openai's strict Schema.
 *
 * Known divergences:
 * - reasoning.effort: "none" → "low" (schema: "minimal"|"low"|"medium"|"high")
 * - text.verbosity: "medium" → null (schema: "auto"|"concise"|"detailed"|null)
 */
function normalizeCodexResponse(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj
  if (Array.isArray(obj)) return obj.map(normalizeCodexResponse)

  const result: any = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === "effort" && v === "none") {
      result[k] = "low"
    } else if (
      k === "verbosity" &&
      typeof v === "string" &&
      !["auto", "concise", "detailed"].includes(v)
    ) {
      result[k] = null
    } else {
      result[k] = normalizeCodexResponse(v)
    }
  }
  return result
}

/**
 * Transform SSE response body: normalize Codex-specific field values.
 */
function transformSSEBody(
  body: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
  const reader = body.getReader()
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let buffer = ""

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        if (buffer.trim()) controller.enqueue(encoder.encode(buffer))
        controller.close()
        return
      }

      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split("\n\n")
      buffer = parts.pop()!

      for (const part of parts) {
        if (!part.trim()) continue
        const lines = part.split("\n")
        const transformed = lines.map((line) => {
          if (!line.startsWith("data:")) return line
          const data = line.slice(5).trim()
          if (data === "[DONE]") return line
          try {
            return (
              "data: " +
              JSON.stringify(normalizeCodexResponse(JSON.parse(data)))
            )
          } catch {
            return line
          }
        })
        controller.enqueue(encoder.encode(transformed.join("\n") + "\n\n"))
      }
    },
  })
}

/**
 * Extract chatgpt_account_id from a Codex JWT.
 */
function extractAccountId(jwt: string): string | null {
  try {
    const payload = JSON.parse(atob(jwt.split(".")[1]))
    return payload?.["https://api.openai.com/auth"]?.chatgpt_account_id ?? null
  } catch {
    return null
  }
}

/**
 * Build the Codex HttpClient layer.
 *
 * This middleware intercepts all HTTP requests and:
 * 1. Injects Codex-specific headers (chatgpt-account-id, OpenAI-Beta, originator)
 * 2. Transforms request body (developer message → top-level instructions, store: false, stream: true)
 * 3. Normalizes response SSE events for @effect/ai-openai schema compatibility
 */
function makeCodexHttpLayer(token: string): Layer.Layer<HttpClient.HttpClient> {
  const accountId = extractAccountId(token)

  return Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((req) =>
      Effect.gen(function* () {
        const { url, method } = req

        // Copy + inject headers
        const headers: Record<string, string> = {}
        const rawHeaders = (req as any).headers
        if (rawHeaders) {
          for (const [k, v] of Object.entries(rawHeaders)) {
            if (typeof v === "string") headers[k] = v
          }
        }
        headers["authorization"] = "Bearer " + token
        if (accountId) headers["chatgpt-account-id"] = accountId
        headers["openai-beta"] = "responses=experimental"
        headers["originator"] = "pi"
        headers["user-agent"] = "pi (linux; x64)"
        headers["content-type"] = "application/json"

        // Transform request body
        let bodyStr: string | undefined
        const body = (req as any).body
        if (body?._tag === "Uint8Array") {
          const rawText = new TextDecoder().decode(body.body)
          try {
            const json = JSON.parse(rawText)
            // Move developer/system role message → top-level instructions
            if (!json.instructions && Array.isArray(json.input)) {
              const sysIdx = json.input.findIndex(
                (m: any) => m.role === "developer" || m.role === "system"
              )
              if (sysIdx >= 0) {
                json.instructions = json.input[sysIdx].content
                json.input.splice(sysIdx, 1)
              } else {
                json.instructions = "You are a helpful assistant."
              }
            }
            json.store = false
            json.stream = true // Codex requires streaming
            bodyStr = JSON.stringify(json)
          } catch {
            bodyStr = rawText
          }
        }

        // Execute fetch
        const response = yield* Effect.tryPromise(() =>
          fetch(url, { method, headers, body: bodyStr })
        )

        // Normalize response SSE
        if (response.body && response.status === 200) {
          const transformed = transformSSEBody(response.body)
          const clean = new Response(transformed, {
            status: 200,
            statusText: "OK",
            headers: { "content-type": "text/event-stream" },
          })
          return HttpClientResponse.fromWeb(req, clean)
        }

        return HttpClientResponse.fromWeb(req, response)
      })
    )
  )
}

// ── Layer Factories ──

/**
 * Create an OpenAI LanguageModel layer using PiAuthBridge → Codex endpoint.
 *
 * This is the primary OAuth path. Uses the Codex backend (chatgpt.com)
 * with full middleware for request/response translation.
 *
 * Supported models: gpt-5.1, gpt-5.1-codex-max, gpt-5.1-codex-mini,
 * gpt-5.2, gpt-5.2-codex, gpt-5.3-codex, gpt-5.3-codex-spark
 *
 * @param modelId - Codex-supported model (default: 'gpt-5.2')
 * @param config - Optional OpenAI language model configuration
 */
export const makeOpenAiCodexLayer = (
  modelId: string = "gpt-5.2",
  config?: Omit<OpenAiLanguageModel.Config.Service, "model">
) => {
  return Layer.unwrapEffect(
    Effect.gen(function* () {
      const bridge = yield* PiAuthBridge
      const token = yield* bridge.getApiKeyRaw(PROVIDER_ID)

      const codexHttpLayer = makeCodexHttpLayer(token)

      const clientLayer = OpenAiClient.layer({
        apiUrl: CODEX_API_URL,
        apiKey: Redacted.make(token),
      }).pipe(Layer.provide(codexHttpLayer))

      const modelLayer = OpenAiLanguageModel.layer({
        model: modelId,
        config,
      })

      return modelLayer.pipe(Layer.provide(clientLayer))
    })
  )
}

/**
 * Create an OpenAI LanguageModel layer using PiAuthBridge → standard API.
 *
 * ⚠️ Codex subscription tokens lack `api.responses.write` scope.
 * This will fail with 401 unless the OAuth provider grants API access.
 * Use `makeOpenAiCodexLayer` for OAuth or `makeOpenAiLayerFromEnv` for API keys.
 *
 * @param modelId - OpenAI model identifier (e.g., 'gpt-4o', 'gpt-4o-mini')
 * @param config - Optional configuration
 */
export const makeOpenAiLayer = (
  modelId: string = "gpt-4o-mini",
  config?: Omit<OpenAiLanguageModel.Config.Service, "model">
) => {
  return Layer.unwrapEffect(
    Effect.gen(function* () {
      const bridge = yield* PiAuthBridge
      const token = yield* bridge.getApiKeyRaw(PROVIDER_ID)

      const clientLayer = OpenAiClient.layer({
        apiKey: Redacted.make(token),
      }).pipe(Layer.provide(FetchHttpClient.layer))

      const languageModelLayer = OpenAiLanguageModel.layer({
        model: modelId,
        config,
      })

      return languageModelLayer.pipe(Layer.provide(clientLayer))
    })
  )
}

/**
 * Create an OpenAI LanguageModel layer using OPENAI_API_KEY env var.
 *
 * No PiAuthBridge dependency. Uses standard OpenAI API.
 *
 * @param modelId - OpenAI model identifier
 * @param config - Optional configuration
 */
export const makeOpenAiLayerFromEnv = (
  modelId: string = "gpt-4o-mini",
  config?: Omit<OpenAiLanguageModel.Config.Service, "model">
) =>
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const apiKey = yield* Config.redacted("OPENAI_API_KEY")

      const clientLayer = OpenAiClient.layer({
        apiKey,
      }).pipe(Layer.provide(FetchHttpClient.layer))

      const languageModelLayer = OpenAiLanguageModel.layer({
        model: modelId,
        config,
      })

      return languageModelLayer.pipe(Layer.provide(clientLayer))
    })
  )

/**
 * Pre-built layer for gpt-4o-mini using env var (no OAuth dependency).
 */
export const OpenAiMiniLayerEnv = makeOpenAiLayerFromEnv("gpt-4o-mini")

// ── Type exports ──

export { PROVIDER_ID as OPENAI_PROVIDER_ID }
