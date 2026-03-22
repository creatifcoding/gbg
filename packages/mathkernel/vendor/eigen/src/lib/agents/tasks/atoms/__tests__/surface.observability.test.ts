import { describe, expect, it } from 'vitest'

import {
  EMPTY_DURABILITY_ACK_METRICS,
  recordDurabilityAckLatency,
} from '../surface'

describe('AgentTask log observability helpers', () => {
  it('records ack latency samples with min/max/avg tracking', () => {
    const after20 = recordDurabilityAckLatency(EMPTY_DURABILITY_ACK_METRICS, 20)
    const after80 = recordDurabilityAckLatency(after20, 80)
    const after5 = recordDurabilityAckLatency(after80, 5)

    expect(after5.samples).toBe(3)
    expect(after5.minMs).toBe(5)
    expect(after5.maxMs).toBe(80)
    expect(after5.lastMs).toBe(5)
    expect(after5.avgMs).toBeCloseTo((20 + 80 + 5) / 3)
  })

  it('places samples into the expected histogram buckets', () => {
    const samples = [8, 20, 40, 90, 200, 450, 900, 1500]

    const result = samples.reduce(
      (metrics, sample) => recordDurabilityAckLatency(metrics, sample),
      EMPTY_DURABILITY_ACK_METRICS,
    )

    expect(result.buckets).toEqual({
      le10ms: 1,
      le25ms: 1,
      le50ms: 1,
      le100ms: 1,
      le250ms: 1,
      le500ms: 1,
      le1000ms: 1,
      gt1000ms: 1,
    })
  })

  it('clamps negative latency values to zero', () => {
    const result = recordDurabilityAckLatency(EMPTY_DURABILITY_ACK_METRICS, -17)

    expect(result.samples).toBe(1)
    expect(result.minMs).toBe(0)
    expect(result.maxMs).toBe(0)
    expect(result.lastMs).toBe(0)
    expect(result.buckets.le10ms).toBe(1)
  })
})
