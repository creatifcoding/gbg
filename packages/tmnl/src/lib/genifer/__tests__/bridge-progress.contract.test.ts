import { describe, expect, it } from 'vitest'
import { Effect, Layer } from 'effect'
import * as AtomRegistry from '@effect-atom/atom/Registry'

import { createGeniferTools } from '../harness/bridge'
import type { GeniferHarnessServiceShape } from '../harness/GeniferHarnessService'

const makeService = (): GeniferHarnessServiceShape => {
  const registry = AtomRegistry.make()

  return {
    generate: (opts) =>
      Effect.sync(() => {
        opts.onProgress?.('streaming', 2, {
          treePatch: { op: 'set', path: '/root', value: 'root-card' } as any,
          patchSeq: 1,
          startTs: 1000,
          firstPatchReceivedTs: 1025,
          firstPatchLatencyMs: 25,
        })

        return {
          surfaceId: 'surface-g',
          treeId: 'tree-g',
          elementCount: 2,
          qualityScore: 0.9,
          repairCount: 0,
          durationMs: 125,
          model: 'sonnet-4',
          threadId: 'thread-g',
          startTs: 1000,
          firstPatchReceivedTs: 1025,
          firstPatchLatencyMs: 25,
          quarantineEntries: [{ stage: 'parse', line: '{bad', lineIndex: 2 }],
          treeSnapshot: { root: 'root-card', elements: {} },
          promptEval: {
            promptHash: 'abc123',
            tokenomics: { estimatedTotalTokens: 10, totalTokens: 12 },
            steering: { unknownTypeCount: 0, requiredPropMissCount: 0 },
            utility: { utilityScore: 0.8, steeringScore: 0.9, costIndex: 0.2 },
          } as any,
        }
      }),
    refine: (opts) =>
      Effect.sync(() => {
        opts.onProgress?.('streaming', 3, {
          treePatch: { op: 'set', path: '/elements/root-card/props/title', value: 'Refined' } as any,
          patchSeq: 2,
          startTs: 2000,
          firstPatchReceivedTs: 2030,
          firstPatchLatencyMs: 30,
        })

        return {
          surfaceId: 'surface-r',
          treeId: 'tree-r',
          sourceTreeId: 'tree-g',
          sourceSurfaceId: 'surface-g',
          elementCount: 3,
          qualityScore: 0.91,
          repairCount: 0,
          durationMs: 140,
          addedElements: 1,
          removedElements: 0,
          modifiedElements: 1,
          startTs: 2000,
          firstPatchReceivedTs: 2030,
          firstPatchLatencyMs: 30,
          quarantineEntries: [{ stage: 'decode', line: '{}', lineIndex: 5 }],
          treeSnapshot: { root: 'root-card', elements: {} },
          promptEval: {
            promptHash: 'def456',
            tokenomics: { estimatedTotalTokens: 12, totalTokens: 14 },
            steering: { unknownTypeCount: 0, requiredPropMissCount: 0 },
            utility: { utilityScore: 0.82, steeringScore: 0.9, costIndex: 0.25 },
          } as any,
        }
      }),
    query: (operation) => Effect.succeed({ operation, data: [] as const }),
    getSurface: () => undefined,
    getAllSurfaces: () => new Map(),
    removeSurface: () => undefined,
    allocateStreamingSurface: () => ({ surfaceId: 'surface-bg' as any, threadId: 'thread-bg' as any }),
    generateInBackground: () =>
      Effect.succeed({
        surfaceId: 'surface-bg',
        treeId: null,
        elementCount: 0,
        qualityScore: 0,
        repairCount: 0,
        durationMs: 0,
        model: 'sonnet-4',
        threadId: 'thread-bg',
        treeSnapshot: null,
      } as any),
    setModelLayer: (_layer: Layer.Layer<any>) => undefined,
    registry,
  }
}

describe('genifer bridge progress contracts', () => {
  it('forwards telemetry + quarantine fields for generate progress and completion', async () => {
    const tools = createGeniferTools(makeService(), 'bridge-test-session')
    const tool = tools.find((t) => t.name === 'genifer_generate')!

    const updates: any[] = []
    const result = await tool.execute(
      'call-g',
      { prompt: 'generate card', persist: false } as any,
      undefined,
      (u) => updates.push(u),
      undefined as any,
    )

    expect(updates.length).toBeGreaterThan(0)
    expect(updates[0].details).toMatchObject({
      patchSeq: 1,
      startTs: 1000,
      firstPatchReceivedTs: 1025,
      firstPatchLatencyMs: 25,
    })

    expect((result as any).details).toMatchObject({
      startTs: 1000,
      firstPatchReceivedTs: 1025,
      firstPatchLatencyMs: 25,
    })
    expect(Array.isArray((result as any).details?.quarantineEntries)).toBe(true)
  })

  it('forwards telemetry + quarantine fields for refine progress and completion', async () => {
    const tools = createGeniferTools(makeService(), 'bridge-test-session')
    const tool = tools.find((t) => t.name === 'genifer_refine')!

    const updates: any[] = []
    const result = await tool.execute(
      'call-r',
      { surfaceId: 'surface-g', instruction: 'refine title', persist: false } as any,
      undefined,
      (u) => updates.push(u),
      undefined as any,
    )

    expect(updates.length).toBeGreaterThan(0)
    expect(updates[0].details).toMatchObject({
      patchSeq: 2,
      startTs: 2000,
      firstPatchReceivedTs: 2030,
      firstPatchLatencyMs: 30,
    })

    expect((result as any).details).toMatchObject({
      startTs: 2000,
      firstPatchReceivedTs: 2030,
      firstPatchLatencyMs: 30,
    })
    expect(Array.isArray((result as any).details?.quarantineEntries)).toBe(true)
  })
})
