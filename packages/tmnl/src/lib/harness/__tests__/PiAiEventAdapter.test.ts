import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'

import { PiAiEventAdapter, PiAiEventAdapterLive } from '../PiAiEventAdapter'

describe('PiAiEventAdapter provider marker coverage', () => {
  it.effect('maps known low-level markers into tagged marker union', () =>
    Effect.gen(function* () {
      const adapter = yield* PiAiEventAdapter

      const [start, textDelta, toolEnd, done, error] = yield* Effect.all([
        adapter.toProviderMarker({ type: 'start', partial: { role: 'assistant' } }),
        adapter.toProviderMarker({ type: 'text_delta', contentIndex: 0, delta: 'hi', partial: {} }),
        adapter.toProviderMarker({ type: 'toolcall_end', contentIndex: 2, toolCall: { id: 't1', name: 'x' } }),
        adapter.toProviderMarker({ type: 'done', reason: 'stop', message: { ok: true } }),
        adapter.toProviderMarker({ type: 'error', reason: 'error', error: { message: 'boom' } }),
      ])

      expect(start._tag).toBe('provider:marker/start')
      expect(textDelta._tag).toBe('provider:marker/text_delta')
      expect(toolEnd._tag).toBe('provider:marker/toolcall_end')
      expect(done._tag).toBe('provider:marker/done')
      expect(error._tag).toBe('provider:marker/error')
    }).pipe(Effect.provide(PiAiEventAdapterLive)),
  )

  it.effect('captures unknown/invalid markers as provider:marker/unknown', () =>
    Effect.gen(function* () {
      const adapter = yield* PiAiEventAdapter

      const marker = yield* adapter.toProviderMarker({
        type: 'future_provider_event',
        payload: { any: true },
      })

      expect(marker._tag).toBe('provider:marker/unknown')
      if (marker._tag === 'provider:marker/unknown') {
        expect(marker.providerType).toBe('future_provider_event')
      }
    }).pipe(Effect.provide(PiAiEventAdapterLive)),
  )
})
