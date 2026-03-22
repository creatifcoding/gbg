import { describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

import {
  GENIFER_FIRST_PATCH_COMMITTED_EVENT,
  useIncrementalTree,
} from '../incremental-tree'

describe('useIncrementalTree commit probe', () => {
  it('emits first-patch committed telemetry exactly once per stream', async () => {
    const events: any[] = []
    const handler = (event: Event) => {
      events.push((event as CustomEvent).detail)
    }

    window.addEventListener(GENIFER_FIRST_PATCH_COMMITTED_EVENT, handler)

    try {
      const { rerender } = renderHook(
        ({ details }: { details: any }) => useIncrementalTree(details),
        {
          initialProps: {
            details: {
              streamKey: 'stream-1',
              startTs: 1000,
            },
          },
        },
      )

      rerender({
        details: {
          streamKey: 'stream-1',
          startTs: 1000,
          firstPatchReceivedTs: 1025,
          patchSeq: 1,
          treePatch: { op: 'set', path: '/root', value: 'root-card' },
        },
      })

      await waitFor(() => {
        expect(events.length).toBe(1)
      })

      // Duplicate/old patch should not emit again
      rerender({
        details: {
          streamKey: 'stream-1',
          startTs: 1000,
          firstPatchReceivedTs: 1025,
          patchSeq: 1,
          treePatch: { op: 'set', path: '/root', value: 'root-card' },
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(events.length).toBe(1)

      // Stream rollover without new patch should not emit/misattributed probe
      rerender({
        details: {
          streamKey: 'stream-2',
          startTs: 2000,
        },
      })
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(events.length).toBe(1)

      const first = events[0]
      expect(first.streamKey).toBe('stream-1')
      expect(first.startTs).toBe(1000)
      expect(first.firstPatchReceivedTs).toBe(1025)
      expect(typeof first.firstPatchCommittedTs).toBe('number')
      expect(first.firstPatchCommittedTs).toBeGreaterThanOrEqual(1025)
      expect(typeof first.commitLatencyFromStartMs).toBe('number')
      expect(first.commitLatencyFromStartMs).toBeGreaterThanOrEqual(0)
      expect(typeof first.commitLagFromReceiveMs).toBe('number')
      expect(first.commitLagFromReceiveMs).toBeGreaterThanOrEqual(0)
    } finally {
      window.removeEventListener(GENIFER_FIRST_PATCH_COMMITTED_EVENT, handler)
    }
  })

  it('does not misattribute commit probe to a new stream during rapid rollover', async () => {
    const events: any[] = []
    const handler = (event: Event) => {
      events.push((event as CustomEvent).detail)
    }

    window.addEventListener(GENIFER_FIRST_PATCH_COMMITTED_EVENT, handler)

    try {
      const { rerender } = renderHook(
        ({ details }: { details: any }) => useIncrementalTree(details),
        {
          initialProps: {
            details: {
              streamKey: 'stream-race-1',
              startTs: 1000,
            },
          },
        },
      )

      // First stream patch
      rerender({
        details: {
          streamKey: 'stream-race-1',
          startTs: 1000,
          firstPatchReceivedTs: 1010,
          patchSeq: 1,
          treePatch: { op: 'set', path: '/root', value: 'root-race' },
        },
      })

      // Immediate rollover before waiting for effects to settle
      rerender({
        details: {
          streamKey: 'stream-race-2',
          startTs: 2000,
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 0))

      // Allowed outcomes: 0 events (probe skipped due rollover) or 1 event for old stream.
      expect(events.length).toBeLessThanOrEqual(1)
      if (events.length === 1) {
        expect(events[0].streamKey).toBe('stream-race-1')
      }
      expect(events.some((e) => e.streamKey === 'stream-race-2')).toBe(false)
    } finally {
      window.removeEventListener(GENIFER_FIRST_PATCH_COMMITTED_EVENT, handler)
    }
  })
})
