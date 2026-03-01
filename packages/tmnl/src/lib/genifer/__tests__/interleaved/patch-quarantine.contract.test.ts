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

const NDJSON_WITH_MALFORMED = [
  JSON.stringify({ op: 'set', path: '/root', value: 'root-card' }),
  '{"op":"set","path":"/elements/root-card/props/title","value":"bad"',
  JSON.stringify({
    op: 'add',
    path: '/elements/root-card',
    value: {
      key: 'root-card',
      type: 'Card',
      props: { title: 'Recovered' },
      children: [],
      parentKey: null,
    },
  }),
].join('\n') + '\n'

const toChunks = (text: string) => {
  const out: Array<any> = []
  for (let i = 0; i < text.length; i += 18) {
    out.push({ type: 'text-delta', delta: text.slice(i, i + 18) })
  }
  out.push({ type: 'finish', usage: { inputTokens: 12, outputTokens: 28, totalTokens: 40 } })
  return out
}

const MockLanguageModelLive = Layer.succeed(
  LanguageModel.LanguageModel,
  LanguageModel.LanguageModel.of({
    _tag: 'LanguageModel',
    streamText: (_opts) => Stream.fromIterable(toChunks(NDJSON_WITH_MALFORMED)),
    generateText: (_opts) =>
      Effect.succeed({
        text: NDJSON_WITH_MALFORMED,
        usage: { inputTokens: 12, outputTokens: 28, totalTokens: 40 },
        finishReason: 'stop',
        providerMetadata: {},
      }),
  } as any),
)

const MockGeniferServiceLive = Layer.succeed(
  GeniferService,
  {
    saveTree: () => Effect.succeed({ treeId: 'quarantine-tree-001' }),
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

describe('interleaved gate: malformed patch quarantine', () => {
  beforeEach(() => {
    const registry = Registry.make()
    setDynamicRpcRegistry(registry)
    setDynamicEventRegistry(registry)
  })

  it('captures malformed patch metadata and still completes with valid patches', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* GeniferHarnessServiceTag
        service.setModelLayer(MockLanguageModelLive)

        return yield* service.generate({
          prompt: 'Render card with malformed stream line',
          sessionId: 'quarantine-session-001',
          persist: false,
        })
      }).pipe(
        Effect.provide(GeniferHarnessServiceLive),
        Effect.provide(MockGeniferServiceLive),
      ),
    )

    expect(result.elementCount).toBeGreaterThan(0)
    expect(result.quarantineEntries?.length ?? 0).toBeGreaterThan(0)

    const first = result.quarantineEntries?.[0] as any
    expect(first?.stage).toMatch(/parse|decode/)
    expect(typeof first?.line).toBe('string')
    expect(typeof first?.lineIndex).toBe('number')
    expect(typeof first?.message).toBe('string')

    const snapshot = typeof result.treeSnapshot === 'string'
      ? JSON.parse(result.treeSnapshot)
      : (result.treeSnapshot as any)
    expect(snapshot.root).toBe('root-card')
    expect(snapshot.elements?.['root-card']).toBeDefined()
  })
})
