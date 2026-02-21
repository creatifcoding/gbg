/**
 * spike-codex-oauth.ts — Full E2E: OAuth → Codex → gpt-5.2 → @effect/ai
 *
 * Proves the complete middleware pipeline:
 * 1. Read OAuth JWT from Pi's auth.json
 * 2. Inject Codex-specific headers (chatgpt-account-id, OpenAI-Beta, originator)
 * 3. Transform request body (developer message → instructions, store: false, stream: true)
 * 4. Transform response SSE (normalize Codex-specific field values for @effect/ai-openai schema)
 * 5. Stream through @effect/ai LanguageModel.streamText
 */
import { LanguageModel } from "@effect/ai"
import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai"
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  HttpBody,
} from "@effect/platform"
import { Effect, Layer, Redacted, Stream } from "effect"
import { readFileSync } from "fs"
import { join } from "path"

// ─── Auth ───────────────────────────────────────────────────────────
const authData = JSON.parse(
  readFileSync(join(process.env.HOME!, ".pi/agent/auth.json"), "utf8")
)
const token = authData["openai-codex"].access
const accountId = (() => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    return payload?.["https://api.openai.com/auth"]?.chatgpt_account_id
  } catch {
    return null
  }
})()

console.log("[auth] Token length:", token.length)
console.log("[auth] Account ID:", accountId ? accountId.slice(0, 8) + "..." : "none")

// ─── Codex SSE Normalizer ───────────────────────────────────────────
// @effect/ai-openai has strict Schema validation.
// Codex returns field values not in the schema (e.g. reasoning.effort: "none").
// We normalize those to valid schema values.
function normalizeCodexResponse(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj
  if (Array.isArray(obj)) return obj.map(normalizeCodexResponse)

  const result: any = {}
  for (const [k, v] of Object.entries(obj)) {
    // reasoning.effort: "none" → "low" (schema: "minimal"|"low"|"medium"|"high")
    if (k === "effort" && v === "none") {
      result[k] = "low"
    }
    // text.verbosity: "medium" → null (schema: "auto"|"concise"|"detailed"|null)
    else if (
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

      // SSE messages are separated by double newlines
      const parts = buffer.split("\n\n")
      buffer = parts.pop()! // keep incomplete tail

      for (const part of parts) {
        if (!part.trim()) continue
        const lines = part.split("\n")
        const transformed = lines.map((line) => {
          if (!line.startsWith("data:")) return line
          const data = line.slice(5).trim()
          if (data === "[DONE]") return line
          try {
            const parsed = JSON.parse(data)
            const cleaned = normalizeCodexResponse(parsed)
            return "data: " + JSON.stringify(cleaned)
          } catch {
            return line
          }
        })
        controller.enqueue(encoder.encode(transformed.join("\n") + "\n\n"))
      }
    },
  })
}

// ─── HttpClient Middleware ───────────────────────────────────────────
const codexFetchLayer = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((req) =>
    Effect.gen(function* () {
      const { url, method } = req

      // Build headers from request + inject Codex-specific
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

      // Transform request body: developer message → instructions
      let bodyStr: string | undefined
      const body = (req as any).body
      if (body?._tag === "Uint8Array") {
        const rawText = new TextDecoder().decode(body.body)
        try {
          const json = JSON.parse(rawText)
          // Extract developer/system role from input → top-level instructions
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
          json.stream = true
          bodyStr = JSON.stringify(json)
        } catch {
          bodyStr = rawText
        }
      }

      // Execute fetch
      const response = yield* Effect.tryPromise(() =>
        fetch(url, { method, headers, body: bodyStr })
      )

      console.log("[middleware] Status:", response.status)

      // Transform response: normalize SSE for @effect/ai-openai schema
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

// ─── Layer Composition ──────────────────────────────────────────────
const clientLayer = OpenAiClient.layer({
  apiUrl: "https://chatgpt.com/backend-api/codex",
  apiKey: Redacted.make(token),
}).pipe(Layer.provide(codexFetchLayer))

const modelLayer = OpenAiLanguageModel.layer({ model: "gpt-5.2" })
const fullLayer = modelLayer.pipe(Layer.provide(clientLayer))

// ─── E2E Test ───────────────────────────────────────────────────────
const program = Effect.gen(function* () {
  const model = yield* LanguageModel.LanguageModel

  // Test 1: streamText
  console.log("\n[test 1] streamText: What is 2+2?")
  const stream = model.streamText({
    system: "You are a helpful assistant. Be concise.",
    prompt: "What is 2 + 2? Reply with just the number.",
  })

  let fullText = ""
  let chunkCount = 0
  yield* Stream.runForEach(stream, (chunk) =>
    Effect.sync(() => {
      chunkCount++
      const part = chunk as any
      if (part.type === "text-delta" && part.delta) {
        fullText += part.delta
        process.stdout.write(part.delta)
      }
    })
  )
  console.log()
  console.log(`[test 1] ✅ Got "${fullText.trim()}" (${chunkCount} chunks)`)

  // Test 2: different question
  console.log("\n[test 2] streamText: Capital of France?")
  const stream2 = model.streamText({
    system: "You are a helpful assistant. Be concise.",
    prompt: "What is the capital of France? One word only.",
  })

  let text2 = ""
  yield* Stream.runForEach(stream2, (chunk) =>
    Effect.sync(() => {
      const part = chunk as any
      if (part.type === "text-delta" && part.delta) text2 += part.delta
    })
  )
  console.log(`[test 2] ✅ Got "${text2.trim()}"`)

  console.log("\n🔥 FULL OAUTH PIPELINE: Pi AuthStorage → JWT → Codex → gpt-5.2 → @effect/ai — COMPLETE!")
})

Effect.runPromise(program.pipe(Effect.provide(fullLayer))).catch((e) => {
  const msg = e?.message || String(e)
  console.error("Error:", msg.slice(0, 500))
  process.exit(1)
})
