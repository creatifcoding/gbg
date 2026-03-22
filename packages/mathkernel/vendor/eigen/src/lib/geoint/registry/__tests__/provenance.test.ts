import { describe, expect, it } from 'vitest'
import {
  buildRequestResponseDigests,
  sha256Hex,
  sha256HexOf,
  stableCanonicalJson,
} from '../provenance'

describe('provenance hashing', () => {
  it('produces the known SHA-256 for abc', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('is stable regardless of object key ordering', () => {
    const a = { source: 'opensky', payload: { b: 2, a: 1 } }
    const b = { payload: { a: 1, b: 2 }, source: 'opensky' }

    expect(stableCanonicalJson(a)).toBe(stableCanonicalJson(b))
    expect(sha256HexOf(a)).toBe(sha256HexOf(b))
  })

  it('builds deterministic request/response digest pair', () => {
    const pairA = buildRequestResponseDigests(
      { queryId: 'q1', bounds: [1, 2, 3, 4] },
      [{ id: 'r1', score: 0.9 }],
    )

    const pairB = buildRequestResponseDigests(
      { bounds: [1, 2, 3, 4], queryId: 'q1' },
      [{ score: 0.9, id: 'r1' }],
    )

    expect(pairA).toEqual(pairB)
    expect(pairA.requestHash).toMatch(/^[a-f0-9]{64}$/)
    expect(pairA.responseHash).toMatch(/^[a-f0-9]{64}$/)
    expect(pairA.requestHash).not.toBe(pairA.responseHash)
  })
})
