/**
 * spike-anthropic-oauth.ts — Full E2E: OAuth → Anthropic → Claude Sonnet 4
 *
 * Pi's Anthropic OAuth uses:
 * - Bearer auth (Authorization header), NOT x-api-key
 * - Beta headers: claude-code-20250219, oauth-2025-04-20
 * - Claude Code identity: user-agent, x-app
 * - System prompt MUST include "You are Claude Code" for OAuth tokens
 *
 * @effect/ai-anthropic sends x-api-key by default. We use transformClient
 * middleware to swap the auth mechanism.
 */
import { LanguageModel } from "@effect/ai"
import { AnthropicClient, AnthropicLanguageModel } from "@effect/ai-anthropic"
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  Headers,
} from "@effect/platform"
import { Effect, Layer, Redacted, Stream } from "effect"
import { readFileSync } from "fs"
import { join } from "path"

// ─── Auth ───────────────────────────────────────────────────────────

const authData = JSON.parse(
  readFileSync(join(process.env.HOME!, ".pi/agent/auth.json"), "utf8")
)
const token = authData["anthropic"].access

console.log("[auth] Token prefix:", token.slice(0, 20) + "...")

// ─── Anthropic OAuth Headers ────────────────────────────────────────

const ANTHROPIC_OAUTH_BETAS = [
  "claude-code-20250219",
  "oauth-2025-04-20",
  "fine-grained-tool-streaming-2025-05-14",
  "interleaved-thinking-2025-05-14",
].join(",")

const CLAUDE_CODE_VERSION = "2.1.2"

// Claude Code identity is REQUIRED for OAuth tokens — without it, the
// API rejects the request. Pi's provider includes this automatically.
const CLAUDE_CODE_SYSTEM_PREFIX =
  "You are Claude Code, Anthropic's official CLI for Claude."

// ─── Layer Composition ──────────────────────────────────────────────

const clientLayer = AnthropicClient.layer({
  // Pass dummy key — transformClient will replace auth entirely
  apiKey: Redacted.make("dummy-replaced-by-transform"),
  transformClient: (client) =>
    HttpClient.mapRequest(client, (req) => {
      // Remove x-api-key header, replace with Bearer auth
      const cleaned = {
        ...req,
        headers: Headers.remove(req.headers, "x-api-key"),
      } as typeof req

      let r = cleaned
      r = HttpClientRequest.setHeader(r, "authorization", "Bearer " + token)
      r = HttpClientRequest.setHeader(r, "anthropic-beta", ANTHROPIC_OAUTH_BETAS)
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

const modelLayer = AnthropicLanguageModel.model("claude-sonnet-4-20250514")
const fullLayer = modelLayer.pipe(Layer.provide(clientLayer))

// ─── E2E Tests ──────────────────────────────────────────────────────

const program = Effect.gen(function* () {
  const model = yield* LanguageModel.LanguageModel

  // Test 1: generateText
  console.log("\n[test 1] generateText: What is 2+2?")
  const response = yield* model.generateText({
    system: CLAUDE_CODE_SYSTEM_PREFIX + " Be concise.",
    prompt: "What is 2 + 2? Reply with just the number.",
  })
  console.log(`[test 1] ✅ Got "${response.text.trim()}"`)

  // Test 2: Different question
  console.log("\n[test 2] generateText: Capital of France?")
  const response2 = yield* model.generateText({
    system: CLAUDE_CODE_SYSTEM_PREFIX + " Be concise.",
    prompt: "What is the capital of France? One word only.",
  })
  console.log(`[test 2] ✅ Got "${response2.text.trim()}"`)

  // Test 3: streamText
  console.log("\n[test 3] streamText: Count to 5")
  const stream = model.streamText({
    system: CLAUDE_CODE_SYSTEM_PREFIX + " Be concise.",
    prompt: "Count from 1 to 5, separated by commas. Nothing else.",
  })

  let streamText = ""
  let chunkCount = 0
  yield* Stream.runForEach(stream, (chunk) =>
    Effect.sync(() => {
      chunkCount++
      const part = chunk as any
      if (part.type === "text-delta" && part.delta) {
        streamText += part.delta
        process.stdout.write(part.delta)
      }
    })
  )
  console.log()
  console.log(`[test 3] ✅ Got "${streamText.trim()}" (${chunkCount} chunks)`)

  console.log(
    "\n🔥 FULL ANTHROPIC OAUTH: Pi AuthStorage → Bearer → claude-sonnet-4 → @effect/ai — COMPLETE!"
  )
})

Effect.runPromise(program.pipe(Effect.provide(fullLayer))).catch((e) => {
  const msg = e?.message || String(e)
  console.error("Error:", msg.slice(0, 800))
  process.exit(1)
})
