/**
 * spike-agent-anthropic.ts — Test Anthropic OAuth via Pi credentials.
 *
 * Run: bun scripts/spikes/spike-agent-anthropic.ts
 */
import { LanguageModel } from '@effect/ai'
import { Effect, Layer } from 'effect'

import {
  makeAnthropicLayer,
  PiAuthBridge,
  PiAuthBridgeLive,
} from '../../src/lib/agents'

const MODEL = 'claude-sonnet-4-20250514'

const program = Effect.gen(function* () {
  const bridge = yield* PiAuthBridge
  
  console.log('\n🔐 Checking Anthropic auth...')
  const hasAuth = yield* bridge.hasAuth('anthropic')
  console.log(`   anthropic: ${hasAuth ? '✅ authenticated' : '❌ no credentials'}`)
  
  if (!hasAuth) {
    console.log('   Skipping — no Anthropic credentials')
    return
  }

  // Show the token prefix for debugging
  const rawToken = yield* bridge.getApiKeyRaw('anthropic')
  console.log(`   Token prefix: ${rawToken.slice(0, 20)}...`)
  console.log(`   Token length: ${rawToken.length}`)

  console.log(`\n🧠 Model: ${MODEL}`)
  const model = yield* LanguageModel.LanguageModel

  console.log('💬 Calling generateText...')
  const response = yield* model.generateText({
    prompt: 'What is 2 + 2? Reply with just the number.',
  })

  console.log(`   Response: "${response.text}"`)
  console.log(`   ✅ Anthropic OAuth → @effect/ai pipeline works!`)
})

const anthropicLayer = makeAnthropicLayer(MODEL)
const fullLayer = Layer.mergeAll(
  PiAuthBridgeLive,
  anthropicLayer.pipe(Layer.provide(PiAuthBridgeLive)),
)

Effect.runPromise(program.pipe(Effect.provide(fullLayer))).catch((e) => {
  const msg = e?.message || String(e)
  console.error('\n💥 Error:', msg.slice(0, 500))
})
