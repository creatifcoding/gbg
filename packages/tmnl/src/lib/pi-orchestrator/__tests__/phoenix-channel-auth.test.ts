import { describe, expect, it } from 'vitest'

import { PhoenixChannelTokenManager } from '../client/PhoenixChannelAuth'

describe('PhoenixChannelTokenManager', () => {
  it('caches token until refresh window', async () => {
    let now = 1000
    let calls = 0

    const manager = new PhoenixChannelTokenManager(
      async () => {
        calls += 1
        return {
          token: `token-${calls}`,
          expiresAtMs: now + 60_000,
        }
      },
      {
        refreshSkewMs: 10_000,
        now: () => now,
      },
    )

    expect(await manager.getToken()).toBe('token-1')
    now += 20_000
    expect(await manager.getToken()).toBe('token-1')

    now += 45_000
    expect(await manager.getToken()).toBe('token-2')
    expect(calls).toBe(2)
  })
})
