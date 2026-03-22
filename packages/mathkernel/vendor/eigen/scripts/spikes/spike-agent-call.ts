/**
 * spike-agent-call.ts — E2E smoke test for agent calling via Pi OAuth.
 *
 * Validates the full pipeline:
 *   PiAuthBridge (reads ~/.pi/agent/auth.json)
 *     → OpenAiClient.make({ apiKey }) using OAuth token
 *       → LanguageModel.generateText
 *         → Real LLM response
 *
 * Also validates env-var path (OPENAI_API_KEY) for comparison.
 *
 * Run: bun scripts/spikes/spike-agent-call.ts
 */
import { LanguageModel } from '@effect/ai'
import { Effect, Layer } from 'effect'

import {
  makeOpenAiLayer,
  makeOpenAiLayerFromEnv,
  PiAuthBridge,
  PiAuthBridgeLive,
} from '../../src/lib/agents'

// ── Config ──

const MODEL = 'gpt-4o-mini'

// ── Test: Auth status ──

const checkAuth = Effect.gen(function* () {
  console.log('\n🔐 [1/3] Checking Pi OAuth credentials...')

  const bridge = yield* PiAuthBridge
  const hasOpenAi = yield* bridge.hasAuth('openai-codex')
  const hasAnthropic = yield* bridge.hasAuth('anthropic')

  console.log(`   openai-codex: ${hasOpenAi ? '✅ authenticated' : '❌ no credentials'}`)
  console.log(`   anthropic:    ${hasAnthropic ? '✅ authenticated' : '❌ no credentials'}`)

  const providers = yield* bridge.listProviders()
  console.log(`   ${providers.length} providers registered`)
})

// ── Test: Env-var OpenAI call ──

const testEnvVar = Effect.gen(function* () {
  console.log('\n🔑 [2/3] Testing with OPENAI_API_KEY env var...')
  console.log(`   Model: ${MODEL}`)

  const model = yield* LanguageModel.LanguageModel

  const response = yield* model.generateText({
    prompt: 'What is 2 + 2? Reply with just the number.',
  })

  const text = response.text.trim()
  const ok = text.includes('4')
  console.log(`   Response: "${text}" ${ok ? '✅' : '⚠️'}`)
  return ok
})

// ── Test: OAuth OpenAI call ──

const testOAuth = Effect.gen(function* () {
  console.log('\n🔐 [3/3] Testing with Pi OAuth (openai-codex)...')
  console.log(`   Model: ${MODEL}`)

  const model = yield* LanguageModel.LanguageModel

  const response = yield* model.generateText({
    prompt: 'What is the capital of France? Reply with just the city name.',
  })

  const text = response.text.trim()
  const ok = text.toLowerCase().includes('paris')
  console.log(`   Response: "${text}" ${ok ? '✅' : '⚠️'}`)
  return ok
})

// ── Layer composition ──

const envLayer = makeOpenAiLayerFromEnv(MODEL)

const oauthLayer = makeOpenAiLayer(MODEL)
const oauthFullLayer = Layer.mergeAll(
  PiAuthBridgeLive,
  oauthLayer.pipe(Layer.provide(PiAuthBridgeLive)),
)

// ── Run ──

async function main() {
  const results: string[] = []

  // 1. Auth check
  await Effect.runPromise(checkAuth.pipe(Effect.provide(PiAuthBridgeLive)))

  // 2. Env var test
  try {
    const envOk = await Effect.runPromise(testEnvVar.pipe(Effect.provide(envLayer)))
    results.push(`   Env var:  ${envOk ? '✅ PASS' : '⚠️ UNEXPECTED'}`)
  } catch (e: any) {
    results.push(`   Env var:  ❌ FAIL (${(e.message || '').slice(0, 80)})`)
  }

  // 3. OAuth test
  try {
    const oauthOk = await Effect.runPromise(testOAuth.pipe(Effect.provide(oauthFullLayer)))
    results.push(`   OAuth:    ${oauthOk ? '✅ PASS' : '⚠️ UNEXPECTED'}`)
  } catch (e: any) {
    results.push(`   OAuth:    ❌ FAIL (${(e.message || '').slice(0, 80)})`)
  }

  // Summary
  console.log('\n📊 Results:')
  results.forEach((r) => console.log(r))
  console.log('\n✨ Spike complete.')
}

main().catch((error) => {
  console.error('\n💥 Spike failed:', error)
  process.exit(1)
})
