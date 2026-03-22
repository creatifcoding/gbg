import { describe, expect, it } from 'vitest'
import {
  decodeContinuationToken,
  encodeContinuationToken,
  hashQuery,
  TokenCodecError,
} from '../token-codec'

describe('token codec', () => {
  const secret = 'tmnl-registry-test-secret'

  it('encodes and decodes continuation token roundtrip', async () => {
    const query = {
      text: 'ports',
      bbox: [-74, 40, -73, 41],
      collections: ['sentinel-2-l2a'],
    }

    const token = await encodeContinuationToken({
      query,
      state: {
        mode: 'token',
        cursor: 'cursor-1',
        providerState: { page: 2 },
      },
      ttlSeconds: 60,
      nowMs: 1_000,
      secret,
    })

    const decoded = await decodeContinuationToken({
      token,
      expectedQuery: query,
      nowMs: 2_000,
      secret,
    })

    expect(decoded.state.mode).toBe('token')
    expect(decoded.state.cursor).toBe('cursor-1')
    expect(decoded.queryHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('detects token tampering', async () => {
    const token = await encodeContinuationToken({
      query: { q: 'x' },
      state: { mode: 'offset', offset: 20 },
      ttlSeconds: 60,
      nowMs: 10_000,
      secret,
    })

    const [prefix, payload, signature] = token.split('.')
    const tamperedPayload = `${payload.slice(0, -1)}${payload.slice(-1) === 'a' ? 'b' : 'a'}`
    const tampered = `${prefix}.${tamperedPayload}.${signature}`

    await expect(
      decodeContinuationToken({
        token: tampered,
        expectedQuery: { q: 'x' },
        nowMs: 11_000,
        secret,
      })
    ).rejects.toMatchObject({
      _tag: 'TokenCodecError',
      code: 'INVALID_SIGNATURE',
    } satisfies Partial<TokenCodecError>)
  })

  it('rejects expired tokens', async () => {
    const token = await encodeContinuationToken({
      query: { q: 'soon-expired' },
      state: { mode: 'link', nextHref: 'https://example.com/page/2' },
      ttlSeconds: 1,
      nowMs: 100,
      secret,
    })

    await expect(
      decodeContinuationToken({
        token,
        expectedQuery: { q: 'soon-expired' },
        nowMs: 2_000,
        secret,
      })
    ).rejects.toMatchObject({
      _tag: 'TokenCodecError',
      code: 'EXPIRED_TOKEN',
    } satisfies Partial<TokenCodecError>)
  })

  it('rejects query hash mismatches', async () => {
    const token = await encodeContinuationToken({
      query: { q: 'a' },
      state: { mode: 'offset', offset: 10 },
      ttlSeconds: 60,
      nowMs: 1_000,
      secret,
    })

    await expect(
      decodeContinuationToken({
        token,
        expectedQuery: { q: 'b' },
        nowMs: 2_000,
        secret,
      })
    ).rejects.toMatchObject({
      _tag: 'TokenCodecError',
      code: 'QUERY_HASH_MISMATCH',
    } satisfies Partial<TokenCodecError>)
  })

  it('hashes semantically equivalent query objects deterministically', async () => {
    const hash1 = await hashQuery({
      b: 2,
      a: 1,
      nested: { y: true, x: false },
    })

    const hash2 = await hashQuery({
      a: 1,
      nested: { x: false, y: true },
      b: 2,
    })

    expect(hash1).toBe(hash2)
  })
})
