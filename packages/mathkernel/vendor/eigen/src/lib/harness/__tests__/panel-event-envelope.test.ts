// @vitest-environment node

import { describe, it, expect } from '@effect/vitest'
import { Schema, Either } from 'effect'
import {
  HarnessRemoteEventEnvelope,
  HarnessWsEventEnvelope,
} from '../HarnessBrowserRemoteSchemas'

describe('panel event envelope schema', () => {
  it('decodes remote:panel_event envelope', () => {
    const payload = {
      _tag: 'remote:panel_event',
      event: {
        _tag: 'panel:spawned',
        surfaceId: 'surf-1',
        panelId: 'panel-1',
        title: 'Test',
        mode: 'floating',
      },
    }

    const decoded = Schema.decodeUnknownEither(HarnessRemoteEventEnvelope)(payload)
    expect(Either.isRight(decoded)).toBe(true)
  })

  it('decodes ws event wrapper with panel event', () => {
    const payload = {
      _tag: 'remote:ws_event',
      event: {
        _tag: 'remote:panel_event',
        event: {
          _tag: 'panel:closed',
          panelId: 'panel-1',
        },
      },
    }

    const decoded = Schema.decodeUnknownEither(HarnessWsEventEnvelope)(payload)
    expect(Either.isRight(decoded)).toBe(true)
  })

  it('rejects malformed panel event payload', () => {
    const payload = {
      _tag: 'remote:panel_event',
      event: {
        _tag: 'panel:spawned',
        panelId: 'panel-1',
        // missing surfaceId
      },
    }

    const decoded = Schema.decodeUnknownEither(HarnessRemoteEventEnvelope)(payload)
    expect(Either.isLeft(decoded)).toBe(true)
  })
})
