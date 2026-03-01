import { beforeEach, describe, expect, it } from 'vitest'
import { Effect, Layer, Stream } from 'effect'
import { LanguageModel } from '@effect/ai'
import { Registry } from '@effect-atom/atom'

import {
  GeniferHarnessServiceTag,
  GeniferHarnessServiceLive,
} from '../../harness/GeniferHarnessService'
import { GeniferService } from '../../services'
import { setDynamicRpcRegistry } from '../../services/DynamicRpcService'
import { setDynamicEventRegistry } from '../../services/DynamicEventService'

const NDJSON = [
  JSON.stringify({ op: 'set', path: '/root', value: 'root-card' }),
  JSON.stringify({
    op: 'add',
    path: '/elements/root-card',
    value: {
      key: 'root-card',
      type: 'Card',
      props: { title: 'Latency Gate' },
      children: [],
      parentKey: null,
    },
  }),
].join('\n') + '\n'

const chunks = (text: string) => {
  const out: Array<any> = []
  for (let i = 0; i < text.length; i += 20) {
    out.push({ type: 'text-delta', delta: text.slice(i, i + 20) })
  }
  out.push({ type: 'finish', usage: { inputTokens: 8, outputTokens: 16, totalTokens: 24 } })
  return out
}

const MockLanguageModelLive = Layer.succeed(
  LanguageModel.LanguageModel,
  LanguageModel.LanguageModel.of({
    _tag: 'LanguageModel',
    streamText: (_opts) => Stream.fromIterable(chunks(NDJSON)),
    generateText: (_opts) =>
      Effect.succeed({
        text: NDJSON,
        usage: { inputTokens: 8, outputTokens: 16, totalTokens: 24 },
        finishReason: 'stop',
        providerMetadata: {},
      }),
  } as any),
)

const MockGeniferServiceLive = Layer.succeed(
  GeniferService,
  {
    saveTree: () => Effect.succeed({ treeId: 'latency-tree-001' }),
    loadTree: () => Effect.succeed(null),
    listRecentTrees: () => Effect.succeed([]),
    listTreesByQuality: () => Effect.succeed([]),
    listTreesByThread: () => Effect.succeed([]),
    rateTree: () => Effect.succeed(undefined),
    listComposites: () => Effect.succeed([]),
    topRankedComposites: () => Effect.succeed([]),
    rateComposite: () => Effect.succeed(undefined),
    listSignalsByTarget: () => Effect.succeed([]),
  } as any,
)

describe('interleaved gate: first patch visible latency', () => {
  beforeEach(() => {
    const registry = Registry.make()
    setDynamicRpcRegistry(registry)
    setDynamicEventRegistry(registry)
  })

  it('records firstPatchLatencyMs and keeps it within 200ms for deterministic fixture', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* GeniferHarnessServiceTag
        service.setModelLayer(MockLanguageModelLive)

        return yield* service.generate({
          prompt: 'Render a tiny card',
          sessionId: 'latency-session-001',
          persist: false,
        })
      }).pipe(
        Effect.provide(GeniferHarnessServiceLive),
        Effect.provide(MockGeniferServiceLive),
      ),
    )

    expect(result.firstPatchLatencyMs).toBeTypeOf('number')
    expect((result.firstPatchLatencyMs ?? 9999)).toBeLessThanOrEqual(200)
  })
})
