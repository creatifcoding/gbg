import { beforeEach, describe, expect, it } from 'vitest'
import { Effect, Layer, Stream } from 'effect'
import { LanguageModel } from '@effect/ai'
import { Registry } from '@effect-atom/atom'

import {
  GeniferHarnessServiceTag,
  GeniferHarnessServiceLive,
} from '../harness/GeniferHarnessService'
import { GeniferService } from '../services'
import { setDynamicRpcRegistry } from '../services/DynamicRpcService'
import { setDynamicEventRegistry } from '../services/DynamicEventService'

const PATCH_NDJSON = [
  JSON.stringify({ op: 'set', path: '/root', value: 'root-card' }),
  JSON.stringify({
    op: 'add',
    path: '/elements/root-card',
    value: {
      key: 'root-card',
      type: 'Card',
      props: { title: 'Mission Control' },
      children: ['title-1'],
      parentKey: null,
    },
  }),
  JSON.stringify({
    op: 'add',
    path: '/elements/title-1',
    value: {
      key: 'title-1',
      type: 'Heading',
      props: { text: 'Patch Stream Ready' },
      children: [],
      parentKey: 'root-card',
    },
  }),
].join('\n') + '\n'

const REFINE_NDJSON = [
  JSON.stringify({
    op: 'replace',
    path: '/elements/root-card/props/title',
    value: 'Mission Control (Refined)',
  }),
].join('\n') + '\n'

const toChunks = (ndjson: string): Array<any> => {
  const chunks: Array<any> = []
  const chunkSize = 28
  for (let i = 0; i < ndjson.length; i += chunkSize) {
    chunks.push({
      type: 'text-delta',
      delta: ndjson.slice(i, i + chunkSize),
    })
  }
  chunks.push({
    type: 'finish',
    usage: { inputTokens: 24, outputTokens: 54, totalTokens: 78 },
  })
  return chunks
}

const MockPatchLanguageModelLive = Layer.succeed(
  LanguageModel.LanguageModel,
  LanguageModel.LanguageModel.of({
    _tag: 'LanguageModel',
    streamText: (_opts) => Stream.fromIterable(toChunks(PATCH_NDJSON)),
    generateText: (_opts) =>
      Effect.succeed({
        text: PATCH_NDJSON,
        usage: { inputTokens: 24, outputTokens: 54, totalTokens: 78 },
        finishReason: 'stop',
        providerMetadata: {},
      }),
  } as any),
)

const MockGeniferServiceLive = Layer.succeed(
  GeniferService,
  {
    saveTree: () => Effect.succeed({ treeId: 'mock-patch-tree-001' }),
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

describe('Genifer harness patch stream E2E', () => {
  beforeEach(() => {
    const registry = Registry.make()
    setDynamicRpcRegistry(registry)
    setDynamicEventRegistry(registry)
  })

  it('streams progressive patch updates and emits component deltas', async () => {
    const progressCounts: number[] = []
    const progressPatchSeqs: number[] = []
    const progressCheckpointCount = { value: 0 }
    const eventTags: string[] = []

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* GeniferHarnessServiceTag
        service.setModelLayer(MockPatchLanguageModelLive)

        return yield* service.generate({
          prompt: 'Build a card with heading',
          sessionId: 'patch-stream-session-001',
          persist: false,
          onProgress: (status, elementCount, progress) => {
            if (status === 'streaming') {
              progressCounts.push(elementCount)
              if (progress?.treePatch) {
                progressPatchSeqs.push(progress.patchSeq ?? -1)
              }
              if (progress?.treeSnapshot) {
                progressCheckpointCount.value += 1
              }
            }
          },
          onEvent: (event) => {
            eventTags.push((event as any)._tag)
          },
        })
      }).pipe(
        Effect.provide(GeniferHarnessServiceLive),
        Effect.provide(MockGeniferServiceLive),
      ),
    )

    expect(result.elementCount).toBeGreaterThanOrEqual(2)
    expect(result.qualityScore).toBeGreaterThan(0.5)

    expect(progressCounts.length).toBeGreaterThanOrEqual(2)
    expect(progressCounts[progressCounts.length - 1]).toBe(result.elementCount)

    // Patch-first progress branch: streaming updates should carry patch payloads
    expect(progressPatchSeqs.length).toBeGreaterThan(0)
    expect(progressPatchSeqs.every((seq) => seq > 0)).toBe(true)
    expect(progressPatchSeqs.every((seq, idx, arr) => idx === 0 || seq > arr[idx - 1])).toBe(true)
    // Strict patch-canonical progress: no snapshot checkpoints during streaming
    expect(progressCheckpointCount.value).toBe(0)

    expect(eventTags).toContain('GeniferGenerateStartEvent')
    expect(eventTags).toContain('GeniferStreamDeltaEvent')
    expect(eventTags).toContain('GeniferGenerateCompleteEvent')

    const snapshot = typeof result.treeSnapshot === 'string'
      ? JSON.parse(result.treeSnapshot)
      : (result.treeSnapshot as any)
    expect(snapshot.root).toBe('root-card')
    expect(snapshot.elements?.['root-card']).toBeDefined()
  })

  it('seeds refine streaming with base snapshot before diff patches', async () => {
    let streamCall = 0
    const SequencedPatchLanguageModelLive = Layer.succeed(
      LanguageModel.LanguageModel,
      LanguageModel.LanguageModel.of({
        _tag: 'LanguageModel',
        streamText: (_opts) => {
          const payload = streamCall === 0 ? PATCH_NDJSON : REFINE_NDJSON
          streamCall += 1
          return Stream.fromIterable(toChunks(payload))
        },
        generateText: (_opts) =>
          Effect.succeed({
            text: streamCall <= 1 ? PATCH_NDJSON : REFINE_NDJSON,
            usage: { inputTokens: 24, outputTokens: 54, totalTokens: 78 },
            finishReason: 'stop',
            providerMetadata: {},
          }),
      } as any),
    )

    const progressFrames: Array<{ treeSnapshot: boolean; treePatch: boolean; patchSeq: number | undefined }> = []

    const refined = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* GeniferHarnessServiceTag
        service.setModelLayer(SequencedPatchLanguageModelLive)

        const generated = yield* service.generate({
          prompt: 'Build a card with heading',
          sessionId: 'patch-stream-session-002',
          persist: false,
        })

        return yield* service.refine({
          surfaceId: generated.surfaceId,
          instruction: 'Update the card title',
          sessionId: 'patch-stream-session-002',
          persist: false,
          onProgress: (status, _elementCount, progress) => {
            if (status === 'streaming') {
              progressFrames.push({
                treeSnapshot: progress?.treeSnapshot != null,
                treePatch: progress?.treePatch != null,
                patchSeq: progress?.patchSeq,
              })
            }
          },
        })
      }).pipe(
        Effect.provide(GeniferHarnessServiceLive),
        Effect.provide(MockGeniferServiceLive),
      ),
    )

    expect(progressFrames.length).toBeGreaterThan(1)
    expect(progressFrames[0]).toMatchObject({ treeSnapshot: true, treePatch: false, patchSeq: 0 })
    expect(progressFrames.some((frame) => frame.treePatch && (frame.patchSeq ?? 0) > 0)).toBe(true)

    const snapshot = typeof refined.treeSnapshot === 'string'
      ? JSON.parse(refined.treeSnapshot)
      : (refined.treeSnapshot as any)
    expect(snapshot.elements?.['root-card']?.props?.title).toBe('Mission Control (Refined)')
  })
})
